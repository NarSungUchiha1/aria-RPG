const db = require('../database/db');
const { ensureTables, HEALER_GC } = require('../systems/healerMarket');

module.exports = {
    name: 'removelisting',
    async execute(msg, args, { userId }) {
        const chat = await msg.getChat();
        if (chat.id._serialized !== HEALER_GC) return;

        await ensureTables();

        try {
            const [result] = await db.execute(
                "UPDATE healer_listings SET is_active=0 WHERE healer_id=? AND is_active=1",
                [userId]
            );
            if (result.affectedRows === 0) return msg.reply(
                `══〘 💚 REMOVE LISTING 〙══╮\n┃◆ ❌ You have no active listing.\n╰═══════════════════════╯`
            );
            return msg.reply(
                `══〘 💚 REMOVE LISTING 〙══╮\n┃◆ ✅ Your listing has been removed.\n╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 💚 REMOVE LISTING 〙══╮\n┃◆ ❌ Failed to remove listing.\n╰═══════════════════════╯`);
        }
    }
};