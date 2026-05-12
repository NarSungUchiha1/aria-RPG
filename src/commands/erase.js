const db = require('../database/db');

module.exports = {
    name: 'erase',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply(
            `══〘 🧨 ERASE 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );
        const target = args[0];
        if (!target) return msg.reply(
            `══〘 🧨 ERASE 〙══╮\n┃◆ ❌ Provide player ID or mention.\n╰═══════════════════════╯`
        );
        let targetId = target.replace(/\D/g, '');
        if (msg.mentionedIds.length) targetId = msg.mentionedIds[0].replace(/@c\.us/g, "").split("@")[0];
        if (!targetId) return msg.reply(
            `══〘 🧨 ERASE 〙══╮\n┃◆ ❌ Invalid ID.\n╰═══════════════════════╯`
        );
        try {
            await db.execute("DELETE FROM players WHERE id=?", [targetId]);
            return msg.reply(
                `══〘 🧨 SYSTEM PURGE 〙══╮\n┃◆ 👤 ${target}\n┃◆ ❌ Player erased.\n┃◆ A soul returns to the void.\n╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🧨 ERASE 〙══╮\n┃◆ ❌ Erase failed.\n╰═══════════════════════╯`);
        }
    }
};