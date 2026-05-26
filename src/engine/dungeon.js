const db = require('../database/db');
const enemiesData = require('../data/enemies');
const { calculateMoveDamage } = require('../systems/skillSystem');
const { getFatigueMultiplier, increasePlayerFatigue, calculateFatigueGain } = require('../systems/fatigueSystem');
const { tickBuffs, getBuffModifiers, consumeShield } = require('../systems/activeBuffs');
const { clearDungeonTimers } = require('./dungeonTimer');
const { clearPrestigeLobbyTimer } = require('./prestigeDungeon');
const { trySpawnPrestigeDungeon } = require('./prestigeDungeon');
const { getEffect, clearEffect, trackDeath, trackHpLost, getTurnEffect } = require('../systems/potionEffects');
const { initMvpTracking, recordDamage: mvpRecordDmg } = require('../systems/mvpSystem');
const { updateClanQuestProgress } = require('../systems/clanQuestTracker');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

const dungeonLocks    = new Map();
const autoStartTimers = new Map();

const LOBBY_WARN_MS  = 8  * 60 * 1000;
const LOBBY_CLOSE_MS = 10 * 60 * 1000;
const lobbyTimers = new Map();

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

// MVP helpers removed — calculateMvp is called directly in onward.js at dungeon clear

async function getWeightedDungeonRank() {
    const rankOrder = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
    const [rows] = await db.execute(
        "SELECT `rank`, COUNT(*) as cnt FROM players GROUP BY `rank`"
    );
    if (!rows.length) return 'F';

    const total = rows.reduce((sum, r) => sum + Number(r.cnt), 0);
    const weights = {};
    rankOrder.forEach(r => { weights[r] = 0; });

    const floorWeights = { F: 0.05, E: 0.08, D: 0.15, C: 0.18, B: 0.20, A: 0.18, S: 0.16 };
    rankOrder.forEach(r => { weights[r] = floorWeights[r] || 0.05; });

    for (const row of rows) {
        const idx  = rankOrder.indexOf(row.rank);
        const base = (Number(row.cnt) / total) * 0.5;
        weights[row.rank]                      += base * 0.6;
        if (idx > 0)                    weights[rankOrder[idx - 1]] += base * 0.2;
        if (idx < rankOrder.length - 1) weights[rankOrder[idx + 1]] += base * 0.2;
    }

    const weightSum = rankOrder.reduce((s, r) => s + weights[r], 0);
    rankOrder.forEach(r => { weights[r] /= weightSum; });

    let cumulative = 0;
    const roll = Math.random();
    for (const rank of rankOrder) {
        cumulative += weights[rank] || 0;
        if (roll <= cumulative) return rank;
    }
    return 'F';
}

async function spawnDungeon(rank, client = null) {
    try {
        // FIX: Territory dungeons run independently — don't block normal spawns
        const [activePlayers] = await db.execute(
            "SELECT COUNT(*) as cnt FROM dungeon_players dp JOIN dungeon d ON d.id=dp.dungeon_id WHERE d.is_active=1 AND dp.is_alive=1 AND d.dungeon_rank NOT LIKE 'TERRITORY_%'"
        );
        if (activePlayers[0].cnt > 0) {
            console.log('⏭️ Spawn skipped — players still active in a dungeon');
            return null;
        }
    } catch(e) {}

    try {
        await db.execute("INSERT INTO dungeon_spawn_lock (id, locked_at) VALUES (1, NOW())");
    } catch (e) {
        console.log('⚠️ Spawn blocked — spawn lock already held.');
        return null;
    }

    try {
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
            await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [oldId]);
            await db.execute("DELETE FROM dungeon_players WHERE dungeon_id=?", [oldId]);
            await db.execute("DELETE FROM dungeon_enemies WHERE dungeon_id=?", [oldId]);
            console.log(`🧹 Closed dungeon ${oldId}.`);
        }

        const boss     = enemiesData[rank]?.boss?.name || "Unknown Boss";
        const maxStage = { F:3, E:4, D:5, C:6, B:7, A:8, S:10, MALACHAR:6 }[rank] || 3;

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
        await db.execute("DELETE FROM dungeon_spawn_lock WHERE id=1").catch(() => {});
    }
}

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
            const [rows] = await db.execute(
                "SELECT id FROM dungeon WHERE id=? AND is_active=1 AND locked=0 ORDER BY id DESC LIMIT 1",
                [dungeonId]
            );
            if (rows.length) {
                const [playersInside] = await db.execute(
                    "SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                    [dungeonId]
                );
                if (playersInside[0].cnt > 0) {
                    console.log(`🚪 Dungeon ${dungeonId} lobby timer fired but ${playersInside[0].cnt} players inside — keeping active.`);
                    lobbyTimers.delete(dungeonId);
                    return;
                }
                if (autoStartTimers.has(dungeonId)) {
                    clearTimeout(autoStartTimers.get(dungeonId));
                    autoStartTimers.delete(dungeonId);
                }
                const [updateResult] = await db.execute(
                    "UPDATE dungeon SET is_active=0 WHERE id=? AND is_active=1 AND locked=0",
                    [dungeonId]
                );
                if (updateResult.affectedRows === 0) {
                    console.log(`🚪 Dungeon ${dungeonId} lobby expiry skipped — already locked or closed.`);
                    lobbyTimers.delete(dungeonId);
                    return;
                }
                await client.sendMessage(RAID_GROUP, {
                    text:
                        `══〘 🚪 DUNGEON EXPIRED 〙══╮\n` +
                        `┃◆ The dungeon portal has collapsed.\n` +
                        `┃◆ No raid was formed in time.\n` +
                        `┃◆ Watch for the next announcement!\n` +
                        `╰═══════════════════════╯`
                });
                console.log(`🚪 Dungeon ${dungeonId} expired — no one started in time.`);
                const [expRank] = await db.execute('SELECT dungeon_rank FROM dungeon WHERE id=?', [dungeonId]).catch(() => [[{}]]);
                if (!expRank[0]?.dungeon_rank?.startsWith('P')) {
                    trySpawnPrestigeDungeon(client, RAID_GROUP).catch(e => console.error('★ Prestige spawn error:', e.message));
                }
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

    let loreText = '';
    try {
        const { getCurrentChapter, getRandomDungeonLore } = require('../systems/loreSystem');
        const chapter = await getCurrentChapter();
        loreText = `┃◆ 〝${getRandomDungeonLore(chapter)}〞\n┃◆ \n`;
    } catch (e) {}

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

    const MAX_RAIDERS_MAP = { F:3, E:3, D:4, C:4, B:5, A:5, S:5 };
    const announceMsg =
        `╭══〘 📢 DUNGEON OPENED 〙══╮\n` +
        `┃◆ \n` +
        `${loreText}` +
        `${warText}` +
        `┃◆   Rank: ${rank}\n` +
        `┃◆   Max Stage: ${maxStage}\n` +
        `┃◆   Boss: ${boss}\n` +
        `┃◆   Max Raiders: ${MAX_RAIDERS_MAP[rank] || 3}\n` +
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

async function getActiveDungeon(includeTerritory = false) {
    const [rows] = await db.execute(
        includeTerritory
            ? "SELECT * FROM dungeon WHERE is_active=1 ORDER BY id DESC LIMIT 1"
            : "SELECT * FROM dungeon WHERE is_active=1 AND dungeon_rank NOT LIKE 'TERRITORY_%' ORDER BY id DESC LIMIT 1"
    );
    return rows[0] || null;
}

function isDungeonLocked(dungeonId) {
    return dungeonLocks.get(dungeonId) || false;
}

async function isDungeonLockedDB(dungeonId) {
    if (dungeonLocks.get(dungeonId)) return true;
    const [rows] = await db.execute(
        "SELECT locked FROM dungeon WHERE id=? AND is_active=1",
        [dungeonId]
    );
    const locked = rows[0]?.locked === 1;
    if (locked) dungeonLocks.set(dungeonId, true);
    return locked;
}

async function ensureSessionColumns() {
    await db.execute('ALTER TABLE dungeon_players ADD COLUMN IF NOT EXISTS session_gold INT DEFAULT 0').catch(() => {});
    await db.execute('ALTER TABLE dungeon_players ADD COLUMN IF NOT EXISTS session_xp INT DEFAULT 0').catch(() => {});
}

async function lockDungeon(dungeonId) {
    clearPrestigeLobbyTimer(dungeonId);
    dungeonLocks.set(dungeonId, true);
    clearLobbyTimer(dungeonId);
    await db.execute("UPDATE dungeon SET locked=1 WHERE id=?", [dungeonId]);

    try {
        const [players] = await db.execute("SELECT player_id FROM dungeon_players WHERE dungeon_id=?", [dungeonId]);
        const ids = players.map(p => p.player_id);
        initMvpTracking(`dungeon_${dungeonId}`, ids);

        for (const p of players) {
            await db.execute(
                `INSERT INTO clan_blessing_state (player_id, dungeon_id, blessing_used, last_triggered, hit_count, skill_count, invincible, damage_boost)
                 VALUES (?, ?, 0, NULL, 0, 0, 0, 0)
                 ON DUPLICATE KEY UPDATE blessing_used=0, last_triggered=NULL, hit_count=0, skill_count=0, invincible=0, damage_boost=0`,
                [p.player_id, dungeonId]
            );
        }
    } catch(e) { console.error('Lock init error:', e.message); }
}

async function getMaxStageForDungeon(dungeonId) {
    const [rows] = await db.execute("SELECT max_stage FROM dungeon WHERE id=?", [dungeonId]);
    // FIX: guard against missing row
    if (!rows.length) throw new Error(`Dungeon ${dungeonId} not found in getMaxStageForDungeon`);
    return rows[0].max_stage;
}

async function spawnStageEnemies(dungeonId, rank, stage) {
    const data = enemiesData[rank];
    if (!data) return;

    let isEvent = false;
    let isVoidWar = false;
    try {
        const [eventRows] = await db.execute("SELECT id FROM events WHERE is_active=1 AND ends_at > NOW() LIMIT 1");
        isEvent = eventRows.length > 0;
    } catch (e) { isEvent = false; }

    try {
        const [warRows] = await db.execute("SELECT id FROM void_war WHERE is_active=1 AND ends_at > NOW() LIMIT 1");
        isVoidWar = warRows.length > 0;
    } catch (e) { isVoidWar = false; }

    const isBoosted = isEvent || isVoidWar;

    // FIX: get max_stage directly from DB, guarded
    let maxStage = 3;
    try { maxStage = await getMaxStageForDungeon(dungeonId); } catch(e) {}

    const isBoss = (stage === maxStage);
    let enemiesToSpawn = [];

    if (isBoss) {
        const boss = { ...data.boss };
        if (isBoosted) {
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
        let count;
        if (isVoidWar)      count = Math.floor(Math.random() * 5) + 6;
        else if (isEvent)   count = Math.floor(Math.random() * 4) + 5;
        else                count = Math.floor(Math.random() * 5) + 1;

        for (let i = 0; i < count; i++) {
            const template = { ...data.miniBosses[Math.floor(Math.random() * data.miniBosses.length)] };
            if (isVoidWar) {
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
        const moves = e.moves ? JSON.stringify(e.moves) : JSON.stringify([{ name: 'Attack', damage: 1.0 }]);

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

function calculatePlayerDamage(player, enemy, weaponBonus = 0) {
    const enemyDef   = Number(enemy.def) || 0;
    const reduction  = Math.min(0.5, enemyDef / 100);
    const baseAttack = (Number(player.strength) || 0) + Math.floor((Number(weaponBonus) || 0) * 0.5);
    const rawDamage  = Math.max(1, Math.floor(baseAttack * (1 - reduction)));
    const fatigueMultiplier = getFatigueMultiplier(player);
    return Math.max(1, Math.floor(rawDamage * fatigueMultiplier));
}

function calculateEnemyRetaliation(enemy, player, playerId = null) {
    // FIX: use playerId if provided (consistent with consumeShield),
    // fall back to player.id from DB row
    const buffKey = playerId || player?.id;
    let buffMods = { defense: 0, shield: 0 };
    try {
        if (buffKey) {
            const mods = getBuffModifiers('player', buffKey);
            if (mods) buffMods = mods;
        }
    } catch (e) {}

    const playerDef    = Number(buffMods.defense) || 0;
    const reduction    = Math.min(0.5, playerDef / 100);
    const rawDamage    = Number(enemy.atk) || 0;
    let damage         = Math.floor(rawDamage * (1 - reduction));
    const playerShield = Number(buffMods.shield) || 0;
    let shieldAbsorbed = 0;

    if (playerShield > 0 && damage > 0) {
        // FIX: absorb up to the full shield value (was capped at 60% of damage)
        // Stand Firm gives 8000 shield — it should absorb 8000 damage total, not 60%
        const maxAbsorb = Math.min(playerShield, damage);
        shieldAbsorbed  = maxAbsorb;
        damage          = Math.max(0, damage - shieldAbsorbed);
    }

    return { damage, shieldAbsorbed, defenseBlocked: Math.floor(rawDamage * reduction) };
}

function evasionCheck(player, enemy) {
    const enemyEvasion = Number(enemy.evasion) || 0;
    if (enemyEvasion > 0) return Math.random() * 100 < enemyEvasion;
    const evadeChance = Math.min(0.3, (Number(player.agility) || 0) / 100);
    return Math.random() < evadeChance;
}

async function playerAttack(playerId, dungeonId, enemyId, weaponBonus) {
    const [player] = await db.execute("SELECT * FROM players WHERE id=?", [playerId]);
    const [enemy]  = await db.execute("SELECT * FROM dungeon_enemies WHERE id=?", [enemyId]);
    const p = player[0];
    const e = enemy[0];

    let evaded = false;
    let damage = calculatePlayerDamage(p, e, weaponBonus);
    if (evasionCheck(p, e)) { damage = Math.floor(damage * 0.5); evaded = true; }

    await db.execute("UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?", [damage, enemyId]);

    // FIX: record damage contribution BEFORE distributing rewards so the attacker gets credit
    await addDamageContribution(dungeonId, enemyId, playerId, damage);
    try { mvpRecordDmg(`dungeon_${dungeonId}`, playerId, null, damage, damage); } catch(e2) {}

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
        const ret = calculateEnemyRetaliation(e, p, playerId);
        retaliation    = ret.damage;
        shieldAbsorbed = ret.shieldAbsorbed;
        defenseBlocked = ret.defenseBlocked;
        if (shieldAbsorbed > 0) consumeShield('player', playerId, shieldAbsorbed);

        let retaliationTargetId = playerId;
        try {
            const { tauntState } = require('../commands/skill');
            const activeTaunt = tauntState && tauntState.get(dungeonId);
            if (activeTaunt && activeTaunt.tankId !== playerId && Date.now() < activeTaunt.expires) {
                const [tankAlive] = await db.execute(
                    'SELECT id FROM dungeon_players WHERE dungeon_id=? AND player_id=? AND is_alive=1',
                    [dungeonId, activeTaunt.tankId]
                );
                if (tankAlive.length) retaliationTargetId = activeTaunt.tankId;
            }
        } catch(e2) {}

        try {
            const puppetFx = getEffect ? getEffect(playerId, dungeonId) : null;
            if (puppetFx?.effect === 'redirect_aggro') {
                const [allies] = await db.execute(
                    'SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND player_id!=? AND is_alive=1 LIMIT 1',
                    [dungeonId, playerId]
                );
                if (allies.length) retaliationTargetId = allies[0].player_id;
            }
            const invisFx = getTurnEffect ? getTurnEffect(playerId) : null;
            if (['invisibility','time_freeze'].includes(invisFx?.effect)) {
                retaliation = 0; retaliationMessage = '';
            }
            const chaosFx = getTurnEffect ? getTurnEffect(playerId) : null;
            if (chaosFx?.effect === 'chaos_mode') {
                retaliation = Math.floor(retaliation * (1 + (chaosFx.data.amp || 0.5)));
            }
        } catch(potErr) {}

        await db.execute("UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?", [retaliation, retaliationTargetId]);
        try { trackHpLost(playerId, dungeonId, retaliation); } catch(e2) {}

        try {
            const bloodpactFx = getEffect ? getEffect(playerId, dungeonId) : null;
            if (bloodpactFx?.effect === 'damage_link' && bloodpactFx.data.linkTarget && retaliation > 0) {
                const sharedDmg = Math.floor(retaliation * 0.5);
                await db.execute('UPDATE players SET hp = GREATEST(0, hp + ?) WHERE id=?', [sharedDmg, retaliationTargetId]);
                await db.execute('UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?', [sharedDmg, bloodpactFx.data.linkTarget]);
            }
        } catch(e2) {}

        const [pUp] = await db.execute("SELECT hp FROM players WHERE id=?", [playerId]);
        playerHp = Number(pUp[0].hp);

        if (retaliation > 0) {
            let usedMovesA = [{ name: 'a vicious strike', damage: 1.0 }];
            try {
                const parsedA = typeof e.moves === 'string' ? JSON.parse(e.moves) : e.moves;
                if (Array.isArray(parsedA) && parsedA.length) usedMovesA = parsedA;
            } catch(_) {}
            const pickedA = usedMovesA[Math.floor(Math.random() * usedMovesA.length)];
            retaliation = Math.floor(retaliation * (pickedA.damage || 1.0));
            if (e.name !== 'Malachar') retaliation = Math.min(retaliation, Math.floor((Number(e.atk) || 0) * 2));
            retaliationMessage = `⚡ ${e.name} uses *${pickedA.name}*!`;
            if (defenseBlocked > 0) retaliationMessage += ` 🛡️ Blocked ${defenseBlocked}.`;
            if (shieldAbsorbed > 0) retaliationMessage += ` 🛡️ Shield absorbed ${shieldAbsorbed}.`;
        }
    }

    const [rem] = await db.execute(
        "SELECT COUNT(*) as cnt FROM dungeon_enemies WHERE dungeon_id=? AND current_hp > 0", [dungeonId]
    );
    if (rem[0].cnt === 0) await db.execute("UPDATE dungeon SET stage_cleared=1 WHERE id=?", [dungeonId]);

    const playerDied = playerHp <= 0;
    if (playerDied) {
        try {
            const anchor = getEffect(playerId, dungeonId);
            if (anchor?.effect === 'auto_revive') {
                const healAmt = Math.floor(p.max_hp * (anchor.data.heal || 0.5));
                await db.execute('UPDATE players SET hp=? WHERE id=?', [healAmt, playerId]);
                clearEffect(playerId);
                const fatigueGainA = calculateFatigueGain();
                await increasePlayerFatigue(playerId, fatigueGainA, p);
                tickBuffs('player', playerId);
                return {
                    enemyDefeated: defeated,
                    enemyHp: defeated ? 0 : Number(updatedEnemy[0].current_hp),
                    damage, exp, gold, rewardDistribution,
                    retaliation, playerHp: healAmt, playerDied: false,
                    retaliationMessage: retaliationMessage + ' ⚓ Soul Anchor — resurrected!',
                    enemyName: e.name, enemyMaxHp: Number(e.max_hp), evaded
                };
            }
        } catch(e2) {}
        try { trackDeath(playerId, dungeonId); } catch(e2) {}
        try {
            const reck = getEffect(playerId, dungeonId);
            if (reck?.effect === 'death_stack' && reck.data?.maxHpPenalty) {
                await db.execute('UPDATE players SET max_hp = GREATEST(1, FLOOR(max_hp * 0.95)) WHERE id=?', [playerId]);
            }
        } catch(e3) {}
        await db.execute(
            "UPDATE dungeon_players SET is_alive=0 WHERE player_id=? AND dungeon_id=?",
            [playerId, dungeonId]
        );
        try {
            // FIX: Check death_protect (Ichor of the Fallen) — if active, skip loss penalty
            const deathProtect = getEffect(playerId, dungeonId);
            const isProtected  = deathProtect?.effect === 'death_protect';
            if (isProtected) {
                clearEffect(playerId);
                console.log(`[death_protect] ${playerId} protected — no gold/XP loss`);
            } else {
                const [sess] = await db.execute("SELECT session_gold, session_xp FROM dungeon_players WHERE player_id=? AND dungeon_id=?", [playerId, dungeonId]);
                if (sess.length) {
                    const lostGold = sess[0].session_gold || 0;
                    const lostXp   = sess[0].session_xp   || 0;
                    if (lostGold > 0) await db.execute("UPDATE currency SET gold = GREATEST(0, gold - ?) WHERE player_id=?", [lostGold, playerId]);
                    if (lostXp   > 0) await db.execute("UPDATE xp SET xp = GREATEST(0, xp - ?) WHERE player_id=?", [lostXp, playerId]);
                }
            }
        } catch(e) { console.error('Death penalty error:', e.message); }
    }

    const fatigueGain = calculateFatigueGain();
    await increasePlayerFatigue(playerId, fatigueGain, p);
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

    let hits = 1;
    try {
        const turnFx = getTurnEffect(playerId);
        if (turnFx?.effect === 'double_strike') hits = turnFx.data.hits || 2;
    } catch (e2) {}

    let totalDamage = 0;
    for (let i = 0; i < hits; i++) {
        let hitDamage = calculateMoveDamage(p, move, e, equippedItems, { noTick: i < (hits - 1) });
        if (move.stat !== 'intelligence' && evasionCheck(p, e)) {
            hitDamage = Math.floor(hitDamage * 0.5);
            evaded = true;
        }
        totalDamage += hitDamage;
    }
    const damage = totalDamage;

    await db.execute("UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?", [damage, enemyId]);
    await addDamageContribution(dungeonId, enemyId, playerId, damage);

    try { mvpRecordDmg(`dungeon_${dungeonId}`, playerId, null, damage, damage); } catch(e2) {}

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
        const ret = calculateEnemyRetaliation(e, p, playerId);
        retaliation    = ret.damage;
        shieldAbsorbed = ret.shieldAbsorbed;
        defenseBlocked = ret.defenseBlocked;
        if (shieldAbsorbed > 0) consumeShield('player', playerId, shieldAbsorbed);

        let retaliationTargetId = playerId;
        try {
            const { tauntState } = require('../commands/skill');
            const activeTaunt = tauntState && tauntState.get(dungeonId);
            if (activeTaunt && activeTaunt.tankId !== playerId && Date.now() < activeTaunt.expires) {
                const [tankAlive] = await db.execute(
                    'SELECT id FROM dungeon_players WHERE dungeon_id=? AND player_id=? AND is_alive=1',
                    [dungeonId, activeTaunt.tankId]
                );
                if (tankAlive.length) retaliationTargetId = activeTaunt.tankId;
            }
        } catch(e2) {}

        try {
            const puppetFx = getEffect ? getEffect(playerId, dungeonId) : null;
            if (puppetFx?.effect === 'redirect_aggro') {
                const [allies] = await db.execute(
                    'SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND player_id!=? AND is_alive=1 LIMIT 1',
                    [dungeonId, playerId]
                );
                if (allies.length) retaliationTargetId = allies[0].player_id;
            }
            const invisFx = getTurnEffect ? getTurnEffect(playerId) : null;
            if (['invisibility', 'time_freeze'].includes(invisFx?.effect)) {
                retaliation = 0; retaliationMessage = '';
            }
            const chaosFx = getTurnEffect ? getTurnEffect(playerId) : null;
            if (chaosFx?.effect === 'chaos_mode') {
                retaliation = Math.floor(retaliation * (1 + (chaosFx.data.amp || 0.5)));
            }
        } catch(potErr) { console.log('Retaliation potion error:', potErr.message); }

        await db.execute("UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?", [retaliation, retaliationTargetId]);
        try { trackHpLost(playerId, dungeonId, retaliation); } catch(e2) {}

        try {
            const bloodpactFx = getEffect ? getEffect(playerId, dungeonId) : null;
            if (bloodpactFx?.effect === 'damage_link' && bloodpactFx.data.linkTarget && retaliation > 0) {
                const sharedDmg = Math.floor(retaliation * 0.5);
                await db.execute('UPDATE players SET hp = GREATEST(0, hp + ?) WHERE id=?', [sharedDmg, retaliationTargetId]);
                await db.execute('UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?', [sharedDmg, bloodpactFx.data.linkTarget]);
            }
        } catch(e2) {}

        const [pUp] = await db.execute("SELECT hp FROM players WHERE id=?", [playerId]);
        playerHp = Number(pUp[0].hp);

        if (retaliation > 0) {
            let usedMoves2 = [{ name: 'a vicious strike', damage: 1.0 }];
            try {
                const parsedMoves2 = typeof e.moves === 'string' ? JSON.parse(e.moves) : e.moves;
                if (Array.isArray(parsedMoves2) && parsedMoves2.length) usedMoves2 = parsedMoves2;
            } catch(_) {}
            const pickedMove2 = usedMoves2[Math.floor(Math.random() * usedMoves2.length)];
            retaliation = Math.floor(retaliation * (pickedMove2.damage || 1.0));
            if (e.name !== 'Malachar') retaliation = Math.min(retaliation, Math.floor((Number(e.atk) || 0) * 2));
            retaliationMessage = `⚡ ${e.name} uses *${pickedMove2.name}*!`;
            if (defenseBlocked > 0) retaliationMessage += ` 🛡️ Blocked ${defenseBlocked}.`;
            if (shieldAbsorbed > 0) retaliationMessage += ` 🛡️ Shield absorbed ${shieldAbsorbed}.`;
        }
    }

    const [rem] = await db.execute(
        "SELECT COUNT(*) as cnt FROM dungeon_enemies WHERE dungeon_id=? AND current_hp > 0", [dungeonId]
    );
    if (rem[0].cnt === 0) await db.execute("UPDATE dungeon SET stage_cleared=1 WHERE id=?", [dungeonId]);

    const playerDied = playerHp <= 0;
    if (playerDied) {
        try {
            const anchor = getEffect(playerId, dungeonId);
            if (anchor?.effect === 'auto_revive') {
                const healAmt = Math.floor(p.max_hp * (anchor.data.heal || 0.5));
                await db.execute('UPDATE players SET hp=? WHERE id=?', [healAmt, playerId]);
                clearEffect(playerId);
                const fatigueGainA = calculateFatigueGain();
                await increasePlayerFatigue(playerId, fatigueGainA, player);
                tickBuffs('player', playerId);
                return {
                    damage, defeated, exp, gold, rewardDistribution,
                    retaliation, playerHp: healAmt, playerDied: false,
                    retaliationMessage: retaliationMessage + ' ⚓ Soul Anchor — resurrected!',
                    enemyHp: defeated ? 0 : Number(updatedEnemy[0].current_hp),
                    enemyMaxHp: Number(e.max_hp), enemyName: e.name, evaded
                };
            }
        } catch(e2) {}
        try { trackDeath(playerId, dungeonId); } catch(e2) {}
        try {
            const reck = getEffect(playerId, dungeonId);
            if (reck?.effect === 'death_stack' && reck.data?.maxHpPenalty) {
                await db.execute('UPDATE players SET max_hp = GREATEST(1, FLOOR(max_hp * 0.95)) WHERE id=?', [playerId]);
            }
        } catch(e3) {}
        await db.execute(
            "UPDATE dungeon_players SET is_alive=0 WHERE player_id=? AND dungeon_id=?",
            [playerId, dungeonId]
        );
        try {
            // FIX: Check death_protect (Ichor of the Fallen) — if active, skip loss penalty
            const deathProtect = getEffect(playerId, dungeonId);
            const isProtected  = deathProtect?.effect === 'death_protect';
            if (isProtected) {
                clearEffect(playerId);
                console.log(`[death_protect] ${playerId} protected — no gold/XP loss`);
            } else {
                const [sess] = await db.execute("SELECT session_gold, session_xp FROM dungeon_players WHERE player_id=? AND dungeon_id=?", [playerId, dungeonId]);
                if (sess.length) {
                    const lostGold = sess[0].session_gold || 0;
                    const lostXp   = sess[0].session_xp   || 0;
                    if (lostGold > 0) await db.execute("UPDATE currency SET gold = GREATEST(0, gold - ?) WHERE player_id=?", [lostGold, playerId]);
                    if (lostXp   > 0) await db.execute("UPDATE xp SET xp = GREATEST(0, xp - ?) WHERE player_id=?", [lostXp, playerId]);
                }
            }
        } catch(e) { console.error('Death penalty error:', e.message); }
    }

    const fatigueGain = calculateFatigueGain();
    await increasePlayerFatigue(playerId, fatigueGain, player);
    tickBuffs('player', playerId);

    return {
        damage, defeated, exp, gold, rewardDistribution,
        retaliation, playerHp, playerDied, retaliationMessage,
        enemyHp: defeated ? 0 : Number(updatedEnemy[0].current_hp),
        enemyMaxHp: Number(e.max_hp), enemyName: e.name, evaded
    };
}

async function distributeEnemyRewards(dungeonId, enemyId) {
    const [enemy] = await db.execute("SELECT exp, gold, name, max_hp FROM dungeon_enemies WHERE id=?", [enemyId]);
    if (!enemy.length) return { contributors: [] };

    const totalExp  = Number(enemy[0].exp);
    const totalGold = Number(enemy[0].gold);
    const isBoss    = Number(enemy[0].exp) >= 2000;

    const [contributors] = await db.execute(
        "SELECT player_id, damage_dealt FROM dungeon_damage WHERE dungeon_id=? AND enemy_id=?",
        [dungeonId, enemyId]
    );
    if (contributors.length === 0) return { contributors: [] };

    const { getContributionScore } = require('../systems/contributionSystem');
    const totalDamage = contributors.reduce((sum, c) => sum + Number(c.damage_dealt), 0);
    const rewards = [];

    for (const c of contributors) {
        let share = totalDamage > 0 ? Number(c.damage_dealt) / totalDamage : 1 / contributors.length;

        if (isBoss) {
            const [roleRow] = await db.execute("SELECT role FROM players WHERE id=?", [c.player_id]);
            const role = roleRow[0]?.role;
            if (role === 'Tank' || role === 'Healer') {
                const contribScore = getContributionScore(dungeonId, c.player_id) || 0;
                const totalContrib = contributors.reduce((s, x) => s + (getContributionScore(dungeonId, x.player_id) || 0), 0);
                const contribShare = totalContrib > 0 ? contribScore / totalContrib : share;
                share = (share * 0.4) + (contribShare * 0.6);
            }
        }

        const expEarned  = Math.floor(totalExp  * share);
        const goldEarned = Math.floor(totalGold * share);

        await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [expEarned, c.player_id]);
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [goldEarned, c.player_id]);
        await db.execute(
            "UPDATE dungeon_players SET session_gold = session_gold + ?, session_xp = session_xp + ? WHERE player_id=? AND dungeon_id=?",
            [goldEarned, expEarned, c.player_id, dungeonId]
        ).catch(() => {});

        try {
            const harvest = getEffect(c.player_id, dungeonId);
            if (harvest?.effect === 'kill_hp_gain') {
                const gainAmt = Math.floor(Number(enemy[0].max_hp) * (harvest.data.percent || 0.1));
                await db.execute('UPDATE players SET hp = LEAST(max_hp, hp + ?) WHERE id=?', [gainAmt, c.player_id]);
            }
        } catch(e2) {}

        const [pl] = await db.execute("SELECT nickname FROM players WHERE id=?", [c.player_id]);
        rewards.push({
            playerId: c.player_id,
            nickname: pl[0]?.nickname || c.player_id,
            damage:   Number(c.damage_dealt),
            exp:      expEarned,
            gold:     goldEarned
        });
    }

    await db.execute("DELETE FROM dungeon_damage WHERE dungeon_id=? AND enemy_id=?", [dungeonId, enemyId]);

    // Fire clan quest progress for kill events
    const isBossKill = Number(enemy[0].exp) >= 2000;
    for (const r of rewards) {
        updateClanQuestProgress(r.playerId, 'kill_enemies', 1, null).catch(() => {});
        if (isBossKill) {
            updateClanQuestProgress(r.playerId, 'boss_kill', 1, null).catch(() => {});
        }
    }

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

async function advanceStage(dungeonId, nextStage) {
    await db.execute("UPDATE dungeon SET stage=?, stage_cleared=0 WHERE id=?", [nextStage, dungeonId]);
    await db.execute("DELETE FROM dungeon_enemies WHERE dungeon_id=? AND current_hp <= 0", [dungeonId]);
    const [dungeon] = await db.execute("SELECT dungeon_rank FROM dungeon WHERE id=?", [dungeonId]);
    const rank = dungeon[0]?.dungeon_rank;
    if (rank && rank.startsWith('TERRITORY_')) {
        // Territory dungeon — spawn territory enemies
        const tid = rank.replace('TERRITORY_', '');
        const territoryEnemies = require('../data/territoryEnemies');
        const enemyData = territoryEnemies[tid];
        if (enemyData) {
            const [dungeonRow] = await db.execute("SELECT max_stage FROM dungeon WHERE id=?", [dungeonId]);
            const maxStage = dungeonRow[0]?.max_stage || 4;
            const isBoss = nextStage === maxStage;
            if (isBoss) {
                const boss = enemyData.boss;
                await db.execute(
                    'INSERT INTO dungeon_enemies (dungeon_id, name, max_hp, current_hp, atk, def, exp, gold, evasion, moves) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [dungeonId, boss.name, boss.hp, boss.hp, boss.atk, boss.def, boss.exp, boss.gold, boss.evasion || 0, JSON.stringify(boss.moves || [])]
                );
            } else {
                const count = Math.floor(Math.random() * 3) + 3;
                for (let i = 0; i < count; i++) {
                    const mini = enemyData.miniBosses[Math.floor(Math.random() * enemyData.miniBosses.length)];
                    await db.execute(
                        'INSERT INTO dungeon_enemies (dungeon_id, name, max_hp, current_hp, atk, def, exp, gold, evasion, moves) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [dungeonId, mini.name, mini.hp, mini.hp, mini.atk, mini.def, mini.exp, mini.gold, mini.evasion || 0, JSON.stringify(mini.moves || [])]
                    );
                }
            }
        }
    } else if (rank && rank.startsWith('P')) {
        const { spawnPrestigeEnemies } = require('./prestigeDungeon');
        await spawnPrestigeEnemies(dungeonId, rank, nextStage);
    } else {
        await spawnStageEnemies(dungeonId, rank, nextStage);
    }
}

async function addPlayerToDungeon(playerId, dungeonId) {
    await ensureSessionColumns();
    await db.execute(
        "INSERT INTO dungeon_players (player_id, dungeon_id, is_alive, session_gold, session_xp) VALUES (?, ?, 1, 0, 0)",
        [playerId, dungeonId]
    );
}

async function removePlayerFromDungeon(playerId, dungeonId, client = null) {
    await db.execute(
        "DELETE FROM dungeon_players WHERE player_id=? AND dungeon_id=?",
        [playerId, dungeonId]
    );
    await checkAndCloseEmptyDungeon(dungeonId, client);
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
        const [dRank] = await db.execute('SELECT dungeon_rank FROM dungeon WHERE id=?', [dungeonId]).catch(() => [[{}]]);
        if (client && !dRank[0]?.dungeon_rank?.startsWith('P')) {
            trySpawnPrestigeDungeon(client, RAID_GROUP).catch(e => console.error('★ Prestige spawn error:', e.message));
        }
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

async function getDungeonEnemyRevealText(dungeonId) {
    const [dungeon] = await db.execute("SELECT * FROM dungeon WHERE id=?", [dungeonId]);
    if (!dungeon.length) return null;
    const d = dungeon[0];
    const enemies = await getCurrentEnemies(dungeonId);

    const isPrestige = d.dungeon_rank && d.dungeon_rank.startsWith('P');
    const [box, bar, bul, close] = isPrestige
        ? ['╔══〘 ✦ VOID THREATS 〙══╗', '┃★────────────', '┃★', '╚═══════════════════════════╝']
        : ['══〘 👾 ENEMIES REVEALED 〙══╮', '┃◆────────────', '┃◆', '╰═══════════════════════╯'];

    let text = `${box}\n`;
    text += `${bul} Rank: ${d.dungeon_rank}  •  Stage: ${d.stage}/${d.max_stage}\n`;
    text += `${bar}\n`;

    enemies.forEach((e, i) => {
        let moveNames = '—';
        try {
            const parsed = typeof e.moves === 'string' ? JSON.parse(e.moves) : e.moves;
            if (Array.isArray(parsed) && parsed.length) moveNames = parsed.map(m => m.name).join(', ');
        } catch (_) {}
        text += `${bul} ${i + 1}. ${e.name}\n`;
        text += `${bul}    ❤️ HP:  ${e.current_hp}/${e.max_hp}\n`;
        text += `${bul}    ⚔️ ATK: ${e.atk}\n`;
        text += `${bul}    🛡️ DEF: ${e.def}\n`;
        text += `${bul}    🗡️ Moves: ${moveNames}\n`;
        if (i < enemies.length - 1) text += `${bar}\n`;
    });

    text += `${bar}\n${bul} 🧭 !skill <move> [enemy #]\n${close}`;
    return text;
}

async function getDungeonStatusText(dungeonId) {
    const [dungeon] = await db.execute("SELECT * FROM dungeon WHERE id=?", [dungeonId]);
    if (!dungeon.length) return "Dungeon not found.";
    const d = dungeon[0];

    // FIX: Re-fetch fresh enemy list directly from DB (don't rely on stale dungeon object)
    const enemies = await getCurrentEnemies(dungeonId);

    // FIX: Re-read stage_cleared from DB in real time
    const [fresh] = await db.execute("SELECT stage_cleared FROM dungeon WHERE id=?", [dungeonId]);
    const stageCleared = fresh[0]?.stage_cleared === 1;

    const isPrestige = d.dungeon_rank && d.dungeon_rank.startsWith('P');
    const [box, bar, bul, close] = isPrestige
        ? ['╔══〘 ✦ PRESTIGE STATUS 〙══╗', '┃★────────────', '┃★', '╚═══════════════════════════╝']
        : ['══〘 🏰 DUNGEON STATUS 〙══╮', '┃◆────────────', '┃◆', '╰═══════════════════════╯'];

    let text = `${box}\n`;
    text += `${bul} Rank: ${d.dungeon_rank}  •  Stage: ${d.stage}/${d.max_stage}\n`;
    text += `${bul} Locked: ${d.locked ? '🔒 YES' : '🔓 NO'}\n`;
    text += `${bar}\n`;

    // FIX: Show enemies if they exist, REGARDLESS of stage_cleared flag
    // The cleared flag and enemy list can desync — trust the enemy list
    if (enemies.length === 0) {
        text += `${bul} ✅ All enemies defeated!\n`;
        text += `${bul} 🧭 Use !onward to advance\n`;
    } else {
        text += `${bul} 👾 ENEMIES:\n`;
        enemies.forEach((e, i) => {
            text += `${bul}   ${i+1}. ${e.name} (${e.current_hp}/${e.max_hp} HP)\n`;
        });
        if (stageCleared) {
            // Desync: flag says cleared but enemies still in DB — reset the flag
            db.execute("UPDATE dungeon SET stage_cleared=0 WHERE id=?", [dungeonId]).catch(() => {});
        }
    }
    text += `${bar}\n${bul} 🧭 !skill <move> [target]\n${close}`;
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
    ensureSessionColumns,
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
    dungeonLocks,
    clearDungeonTimers,
};