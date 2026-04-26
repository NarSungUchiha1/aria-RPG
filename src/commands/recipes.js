const db = require('../database/db');
const { RECIPES, RARITY_EMOJI } = require('../systems/materialSystem');

module.exports = {
    name: 'recipes',
    async execute(msg, args, { userId }) {
        try {
            const [player] = await db.execute("SELECT role FROM players WHERE id=?", [userId]);
            if (!player.length) return msg.reply(
                `══〘 ⚒️ RECIPES 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );

            const role = player[0].role;
            const myRecipes = RECIPES.filter(r => r.role === role);

            const rarityOrder = ['common', 'uncommon', 'rare', 'legendary'];
            myRecipes.sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity));

            let text =
                `══〘 ⚒️ BLACKSMITH RECIPES 〙══╮\n` +
                `┃◆ Role: ${role}\n` +
                `┃◆────────────\n`;

            myRecipes.forEach((r, i) => {
                const mats = Object.entries(r.materials).map(([m, q]) => `${m} ×${q}`).join(', ');
                text +=
                    `┃◆ ${i + 1}. ${RARITY_EMOJI[r.rarity]} *${r.name}*\n` +
                    `┃◆    📋 ${r.description}\n` +
                    `┃◆    🔧 ${mats}\n` +
                    `┃◆    ⚔️ ${Object.entries(r.stats).map(([s,v]) => `${s} +${v}`).join(' ')}\n` +
                    `┃◆────────────\n`;
            });

            text += `┃◆ Use !forge <number> to craft\n╰═══════════════════════╯`;
            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ⚒️ RECIPES 〙══╮\n┃◆ ❌ Could not load recipes.\n╰═══════════════════════╯`);
        }
    }
};