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

            const [player] = await db.execute("SELECT role, nickname FROM players WHERE id=?", [userId]);
            if (!player.length) return msg.reply(
                `╔══〘 ✦ BLACKSMITH 〙══╗\n┃★ ❌ Not registered.\n╚═══════════════════════╝`
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
                `╔══〘 ✦ BLACKSMITH 〙══╗\n` +
                `┃★ \n` +
                `┃★ Hunter: *${player[0].nickname}*\n` +
                `┃★ Role:   ${role}\n` +
                `┃★ \n` +
                `┃★ ${myRecipes.length} weapons to forge.\n` +
                `┃★ !materials — check your materials\n` +
                `┃★ !forge <number> — craft a weapon\n` +
                `┃★ \n` +
                `╚═══════════════════════════╝`
            );

            // Send each recipe as its own card
            for (let i = 0; i < myRecipes.length; i++) {
                const r = myRecipes[i];
                const craftable = canCraft(r) ? '✅ Can forge now' : '🔒 Missing materials';
                const matLines = Object.entries(r.materials)
                    .map(([mat, qty]) => {
                        const have = heldMap[mat] || 0;
                        const ok = have >= qty ? '✅' : '❌';
                        return `┃★   ${ok} ${mat} ×${qty} (have: ${have})`;
                    }).join('\n');

                const statLines = Object.entries(r.stats)
                    .map(([s, v]) => `+${v} ${s}`).join('  ');

                await msg.reply(
                    `╔══〘 ✦ ${RARITY_TITLE[r.rarity]} 〙══╗\n` +
                    `┃★ ${i + 1}. *${r.name}*\n` +
                    `┃★ \n` +
                    `┃★ 〝${r.description}〞\n` +
                    `┃★ \n` +
                    `┃★ ── STATS ──\n` +
                    `┃★ ${statLines}\n` +
                    `┃★ \n` +
                    `┃★ ── MATERIALS ──\n` +
                    `${matLines}\n` +
                    `┃★ \n` +
                    `┃★ ${craftable}\n` +
                    `┃★ !forge ${i + 1} to craft\n` +
                    `╚═══════════════════════╝`
                );
            }

        } catch (err) {
            console.error(err);
            msg.reply(`╔══〘 ✦ BLACKSMITH 〙══╗\n┃★ ❌ Could not load recipes.\n╚═══════════════════════╝`);
        }
    }
};