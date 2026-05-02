/**
 * PRESTIGE DUNGEON SYSTEM
 * Separate from normal dungeons.
 * Uses prestigeEnemies.js — enemies start at 1000HP for PF rank.
 * Prestige rank maps: F→PF, E→PE, D→PD, C→PC, B→PB, A→PA, S→PS
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

async function spawnPrestigeEnemies(dungeonId, prestigeRank, stage) {
    const data = prestigeEnemies[prestigeRank];
    if (!data) return;

    const maxStage = MAX_STAGES[prestigeRank] || 3;
    const isBoss = stage === maxStage;

    let toSpawn = [];
    if (isBoss) {
        toSpawn = [{ ...data.boss }];
    } else {
        // 3-6 enemies per stage
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

    // Lore lines per rank
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
            `┃★ Portal closes in 10 minutes.\n` +
            `┃★ \n` +
            `╚═══════════════════════════╝`,
        mentions
    });

    return dungeonId;
}

module.exports = {
    spawnPrestigeDungeon,
    spawnPrestigeEnemies,
    getPrestigeRankForPlayer,
    PRESTIGE_RANK_MAP,
    PRESTIGE_RANK_ORDER,
    MAX_STAGES
};