const db = require('../database/db');
const { getPlayerMaterials, MATERIALS, RARITY_EMOJI } = require('../systems/materialSystem');

module.exports = {
    name: 'materials',
    async execute(msg, args, { userId }) {
        try {
            // ✅ Blacksmith is prestige-only
            const [prestigeCheck] = await db.execute(
                "SELECT COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?", [userId]
            );
            if (!prestigeCheck[0] || prestigeCheck[0].prestige_level < 1) return msg.reply(
                `╔══〘 ✦ BLACKSMITH 〙══╗\n` +
                `┃★ ❌ The Blacksmith serves\n` +
                `┃★ prestige hunters only.\n` +
                `┃★ \n` +
                `┃★ Reach Rank S → !prestige confirm\n` +
                `╚═══════════════════════════╝`
            );

            const mats = await getPlayerMaterials(userId);

            if (!mats.length) return msg.reply(
                `╔══〘 💎 MATERIALS 〙══╗\n` +
                `┃★ \n` +
                `┃★ You have no materials yet.\n` +
                `┃★ Clear dungeons to collect them.\n` +
                `┃★ \n` +
                `┃★ 🎒 Bring a bag to collect drops.\n` +
                `┃★ ⚒️ Visit Blacksmith to forge.\n` +
                `┃★ \n` +
                `╚═══════════════════════╝`
            );

            // Group by rarity
            const byRarity = { legendary: [], rare: [], uncommon: [], common: [] };
            for (const m of mats) {
                const data = MATERIALS[m.material];
                if (data) byRarity[data.rarity]?.push(m);
                else byRarity.common.push(m);
            }

            let text = `╔══〘 💎 YOUR MATERIALS 〙══╗\n`;

            const order = ['legendary', 'rare', 'uncommon', 'common'];
            let first = true;

            for (const rarity of order) {
                const items = byRarity[rarity];
                if (!items.length) continue;

                if (!first) text += `┃★ \n`; // spacer between groups
                first = false;

                text += `┃★ ${RARITY_EMOJI[rarity]} ${rarity.toUpperCase()}\n`;
                items.forEach(i => {
                    text += `┃★   ${i.material} ×${i.quantity}\n`;
                });
            }

            const total = mats.reduce((s, m) => s + m.quantity, 0);
            text +=
                `┃★ \n` +
                `┃★ Total: ${total} item${total !== 1 ? 's' : ''}\n` +
                `┃★ Use !recipes in the Blacksmith GC\n` +
                `╚═══════════════════════╝`;

            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(`╔══〘 💎 MATERIALS 〙══╗\n┃★ ❌ Failed to load materials.\n╚═══════════════════════╝`);
        }
    }
};