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
         ORDER BY pq.id ASC`,
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
         ORDER BY pq.id ASC`,
        [playerId, weekAgo]
    );

    return { daily, achievements, party };
}

// ── ASSIGN DAILY QUESTS ──────────────────────────────────────────────────────
async function assignDailyQuests(playerId) {
    const today = new Date().toISOString().split('T')[0];
    const [existing] = await db.execute(
        "SELECT * FROM player_quests WHERE player_id=? AND assigned_date=?",
        [playerId, today]
    );
    if (existing.length) return;

    const [quests] = await db.execute(
        "SELECT * FROM quests WHERE quest_type='daily' AND is_active=1 ORDER BY RAND() LIMIT 3"
    );
    for (const q of quests) {
        await db.execute(
            `INSERT IGNORE INTO player_quests (player_id, quest_id, progress, completed, claimed, assigned_date)
             VALUES (?, ?, 0, 0, 0, ?)`,
            [playerId, q.id, today]
        );
    }
}

// ── UPDATE QUEST PROGRESS ────────────────────────────────────────────────────
async function updateQuestProgress(playerId, objectiveType, amount = 1, client = null) {
    await db.execute(
        `UPDATE player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         SET pq.progress = pq.progress + ?
         WHERE pq.player_id = ? AND q.objective_type = ?
           AND pq.completed = 0
           AND pq.assigned_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
        [amount, playerId, objectiveType]
    );
    await db.execute(
        `UPDATE player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         SET pq.completed = 1
         WHERE pq.player_id = ? AND pq.progress >= q.objective_count AND pq.completed = 0`,
        [playerId]
    );
}

// ── CLAIM QUEST REWARDS ──────────────────────────────────────────────────────
async function claimQuestRewards(playerId, questId) {
    const [pq] = await db.execute(
        "SELECT * FROM player_quests WHERE player_id=? AND quest_id=? AND completed=1 AND claimed=0",
        [playerId, questId]
    );
    if (!pq.length) return { error: "Quest not completed or already claimed." };

    const [quest] = await db.execute("SELECT * FROM quests WHERE id=?", [questId]);
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
    await db.execute(
        "UPDATE player_quests SET claimed=1 WHERE player_id=? AND quest_id=?",
        [playerId, questId]
    );
    return { success: true, rewards: q };
}

module.exports = {
    ensureTables,
    progressBar,
    getPlayerQuests,
    assignDailyQuests,
    updateQuestProgress,
    claimQuestRewards
};