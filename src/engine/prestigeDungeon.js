/**
 * PRESTIGE DUNGEON SYSTEM
 * Separate from normal dungeons.
 * Uses prestigeEnemies.js — enemies start at 1000HP for PF rank.
 * Prestige rank maps: F→PF, E→PE, D→PD, C→PC, B→PB, A→PA, S→PS
 * Auto-spawns after normal dungeon ends (complete, expire, or admin close).
 */

const db = require('../database/db');
const prestigeEnemies = require('../data/prestigeEnemies');

const PRESTIGE_RANK_MAP = {
    F: 'PF', E: 'PE', D: 'PD', C: 'PC', B: 'PB', A: 'PA', S: 'PS'
};

const PRESTIGE_RANK_ORDER = ['PF', 'PE', 'PD', 'PC', 'PB', 'PA', 'PS'];

const PRESTIGE_BOSSES = {
    PF: 'Void Sentinel',
    PE: 'Fracture Beast',
    PD: 'Void Warlord',
    PC: 'Abyss Monarch',
    PB: 'The Fracture God',
    PA: "Malachar's Herald",
    PS: 'Malachar'
};

const MAX_STAGES = { PF: 3, PE: 3, PD: 4, PC: 4, PB: 5, PA: 5, PS: 6 };

// ── PRESTIGE LOBBY TIMER ─────────────────────────────────
const PRESTIGE_LOBBY_WARN_MS  = 8  * 60 * 1000;
const PRESTIGE_LOBBY_CLOSE_MS = 10 * 60 * 1000;
const prestigeLobbyTimers = new Map(); // dungeonId -> { warning, timeout }

function clearPrestigeLobbyTimer(dungeonId) {
    const t = prestigeLobbyTimers.get(dungeonId);
    if (t) {
        clearTimeout(t.warning);
        clearTimeout(t.timeout);
        prestigeLobbyTimers.delete(dungeonId);
    }
}

function startPrestigeLobbyTimer(dungeonId, client, RAID_GROUP) {
    clearPrestigeLobbyTimer(dungeonId);
    const { sendWithRetry } = require('../utils/sendWithRetry');

    const warning = setTimeout(async () => {
        try {
            await sendWithRetry(client, RAID_GROUP, {
                text:
                    `╔══〘 ✦ PRESTIGE PORTAL 〙══╗\n` +
                    `┃★ ⚠️ The void rift is destabilizing!\n` +
                    `┃★ ⏳ 2 minutes left to enter.\n` +
                    `┃★ DM !enter now — Prestige Hunters only.\n` +
                    `╚═══════════════════════════╝`
            });
        } catch (e) {}
    }, PRESTIGE_LOBBY_WARN_MS);

    const timeout = setTimeout(async () => {
        try {
            const [rows] = await db.execute(
                "SELECT id FROM dungeon WHERE id=? AND is_active=1 AND locked=0",
                [dungeonId]
            );
            if (rows.length) {
                await db.execute("UPDATE dungeon SET is_active=0 WHERE id=?", [dungeonId]);
                await sendWithRetry(client, RAID_GROUP, {
                    text:
                        `╔══〘 ✦ PRESTIGE PORTAL 〙══╗\n` +
                        `┃★ The void rift has sealed itself.\n` +
                        `┃★ No Prestige Hunters stepped through.\n` +
                        `┃★ The darkness recedes... for now.\n` +
                        `╚═══════════════════════════╝`
                });
                console.log(`★ Prestige dungeon ${dungeonId} expired — no one entered.`);
            }
        } catch (e) {
            console.error('Prestige lobby timeout error:', e.message);
        }
        prestigeLobbyTimers.delete(dungeonId);
    }, PRESTIGE_LOBBY_CLOSE_MS);

    prestigeLobbyTimers.set(dungeonId, { warning, timeout });
}
// ─────────────────────────────────────────────────────────

// ── WEIGHTED PRESTIGE RANK ───────────────────────────────
// Same weighted concept as normal dungeons, but only counts prestige players.
// Uses their base rank mapped to prestige rank.
async function getWeightedPrestigeRank() {
    const [rows] = await db.execute(
        "SELECT `rank`, COUNT(*) as cnt FROM players WHERE COALESCE(prestige_level,0) > 0 GROUP BY `rank`"
    );
    if (!rows.length) return 'PF';

    const rankOrder = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
    const total = rows.reduce((sum, r) => sum + Number(r.cnt), 0);
    const weights = {};
    rankOrder.forEach(r => { weights[r] = 0; });

    for (const row of rows) {
        const idx  = rankOrder.indexOf(row.rank);
        if (idx === -1) continue;
        const base = Number(row.cnt) / total;
        weights[row.rank]                      += base * 0.6;
        if (idx > 0)                    weights[rankOrder[idx - 1]] += base * 0.2;
        if (idx < rankOrder.length - 1) weights[rankOrder[idx + 1]] += base * 0.2;
    }

    let cumulative = 0;
    const roll = Math.random();
    for (const rank of rankOrder) {
        cumulative += weights[rank] || 0;
        if (roll <= cumulative) return PRESTIGE_RANK_MAP[rank] || 'PF';
    }
    return 'PF';
}
// ─────────────────────────────────────────────────────────

async function spawnPrestigeEnemies(dungeonId, prestigeRank, stage) {
    const data = prestigeEnemies[prestigeRank];
    if (!data) return;

    const maxStage = MAX_STAGES[prestigeRank] || 3;
    const isBoss = stage === maxStage;

    let toSpawn = [];
    if (isBoss) {
        toSpawn = [{ ...data.boss }];
    } else {
        const count = Math.floor(Math.random() * 4) + 3;
        for (let i = 0; i < count; i++) {
            const mini = data.miniBosses[Math.floor(Math.random() * data.miniBosses.length)];
            toSpawn.push({ ...mini });
        }
    }

    for (const e of toSpawn) {
        await db.execute(
            `INSERT INTO dungeon_enemies (dungeon_id, name, hp, max_hp, atk, def, exp, gold, stage, is_boss, moves)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dungeonId, e.name, e.hp, e.hp, e.atk, e.def,
             e.exp, e.gold, stage, isBoss ? 1 : 0,
             JSON.stringify(e.moves || [])]
        );
    }
}

async function getPrestigeRankForPlayer(playerId) {
    const [rows] = await db.execute(
        "SELECT `rank`, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
        [playerId]
    );
    if (!rows.length) return null;
    return PRESTIGE_RANK_MAP[rows[0].rank] || 'PF';
}

async function spawnPrestigeDungeon(prestigeRank, client, RAID_GROUP) {
    const data = prestigeEnemies[prestigeRank];
    if (!data) return null;

    const maxStage = MAX_STAGES[prestigeRank] || 3;
    const bossName = PRESTIGE_BOSSES[prestigeRank];

    // Check no active prestige dungeon
    const [active] = await db.execute(
        "SELECT id FROM dungeon WHERE is_active=1 AND dungeon_rank LIKE 'P%' LIMIT 1"
    );
    if (active.length) return null;

    const [result] = await db.execute(
        `INSERT INTO dungeon (dungeon_rank, stage, max_stage, boss_name, is_active, stage_cleared, in_combat, locked)
         VALUES (?, 1, ?, ?, 1, 0, 0, 0)`,
        [prestigeRank, maxStage, bossName]
    );
    const dungeonId = result.insertId;

    await spawnPrestigeEnemies(dungeonId, prestigeRank, 1);

    const lorelines = {
        PF: 'The void left something behind when the Leviathan fell.',
        PE: 'The Fracture deepens. The ground between worlds grows thin.',
        PD: 'These creatures did not come from a Gate. They came from what was left.',
        PC: 'Malachar is not here yet. But his influence has been for centuries.',
        PB: 'The system cannot classify what comes next.',
        PA: "Malachar's heralds do not announce. They arrive.",
        PS: 'This is the end. Or the beginning of what comes after the end.'
    };

    const { sendWithRetry } = require('../utils/sendWithRetry');
    const { tagAll } = require('../utils/tagAll');
    let mentions = [];
    try { const t = await tagAll(client); mentions = t.mentions || []; } catch(e) {}

    await sendWithRetry(client, RAID_GROUP, {
        text:
            `╔══〘 ✦ PRESTIGE DUNGEON 〙══╗\n` +
            `┃★ \n` +
            `┃★ 〝${lorelines[prestigeRank]}〞\n` +
            `┃★ \n` +
            `┃★────────────\n` +
            `┃★ Rank:    ${prestigeRank}\n` +
            `┃★ Stages:  ${maxStage}\n` +
            `┃★ Boss:    ${bossName}\n` +
            `┃★ \n` +
            `┃★ ⚠️ Prestige Hunters only.\n` +
            `┃★ DM !enter to join.\n` +
            `┃★ ⏳ Portal closes in 10 minutes.\n` +
            `┃★ \n` +
            `╚═══════════════════════════╝`,
        mentions
    });

    // Start prestige lobby timer
    startPrestigeLobbyTimer(dungeonId, client, RAID_GROUP);

    return dungeonId;
}

// ── PUBLIC TRIGGER — called after any normal dungeon ends ──
// Checks if prestige players exist, picks weighted rank, spawns after short delay.
async function trySpawnPrestigeDungeon(client, RAID_GROUP) {
    try {
        // Check if any prestige players exist
        const [prestigePlayers] = await db.execute(
            "SELECT COUNT(*) as cnt FROM players WHERE COALESCE(prestige_level,0) > 0"
        );
        if (!prestigePlayers[0]?.cnt) { console.log('★ No prestige players — skip spawn'); return; }

        // Check no prestige dungeon already active
        const [alreadyActive] = await db.execute(
            "SELECT id FROM dungeon WHERE is_active=1 AND dungeon_rank LIKE 'P%' LIMIT 1"
        );
        if (alreadyActive.length) { console.log('★ Prestige dungeon already active — skip spawn'); return; }

        // Short delay so normal dungeon closure messages settle first
        await new Promise(r => setTimeout(r, 3000));

        console.log('★ RAID_GROUP for prestige spawn:', RAID_GROUP);
        const prestigeRank = await getWeightedPrestigeRank();
        console.log(`★ Auto-spawning prestige dungeon rank ${prestigeRank}`);
        await spawnPrestigeDungeon(prestigeRank, client, RAID_GROUP);
    } catch (e) {
        console.error('★ trySpawnPrestigeDungeon error:', e.message, e.stack);
    }
}

module.exports = {
    spawnPrestigeDungeon,
    spawnPrestigeEnemies,
    getPrestigeRankForPlayer,
    getWeightedPrestigeRank,
    trySpawnPrestigeDungeon,
    clearPrestigeLobbyTimer,
    PRESTIGE_RANK_MAP,
    PRESTIGE_RANK_ORDER,
    MAX_STAGES
};