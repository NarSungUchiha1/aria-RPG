const db = require('../database/db');
const { RECIPES, RARITY_EMOJI, getPlayerMaterials, MATERIALS } = require('../systems/materialSystem');

const RARITY_TITLE = {
    common:    '⚪ COMMON',
    uncommon:  '🟢 UNCOMMON',
    rare:      '🔵 RARE',
    legendary: '🟣 LEGENDARY'
};

module.exports = {
    name: 'recipes',
    async execute(msg, args, { userId }) {
        try {
            const [player] = await db.execute("SELECT role, nickname FROM players WHERE id=?", [userId]);
            if (!player.length) return msg.reply(
                `══〘 ⚒️ RECIPES 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );

            const role = player[0].role;
            const myRecipes = RECIPES.filter(r => r.role === role);
            const rarityOrder = ['common', 'uncommon', 'rare', 'legendary'];
            myRecipes.sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity));

            // Get player's current materials for availability check
            const heldMats = await getPlayerMaterials(userId);
            const heldMap = {};
            heldMats.forEach(r => { heldMap[r.material] = r.quantity; });

            const canCraft = (recipe) => {
                for (const [mat, qty] of Object.entries(recipe.materials)) {
                    if ((heldMap[mat] || 0) < qty) return false;
                }
                return true;
            };

            // Send intro header
            await msg.reply(
                `╭══〘 ⚒️ BLACKSMITH RECIPES 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ Hunter: *${player[0].nickname}*\n` +
                `┃◆ Role:   ${role}\n` +
                `┃◆ \n` +
                `┃◆ ${myRecipes.length} weapons available to forge.\n` +
                `┃◆ Use !materials to check what you have.\n` +
                `┃◆ Use !forge <number> to craft.\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`
            );

            // Send each recipe as its own card
            for (let i = 0; i < myRecipes.length; i++) {
                const r = myRecipes[i];
                const craftable = canCraft(r) ? '✅ Can forge now' : '🔒 Missing materials';
                const matLines = Object.entries(r.materials)
                    .map(([mat, qty]) => {
                        const have = heldMap[mat] || 0;
                        const ok = have >= qty ? '✅' : '❌';
                        return `┃◆   ${ok} ${mat} ×${qty} (have: ${have})`;
                    }).join('\n');

                const statLines = Object.entries(r.stats)
                    .map(([s, v]) => `+${v} ${s}`).join('  ');

                await msg.reply(
                    `══〘 ${RARITY_TITLE[r.rarity]} 〙══╮\n` +
                    `┃◆ ${i + 1}. *${r.name}*\n` +
                    `┃◆ \n` +
                    `┃◆ 〝${r.description}〞\n` +
                    `┃◆ \n` +
                    `┃◆ ── STATS ──\n` +
                    `┃◆ ${statLines}\n` +
                    `┃◆ \n` +
                    `┃◆ ── MATERIALS ──\n` +
                    `${matLines}\n` +
                    `┃◆ \n` +
                    `┃◆ ${craftable}\n` +
                    `┃◆ !forge ${i + 1} to craft\n` +
                    `╰═══════════════════════╯`
                );
            }

        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ⚒️ RECIPES 〙══╮\n┃◆ ❌ Could not load recipes.\n╰═══════════════════════╯`);
        }
    }
};