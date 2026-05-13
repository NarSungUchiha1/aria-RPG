const db = require('../database/db');

// ── TABLE SETUP ──────────────────────────────────────────────────────────────
async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS quests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(100) NOT NULL,
            description TEXT,
            quest_type ENUM('daily','achievement','party') DEFAULT 'daily',
            objective_type VARCHAR(50),
            objective_target VARCHAR(50),
            objective_count INT DEFAULT 1,
            reward_gold INT DEFAULT 0,
            reward_xp INT DEFAULT 0,
            reward_sp INT DEFAULT 0,
            reward_item VARCHAR(100),
            reward_title VARCHAR(100),
            is_active TINYINT DEFAULT 1
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS player_quests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            player_id VARCHAR(50) NOT NULL,
            quest_id INT NOT NULL,
            progress INT DEFAULT 0,
            completed TINYINT DEFAULT 0,
            claimed TINYINT DEFAULT 0,
            assigned_date DATE,
            UNIQUE KEY unique_player_quest_date (player_id, quest_id, assigned_date)
        )
    `).catch(() => {});

    // ── Migrate: add id column if the table existed before this version ──────
    await db.execute(
        `ALTER TABLE player_quests ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST`
    ).catch(() => {}); // silently ignored if column already exists

    // ── Seed quests if table is empty ─────────────────────────────────────────
    const [count] = await db.execute('SELECT COUNT(*) as cnt FROM quests').catch(() => [[{ cnt: 1 }]]);
    if (count[0].cnt > 0) return;

    const seeds = [
        // ── DAILY ─────────────────────────────────────────────────────────────
        ['Dungeon Diver',      'Enter any dungeon.',                       'daily', 'dungeon_enter',   null, 1,  500,  300, 0, null, null],
        ['Stage Clearer',      'Clear 2 dungeon stages.',                  'daily', 'stage_clear',     null, 2,  800,  500, 0, null, null],
        ['Dungeon Victor',     'Clear a full dungeon without dying.',      'daily', 'dungeon_survive', null, 1, 1200,  800, 0, null, null],
        ['Blood & Gold',       'Clear any dungeon.',                       'daily', 'dungeon_clear',   null, 1,  700,  600, 0, null, null],
        ['Repeat Raider',      'Clear 3 dungeon stages total.',            'daily', 'stage_clear',     null, 3, 1000,  700, 0, null, null],
        ['PvP Challenger',     'Win a duel.',                              'daily', 'pvp_win',         null, 1,  600,  400, 0, null, null],
        ['Survivor',           'Survive any dungeon.',                     'daily', 'dungeon_survive', null, 1,  600,  400, 0, null, null],
        ['Stage Grinder',      'Clear 5 stages in one day.',               'daily', 'stage_clear',     null, 5, 1500, 1000, 0, null, null],

        // ── ACHIEVEMENT ───────────────────────────────────────────────────────
        ['First Blood',        'Win your first PvP duel.',                 'achievement', 'pvp_win',         null,  1, 2000, 1500, 10, null, 'Duelist'],
        ['Veteran Duelist',    'Win 10 PvP duels.',                        'achievement', 'pvp_win',         null, 10, 8000, 5000, 30, null, 'Gladiator'],
        ['Void Conqueror',     'Clear 10 dungeons.',                       'achievement', 'dungeon_clear',   null, 10, 5000, 4000, 20, null, 'Dungeon Breaker'],
        ['Unkillable',         'Survive 5 full dungeons without dying.',   'achievement', 'dungeon_survive', null,  5, 6000, 4500, 25, null, 'Iron Will'],
        ['Stage Hunter',       'Clear 25 total stages.',                   'achievement', 'stage_clear',     null, 25, 7000, 5000, 30, null, 'Stage Slayer'],
        ['S-Rank Slayer',      'Clear an S-rank dungeon.',                 'achievement', 'srank_clear',     null,  1, 4000, 3000, 20, null, 'S-Rank Hunter'],
        ['Champion',           'Win 25 PvP duels.',                        'achievement', 'pvp_win',         null, 25,15000,10000, 50, null, 'Champion'],

        // ── PARTY (weekly) ────────────────────────────────────────────────────
        ['Party Raid',         'Clear a dungeon with a full team.',        'party', 'dungeon_clear',   null, 1, 3000, 2000, 15, null, null],
        ['Team Surge',         'Clear 10 stages as a group this week.',    'party', 'stage_clear',     null,10, 5000, 3500, 20, null, null],
        ['Void Tide',          'Clear 3 dungeons together this week.',     'party', 'dungeon_clear',   null, 3, 7000, 5000, 30, null, null],
    ];

    for (const [title, desc, type, objType, objTarget, objCount, gold, xp, sp, item, rewardTitle] of seeds) {
        await db.execute(
            `INSERT IGNORE INTO quests
             (title, description, quest_type, objective_type, objective_target, objective_count,
              reward_gold, reward_xp, reward_sp, reward_item, reward_title, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
            [title, desc, type, objType, objTarget, objCount, gold, xp, sp, item, rewardTitle]
        ).catch(() => {});
    }
}

// ── PROGRESS BAR ─────────────────────────────────────────────────────────────
function progressBar(current, total, length = 8) {
    if (!total || total <= 0) return `[--------] 0%`;
    const pct   = Math.min(1, current / total);
    const filled = Math.round(pct * length);
    const bar   = '█'.repeat(filled) + '░'.repeat(length - filled);
    return `[${bar}] ${current}/${total}`;
}

// ── GET PLAYER QUESTS ────────────────────────────────────────────────────────
async function getPlayerQuests(playerId) {
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Auto-assign daily quests if none today
    await assignDailyQuests(playerId);

    const [daily] = await db.execute(
        `SELECT pq.*, q.title, q.description, q.objective_type, q.objective_target,
                q.objective_count, q.reward_gold, q.reward_xp, q.reward_sp,
                q.reward_item, q.reward_title
         FROM player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         WHERE pq.player_id = ? AND q.quest_type = 'daily' AND pq.assigned_date = ?
         ORDER BY pq.quest_id ASC`,
        [playerId, today]
    );

    const [achievements] = await db.execute(
        `SELECT pq.*, q.title, q.description, q.objective_type, q.objective_target,
                q.objective_count, q.reward_gold, q.reward_xp, q.reward_sp,
                q.reward_item, q.reward_title
         FROM player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         WHERE pq.player_id = ? AND q.quest_type = 'achievement'
         ORDER BY pq.completed DESC, pq.progress DESC
         LIMIT 4`,
        [playerId]
    );

    const [party] = await db.execute(
        `SELECT pq.*, q.title, q.description, q.objective_type, q.objective_target,
                q.objective_count, q.reward_gold, q.reward_xp, q.reward_sp,
                q.reward_item, q.reward_title
         FROM player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         WHERE pq.player_id = ? AND q.quest_type = 'party' AND pq.assigned_date >= ?
         ORDER BY pq.quest_id ASC`,
        [playerId, weekAgo]
    );

    return { daily, achievements, party };
}

// ── ASSIGN DAILY QUESTS ──────────────────────────────────────────────────────
async function assignDailyQuests(playerId) {
    const today = new Date().toISOString().split('T')[0];

    // Check for TODAY's daily quests specifically — not party/achievement
    const [existing] = await db.execute(
        `SELECT pq.quest_id FROM player_quests pq
         JOIN quests q ON q.id = pq.quest_id
         WHERE pq.player_id=? AND pq.assigned_date=? AND q.quest_type='daily'`,
        [playerId, today]
    );
    if (existing.length) return;

    // Only assign DAILY quests — not achievements or party
    const [quests] = await db.execute(
        "SELECT * FROM quests WHERE is_active=1 AND quest_type='daily' ORDER BY RAND() LIMIT 3"
    );
    for (const q of quests) {
        await db.execute(
            `INSERT IGNORE INTO player_quests (player_id, quest_id, progress, completed, claimed, assigned_date)
             VALUES (?, ?, 0, 0, 0, ?)`,
            [playerId, q.id, today]
        );
    }

    // Ensure achievement rows exist for this player (once, no date)
    const [achRows] = await db.execute(
        "SELECT quest_id FROM player_quests pq JOIN quests q ON q.id=pq.quest_id WHERE pq.player_id=? AND q.quest_type='achievement'",
        [playerId]
    );
    const assignedAchIds = new Set(achRows.map(r => r.quest_id));
    const [allAch] = await db.execute("SELECT id FROM quests WHERE quest_type='achievement' AND is_active=1");
    for (const a of allAch) {
        if (!assignedAchIds.has(a.id)) {
            await db.execute(
                `INSERT IGNORE INTO player_quests (player_id, quest_id, progress, completed, claimed, assigned_date)
                 VALUES (?, ?, 0, 0, 0, NULL)`,
                [playerId, a.id]
            ).catch(() => {});
        }
    }

    // Ensure weekly party quest row exists
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartDate = weekStart.toISOString().split('T')[0];
    const [partyRows] = await db.execute(
        "SELECT quest_id FROM player_quests pq JOIN quests q ON q.id=pq.quest_id WHERE pq.player_id=? AND q.quest_type='party' AND pq.assigned_date >= ?",
        [playerId, weekStartDate]
    );
    if (!partyRows.length) {
        const [partyQuests] = await db.execute(
            "SELECT * FROM quests WHERE quest_type='party' AND is_active=1 ORDER BY RAND() LIMIT 2"
        );
        for (const pq of partyQuests) {
            await db.execute(
                `INSERT IGNORE INTO player_quests (player_id, quest_id, progress, completed, claimed, assigned_date)
                 VALUES (?, ?, 0, 0, 0, ?)`,
                [playerId, pq.id, weekStartDate]
            ).catch(() => {});
        }
    }
}

// ── UPDATE QUEST PROGRESS ────────────────────────────────────────────────────
async function updateQuestProgress(playerId, objectiveType, amount = 1, client = null) {
    await assignDailyQuests(playerId).catch(() => {});
    const today = new Date().toISOString().split('T')[0];

    // Update daily quests for TODAY only — not old unfinished ones
    await db.execute(
        `UPDATE player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         SET pq.progress = LEAST(q.objective_count, pq.progress + ?)
         WHERE pq.player_id = ? AND q.objective_type = ?
           AND pq.completed = 0 AND (q.quest_type != 'daily' OR pq.assigned_date = ?)`,
        [amount, playerId, objectiveType, today]
    );

    // Mark completed
    const [justCompleted] = await db.execute(
        `SELECT pq.quest_id, q.title FROM player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         WHERE pq.player_id = ? AND pq.progress >= q.objective_count
           AND pq.completed = 0`,
        [playerId]
    );

    if (justCompleted.length) {
        await db.execute(
            `UPDATE player_quests pq
             JOIN quests q ON pq.quest_id = q.id
             SET pq.completed = 1
             WHERE pq.player_id = ? AND pq.progress >= q.objective_count AND pq.completed = 0`,
            [playerId]
        );
        // Notify player of completions
        if (client) {
            for (const q of justCompleted) {
                await client.sendMessage(client.info?.wid?._serialized || '', {
                    text: `╭══〘 ✅ QUEST COMPLETE 〙══╮\n┃◆ "${q.title}" completed!\n┃◆ Use !claim ${q.quest_id} to collect your reward.\n╰═══════════════════════╯`
                }).catch(() => {});
            }
        }
    }
}

// ── CLAIM QUEST REWARDS ──────────────────────────────────────────────────────
async function claimQuestRewards(playerId, questId, client) {
    // Find the specific unclaimed completed row
    // Use COALESCE so NULL dates sort consistently
    const [pq] = await db.execute(
        `SELECT quest_id, assigned_date FROM player_quests
         WHERE player_id=? AND quest_id=? AND completed=1 AND claimed=0
         ORDER BY COALESCE(assigned_date, '9999-12-31') DESC LIMIT 1`,
        [playerId, questId]
    );
    if (!pq.length) return { error: "Quest not completed or already claimed." };
    const assignedDate = pq[0].assigned_date;

    const [quest] = await db.execute("SELECT * FROM quests WHERE id=?", [questId]);
    if (!quest.length) return { error: "Quest not found." };
    const q = quest[0];

    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [q.reward_gold || 0, playerId]);
    await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?",          [q.reward_xp   || 0, playerId]);
    if (q.reward_sp) {
        await db.execute("UPDATE players SET sp = sp + ? WHERE id=?", [q.reward_sp, playerId]);
    }
    if (q.reward_item) {
        await db.execute(
            "INSERT INTO inventory (player_id, item_name, item_type, quantity) VALUES (?, ?, 'misc', 1)",
            [playerId, q.reward_item]
        );
    }
    if (q.reward_title) {
        await db.execute("UPDATE players SET title=? WHERE id=?", [q.reward_title, playerId]).catch(() => {});
    }
    await db.execute(
        `UPDATE player_quests SET claimed=1
         WHERE player_id=? AND quest_id=? AND completed=1 AND claimed=0
         AND COALESCE(assigned_date,'9999-12-31') = COALESCE(?,'9999-12-31') LIMIT 1`,
        [playerId, questId, assignedDate]
    );
    return { quest: q };
}

module.exports = {
    ensureTables,
    progressBar,
    getPlayerQuests,
    assignDailyQuests,
    updateQuestProgress,
    claimQuestRewards
};