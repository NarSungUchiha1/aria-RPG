const db = require('../database/db');

module.exports = {
    name: 'erase',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");
        const target = args[0];
        if (!target) return msg.reply("❌ Provide player ID or mention.");

        let targetId = target.replace(/\D/g, '');
        if (msg.mentionedIds.length) {
            targetId = msg.mentionedIds[0].replace(/@c\.us/g, "").split("@")[0];
        }

        if (!targetId) return msg.reply("❌ Invalid ID.");

        try {
            // Foreign key cascades handle related records
            await db.execute("DELETE FROM players WHERE id=?", [targetId]);
            return msg.reply(`╭══〘 🧨 SYSTEM PURGE 〙══╮\n┃ 👤 ${target}\n┃ ❌ Player erased\n┃ 🔄 A soul has returned to the great flames\n╰════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Erase failed.");
        }
    }
};