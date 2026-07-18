/**
 * TITLE SYSTEM
 * Titles earned through achievements. Shown in !me under name.
 */
const db = require('../database/db');

const TITLES = {
    // Dungeon achievements
    'First Blood':       { condition: 'dungeon_clear', count: 1,   reward: 'First Blood',       desc: 'Cleared your first dungeon' },
    'Veteran Hunter':    { condition: 'dungeon_clear', count: 50,  reward: 'Veteran Hunter',    desc: 'Cleared 50 dungeons' },
    'Dungeon Destroyer': { condition: 'dungeon_clear', count: 200, reward: 'Dungeon Destroyer', desc: 'Cleared 200 dungeons' },
    // Rank achievements
    'S-Class':           { condition: 'reach_rank',   target: 'S', reward: 'S-Class',          desc: 'Reached S Rank' },
    'Void Walker':       { condition: 'prestige',     count: 1,    reward: 'Void Walker',       desc: 'First prestige' },
    'Void Sovereign':    { condition: 'prestige_rank',target: 'PS',reward: 'Void Sovereign',   desc: 'Reached PS Rank' },
    // Combat
    'Ghost':             { condition: 'evasion',      count: 100,  reward: 'Ghost',             desc: '100 attacks evaded' },
    'Unstoppable':       { condition: 'kills',        count: 500,  reward: 'Unstoppable',       desc: '500 enemies killed' },
    'Phantom':           { condition: 'phantom_shift',count: 1,    reward: 'Phantom',           desc: 'Phantom Shift activated' },
    // Clan
    'Clan Founder':      { condition: 'clan_create',  count: 1,    reward: 'Clan Founder',      desc: 'Founded a clan' },
    'War Chief':         { condition: 'clan_war_win', count: 1,    reward: 'War Chief',         desc: 'Won a clan war' },
    // Exploration
    'Void Scholar':      { condition: 'explore',      count: 10,   reward: 'Void Scholar',      desc: 'Completed 10 explorations' },
    'Alchemist':         { condition: 'brew',         count: 20,   reward: 'Alchemist',         desc: 'Brewed 20 potions' },
    // Special
    'The Reckless':      { condition: 'void_madness', count: 5,    reward: 'The Reckless',      desc: 'Used Void Madness 5 times' },
    "the Hollow King's Eye":    { condition: 'malachar_frag',count: 3,    reward: "the Hollow King's Eye",    desc: 'Found 3 the Hollow King Fragments' }
};

async function ensureTitleTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS player_titles (
            player_id    VARCHAR(50) NOT NULL,
            title        VARCHAR(100) NOT NULL,
            earned_at    DATETIME DEFAULT NOW(),
            is_equipped  TINYINT DEFAULT 0,
            PRIMARY KEY (player_id, title)
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS title_progress (
            player_id  VARCHAR(50) NOT NULL,
            condition  VARCHAR(50) NOT NULL,
            progress   INT DEFAULT 0,
            PRIMARY KEY (player_id, \`condition\`)
        )
    `).catch(() => {});
}

async function awardTitle(playerId, titleKey, client = null, RAID_GROUP = null) {
    await ensureTitleTables();
    const [existing] = await db.execute(
        "SELECT title FROM player_titles WHERE player_id=? AND title=?",
        [playerId, titleKey]
    );
    if (existing.length) return;

    await db.execute(
        "INSERT IGNORE INTO player_titles (player_id, title) VALUES (?, ?)",
        [playerId, titleKey]
    );

    const [p] = await db.execute("SELECT nickname FROM players WHERE id=?", [playerId]);
    const nick = p[0]?.nickname || playerId;

    if (client && RAID_GROUP) {
        await client.sendMessage(RAID_GROUP, {
            text:
                `╔══〘 🏅 TITLE UNLOCKED 〙══╗\n` +
                `┃◆\n` +
                `┃◆ *${nick}* earned a title:\n` +
                `┃◆\n` +
                `┃◆ 〝*${titleKey}*〞\n` +
                `┃◆ ${TITLES[titleKey]?.desc || ''}\n` +
                `┃◆\n` +
                `┃◆ !title equip to wear it.\n` +
                `╚═══════════════════════════╝`
        }).catch(() => {});
    }
}

async function updateTitleProgress(playerId, condition, target = null, amount = 1, client = null, RAID_GROUP = null) {
    await ensureTitleTables();
    await db.execute(`
        INSERT INTO title_progress (player_id, \`condition\`, progress) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE progress = progress + ?
    `, [playerId, condition, amount, amount]);

    const [prog] = await db.execute(
        "SELECT progress FROM title_progress WHERE player_id=? AND `condition`=?",
        [playerId, condition]
    );
    const current = prog[0]?.progress || 0;

    for (const [key, t] of Object.entries(TITLES)) {
        if (t.condition !== condition) continue;
        if (t.target && target && t.target !== target) continue;
        if (t.count && current >= t.count) {
            await awardTitle(playerId, key, client, RAID_GROUP);
        }
    }
}

async function getEquippedTitle(playerId) {
    const [rows] = await db.execute(
        "SELECT title FROM player_titles WHERE player_id=? AND is_equipped=1 LIMIT 1",
        [playerId]
    );
    return rows[0]?.title || null;
}

async function getPlayerTitles(playerId) {
    const [rows] = await db.execute(
        "SELECT title, earned_at, is_equipped FROM player_titles WHERE player_id=? ORDER BY earned_at DESC",
        [playerId]
    );
    return rows;
}

module.exports = { TITLES, ensureTitleTables, awardTitle, updateTitleProgress, getEquippedTitle, getPlayerTitles };