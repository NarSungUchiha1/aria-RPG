const db = require('../database/db');

module.exports = {
    name: 'eleaderboard',
    async execute(msg, args, { userId }) {
        try {
            await db.execute(`
                CREATE TABLE IF NOT EXISTS events (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    is_active TINYINT DEFAULT 1,
                    ends_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT NOW()
                )
            `).catch(() => {});

            await db.execute(`
                CREATE TABLE IF NOT EXISTS event_progress (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    event_id INT NOT NULL,
                    player_id VARCHAR(50) NOT NULL,
                    shards INT DEFAULT 0,
                    completed TINYINT DEFAULT 0,
                    completed_at DATETIME NULL,
                    UNIQUE KEY unique_player_event (event_id, player_id)
                )
            `).catch(() => {});

            // Get most recent event
            const [eventRows] = await db.execute(
                "SELECT * FROM events ORDER BY id DESC LIMIT 1"
            );

            if (!eventRows.length) return msg.reply(
                `══〘 💠 EVENT LEADERBOARD 〙══╮\n` +
                `┃◆ ❌ No event has been run yet.\n` +
                `╰═══════════════════════╯`
            );

            const event  = eventRows[0];
            const status = (event.is_active && new Date(event.ends_at) > new Date())
                ? '⚡ ACTIVE'
                : '✅ ENDED';

            const [rows] = await db.execute(
                `SELECT ep.player_id, ep.shards, ep.completed, ep.completed_at, p.nickname
                 FROM event_progress ep
                 JOIN players p ON p.id = ep.player_id
                 WHERE ep.event_id = ? AND ep.shards > 0
                 ORDER BY ep.shards DESC, ep.completed_at ASC`,
                [event.id]
            );

            if (!rows.length) return msg.reply(
                `══〘 💠 EVENT LEADERBOARD 〙══╮\n` +
                `┃◆ ${event.name}\n` +
                `┃◆ ${status}\n` +
                `┃◆────────────\n` +
                `┃◆ No shards collected yet.\n` +
                `╰═══════════════════════╯`
            );

            const REQUIRED = 5;
            let text =
                `══〘 💠 VOID SHARD LEADERBOARD 〙══╮\n` +
                `┃◆ ${event.name}\n` +
                `┃◆ ${status}\n` +
                `┃◆────────────\n`;

            rows.forEach((r, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                const bar   = '💠'.repeat(r.shards) + '⬜'.repeat(Math.max(0, REQUIRED - r.shards));
                const done  = r.completed ? '✅ Complete' : `🔄 ${r.shards}/${REQUIRED}`;
                const time  = r.completed_at
                    ? new Date(r.completed_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
                    : '';

                text +=
                    `┃◆ ${medal} *${r.nickname}*\n` +
                    `┃◆    ${bar}\n` +
                    `┃◆    ${done}${time ? `  •  ${time}` : ''}\n` +
                    `┃◆────────────\n`;
            });

            text += `╰═══════════════════════╯`;
            return msg.reply(text);

        } catch (err) {
            console.error('eleaderboard error:', err);
            msg.reply(
                `══〘 💠 EVENT LEADERBOARD 〙══╮\n` +
                `┃◆ ❌ ${err.message}\n` +
                `╰═══════════════════════╯`
            );
        }
    }
};