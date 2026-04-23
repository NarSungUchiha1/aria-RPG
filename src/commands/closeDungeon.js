const db = require('../database/db');

module.exports = {
    name: 'closedungeon',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply(
            `══〘 🔒 CLOSE DUNGEON 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );
        try {
            const [result] = await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE is_active=1");
            if (result.affectedRows === 0) return msg.reply(
                `══〘 🔒 CLOSE DUNGEON 〙══╮\n┃◆ ❌ No active dungeon to close.\n╰═══════════════════════╯`
            );
            return msg.reply(
                `══〘 🔒 CLOSE DUNGEON 〙══╮\n┃◆ ✅ Dungeon forcefully closed.\n╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🔒 CLOSE DUNGEON 〙══╮\n┃◆ ❌ Failed to close dungeon.\n╰═══════════════════════╯`);
        }
    }
};