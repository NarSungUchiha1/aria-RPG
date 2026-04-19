const db = require('../database/db');
const getUserId = require('../utils/getUserId');

module.exports = {
    name: 'quests',
    async execute(msg, args, { userId }) {
        const [rows] = await db.execute(
            `SELECT q.id, q.title, pq.progress, q.objective_count, pq.completed, pq.claimed
             FROM player_quests pq JOIN quests q ON pq.quest_id = q.id
             WHERE pq.player_id=? AND pq.assigned_date >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
             ORDER BY pq.completed, pq.quest_id`,
            [userId]
        );
        if (!rows.length) return msg.reply("📜 No active quests.");
        let text = `══〘 📜 QUESTS 〙══╮\n`;
        rows.forEach(q => {
            const status = q.claimed ? '✅ Claimed' : (q.completed ? '🎁 Ready' : `${q.progress}/${q.objective_count}`);
            text += `┃◆ ${q.title} [${status}]\n`;
        });
        text += `┃◆────────────\n┃◆ !claim <quest_id> to collect\n╰═══════════════════════╯`;
        return msg.reply(text);
    }
};