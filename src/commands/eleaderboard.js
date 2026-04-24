const db = require('../database/db');

module.exports = {
    name: 'eleaderboard',
    async execute(msg, args, { userId }) {
        try {
            // Get active or most recent event
            const [eventRows] = await db.execute(
                "SELECT * FROM events ORDER BY id DESC LIMIT 1"
            ).catch(() => [[]]);

            if (!eventRows.length) return msg.reply(
                `══〘 💠 EVENT LEADERBOARD 〙══╮\n` +
                `┃◆ ❌ No event has been run yet.\n` +
                `╰═══════════════════════╯`
            );

            const event = eventRows[0];
            const status = event.is_active && new Date(event.ends_at) > new Date()
                ? '⚡ ACTIVE'
                : '✅ ENDED';

            const [rows] = await db.execute(
                `SELECT ep.player_id, ep.shards, ep.completed, ep.completed_at, p.nickname
                 FROM event_progress ep
                 JOIN players p ON p.id = ep.player_id
                 WHERE ep.event_id = ?
                   AND ep.shards > 0
                 ORDER BY ep.shards DESC, ep.completed_at ASC`,
                [event.id]
            );

            if (!rows.length) return msg.reply(
                `══〘 💠 EVENT LEADERBOARD 〙══╮\n` +
                `┃◆ Event: ${event.name}\n` +
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
                const medal     = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                const bar       = '💠'.repeat(r.shards) + '⬜'.repeat(Math.max(0, REQUIRED - r.shards));
                const completed = r.completed
                    ? `✅ Complete`
                    : `🔄 ${r.shards}/${REQUIRED}`;
                const time = r.completed_at
                    ? new Date(r.completed_at).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })
                    : '';

                text +=
                    `┃◆ ${medal} *${r.nickname}*\n` +
                    `┃◆    ${bar}\n` +
                    `┃◆    ${completed}${time ? `  •  ${time}` : ''}\n` +
                    `┃◆────────────\n`;
            });

            text += `╰═══════════════════════╯`;
            return msg.reply(text);

        } catch (err) {
            console.error(err);
            msg.reply(
                `══〘 💠 EVENT LEADERBOARD 〙══╮\n` +
                `┃◆ ❌ Could not load leaderboard.\n` +
                `╰═══════════════════════╯`
            );
        }
    }
};