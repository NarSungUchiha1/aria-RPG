const db = require('../database/db');

async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS quests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(100),
            description TEXT,
            quest_type ENUM('daily','achievement','party') DEFAULT 'daily',
            objective_type VARCHAR(50),
            objective_target VARCHAR(100),
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
            player_id VARCHAR(50),
            quest_id INT,
            progress INT DEFAULT 0,
            completed TINYINT DEFAULT 0,
            claimed TINYINT DEFAULT 0,
            assigned_date DATE,
            UNIQUE KEY unique_player_quest (player_id, quest_id, assigned_date)
        )
    `).catch(() => {});
}

function progressBar(current, total) {
    const filled = Math.min(10, Math.floor((current / Math.max(1, total)) * 10));
    return `[${'█'.repeat(filled)}${'░'.repeat(10 - filled)}] ${current}/${total}`;
}

async function getPlayerQuests(playerId) {
    const today = new Date().toISOString().split('T')[0];

    // Assign daily quests if not assigned today
    await assignDailyQuests(playerId);

    // Daily
    const [daily] = await db.execute(
        `SELECT pq.*, q.title, q.description, q.objective_count, q.reward_gold, q.reward_xp, q.reward_sp, q.reward_title
         FROM player_quests pq JOIN quests q ON pq.quest_id = q.id
         WHERE pq.player_id=? AND q.quest_type='daily' AND pq.assigned_date=?
         ORDER BY pq.id LIMIT 3`,
        [playerId, today]
    );

    // Achievements
    const [achievements] = await db.execute(
        `SELECT pq.*, q.title, q.description, q.objective_count, q.reward_gold, q.reward_xp, q.reward_sp, q.reward_title
         FROM player_quests pq JOIN quests q ON pq.quest_id = q.id
         WHERE pq.player_id=? AND q.quest_type='achievement'
         ORDER BY pq.completed DESC, pq.progress DESC LIMIT 4`,
        [playerId]
    );

    // Party (weekly)
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const [party] = await db.execute(
        `SELECT pq.*, q.title, q.description, q.objective_count, q.reward_gold, q.reward_xp, q.reward_sp
         FROM player_quests pq JOIN quests q ON pq.quest_id = q.id
         WHERE pq.player_id=? AND q.quest_type='party' AND pq.assigned_date >= ?
         ORDER BY pq.id LIMIT 3`,
        [playerId, weekStartStr]
    );

    return { daily, achievements, party };
}

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

async function updateQuestProgress(playerId, objectiveType, target, amount = 1) {
    await db.execute(
        `UPDATE player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         SET pq.progress = pq.progress + ?
         WHERE pq.player_id = ? AND q.objective_type = ?
           AND (q.objective_target = ? OR q.objective_target IS NULL)
           AND pq.completed = 0 AND pq.assigned_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
        [amount, playerId, objectiveType, target]
    );
    await db.execute(
        `UPDATE player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         SET pq.completed = 1
         WHERE pq.player_id = ? AND pq.progress >= q.objective_count AND pq.completed = 0`,
        [playerId]
    );
}

async function claimQuestRewards(playerId, questId) {
    const [pq] = await db.execute(
        "SELECT * FROM player_quests WHERE player_id=? AND quest_id=? AND completed=1 AND claimed=0",
        [playerId, questId]
    );
    if (!pq.length) return { error: "Quest not completed or already claimed." };
    const [quest] = await db.execute("SELECT * FROM quests WHERE id=?", [questId]);
    const q = quest[0];
    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [q.reward_gold, playerId]);
    await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [q.reward_xp, playerId]);
    if (q.reward_sp) {
        await db.execute("UPDATE players SET sp = sp + ? WHERE id=?", [q.reward_sp, playerId]);
    }
    if (q.reward_item) {
        await db.execute(
            "INSERT INTO inventory (player_id, item_name, item_type, quantity) VALUES (?, ?, 'misc', 1)",
            [playerId, q.reward_item]
        );
    }
    await db.execute("UPDATE player_quests SET claimed=1 WHERE player_id=? AND quest_id=?", [playerId, questId]);
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