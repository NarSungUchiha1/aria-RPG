const db = require('../database/db');
const { getActiveDungeon } = require('../engine/dungeon');

module.exports = {
    name: 'clear',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply(
            `══〘 🔧 CLEAR 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );
        try {
            const dungeon = await getActiveDungeon();
            if (!dungeon) return msg.reply(
                `══〘 🔧 CLEAR 〙══╮\n┃◆ ❌ No active dungeon.\n╰═══════════════════════╯`
            );
            await db.execute("UPDATE dungeon SET stage_cleared=1 WHERE id=?", [dungeon.id]);
            return msg.reply(
                `══〘 🔧 CLEAR 〙══╮\n┃◆ ✅ Stage force-cleared.\n┃◆ Use !onward to advance.\n╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🔧 CLEAR 〙══╮\n┃◆ ❌ Clear failed.\n╰═══════════════════════╯`);
        }
    }
};