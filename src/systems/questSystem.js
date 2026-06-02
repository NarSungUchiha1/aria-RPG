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

    // ── Seed quests from questData.js ──────────────────────────────────────────
    const [count] = await db.execute('SELECT COUNT(*) as cnt FROM quests').catch(() => [[{ cnt: 1 }]]);
    if (count[0].cnt >= 50) return; // already seeded

    const questData = require('../data/questData');

    // Seed daily quests
    for (const [title, desc, objType, objCount, gold, xp] of questData.daily) {
        await db.execute(
            'INSERT IGNORE INTO quests (title, description, quest_type, objective_type, objective_count, reward_gold, reward_xp, reward_sp, is_active) VALUES (?,?,?,?,?,?,?,0,1)',
            [title, desc, 'daily', objType, objCount, gold, xp]
        ).catch(() => {});
    }
    // Seed achievements
    for (const [title, desc, objType, objCount, gold, xp, sp, rewardTitle] of questData.achievements) {
        await db.execute(
            'INSERT IGNORE INTO quests (title, description, quest_type, objective_type, objective_count, reward_gold, reward_xp, reward_sp, reward_title, is_active) VALUES (?,?,?,?,?,?,?,?,?,1)',
            [title, desc, 'achievement', objType, objCount, gold, xp, sp, rewardTitle]
        ).catch(() => {});
    }
    // Seed party quests
    for (const [title, desc, objType, objCount, gold, xp, sp] of questData.party) {
        await db.execute(
            'INSERT IGNORE INTO quests (title, description, quest_type, objective_type, objective_count, reward_gold, reward_xp, reward_sp, is_active) VALUES (?,?,?,?,?,?,?,?,1)',
            [title, desc, 'party', objType, objCount, gold, xp, sp]
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
        "SELECT * FROM quests WHERE is_active=1 AND quest_type='daily' ORDER BY RAND() LIMIT 5"
    );
    for (const q of quests) {
        await db.execute(
            `INSERT IGNORE INTO player_quests (player_id, quest_id, progress, completed, claimed, assigned_date)
             VALUES (?, ?, 0, 0, 0, ?)`,
            [playerId, q.id, today]
        );
    }

   // ── Deduplicate achievement rows — kills NULL-key duplicates ─────────────────
    await db.execute(`DELETE p1 FROM player_quests p1
        INNER JOIN player_quests p2
        ON p1.player_id=p2.player_id AND p1.quest_id=p2.quest_id
        AND p1.assigned_date IS NULL AND p2.assigned_date IS NULL
        AND p1.progress < p2.progress WHERE p1.player_id=?`, [playerId]).catch(()=>{});
    await db.execute(`DELETE p1 FROM player_quests p1
        INNER JOIN player_quests p2
        ON p1.player_id=p2.player_id AND p1.quest_id=p2.quest_id
        AND p1.assigned_date IS NULL AND p2.assigned_date IS NULL
        AND p1.claimed < p2.claimed AND p1.progress=p2.progress WHERE p1.player_id=?`, [playerId]).catch(()=>{});

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
const { updateClanQuestProgress } = require('./clanQuestTracker');

async function updateQuestProgress(playerId, objectiveType, amount = 1, client = null) {
    updateClanQuestProgress(playerId, objectiveType, amount, client).catch(() => {});
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
    // Check at least one completed unclaimed row exists
    const [pq] = await db.execute(
        `SELECT quest_id FROM player_quests
         WHERE player_id=? AND quest_id=? AND completed=1 AND claimed=0 LIMIT 1`,
        [playerId, questId]
    );
    if (!pq.length) return { error: "Quest not completed or already claimed." };

    const [quest] = await db.execute("SELECT * FROM quests WHERE id=?", [questId]);
    if (!quest.length) return { error: "Quest not found." };
    const q = quest[0];

    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [q.reward_gold || 0, playerId]);
    await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?",           [q.reward_xp   || 0, playerId]);
    if (q.reward_sp)   await db.execute("UPDATE players SET sp = sp + ? WHERE id=?", [q.reward_sp, playerId]);
    if (q.reward_item) await db.execute(
        "INSERT INTO inventory (player_id, item_name, item_type, quantity) VALUES (?, ?, 'misc', 1)",
        [playerId, q.reward_item]
    );
    if (q.reward_title) await db.execute(
        "UPDATE players SET title=? WHERE id=?", [q.reward_title, playerId]
    ).catch(() => {});

    // Mark ALL rows for this quest as claimed — kills any duplicate rows in one shot
    await db.execute(
        `UPDATE player_quests SET claimed=1
         WHERE player_id=? AND quest_id=? AND claimed=0`,
        [playerId, questId]
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