const db = require('../database/db');

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
            `INSERT INTO player_quests (player_id, quest_id, progress, completed, claimed, assigned_date)
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

module.exports = { assignDailyQuests, updateQuestProgress, claimQuestRewards };