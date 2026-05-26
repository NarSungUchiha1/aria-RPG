const db = require('../database/db');

module.exports = {
    name: 'clear',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply(
            '══〘 🔧 CLEAR 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯'
        );
        try {
            // Get any active dungeon — territory first, then normal
            const [rows] = await db.execute(
                "SELECT id, dungeon_rank, stage, max_stage FROM dungeon WHERE is_active=1 ORDER BY id DESC LIMIT 1"
            );

            if (!rows.length) return msg.reply(
                '══〘 🔧 CLEAR 〙══╮\n┃◆ ❌ No active dungeon.\n╰═══════════════════════╯'
            );

            const d = rows[0];

            // Kill all remaining enemies
            await db.execute(
                'UPDATE dungeon_enemies SET current_hp = 0 WHERE dungeon_id=? AND current_hp > 0',
                [d.id]
            );

            // Set stage_cleared flag
            await db.execute('UPDATE dungeon SET stage_cleared=1 WHERE id=?', [d.id]);

            return msg.reply(
                '══〘 🔧 CLEAR 〙══╮\n' +
                '┃◆ ✅ Stage force-cleared.\n' +
                '┃◆ Rank: ' + d.dungeon_rank + '  Stage: ' + d.stage + '/' + d.max_stage + '\n' +
                '┃◆ All enemies defeated.\n' +
                '┃◆ Use !onward to advance.\n' +
                '╰═══════════════════════╯'
            );
        } catch (err) {
            console.error(err);
            msg.reply('══〘 🔧 CLEAR 〙══╮\n┃◆ ❌ Clear failed: ' + err.message + '\n╰═══════════════════════╯');
        }
    }
};