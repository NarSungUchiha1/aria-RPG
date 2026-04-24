const db = require('../database/db');
const { ensureTables, HEALER_GC } = require('../systems/healerMarket');

module.exports = {
    name: 'healers',
    async execute(msg, args, { userId }) {
        const chat = await msg.getChat();
        if (chat.id._serialized !== HEALER_GC) return;

        await ensureTables();

        try {
            const [listings] = await db.execute(
                "SELECT * FROM healer_listings WHERE is_active=1 ORDER BY updated_at DESC"
            );

            if (!listings.length) return msg.reply(
                `══〘 💚 HEALER MARKET 〙══╮\n` +
                `┃◆ No healers are currently listed.\n` +
                `┃◆ Healers use !listservice to post.\n` +
                `╰═══════════════════════╯`
            );

            let text =
                `══〘 💚 HEALER MARKET 〙══╮\n` +
                `┃◆ Available Healers:\n` +
                `┃◆────────────\n`;

            listings.forEach((h, i) => {
                text +=
                    `┃◆ ${i + 1}. *${h.nickname}*\n` +
                    `┃◆    💰 ${h.price_gold} Gold  ⭐ ${h.price_xp} XP\n` +
                    `┃◆    📋 ${h.description}\n` +
                    `┃◆────────────\n`;
            });

            text +=
                `┃◆ Use !hire <number> to book\n` +
                `╰═══════════════════════╯`;

            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 💚 HEALER MARKET 〙══╮\n┃◆ ❌ Failed to load listings.\n╰═══════════════════════╯`);
        }
    }
};