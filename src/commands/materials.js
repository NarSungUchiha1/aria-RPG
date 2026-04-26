const db = require('../database/db');
const { getPlayerMaterials, MATERIALS, RARITY_EMOJI, BLACKSMITH_GC } = require('../systems/materialSystem');

module.exports = {
    name: 'materials',
    async execute(msg, args, { userId }) {
        try {
            const mats = await getPlayerMaterials(userId);

            if (!mats.length) return msg.reply(
                `══〘 💎 MATERIALS 〙══╮\n` +
                `┃◆ You have no materials yet.\n` +
                `┃◆ Clear dungeons to collect them.\n` +
                `┃◆ Visit the Blacksmith GC to forge.\n` +
                `╰═══════════════════════╯`
            );

            // Group by rarity
            const byRarity = { legendary: [], rare: [], uncommon: [], common: [] };
            for (const m of mats) {
                const data = MATERIALS[m.material];
                if (data) byRarity[data.rarity]?.push(m);
            }

            let text = `══〘 💎 YOUR MATERIALS 〙══╮\n`;

            for (const [rarity, items] of Object.entries(byRarity)) {
                if (!items.length) continue;
                text += `┃◆ ${RARITY_EMOJI[rarity]} ${rarity.toUpperCase()}\n`;
                items.forEach(i => {
                    text += `┃◆   ${i.material} ×${i.quantity}\n`;
                });
            }

            text += `┃◆────────────\n┃◆ Use !recipes in the Blacksmith GC\n╰═══════════════════════╯`;
            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 💎 MATERIALS 〙══╮\n┃◆ ❌ Failed to load materials.\n╰═══════════════════════╯`);
        }
    }
};