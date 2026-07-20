const db = require('../database/db');
const enemiesData = require('../data/enemies');
const { calculateMoveDamage } = require('../systems/skillSystem');
const { getFatigueMultiplier, increasePlayerFatigue } = require('../systems/fatigueSystem');
const { tickBuffs, getBuffModifiers, consumeShield } = require('../systems/activeBuffs');
const { clearDungeonTimers } = require('./dungeonTimer');
const { clearPrestigeLobbyTimer } = require('./prestigeDungeon');
const { trySpawnPrestigeDungeon } = require('./prestigeDungeon');
const { getEffect, getEffectByName, clearEffect, trackDeath, trackHpLost, getTurnEffect, getTurnEffectByName } = require('../systems/potionEffects');
const { getPlayerBlessingState, updateBlessingState } = require('../systems/clanSystem');
const { initMvpTracking, recordDamage: mvpRecordDmg, recordDamageTaken: mvpRecordTaken, getMvp, getContributions: getMvpContributions } = require('../systems/mvpSystem');

const getRaidGroup  = () => global.overrideRaidGroup || process.env.RAID_GROUP_JID || '120363213735662100@g.us';

// Per-dungeon announcement group — allows real dungeon + test dungeon simultaneously
// When a dungeon spawns, it captures the current getRaidGroup() value and stores it here
// All timers/callbacks use getDungeonGroup(id) so they always route to the right GC
const dungeonGroupMap = new Map();
function getDungeonGroup(dungeonId) {
    return dungeonGroupMap.get(dungeonId) || getRaidGroup();
}
function setDungeonGroup(dungeonId, groupJid) {
    dungeonGroupMap.set(dungeonId, groupJid);
}

const dungeonLocks    = new Map();
const autoStartTimers = new Map();

const LOBBY_WARN_MS  = 8  * 60 * 1000;
const LOBBY_CLOSE_MS = 10 * 60 * 1000;
const lobbyTimers = new Map();

const { normalizeId } = require('../utils/identity');

function clearLobbyTimer(dungeonId) {
    const t = lobbyTimers.get(dungeonId);
    if (t) {
        clearTimeout(t.warning);
        clearTimeout(t.timeout);
        lobbyTimers.delete(dungeonId);
    }
}

function getDungeonMvp(dungeonId) {
    try { return getMvp(`dungeon_${dungeonId}`); } catch(e) { return null; }
}

function getDungeonMvpContributions(dungeonId) {
    try { return getMvpContributions(`dungeon_${dungeonId}`); } catch(e) { return {}; }
}

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
        const spawnGroupCheck = getRaidGroup();
        const [activePlayers] = await db.execute(
            "SELECT COUNT(*) as cnt FROM dungeon_players dp JOIN dungeon d ON d.id=dp.dungeon_id WHERE d.is_active=1 AND dp.is_alive=1 AND (d.group_jid=? OR (d.group_jid IS NULL AND ?=?))",
            [spawnGroupCheck, spawnGroupCheck, process.env.RAID_GROUP_JID || '120363213735662100@g.us']
        );
        if (activePlayers[0].cnt > 0) {
            console.log('⏭️ Spawn skipped — players still active in a dungeon for this group');
            return null;
        }
    } catch(e) {}

    const lockGroup = getRaidGroup();
    try {
        await db.execute("INSERT INTO dungeon_spawn_lock (id, locked_at, group_jid) VALUES (1, NOW(), ?) ON DUPLICATE KEY UPDATE locked_at=IF(group_jid=?, locked_at, NOW()), group_jid=IF(group_jid=?, group_jid, ?)", [lockGroup, lockGroup, lockGroup, lockGroup]);
        // Check if we got the lock for our group
        const [lockRow] = await db.execute("SELECT group_jid FROM dungeon_spawn_lock WHERE id=1");
        if (lockRow[0]?.group_jid !== lockGroup) {
            console.log('⚠️ Spawn blocked — spawn lock held by another group.');
            return null;
        }
    } catch (e) {
        console.log('⚠️ Spawn blocked — spawn lock error:', e.message);
        return null;
    }

    try {
        const groupJidForSpawn = getRaidGroup();
        const [existing] = await db.execute(
            "SELECT id FROM dungeon WHERE is_active=1 AND (group_jid=? OR (group_jid IS NULL AND ?=?)) ORDER BY id DESC LIMIT 1",
            [groupJidForSpawn, groupJidForSpawn, process.env.RAID_GROUP_JID || '120363213735662100@g.us']
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
        const maxStage = { F:3, E:4, D:5, C:6, B:7, A:8, S:10, HOLLOWKING:6, VESPERION:5, CINDERMAW:5, UMBRYSS:6 }[rank] || 3;

        // ── DUNGEON MODIFIERS — ~30% of spawns roll one ──────────────────────
        // GOLDEN: gold rewards ×3 · CURSED: enemies +50%, rewards ×2 ·
        // FRACTURED: the Hollow King's Echo invasion chance doubled (Chapter 6+)
        await db.execute('ALTER TABLE dungeon ADD COLUMN modifier VARCHAR(20) DEFAULT NULL').catch(() => {});
        let modifier = null;
        if (!['HOLLOWKING','VESPERION','CINDERMAW','UMBRYSS'].includes(rank) && Math.random() < 0.30) {
            modifier = ['GOLDEN', 'CURSED', 'FRACTURED'][Math.floor(Math.random() * 3)];
        }

        const [result] = await db.execute(
            `INSERT INTO dungeon (dungeon_rank, stage, max_stage, boss_name, is_active, stage_cleared, in_combat, locked, group_jid, modifier)
             VALUES (?, 1, ?, ?, 1, 0, 0, 0, ?, ?)`,
            [rank, maxStage, boss, getRaidGroup(), modifier]
        );

        const dungeonId = result.insertId;
        console.log(`🏰 Dungeon ${rank} spawned (id: ${dungeonId})${modifier ? ` [${modifier}]` : ''}.`);

        // Capture current group at spawn time (real group OR test group)
        const spawnGroup = getRaidGroup();
        dungeonGroupMap.set(dungeonId, spawnGroup);

        if (client) {
            await sendDungeonAnnouncement(client, rank, boss, maxStage, spawnGroup);
            // Modifier flavor ("enemies are stronger", etc.) is NO LONGER posted
            // at spawn — it now fires 20s before the dungeon auto-starts (see the
            // auto-start block in enter.js), so raiders get the warning right as
            // the fight is about to lock in.
            startLobbyTimer(dungeonId, client);
        }

        return { id: dungeonId, rank, maxStage, boss, modifier };
    } finally {
        await db.execute("DELETE FROM dungeon_spawn_lock WHERE id=1 AND group_jid=?", [getRaidGroup()]).catch(() => {});
    }
}

// Modifier flavor text, posted 20s before auto-start (see enter.js).
const MOD_TEXT = {
    GOLDEN:    '╔══〘 ✨ GOLDEN DUNGEON 〙══╗\n┃★ The walls drip with gold.\n┃★ 💰 *ALL LUMEN REWARDS ×3!*\n╚═══════════════════════╝',
    CURSED:    '╔══〘 💀 CURSED DUNGEON 〙══╗\n┃★ Something is wrong in there.\n┃★ ⚠️ Enemies are *+50% stronger*\n┃★ 🎁 but rewards are *DOUBLED.*\n╚═══════════════════════╝',
    FRACTURED: '╔══〘 👁️ FRACTURED DUNGEON 〙══╗\n┃★ The dark is thin here.\n┃★ ⚠️ A *Sunshard* is twice as\n┃★ likely to crash in...\n╚═══════════════════════╝'
};

// Posts the modifier warning IF the dungeon is still in its lobby (active,
// unlocked) and actually has a modifier. Self-guards so a cancelled or
// already-started dungeon posts nothing. Called ~20s before auto-start.
async function announceDungeonModifier(dungeonId, client) {
    try {
        if (!client) return;
        const [rows] = await db.execute("SELECT modifier, is_active, locked FROM dungeon WHERE id=?", [dungeonId]);
        const d = rows[0];
        if (!d || !d.modifier || Number(d.is_active) !== 1 || Number(d.locked) !== 0) return;
        if (!MOD_TEXT[d.modifier]) return;
        await client.sendMessage(getDungeonGroup(dungeonId), { text: MOD_TEXT[d.modifier] }).catch(() => {});
        console.log(`⚠️ Modifier warning posted for dungeon ${dungeonId} [${d.modifier}] (pre-start).`);
    } catch (e) { console.error('announceDungeonModifier error:', e.message); }
}

function startLobbyTimer(dungeonId, client) {
    clearLobbyTimer(dungeonId);

    const warning = setTimeout(async () => {
        try {
            await client.sendMessage(getDungeonGroup(dungeonId), {
                text:
                    `══〘 ⚠️ DUNGEON CLOSING SOON 〙══╮
` +
                    `┃◆ The dungeon portal is destabilizing!
` +
                    `┃◆ ⏳ 2 minutes left to enter.
` +
                    `┃◆ DM the bot !enter now or miss out!
` +
                    `┃◆ No entry = no rewards.
` +
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
                await client.sendMessage(getDungeonGroup(dungeonId), {
                    text:
                        `══〘 🚪 DUNGEON EXPIRED 〙══╮
` +
                        `┃◆ The dungeon portal has collapsed.
` +
                        `┃◆ No raid was formed in time.
` +
                        `┃◆ Watch for the next announcement!
` +
                        `╰═══════════════════════╯`
                });
                console.log(`🚪 Dungeon ${dungeonId} expired — no one started in time.`);
                const [expRank] = await db.execute('SELECT dungeon_rank FROM dungeon WHERE id=?', [dungeonId]).catch(() => [[{}]]);
                if (!expRank[0]?.dungeon_rank?.startsWith('P')) {
                    trySpawnPrestigeDungeon(client, getDungeonGroup(dungeonId)).catch(e => console.error('★ Prestige spawn error:', e.message));
                }
            }
        } catch (e) {
            console.error("Lobby timeout error:", e.message);
        }
        lobbyTimers.delete(dungeonId);
    }, LOBBY_CLOSE_MS);

    lobbyTimers.set(dungeonId, { warning, timeout });
}

async function sendDungeonAnnouncement(client, rank, boss, maxStage, groupJid) {
    groupJid = groupJid || getRaidGroup();
    let mentions = [];
    try {
        const { tagAll } = require('../utils/tagAll');
        const result = await tagAll(client, groupJid);
        mentions = result.mentions || [];
    } catch (e) {
        console.log('tagAll unavailable — sending announcement without mentions.');
    }

    let loreText = '';
    try {
        const { getCurrentChapter, getRandomDungeonLore } = require('../systems/loreSystem');
        const chapter = await getCurrentChapter();
        loreText = `┃◆ 〝${getRandomDungeonLore(chapter)}〞
┃◆ 
`;
    } catch (e) {}


    const announceMsg =
        `╭══〘 📢 DUNGEON OPENED 〙══╮
` +
        `┃◆ 
` +
        `${loreText}` +
            `┃◆   Rank: ${rank}
` +
        `┃◆   Max Stage: ${maxStage}
` +
        `┃◆   Boss: ${boss}
` +
        `┃◆   Max Raiders: ${{ F:3, E:3, D:4, C:4, B:5, A:5, S:5, PF:3, PE:3, PD:4, PC:4, PB:10, PA:10, PS:10 }[rank] || 3}
` +
        `┃◆ 
` +
        `┃◆   DM the bot: !enter to join!
` +
        `┃◆   ⏳ Portal closes in 10 minutes.
` +
        `┃◆ 
` +
        `╰═══════════════════════════╯`;

    try {
        const { sendWithRetry } = require('../utils/sendWithRetry');
        await sendWithRetry(client, groupJid, { text: announceMsg, mentions });
        console.log(`📢 Dungeon announcement sent to group`);
    } catch (e) {
        console.error("Dungeon announcement failed:", e.message);
    }
}

async function promoteRaider(client, userId) {
    try {
        const metadata    = await client.groupMetadata(getRaidGroup());
        const participant = metadata.participants.find(p => normalizeId(p.id) === userId);
        if (!participant) {
            console.error(`⚠️ Promote failed: ${userId} not found in dungeon group`);
            return;
        }
        await client.groupParticipantsUpdate(getRaidGroup(), [participant.id], 'promote');
        console.log(`👑 Promoted ${userId} to admin`);
    } catch (e) {
        console.error(`Failed to promote ${userId}:`, e.message);
    }
}

async function demoteRaider(client, userId, groupJid) {
    try {
        const targetGroup = groupJid || getRaidGroup();
        const metadata    = await client.groupMetadata(targetGroup);
        const participant = metadata.participants.find(p => normalizeId(p.id) === userId);
        if (!participant) { console.log(`👇 Demote skip — ${userId} not in group`); return; }
        if (participant.admin !== 'admin' && participant.admin !== 'superadmin') return;
        await client.groupParticipantsUpdate(targetGroup, [participant.id], 'demote');
        console.log(`👇 Demoted ${userId} from admin in ${targetGroup}`);
    } catch (e) {
        console.error(`Failed to demote ${userId}:`, e.message);
    }
}

async function demoteAllRaiders(client, dungeonId) {
    try {
        const groupJid = getDungeonGroup(dungeonId);
        const [players] = await db.execute(
            "SELECT player_id FROM dungeon_players WHERE dungeon_id=?",
            [dungeonId]
        );
        if (!players.length) { console.log(`👇 No players to demote for dungeon ${dungeonId}`); return; }
        for (const p of players) {
            await demoteRaider(client, p.player_id, groupJid);
        }
        console.log(`👇 All raiders demoted for dungeon ${dungeonId} in ${groupJid}`);
    } catch (e) {
        console.error("Failed to demote all raiders:", e.message);
    }
}

async function getActiveDungeon(groupJid) {
    const gid = groupJid || getRaidGroup();
    const liveGroup = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
    const [rows] = await db.execute(
        "SELECT * FROM dungeon WHERE is_active=1 AND (group_jid=? OR (group_jid IS NULL AND ?=?)) ORDER BY id DESC LIMIT 1",
        [gid, gid, liveGroup]
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
    // Per-group dungeon isolation
    await db.execute('ALTER TABLE dungeon ADD COLUMN IF NOT EXISTS group_jid VARCHAR(80) DEFAULT NULL').catch(() => {});
    await db.execute('ALTER TABLE dungeon_spawn_lock ADD COLUMN IF NOT EXISTS group_jid VARCHAR(80) DEFAULT NULL').catch(() => {});
}

async function lockDungeon(dungeonId) {
    clearPrestigeLobbyTimer(dungeonId);
    dungeonLocks.set(dungeonId, true);
    clearLobbyTimer(dungeonId);
    await db.execute("UPDATE dungeon SET locked=1 WHERE id=?", [dungeonId]);

    try {
        const [players] = await db.execute("SELECT player_id FROM dungeon_players WHERE dungeon_id=?", [dungeonId]);
        // Clear weapon cooldowns for all entering players so previous dungeon cooldowns don't carry over
        try {
            const { clearPlayerCooldowns } = require('../systems/skillSystem');
            for (const p of players) clearPlayerCooldowns(p.player_id);
        } catch(e) {}
        const ids = players.map(p => p.player_id);
        initMvpTracking(`dungeon_${dungeonId}`, ids);

        for (const p of players) {
            await db.execute(
                `INSERT INTO clan_blessing_state (player_id, dungeon_id, blessing_used, last_triggered, hit_count, skill_count, invincible, damage_boost, next_hit_mult, charges)
                 VALUES (?, ?, 0, NULL, 0, 0, 0, 0, 0, 0)
                 ON DUPLICATE KEY UPDATE blessing_used=0, last_triggered=NULL, hit_count=0, skill_count=0, invincible=0, damage_boost=0, next_hit_mult=0, charges=0`,
                [p.player_id, dungeonId]
            );
        }
    } catch(e) { console.error('Lock init error:', e.message); }
}

async function getMaxStageForDungeon(dungeonId) {
    const [rows] = await db.execute("SELECT max_stage FROM dungeon WHERE id=?", [dungeonId]);
    return rows[0].max_stage;
}

async function spawnStageEnemies(dungeonId, rank, stage) {
    const data = enemiesData[rank];
    if (!data) return;

    let isEvent = false;
    const isBoosted = isEvent;
    const isBoss = (stage === (await getMaxStageForDungeon(dungeonId)));
    let enemiesToSpawn = [];

    if (isBoss) {
        const boss = { ...data.boss };
        if (isBoosted) {
            boss.hp   = Math.floor(boss.hp  * 2.0);
            boss.atk  = Math.floor(boss.atk * 1.5);
            boss.def  = Math.floor((boss.def || 5) * 1.8);
            boss.exp  = Math.floor(boss.exp  * 2.0);
            boss.gold = Math.floor(boss.gold * 2.0);
            boss.name = `Void-Touched ${boss.name}`;
        }
        enemiesToSpawn = [boss];
    } else {
        let count;
        if (isEvent)   count = Math.floor(Math.random() * 4) + 5;
        else            count = Math.floor(Math.random() * 5) + 1;

        for (let i = 0; i < count; i++) {
            const template = { ...data.miniBosses[Math.floor(Math.random() * data.miniBosses.length)] };
            if (isEvent) {
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

function calculateEnemyRetaliation(enemy, player) {
    let buffMods = { defense: 0, shield: 0 };
    try {
        if (player?.id) {
            const mods = getBuffModifiers('player', player.id);
            if (mods) buffMods = mods;
        }
    } catch (e) {}

    // Defense = buff skill bonus + weapon defense_bonus stat
    const buffDef      = Number(buffMods.defense) || 0;
    const equipDef     = Number(player?.defense_bonus) || 0;
    const playerDef    = buffDef + equipDef;
    const reduction    = Math.min(0.75, playerDef / 100);
    const rawDamage    = Number(enemy.atk) || 0;
    let damage         = Math.floor(rawDamage * (1 - reduction));
    const playerShield = Number(buffMods.shield) || 0;
    let shieldAbsorbed = 0;

    if (playerShield > 0 && damage > 0) {
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

    // Eclipse clan blessing — permanent damage_boost for rest of dungeon after final stage trigger
    // Titan's Roar / the Hollow King's Will — next_hit_mult consumed on the next outgoing attack
    let bStateShared = null; // fetched once, reused by the invincible check below
    try {
        const bState = await getPlayerBlessingState(playerId, dungeonId);
        bStateShared = bState;
        if (bState.damage_boost > 0) {
            damage = Math.floor(damage * (1 + Number(bState.damage_boost)));
        }
        if (Number(bState.next_hit_mult) > 0) {
            damage = Math.floor(damage * Number(bState.next_hit_mult));
            evaded = false; // these hits cannot be evaded
            const remainingCharges = Math.max(0, Number(bState.charges || 0) - 1);
            await updateBlessingState(playerId, dungeonId, {
                charges: remainingCharges,
                next_hit_mult: remainingCharges > 0 ? Number(bState.next_hit_mult) : 0
            });
        }
    } catch(eclipseErr) {}

    // Territory bonus: Umbral Court (+25% damage) — cached lookup.
    try {
        const { getDamageBonusMultiplier } = require('../systems/territoryBonusSystem');
        const terrMult = await getDamageBonusMultiplier(playerId);
        if (terrMult > 1) damage = Math.floor(damage * terrMult);
    } catch(e) {}

    await db.execute("UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?", [damage, enemyId]);
    // Re-read only current_hp (concurrency-correct defeated check, minimal cost)
    const [updatedEnemy] = await db.execute("SELECT current_hp FROM dungeon_enemies WHERE id=?", [enemyId]);
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
        } catch(e) {}

        try {
            const puppetFx = getEffectByName ? getEffectByName(playerId, 'redirect_aggro', dungeonId) : null;
            if (puppetFx) {
                const [allies] = await db.execute(
                    'SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND player_id!=? AND is_alive=1 LIMIT 1',
                    [dungeonId, playerId]
                );
                if (allies.length) retaliationTargetId = allies[0].player_id;
            }
            const invisFx = getTurnEffectByName ? (getTurnEffectByName(playerId, 'invisibility') || getTurnEffectByName(playerId, 'time_freeze')) : null;
            if (invisFx) {
                retaliation = 0; retaliationMessage = '';
            }

            // Titan's Roar / the Hollow King's Will — invincible charges block all incoming damage
            // (reuses the blessing state fetched above — `invincible` isn't touched
            // by the next_hit_mult update, so the earlier read is still accurate)
            try {
                const bStateInv = bStateShared || await getPlayerBlessingState(playerId, dungeonId);
                if (Number(bStateInv.invincible) > 0) {
                    retaliation = 0;
                    retaliationMessage = (retaliationMessage || '') + '\n🛡️ Blessing invincibility absorbed the hit!';
                    await updateBlessingState(playerId, dungeonId, { invincible: Number(bStateInv.invincible) - 1 });
                }
            } catch(invErr) {}
            const chaosFx = getTurnEffectByName ? getTurnEffectByName(playerId, 'chaos_mode') : null;
            if (chaosFx) {
                retaliation = Math.floor(retaliation * (1 + (chaosFx.data.amp || 0.5)));
            }
        } catch(potErr) {}

        if (shieldAbsorbed > 0) consumeShield('player', retaliationTargetId, shieldAbsorbed);
        await db.execute("UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?", [retaliation, retaliationTargetId]);
        try { trackHpLost(playerId, dungeonId, retaliation); } catch(e) {}
        try { if (retaliation > 0) mvpRecordTaken(`dungeon_${dungeonId}`, retaliationTargetId, retaliation); } catch(_m) {}
        if (retaliation > 0) {
            try {
                const { triggerBlessingIfReady } = require('../commands/skill');
                const [hitTarget] = await db.execute('SELECT * FROM players WHERE id=?', [retaliationTargetId]);
                if (hitTarget[0]) {
                    await triggerBlessingIfReady('three_consecutive_hits', retaliationTargetId, dungeonId, hitTarget[0], { id: dungeonId }, null);
                    if ((hitTarget[0].hp - retaliation) <= 0)
                        await triggerBlessingIfReady('on_death', retaliationTargetId, dungeonId, hitTarget[0], { id: dungeonId }, null);
                }
            } catch(e) { console.error('[Blessing retal]', e.message); }
        }

        try {
            const bloodpactFx = getEffectByName ? getEffectByName(playerId, 'damage_link', dungeonId) : null;
            if (bloodpactFx && bloodpactFx.data.linkTarget && retaliation > 0) {
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
            if (e.name !== 'The Hollow King') retaliation = Math.min(retaliation, Math.floor((Number(e.atk) || 0) * 2));
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
            const anchor = getEffectByName(playerId, 'auto_revive', dungeonId);
            if (anchor) {
                const healAmt = Math.floor(p.max_hp * (anchor.data.heal || 0.5));
                await db.execute('UPDATE players SET hp=? WHERE id=?', [healAmt, playerId]);
                clearEffect(playerId);
                const fatigueGainA = Math.min(4, Math.max(1, Math.ceil(damage / 120)));
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
            const reck = getEffectByName(playerId, 'death_stack', dungeonId);
            if (reck && reck.data?.maxHpPenalty) {
                await db.execute('UPDATE players SET max_hp = GREATEST(1, FLOOR(max_hp * 0.95)) WHERE id=?', [playerId]);
            }
        } catch(e3) {}
        await db.execute(
            "UPDATE dungeon_players SET is_alive=0 WHERE player_id=? AND dungeon_id=?",
            [playerId, dungeonId]
        );
        try {
            // Death Protect (Ichor of the Fallen) — keep all gold and XP on death
            const deathProtectFx = getEffectByName(playerId, 'death_protect', dungeonId);
            if (deathProtectFx) {
                clearEffect(playerId, 'death_protect'); // one-time use, consumed on death
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

    const fatigueGain = Math.min(4, Math.max(1, Math.ceil(damage / 120)));
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

// `enemyRow` lets the caller pass the already-fetched enemy row (the !skill hot
// path just looked it up) instead of re-SELECTing the same row.
async function playerSkill(playerId, dungeonId, enemyId, move, player, equippedItems, enemyRow = null) {
    let e = enemyRow;
    if (!e) {
        const [enemy] = await db.execute("SELECT * FROM dungeon_enemies WHERE id=?", [enemyId]);
        e = enemy[0];
    }
    const p = player;

    let evaded = false;

    // ── DOUBLE STRIKE SUPPORT ─────────────────────────────────
    let hits = 1;
    try {
        const turnFx = getTurnEffectByName(playerId, 'double_strike');
        if (turnFx) hits = turnFx.data.hits || 2;
    } catch (e) {}

    let totalDamage = 0;
    for (let i = 0; i < hits; i++) {
        let hitDamage = calculateMoveDamage(p, move, e, equippedItems, { noTick: i < (hits - 1) });
        if (move.stat !== 'intelligence' && evasionCheck(p, e)) {
            hitDamage = Math.floor(hitDamage * 0.5);
            evaded = true;
        }
        totalDamage += hitDamage;
    }
    let damage = totalDamage;

    // Eclipse clan blessing — permanent damage_boost for rest of dungeon after final stage trigger
    // Titan's Roar / the Hollow King's Will — next_hit_mult consumed on the next outgoing attack
    let bStateShared = null; // fetched once, reused by the invincible check below
    try {
        const bState2 = await getPlayerBlessingState(playerId, dungeonId);
        bStateShared = bState2;
        if (bState2.damage_boost > 0) {
            damage = Math.floor(damage * (1 + Number(bState2.damage_boost)));
        }
        if (Number(bState2.next_hit_mult) > 0) {
            damage = Math.floor(damage * Number(bState2.next_hit_mult));
            evaded = false;
            const remainingCharges2 = Math.max(0, Number(bState2.charges || 0) - 1);
            await updateBlessingState(playerId, dungeonId, {
                charges: remainingCharges2,
                next_hit_mult: remainingCharges2 > 0 ? Number(bState2.next_hit_mult) : 0
            });
        }
    } catch(eclipseErr2) {}

    // Territory bonus: Umbral Court (+25% damage) — cached lookup.
    try {
        const { getDamageBonusMultiplier } = require('../systems/territoryBonusSystem');
        const terrMult = await getDamageBonusMultiplier(playerId);
        if (terrMult > 1) damage = Math.floor(damage * terrMult);
    } catch(e) {}

    await db.execute("UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?", [damage, enemyId]);
    await addDamageContribution(dungeonId, enemyId, playerId, damage);

    try { mvpRecordDmg(`dungeon_${dungeonId}`, playerId, damage); } catch(e) {}

    // Re-read only current_hp (concurrency-correct defeated check, minimal cost)
    const [updatedEnemy] = await db.execute("SELECT current_hp FROM dungeon_enemies WHERE id=?", [enemyId]);
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
        } catch(e) {}

        try {
            const puppetFx = getEffectByName ? getEffectByName(playerId, 'redirect_aggro', dungeonId) : null;
            if (puppetFx) {
                const [allies] = await db.execute(
                    'SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND player_id!=? AND is_alive=1 LIMIT 1',
                    [dungeonId, playerId]
                );
                if (allies.length) retaliationTargetId = allies[0].player_id;
            }
            const invisFx = getTurnEffectByName ? (getTurnEffectByName(playerId, 'invisibility') || getTurnEffectByName(playerId, 'time_freeze')) : null;
            if (invisFx) {
                retaliation = 0; retaliationMessage = '';
            }

            // Titan's Roar / the Hollow King's Will — invincible charges block all incoming damage
            // (reuses the blessing state fetched above — `invincible` isn't touched
            // by the next_hit_mult update, so the earlier read is still accurate)
            try {
                const bStateInv = bStateShared || await getPlayerBlessingState(playerId, dungeonId);
                if (Number(bStateInv.invincible) > 0) {
                    retaliation = 0;
                    retaliationMessage = (retaliationMessage || '') + '\n🛡️ Blessing invincibility absorbed the hit!';
                    await updateBlessingState(playerId, dungeonId, { invincible: Number(bStateInv.invincible) - 1 });
                }
            } catch(invErr) {}
            const chaosFx = getTurnEffectByName ? getTurnEffectByName(playerId, 'chaos_mode') : null;
            if (chaosFx) {
                retaliation = Math.floor(retaliation * (1 + (chaosFx.data.amp || 0.5)));
            }
        } catch(potErr) { console.log('Retaliation potion error:', potErr.message); }

        if (shieldAbsorbed > 0) consumeShield('player', retaliationTargetId, shieldAbsorbed);
        await db.execute("UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?", [retaliation, retaliationTargetId]);
        try { trackHpLost(playerId, dungeonId, retaliation); } catch(e2) {}
        try { if (retaliation > 0) mvpRecordTaken(`dungeon_${dungeonId}`, retaliationTargetId, retaliation); } catch(_m) {}
        if (retaliation > 0) {
            try {
                const { triggerBlessingIfReady } = require('../commands/skill');
                const [hitTarget] = await db.execute('SELECT * FROM players WHERE id=?', [retaliationTargetId]);
                if (hitTarget[0]) {
                    await triggerBlessingIfReady('three_consecutive_hits', retaliationTargetId, dungeonId, hitTarget[0], { id: dungeonId }, null);
                    if ((hitTarget[0].hp - retaliation) <= 0)
                        await triggerBlessingIfReady('on_death', retaliationTargetId, dungeonId, hitTarget[0], { id: dungeonId }, null);
                }
            } catch(e) { console.error('[Blessing retal]', e.message); }
        }

        try {
            const bloodpactFx = getEffectByName ? getEffectByName(playerId, 'damage_link', dungeonId) : null;
            if (bloodpactFx && bloodpactFx.data.linkTarget && retaliation > 0) {
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
            if (e.name !== 'The Hollow King') retaliation = Math.min(retaliation, Math.floor((Number(e.atk) || 0) * 2));
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
            const anchor = getEffectByName(playerId, 'auto_revive', dungeonId);
            if (anchor) {
                const healAmt = Math.floor(p.max_hp * (anchor.data.heal || 0.5));
                await db.execute('UPDATE players SET hp=? WHERE id=?', [healAmt, playerId]);
                clearEffect(playerId);
                const fatigueGainA = Math.min(4, Math.max(1, Math.ceil(damage / 120)));
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
            const reck = getEffectByName(playerId, 'death_stack', dungeonId);
            if (reck && reck.data?.maxHpPenalty) {
                await db.execute('UPDATE players SET max_hp = GREATEST(1, FLOOR(max_hp * 0.95)) WHERE id=?', [playerId]);
            }
        } catch(e3) {}
        await db.execute(
            "UPDATE dungeon_players SET is_alive=0 WHERE player_id=? AND dungeon_id=?",
            [playerId, dungeonId]
        );
        try {
            // Death Protect (Ichor of the Fallen) — keep all gold and XP on death
            const deathProtectFx = getEffectByName(playerId, 'death_protect', dungeonId);
            if (deathProtectFx) {
                clearEffect(playerId, 'death_protect'); // one-time use, consumed on death
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

    const fatigueGain = Math.min(4, Math.max(1, Math.ceil(damage / 120)));
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

    // Dungeon modifier multipliers: GOLDEN = gold ×3, CURSED = gold+xp ×2.
    let goldMult = 1, expMult = 1;
    try {
        const [dg] = await db.execute("SELECT modifier FROM dungeon WHERE id=?", [dungeonId]);
        const mod = dg[0]?.modifier;
        if (mod === 'GOLDEN') goldMult = 3;
        else if (mod === 'CURSED') { goldMult = 2; expMult = 2; }
    } catch(e) {}

    const totalExp  = Number(enemy[0].exp)  * expMult;
    const totalGold = Number(enemy[0].gold) * goldMult;
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

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();
            await conn.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [expEarned, c.player_id]);
            await conn.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [goldEarned, c.player_id]);
            await conn.execute(
                "UPDATE dungeon_players SET session_gold = session_gold + ?, session_xp = session_xp + ? WHERE player_id=? AND dungeon_id=?",
                [goldEarned, expEarned, c.player_id, dungeonId]
            );
            await conn.commit();
        } catch(txErr) {
            await conn.rollback();
            console.error(`[TX] Reward rollback for ${c.player_id}:`, txErr.message);
        } finally {
            conn.release();
        }

        try {
            const harvest = getEffectByName(c.player_id, 'kill_hp_gain', dungeonId);
            if (harvest) {
                const gainAmt = Math.floor(Number(enemy[0].max_hp) * (harvest.data.percent || 0.1));
                await db.execute('UPDATE players SET hp = LEAST(max_hp, hp + ?) WHERE id=?', [gainAmt, c.player_id]);
            }
        } catch(e2) {}

        const [pl] = await db.execute("SELECT nickname FROM players WHERE id=?", [c.player_id]);
        rewards.push({
            playerId: c.player_id,
            nickname: pl[0].nickname,
            damage:   Number(c.damage_dealt),
            exp:      expEarned,
            gold:     goldEarned
        });
    }

    // Sunshard (Hollow Sun invader) — killing it grants +25 Void Resonance.
    // (Internal gain key 'sunshard_kill' kept — it's just an id.)
    if (enemy[0].name === 'Sunshard') {
        try {
            const { addVoidResonance } = require('../systems/ascendantSystem');
            for (const r of rewards) await addVoidResonance(r.playerId, 'sunshard_kill', null).catch(() => {});
            console.log(`☄️ Sunshard slain in dungeon ${dungeonId} — resonance granted to ${rewards.length} hunter(s).`);
        } catch(e) {}
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

async function advanceStage(dungeonId, nextStage, client = null) {
    await db.execute("UPDATE dungeon SET stage=?, stage_cleared=0 WHERE id=?", [nextStage, dungeonId]);
    await db.execute("DELETE FROM dungeon_enemies WHERE dungeon_id=? AND current_hp <= 0", [dungeonId]);
    const [dungeon] = await db.execute("SELECT dungeon_rank, modifier FROM dungeon WHERE id=?", [dungeonId]).catch(() => [[{}]]);
    const rank = dungeon[0]?.dungeon_rank;
    const modifier = dungeon[0]?.modifier || null;
    if (rank && rank.startsWith('P')) {
        const { spawnPrestigeEnemies } = require('./prestigeDungeon');
        await spawnPrestigeEnemies(dungeonId, rank, nextStage);
    } else {
        await spawnStageEnemies(dungeonId, rank, nextStage);
    }

    // ── CURSED modifier: freshly spawned enemies hit/soak +50% ───────────────
    if (modifier === 'CURSED') {
        await db.execute(
            "UPDATE dungeon_enemies SET max_hp=FLOOR(max_hp*1.5), current_hp=FLOOR(current_hp*1.5), atk=FLOOR(atk*1.5), def=FLOOR(def*1.5) WHERE dungeon_id=? AND current_hp > 0",
            [dungeonId]
        ).catch(() => {});
    }

    // ── THE HOLLOW SUN: SUNSHARD INVASION ────────────────────
    // Normal ranked dungeons only; 8% per stage (16% in FRACTURED dungeons).
    // The shard's light throws every hunter's reflection back at them: each
    // player must beat THEIR OWN mirror (which uses their moveset) before they
    // can advance. Beating yours grants +25 Void Resonance. Because the gate is
    // per-player, the party splits — whoever finishes first can push ahead.
    try {
        if (rank && !rank.startsWith('TERRITORY_') && !['HOLLOWKING','VESPERION','CINDERMAW','UMBRYSS'].includes(rank)) {
            const { getFlag } = require('../systems/gameFlags');
            if ((await getFlag('hollow_sun_active')) === '1') {
                const chance = modifier === 'FRACTURED' ? 0.16 : 0.08;
                if (Math.random() < chance) {
                    const { spawnReflections } = require('../systems/reflectionSystem');
                    const spawned = await spawnReflections(dungeonId, rank);
                    if (spawned.length && client) {
                        const { sunshardInvasionText } = require('../systems/hollowSunLore');
                        await client.sendMessage(getDungeonGroup(dungeonId), { text: sunshardInvasionText() }).catch(() => {});
                        await client.sendMessage(getDungeonGroup(dungeonId), {
                            text:
                                '╔══〘 ☄️ SUNSHARD INVASION 〙══╗\n' +
                                '┃★ The shard\'s light throws you back\n' +
                                '┃★ at yourselves.\n' +
                                '┃★\n' +
                                spawned.map(s => `┃★ 🪞 *${s.nickname}* vs their reflection — ${s.hp.toLocaleString()} HP`).join('\n') + '\n' +
                                '┃★\n' +
                                '┃★ They know every move you know.\n' +
                                '┃★ They can heal. They can shield.\n' +
                                '┃★\n' +
                                '┃★ ⚔️ !skill <move> — fight your own\n' +
                                '┃★ 🤝 !skill <move> <name> — help an ally\n' +
                                '┃★ (it will strike back at YOU)\n' +
                                '┃★ Break yours to move on. *+25 Resonance*\n' +
                                '╚═══════════════════════════╝'
                        }).catch(() => {});
                    }
                    console.log(`🪞 Sunshard crashed into dungeon ${dungeonId} — ${spawned.length} reflection(s) spawned.`);
                }
            }
        }
    } catch(e) { console.error('Sunshard reflection error:', e.message); }

    // ── CHAPTER 1 EVENT: DUSKSPAWN INVASIONS (F–D dungeons) ──────────────────
    // Active between "The Blue Flame" and the Vesperion unlock; chance rises
    // after "The Whelps". Content/gates: src/systems/storyEvents.js
    try {
        if (['F', 'E', 'D'].includes(rank)) {
            const { duskspawnActive, duskspawnChance } = require('../systems/storyEvents');
            if (await duskspawnActive() && Math.random() < await duskspawnChance()) {
                const SPAWN_STATS = { F: { hp: 700, atk: 26, def: 10 }, E: { hp: 1100, atk: 42, def: 16 }, D: { hp: 1700, atk: 62, def: 24 } };
                const s = SPAWN_STATS[rank];
                await db.execute(
                    "INSERT INTO dungeon_enemies (dungeon_id, name, max_hp, current_hp, atk, def, exp, gold, evasion, moves) VALUES (?, 'Duskspawn', ?, ?, ?, ?, ?, ?, 12, ?)",
                    [dungeonId, s.hp, s.hp, s.atk, s.def, Math.floor(s.hp / 5), Math.floor(s.hp / 4),
                     JSON.stringify([{ name: 'Newborn Fang', damage: 1.4 }, { name: 'Hungry Dark', damage: 1.1 }])]
                );
                if (client) {
                    await client.sendMessage(getDungeonGroup(dungeonId), {
                        text:
                            '╔══〘 🐾 DUSKSPAWN 〙══╗\n' +
                            '┃★ The candle at the entrance\n' +
                            '┃★ just turned blue.\n' +
                            '┃★ Something young slipped in\n' +
                            '┃★ with you. It is hungry.\n' +
                            '┃★ ⚔️ Kill the *Duskspawn* —\n' +
                            '┃★ bonus Lumens on its corpse.\n' +
                            '╚═══════════════════════╝'
                    }).catch(() => {});
                }
                console.log(`🐾 Duskspawn invaded dungeon ${dungeonId} (rank ${rank}).`);
            }
        }
    } catch(e) { console.error('Duskspawn invasion error:', e.message); }
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
        try { await require('../systems/reflectionSystem').clearReflections(dungeonId); } catch(e) {}
        console.log(`🏰 Dungeon ${dungeonId} closed (empty).`);
        const [dRank] = await db.execute('SELECT dungeon_rank FROM dungeon WHERE id=?', [dungeonId]).catch(() => [[{}]]);
        if (client && !dRank[0]?.dungeon_rank?.startsWith('P')) {
            trySpawnPrestigeDungeon(client, getDungeonGroup(dungeonId)).catch(e => console.error('★ Prestige spawn error:', e.message));
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

// `preloaded` lets callers that already fetched the enemy list skip a duplicate
// full-table read (the !skill hot path fetches it right before targeting).
async function findEnemyTarget(dungeonId, targetArg, preloaded = null) {
    const enemies = preloaded || await getCurrentEnemies(dungeonId);
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

    let text = `${box}
`;
    text += `${bul} Rank: ${d.dungeon_rank}  •  Stage: ${d.stage}/${d.max_stage}
`;
    text += `${bar}
`;

    enemies.forEach((e, i) => {
        let moveNames = '—';
        try {
            const parsed = typeof e.moves === 'string' ? JSON.parse(e.moves) : e.moves;
            if (Array.isArray(parsed) && parsed.length) moveNames = parsed.map(m => m.name).join(', ');
        } catch (_) {}
        text += `${bul} ${i + 1}. ${e.name}
`;
        text += `${bul}    ❤️ HP:  ${e.current_hp}/${e.max_hp}
`;
        text += `${bul}    ⚔️ ATK: ${e.atk}
`;
        text += `${bul}    🛡️ DEF: ${e.def}
`;
        text += `${bul}    🗡️ Moves: ${moveNames}
`;
        if (i < enemies.length - 1) text += `${bar}
`;
    });

    text += `${bar}
${bul} 🧭 !skill <move> [enemy #]
${close}`;
    return text;
}

async function getDungeonStatusText(dungeonId) {
    const [dungeon] = await db.execute("SELECT * FROM dungeon WHERE id=?", [dungeonId]);
    if (!dungeon.length) return "Dungeon not found.";
    const d = dungeon[0];
    const enemies = await getCurrentEnemies(dungeonId);
    const isPrestige = d.dungeon_rank && d.dungeon_rank.startsWith('P');
    const [box, bar, bul, close] = isPrestige
        ? ['╔══〘 ✦ PRESTIGE STATUS 〙══╗', '┃★────────────', '┃★', '╚═══════════════════════════╝']
        : ['══〘 🏰 DUNGEON STATUS 〙══╮', '┃◆────────────', '┃◆', '╰═══════════════════════╯'];

    let text = `${box}
`;
    text += `${bul} Rank: ${d.dungeon_rank}  •  Stage: ${d.stage}/${d.max_stage}
`;
    text += `${bul} Locked: ${d.locked ? '🔒 YES' : '🔓 NO'}
`;
    text += `${bar}
`;
    if (enemies.length === 0) {
        text += `${bul} ✅ All enemies defeated!
`;
        text += `${bul} 🧭 Use !onward to advance
`;
    } else {
        text += `${bul} 👾 ENEMIES:
`;
        enemies.forEach((e, i) => {
            text += `${bul}   ${i+1}. ${e.name} (${e.current_hp}/${e.max_hp} HP)
`;
        });
    }
    text += `${bar}
${bul} 🧭 !skill <move> [target]
${close}`;
    return text;
}

module.exports = {
    getRaidGroup,
    getDungeonGroup,
    setDungeonGroup,
    dungeonGroupMap,
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
    announceDungeonModifier,
    clearLobbyTimer,
    dungeonLocks,
    clearDungeonTimers,
    getDungeonMvp,
    getDungeonMvpContributions
};