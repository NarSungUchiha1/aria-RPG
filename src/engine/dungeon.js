const db = require('../database/db');
const enemiesData = require('../data/enemies');
const { calculateMoveDamage } = require('../systems/skillSystem');
const { tickBuffs, getBuffModifiers, consumeShield } = require('../systems/activeBuffs');
const { clearDungeonTimers } = require('./dungeonTimer');

// ✅ Read from env so you never have to touch code to change the group
const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

const dungeonLocks    = new Map();
const autoStartTimers = new Map();

// ── LOBBY TIMER CONFIG ───────────────────────────────────
// After a dungeon spawns, players have this long to enter before it disappears.
const LOBBY_WARN_MS  = 8  * 60 * 1000; //  8 min → warning fires (2 min left to join)
const LOBBY_CLOSE_MS = 10 * 60 * 1000; // 10 min → lobby closes if dungeon never locked
const lobbyTimers = new Map(); // dungeonId -> { warning, timeout }
// ─────────────────────────────────────────────────────────

// ✅ Local normalizeId — strips device suffix for group participant matching
function normalizeId(id) {
    if (!id) return '';
    return id.toString()
        .replace(/@s\.whatsapp\.net|@g\.us|@lid|@c\.us/g, '')
        .split(':')[0]
        .split('@')[0];
}

function clearLobbyTimer(dungeonId) {
    const t = lobbyTimers.get(dungeonId);
    if (t) {
        clearTimeout(t.warning);
        clearTimeout(t.timeout);
        lobbyTimers.delete(dungeonId);
    }
}

// =======================
//  SPAWN DUNGEON
// =======================
// ✅ Weighted rank: higher population ranks spawn more frequently
async function getWeightedDungeonRank() {
    const rankOrder = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
    const [rows] = await db.execute(
        "SELECT `rank`, COUNT(*) as cnt FROM players GROUP BY `rank`"
    );
    if (!rows.length) return 'F';

    const total = rows.reduce((sum, r) => sum + Number(r.cnt), 0);
    const weights = {};
    rankOrder.forEach(r => { weights[r] = 0; });

    for (const row of rows) {
        const idx  = rankOrder.indexOf(row.rank);
        const base = Number(row.cnt) / total;
        weights[row.rank]                      += base * 0.6;
        if (idx > 0)                    weights[rankOrder[idx - 1]] += base * 0.2;
        if (idx < rankOrder.length - 1) weights[rankOrder[idx + 1]] += base * 0.2;
    }

    let cumulative = 0;
    const roll = Math.random();
    for (const rank of rankOrder) {
        cumulative += weights[rank] || 0;
        if (roll <= cumulative) return rank;
    }
    return 'F';
}

async function spawnDungeon(rank, client = null) {
    // ✅ DB-level lock — prevent two spawns running simultaneously
    try {
        await db.execute("INSERT INTO dungeon_spawn_lock (id, locked_at) VALUES (1, NOW())");
    } catch (e) {
        // Lock already held — another spawn is in progress
        console.log('⚠️ Spawn blocked — spawn lock already held.');
        return null;
    }

    try {
    // ── Safety check — never overwrite a dungeon with alive players ──────────
    const [existing] = await db.execute(
        "SELECT id FROM dungeon WHERE is_active=1 ORDER BY id DESC LIMIT 1"
    );
    if (existing.length) {
        const oldId = existing[0].id;
        const [alive] = await db.execute(
            "SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
            [oldId]
        );
        if (alive[0].cnt > 0) {
            console.log(`⚠️ Spawn blocked — dungeon ${oldId} still has ${alive[0].cnt} alive players.`);
            return null;
        }
        if (client) await demoteAllRaiders(client, oldId);
        clearDungeonTimers(oldId);
        clearLobbyTimer(oldId);
        if (autoStartTimers.has(oldId)) {
            clearTimeout(autoStartTimers.get(oldId));
            autoStartTimers.delete(oldId);
        }
        dungeonLocks.delete(oldId);
        // ✅ Scoped DELETE — only wipe players/enemies for the OLD dungeon
        await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [oldId]);
        await db.execute("DELETE FROM dungeon_players WHERE dungeon_id=?", [oldId]);
        await db.execute("DELETE FROM dungeon_enemies WHERE dungeon_id=?", [oldId]);
        console.log(`🧹 Closed dungeon ${oldId}.`);
    }

    const boss     = enemiesData[rank]?.boss?.name || "Unknown Boss";
    const maxStage = { F:3, E:4, D:5, C:6, B:7, A:8, S:10 }[rank] || 3;

    const [result] = await db.execute(
        `INSERT INTO dungeon (dungeon_rank, stage, max_stage, boss_name, is_active, stage_cleared, in_combat, locked)
         VALUES (?, 1, ?, ?, 1, 0, 0, 0)`,
        [rank, maxStage, boss]
    );

    const dungeonId = result.insertId;
    console.log(`🏰 Dungeon ${rank} spawned (id: ${dungeonId}).`);

    if (client) {
        await sendDungeonAnnouncement(client, rank, boss, maxStage);
        startLobbyTimer(dungeonId, client);
    }

        return { id: dungeonId, rank, maxStage, boss };
    } finally {
        // Always release the lock
        await db.execute("DELETE FROM dungeon_spawn_lock WHERE id=1").catch(() => {});
    }
}

// ── LOBBY TIMER ──────────────────────────────────────────
// Warns at 8 min (2 min left), closes at 10 min if dungeon never locked.
function startLobbyTimer(dungeonId, client) {
    clearLobbyTimer(dungeonId);

    const warning = setTimeout(async () => {
        try {
            await client.sendMessage(RAID_GROUP, {
                text:
                    `══〘 ⚠️ DUNGEON CLOSING SOON 〙══╮\n` +
                    `┃◆ The dungeon portal is destabilizing!\n` +
                    `┃◆ ⏳ 2 minutes left to enter.\n` +
                    `┃◆ DM the bot !enter now or miss out!\n` +
                    `┃◆ No entry = no rewards.\n` +
                    `╰═══════════════════════╯`
            });
        } catch (e) {}
    }, LOBBY_WARN_MS);

    const timeout = setTimeout(async () => {
        try {
            // Only close if dungeon hasn't started yet
            const [rows] = await db.execute(
                "SELECT id FROM dungeon WHERE id=? AND is_active=1 AND locked=0 ORDER BY id DESC LIMIT 1",
                [dungeonId]
            );
            if (rows.length) {
                // Cancel auto-start timer if one was running
                if (autoStartTimers.has(dungeonId)) {
                    clearTimeout(autoStartTimers.get(dungeonId));
                    autoStartTimers.delete(dungeonId);
                }
                await db.execute("UPDATE dungeon SET is_active=0 WHERE id=?", [dungeonId]);
                await client.sendMessage(RAID_GROUP, {
                    text:
                        `══〘 🚪 DUNGEON EXPIRED 〙══╮\n` +
                        `┃◆ The dungeon portal has collapsed.\n` +
                        `┃◆ No raid was formed in time.\n` +
                        `┃◆ Watch for the next announcement!\n` +
                        `╰═══════════════════════╯`
                });
                console.log(`🚪 Dungeon ${dungeonId} expired — no one started in time.`);
            }
        } catch (e) {
            console.error("Lobby timeout error:", e.message);
        }
        lobbyTimers.delete(dungeonId);
    }, LOBBY_CLOSE_MS);

    lobbyTimers.set(dungeonId, { warning, timeout });
}

async function sendDungeonAnnouncement(client, rank, boss, maxStage) {
    let mentions = [];
    try {
        const { tagAll } = require('../utils/tagAll');
        const result = await tagAll(client);
        mentions = result.mentions || [];
    } catch (e) {
        console.log('tagAll unavailable — sending announcement without mentions.');
    }

    // ✅ Lore flavour text based on current chapter
    let loreText = '';
    try {
        const { getCurrentChapter, getRandomDungeonLore } = require('../systems/loreSystem');
        const chapter = await getCurrentChapter();
        loreText = `┃◆ 〝${getRandomDungeonLore(chapter)}〞\n┃◆ \n`;
    } catch (e) {}

    // ✅ Void War context if active
    let warText = '';
    try {
        const { getActiveWar } = require('../systems/voidwar');
        const war = await getActiveWar();
        if (war) {
            const pct = Math.min(100, Math.floor((war.total_damage / war.goal) * 100));
            const filled = Math.floor(pct / 10);
            const bar = '🟥'.repeat(filled) + '⬛'.repeat(10 - filled);
            warText =
                `┃◆ ━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ ⚡ VOID WAR ACTIVE\n` +
                `┃◆ ${bar} ${pct}%\n` +
                `┃◆ Clear this to wound the Leviathan!\n` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ \n`;
        }
    } catch(e) {}

    const announceMsg =
        `╭══〘 📢 DUNGEON OPENED 〙══╮\n` +
        `┃◆ \n` +
        `${loreText}` +
        `${warText}` +
        `┃◆   Rank: ${rank}\n` +
        `┃◆   Max Stage: ${maxStage}\n` +
        `┃◆   Boss: ${boss}\n` +
        `┃◆   Max Raiders: ${{ F:3, E:3, D:4, C:4, B:5, A:5, S:5 }[rank] || 3}\n` +
        `┃◆ \n` +
        `┃◆   DM the bot: !enter to join!\n` +
        `┃◆   ⏳ Portal closes in 10 minutes.\n` +
        `┃◆ \n` +
        `╰═══════════════════════════╯`;

    try {
        const { sendWithRetry } = require('../utils/sendWithRetry');
        await sendWithRetry(client, RAID_GROUP, { text: announceMsg, mentions });
        console.log(`📢 Dungeon announcement sent to group`);
    } catch (e) {
        console.error("Dungeon announcement failed:", e.message);
    }
}

// =======================
//  PROMOTE / DEMOTE RAIDERS
// =======================

// ✅ Fixed: fetch group metadata to get exact Baileys JID (includes :device suffix)
async function promoteRaider(client, userId) {
    try {
        const metadata    = await client.groupMetadata(RAID_GROUP);
        const participant = metadata.participants.find(p => normalizeId(p.id) === userId);
        if (!participant) {
            console.error(`⚠️ Promote failed: ${userId} not found in dungeon group`);
            return;
        }
        await client.groupParticipantsUpdate(RAID_GROUP, [participant.id], 'promote');
        console.log(`👑 Promoted ${userId} to admin`);
    } catch (e) {
        console.error(`Failed to promote ${userId}:`, e.message);
    }
}

async function demoteRaider(client, userId) {
    try {
        const metadata    = await client.groupMetadata(RAID_GROUP);
        const participant = metadata.participants.find(p => normalizeId(p.id) === userId);
        if (!participant) return;
        await client.groupParticipantsUpdate(RAID_GROUP, [participant.id], 'demote');
        console.log(`👇 Demoted ${userId} from admin`);
    } catch (e) {
        console.error(`Failed to demote ${userId}:`, e.message);
    }
}

async function demoteAllRaiders(client, dungeonId) {
    try {
        const [players] = await db.execute(
            "SELECT player_id FROM dungeon_players WHERE dungeon_id=?",
            [dungeonId]
        );
        for (const p of players) {
            await demoteRaider(client, p.player_id);
        }
        console.log(`👇 All raiders demoted for dungeon ${dungeonId}`);
    } catch (e) {
        console.error("Failed to demote all raiders:", e.message);
    }
}

// =======================
//  ACTIVE DUNGEON
// =======================
async function getActiveDungeon() {
    const [rows] = await db.execute("SELECT * FROM dungeon WHERE is_active=1 ORDER BY id DESC LIMIT 1");
    return rows[0] || null;
}

function isDungeonLocked(dungeonId) {
    return dungeonLocks.get(dungeonId) || false;
}

// ✅ DB-backed version used by enter.js — reliable across restarts
async function isDungeonLockedDB(dungeonId) {
    if (dungeonLocks.get(dungeonId)) return true;
    const [rows] = await db.execute(
        "SELECT locked FROM dungeon WHERE id=? AND is_active=1",
        [dungeonId]
    );
    const locked = rows[0]?.locked === 1;
    if (locked) dungeonLocks.set(dungeonId, true); // Restore to memory
    return locked;
}

async function lockDungeon(dungeonId) {
    dungeonLocks.set(dungeonId, true);
    clearLobbyTimer(dungeonId); // ✅ dungeon started — cancel the lobby expiry
    await db.execute("UPDATE dungeon SET locked=1 WHERE id=?", [dungeonId]);
}

async function getMaxStageForDungeon(dungeonId) {
    const [rows] = await db.execute("SELECT max_stage FROM dungeon WHERE id=?", [dungeonId]);
    return rows[0].max_stage;
}

// =======================
//  ENEMY MANAGEMENT
// =======================
async function spawnStageEnemies(dungeonId, rank, stage) {
    const data = enemiesData[rank];
    if (!data) return;

    // Check if event OR Void War is active for boosted spawns
    let isEvent = false;
    let isVoidWar = false;
    try {
        const [eventRows] = await db.execute(
            "SELECT id FROM events WHERE is_active=1 AND ends_at > NOW() LIMIT 1"
        );
        isEvent = eventRows.length > 0;
    } catch (e) { isEvent = false; }

    try {
        const [warRows] = await db.execute(
            "SELECT id FROM void_war WHERE is_active=1 AND ends_at > NOW() LIMIT 1"
        );
        isVoidWar = warRows.length > 0;
    } catch (e) { isVoidWar = false; }

    const isBoosted = isEvent || isVoidWar;

    const isBoss = (stage === (await getMaxStageForDungeon(dungeonId)));
    let enemiesToSpawn = [];

    if (isBoss) {
        const boss = { ...data.boss };
        if (isBoosted) {
            // Void War boss — massively empowered
            const hpMult  = isVoidWar ? 3.5 : 2.0;
            const atkMult = isVoidWar ? 2.5 : 1.5;
            boss.hp   = Math.floor(boss.hp  * hpMult);
            boss.atk  = Math.floor(boss.atk * atkMult);
            boss.def  = Math.floor((boss.def || 5) * 1.8);
            boss.exp  = Math.floor(boss.exp  * 2.0);
            boss.gold = Math.floor(boss.gold * 2.0);
            boss.name = isVoidWar ? `Void-Corrupted ${boss.name}` : `Void-Touched ${boss.name}`;
        }
        enemiesToSpawn = [boss];
    } else {
        // Normal: 1–5. Event: 5–8. Void War: 6–10
        let count;
        if (isVoidWar) {
            count = Math.floor(Math.random() * 5) + 6; // 6-10
        } else if (isEvent) {
            count = Math.floor(Math.random() * 4) + 5; // 5-8
        } else {
            count = Math.floor(Math.random() * 5) + 1; // 1-5
        }

        for (let i = 0; i < count; i++) {
            const template = { ...data.miniBosses[Math.floor(Math.random() * data.miniBosses.length)] };
            if (isVoidWar) {
                // Void War mini-bosses — heavily boosted
                template.hp   = Math.floor(template.hp  * 2.5);
                template.atk  = Math.floor(template.atk * 2.0);
                template.def  = Math.floor((template.def || 2) * 1.5);
                template.exp  = Math.floor(template.exp * 1.8);
                template.gold = Math.floor(template.gold * 1.8);
                template.name = `Void-Corrupted ${template.name}`;
            } else if (isEvent) {
                template.hp  = Math.floor(template.hp  * 1.3);
                template.atk = Math.floor(template.atk * 1.2);
            }
            enemiesToSpawn.push(template);
        }
    }

    for (const e of enemiesToSpawn) {
        const name  = e.name  || 'Unknown Enemy';
        const hp    = Number(e.hp)   || 50;
        const atk   = Number(e.atk)  || 5;
        const def   = Number(e.def)  || 2;
        const exp   = Number(e.exp)  || 10;
        const gold  = Number(e.gold) || 5;
        const moves = e.moves
            ? JSON.stringify(e.moves)
            : JSON.stringify([{ name: 'Attack', damage: 1.0 }]);

        await db.execute(
            `INSERT INTO dungeon_enemies (dungeon_id, name, max_hp, current_hp, atk, def, exp, gold, moves)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dungeonId, name, hp, hp, atk, def, exp, gold, moves]
        );
    }
}

async function getCurrentEnemies(dungeonId) {
    const [rows] = await db.execute(
        "SELECT * FROM dungeon_enemies WHERE dungeon_id=? AND current_hp > 0",
        [dungeonId]
    );
    return rows;
}

// =======================
//  COMBAT CALCULATIONS
// =======================
function calculatePlayerDamage(player, enemy, weaponBonus = 0) {
    const enemyDef   = Number(enemy.def) || 0;
    const reduction  = Math.min(0.5, enemyDef / 100);
    const baseAttack = (Number(player.strength) || 0) + Math.floor((Number(weaponBonus) || 0) * 0.5);
    return Math.max(1, Math.floor(baseAttack * (1 - reduction)));
}

function calculateEnemyRetaliation(enemy, player) {
    let buffMods = { defense: 0, shield: 0 };
    try {
        if (player?.id) {
            const mods = getBuffModifiers('player', player.id);
            if (mods) buffMods = mods;
        }
    } catch (e) {}

    const playerDef    = Number(buffMods.defense) || 0;
    const reduction    = Math.min(0.5, playerDef / 100);
    const rawDamage    = Number(enemy.atk) || 0;
    let damage         = Math.floor(rawDamage * (1 - reduction));
    const playerShield = Number(buffMods.shield) || 0;
    let shieldAbsorbed = 0;

    if (playerShield > 0) {
        shieldAbsorbed = Math.min(damage, playerShield);
        damage -= shieldAbsorbed;
    }

    return { damage, shieldAbsorbed, defenseBlocked: Math.floor(rawDamage * reduction) };
}

function evasionCheck(player, enemy) {
    const evadeChance = Math.min(0.3, (Number(player.agility) || 0) / 100);
    return Math.random() < evadeChance;
}

// =======================
//  COMBAT ACTIONS
// =======================
async function playerAttack(playerId, dungeonId, enemyId, weaponBonus) {
    const [player] = await db.execute("SELECT * FROM players WHERE id=?", [playerId]);
    const [enemy]  = await db.execute("SELECT * FROM dungeon_enemies WHERE id=?", [enemyId]);
    const p = player[0];
    const e = enemy[0];

    let evaded = false;
    let damage = calculatePlayerDamage(p, e, weaponBonus);
    if (evasionCheck(p, e)) { damage = Math.floor(damage * 0.5); evaded = true; }

    await db.execute("UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?", [damage, enemyId]);
    const [updatedEnemy] = await db.execute("SELECT * FROM dungeon_enemies WHERE id=?", [enemyId]);
    const defeated = updatedEnemy[0].current_hp <= 0;

    let exp = 0, gold = 0, rewardDistribution = null;
    if (defeated) {
        const result = await distributeEnemyRewards(dungeonId, enemyId);
        rewardDistribution = result;
        exp  = result.contributors.find(c => c.playerId === playerId)?.exp  || 0;
        gold = result.contributors.find(c => c.playerId === playerId)?.gold || 0;
    }

    let retaliation = 0, playerHp = Number(p.hp), retaliationMessage = '';
    let shieldAbsorbed = 0, defenseBlocked = 0;
    if (!defeated) {
        const ret = calculateEnemyRetaliation(e, p);
        retaliation    = ret.damage;
        shieldAbsorbed = ret.shieldAbsorbed;
        defenseBlocked = ret.defenseBlocked;
        if (shieldAbsorbed > 0) consumeShield('player', playerId, shieldAbsorbed);
        await db.execute("UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?", [retaliation, playerId]);
        const [pUp] = await db.execute("SELECT hp FROM players WHERE id=?", [playerId]);
        playerHp = Number(pUp[0].hp);
        retaliationMessage = `⚡ ${e.name} retaliates with ${e.moves?.[0]?.name || 'a vicious strike'}!`;
        if (defenseBlocked  > 0) retaliationMessage += ` 🛡️ Blocked ${defenseBlocked}.`;
        if (shieldAbsorbed  > 0) retaliationMessage += ` 🛡️ Shield absorbed ${shieldAbsorbed}.`;
    }

    const [rem] = await db.execute(
        "SELECT COUNT(*) as cnt FROM dungeon_enemies WHERE dungeon_id=? AND current_hp > 0", [dungeonId]
    );
    if (rem[0].cnt === 0) await db.execute("UPDATE dungeon SET stage_cleared=1 WHERE id=?", [dungeonId]);

    // ✅ If player died from retaliation, mark them dead in dungeon
    const playerDied = playerHp <= 0;
    if (playerDied) {
        await db.execute(
            "UPDATE dungeon_players SET is_alive=0 WHERE player_id=? AND dungeon_id=?",
            [playerId, dungeonId]
        );
    }

    tickBuffs('player', playerId);

    return {
        enemyDefeated: defeated,
        enemyHp: defeated ? 0 : Number(updatedEnemy[0].current_hp),
        damage, exp, gold, rewardDistribution,
        retaliation, playerHp, playerDied, retaliationMessage,
        enemyName: e.name, enemyMaxHp: Number(e.max_hp), evaded
    };
}

async function playerSkill(playerId, dungeonId, enemyId, move, player, equippedItems) {
    const [enemy] = await db.execute("SELECT * FROM dungeon_enemies WHERE id=?", [enemyId]);
    const p = player;
    const e = enemy[0];

    let evaded = false;
    let damage = calculateMoveDamage(p, move, e, equippedItems);
    if (move.stat !== 'intelligence' && evasionCheck(p, e)) { damage = Math.floor(damage * 0.5); evaded = true; }

    await db.execute("UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?", [damage, enemyId]);
    const [updatedEnemy] = await db.execute("SELECT * FROM dungeon_enemies WHERE id=?", [enemyId]);
    const defeated = updatedEnemy[0].current_hp <= 0;

    let exp = 0, gold = 0, rewardDistribution = null;
    if (defeated) {
        const result = await distributeEnemyRewards(dungeonId, enemyId);
        rewardDistribution = result;
        exp  = result.contributors.find(c => c.playerId === playerId)?.exp  || 0;
        gold = result.contributors.find(c => c.playerId === playerId)?.gold || 0;
    }

    let retaliation = 0, playerHp = Number(p.hp), retaliationMessage = '';
    let shieldAbsorbed = 0, defenseBlocked = 0;
    if (!defeated) {
        const ret = calculateEnemyRetaliation(e, p);
        retaliation    = ret.damage;
        shieldAbsorbed = ret.shieldAbsorbed;
        defenseBlocked = ret.defenseBlocked;
        if (shieldAbsorbed > 0) consumeShield('player', playerId, shieldAbsorbed);
        await db.execute("UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?", [retaliation, playerId]);
        const [pUp] = await db.execute("SELECT hp FROM players WHERE id=?", [playerId]);
        playerHp = Number(pUp[0].hp);
        retaliationMessage = `⚡ ${e.name} retaliates with ${e.moves?.[0]?.name || 'a vicious strike'}!`;
        if (defenseBlocked  > 0) retaliationMessage += ` 🛡️ Blocked ${defenseBlocked}.`;
        if (shieldAbsorbed  > 0) retaliationMessage += ` 🛡️ Shield absorbed ${shieldAbsorbed}.`;
    }

    const [rem] = await db.execute(
        "SELECT COUNT(*) as cnt FROM dungeon_enemies WHERE dungeon_id=? AND current_hp > 0", [dungeonId]
    );
    if (rem[0].cnt === 0) await db.execute("UPDATE dungeon SET stage_cleared=1 WHERE id=?", [dungeonId]);

    // ✅ If player died from retaliation, mark them dead in dungeon
    const playerDied = playerHp <= 0;
    if (playerDied) {
        await db.execute(
            "UPDATE dungeon_players SET is_alive=0 WHERE player_id=? AND dungeon_id=?",
            [playerId, dungeonId]
        );
    }

    tickBuffs('player', playerId);

    return {
        damage, defeated, exp, gold, rewardDistribution,
        retaliation, playerHp, playerDied, retaliationMessage,
        enemyHp: defeated ? 0 : Number(updatedEnemy[0].current_hp),
        enemyMaxHp: Number(e.max_hp), enemyName: e.name, evaded
    };
}

// =======================
//  REWARD DISTRIBUTION
// =======================
async function distributeEnemyRewards(dungeonId, enemyId) {
    const [enemy] = await db.execute("SELECT exp, gold, name FROM dungeon_enemies WHERE id=?", [enemyId]);
    if (!enemy.length) return { contributors: [] };

    const totalExp  = Number(enemy[0].exp);
    const totalGold = Number(enemy[0].gold);

    const [contributors] = await db.execute(
        "SELECT player_id, damage_dealt FROM dungeon_damage WHERE dungeon_id=? AND enemy_id=?",
        [dungeonId, enemyId]
    );
    if (contributors.length === 0) return { contributors: [] };

    const totalDamage = contributors.reduce((sum, c) => sum + Number(c.damage_dealt), 0);
    const rewards = [];

    for (const c of contributors) {
        const share      = totalDamage > 0 ? Number(c.damage_dealt) / totalDamage : 0;
        const expEarned  = Math.floor(totalExp  * share);
        const goldEarned = Math.floor(totalGold * share);

        await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?",          [expEarned,  c.player_id]);
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [goldEarned, c.player_id]);

        const [pl] = await db.execute("SELECT nickname FROM players WHERE id=?", [c.player_id]);
        rewards.push({
            playerId: c.player_id,
            nickname: pl[0].nickname,
            damage:   Number(c.damage_dealt),
            exp:      expEarned,
            gold:     goldEarned
        });
    }

    await db.execute("DELETE FROM dungeon_damage WHERE dungeon_id=? AND enemy_id=?", [dungeonId, enemyId]);
    return { enemyName: enemy[0].name, contributors: rewards };
}

async function addDamageContribution(dungeonId, enemyId, playerId, damage) {
    await db.execute(
        `INSERT INTO dungeon_damage (dungeon_id, enemy_id, player_id, damage_dealt)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE damage_dealt = damage_dealt + ?`,
        [dungeonId, enemyId, playerId, damage, damage]
    );
}

// =======================
//  STAGE PROGRESSION
// =======================
async function advanceStage(dungeonId, nextStage) {
    await db.execute("UPDATE dungeon SET stage=?, stage_cleared=0 WHERE id=?", [nextStage, dungeonId]);
    const [dungeon] = await db.execute("SELECT dungeon_rank FROM dungeon WHERE id=?", [dungeonId]);
    await spawnStageEnemies(dungeonId, dungeon[0].dungeon_rank, nextStage);
}

// =======================
//  PLAYER DUNGEON ACTIONS
// =======================
async function addPlayerToDungeon(playerId, dungeonId) {
    await db.execute(
        "INSERT INTO dungeon_players (player_id, dungeon_id, is_alive) VALUES (?, ?, 1)",
        [playerId, dungeonId]
    );
}

async function removePlayerFromDungeon(playerId, dungeonId) {
    await db.execute(
        "DELETE FROM dungeon_players WHERE player_id=? AND dungeon_id=?",
        [playerId, dungeonId]
    );
    await checkAndCloseEmptyDungeon(dungeonId);
}

async function isPlayerInDungeon(playerId, dungeonId) {
    const [rows] = await db.execute(
        "SELECT * FROM dungeon_players WHERE player_id=? AND dungeon_id=? AND is_alive=1",
        [playerId, dungeonId]
    );
    return rows.length > 0;
}

async function checkAndCloseEmptyDungeon(dungeonId, client = null) {
    const [rows] = await db.execute(
        "SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
        [dungeonId]
    );
    if (rows[0].cnt === 0) {
        if (client) await demoteAllRaiders(client, dungeonId);
        await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [dungeonId]);
        dungeonLocks.delete(dungeonId);
        clearDungeonTimers(dungeonId);
        clearLobbyTimer(dungeonId);
        if (autoStartTimers.has(dungeonId)) {
            clearTimeout(autoStartTimers.get(dungeonId));
            autoStartTimers.delete(dungeonId);
        }
        console.log(`🏰 Dungeon ${dungeonId} closed (empty).`);
        return true;
    }
    return false;
}

async function isPlayerInAnyDungeon(playerId) {
    const [rows] = await db.execute(
        "SELECT dungeon_id FROM dungeon_players WHERE player_id=? AND is_alive=1",
        [playerId]
    );
    return rows.length ? rows[0].dungeon_id : null;
}

// =======================
//  TARGETING HELPERS
// =======================
async function findEnemyTarget(dungeonId, targetArg) {
    const enemies = await getCurrentEnemies(dungeonId);
    if (!enemies.length) return null;
    const index = parseInt(targetArg) - 1;
    if (!isNaN(index) && index >= 0 && index < enemies.length) return enemies[index];
    const search = targetArg.toLowerCase();
    return enemies.find(e => e.name.toLowerCase().includes(search)) || null;
}

async function findPlayerTarget(dungeonId, targetArg) {
    if (targetArg.startsWith('@')) {
        const number = targetArg.substring(1).replace(/\D/g, '');
        if (number) {
            const [rows] = await db.execute(
                `SELECT p.* FROM players p JOIN dungeon_players dp ON p.id = dp.player_id
                 WHERE dp.dungeon_id = ? AND p.id LIKE ? AND dp.is_alive = 1`,
                [dungeonId, `%${number}%`]
            );
            return rows[0] || null;
        }
    }
    const [rows] = await db.execute(
        `SELECT p.* FROM players p JOIN dungeon_players dp ON p.id = dp.player_id
         WHERE dp.dungeon_id = ? AND p.nickname = ? AND dp.is_alive = 1`,
        [dungeonId, targetArg]
    );
    if (rows.length) return rows[0];
    const [rows2] = await db.execute(
        `SELECT p.* FROM players p JOIN dungeon_players dp ON p.id = dp.player_id
         WHERE dp.dungeon_id = ? AND p.id = ? AND dp.is_alive = 1`,
        [dungeonId, targetArg]
    );
    return rows2[0] || null;
}

// =======================
//  STATUS DISPLAY
// =======================

// Sent as the SECOND message when combat begins — shows full enemy stats
async function getDungeonEnemyRevealText(dungeonId) {
    const [dungeon] = await db.execute("SELECT * FROM dungeon WHERE id=?", [dungeonId]);
    if (!dungeon.length) return null;
    const d = dungeon[0];
    const enemies = await getCurrentEnemies(dungeonId);

    let text = `══〘 👾 ENEMIES REVEALED 〙══╮\n`;
    text += `┃◆ Rank: ${d.dungeon_rank}  •  Stage: ${d.stage}/${d.max_stage}\n`;
    text += `┃◆────────────\n`;

    enemies.forEach((e, i) => {
        // Parse moves JSON safely
        let moveNames = '—';
        try {
            const parsed = typeof e.moves === 'string' ? JSON.parse(e.moves) : e.moves;
            if (Array.isArray(parsed) && parsed.length) {
                moveNames = parsed.map(m => m.name).join(', ');
            }
        } catch (_) {}

        text += `┃◆ ${i + 1}. ${e.name}\n`;
        text += `┃◆    ❤️ HP:  ${e.current_hp}/${e.max_hp}\n`;
        text += `┃◆    ⚔️ ATK: ${e.atk}\n`;
        text += `┃◆    🛡️ DEF: ${e.def}\n`;
        text += `┃◆    🗡️ Moves: ${moveNames}\n`;
        if (i < enemies.length - 1) text += `┃◆────────────\n`;
    });

    text += `┃◆────────────\n`;
    text += `┃◆ 🧭 !skill <move> [enemy #]\n`;
    text += `╰═══════════════════════╯`;
    return text;
}

async function getDungeonStatusText(dungeonId) {
    const [dungeon] = await db.execute("SELECT * FROM dungeon WHERE id=?", [dungeonId]);
    if (!dungeon.length) return "Dungeon not found.";
    const d = dungeon[0];
    const enemies = await getCurrentEnemies(dungeonId);
    let text = `══〘 🏰 DUNGEON STATUS 〙══╮\n`;
    text += `┃◆ Rank: ${d.dungeon_rank}  •  Stage: ${d.stage}/${d.max_stage}\n`;
    text += `┃◆ Locked: ${d.locked ? '🔒 YES' : '🔓 NO'}\n`;
    text += `┃◆────────────\n`;
    if (enemies.length === 0) {
        text += `┃◆ ✅ All enemies defeated!\n`;
        text += `┃◆ 🧭 Use !onward to advance\n`;
    } else {
        text += `┃◆ 👾 ENEMIES:\n`;
        enemies.forEach((e, i) => {
            text += `┃◆   ${i+1}. ${e.name} (${e.current_hp}/${e.max_hp} HP)\n`;
        });
    }
    text += `┃◆────────────\n┃◆ 🧭 !skill <move> [target]\n╰═══════════════════════╯`;
    return text;
}

module.exports = {
    RAID_GROUP,
    spawnDungeon,
    getWeightedDungeonRank,
    getActiveDungeon,
    isPlayerInDungeon,
    addPlayerToDungeon,
    removePlayerFromDungeon,
    lockDungeon,
    isDungeonLocked,
    isDungeonLockedDB,
    spawnStageEnemies,
    getCurrentEnemies,
    playerAttack,
    playerSkill,
    advanceStage,
    getMaxStageForDungeon,
    findEnemyTarget,
    findPlayerTarget,
    getDungeonStatusText,
    getDungeonEnemyRevealText,
    checkAndCloseEmptyDungeon,
    isPlayerInAnyDungeon,
    addDamageContribution,
    distributeEnemyRewards,
    promoteRaider,
    demoteRaider,
    demoteAllRaiders,
    autoStartTimers,
    clearLobbyTimer,
    dungeonLocks
};