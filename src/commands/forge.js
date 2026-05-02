const db = require('../database/db');
const { RECIPES, RARITY_EMOJI, hasMaterials, consumeMaterials, ensureTables, BLACKSMITH_GC } = require('../systems/materialSystem');

module.exports = {
    name: 'forge',
    async execute(msg, args, { userId, client }) {
        await ensureTables();

        if (!args[0]) return msg.reply(
            `╔══〘 ✦ FORGE 〙══╗\n┃★ ❌ Use: !forge <recipe number>\n┃★ See !recipes for your options.\n╚═══════════════════════╝`
        );

        try {
            const [player] = await db.execute("SELECT nickname, role FROM players WHERE id=?", [userId]);
            if (!player.length) return msg.reply(
                `╔══〘 ✦ FORGE 〙══╗\n┃★ ❌ Not registered.\n╚═══════════════════════╝`
            );

            const role = player[0].role;
            const myRecipes = RECIPES.filter(r => r.role === role);
            const rarityOrder = ['common', 'uncommon', 'rare', 'legendary'];
            myRecipes.sort((a, b) => rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity));

            const index = parseInt(args[0]) - 1;
            if (isNaN(index) || index < 0 || index >= myRecipes.length) return msg.reply(
                `╔══〘 ✦ FORGE 〙══╗\n┃★ ❌ Invalid recipe number.\n┃★ Use !recipes to see your list.\n╚═══════════════════════╝`
            );

            const recipe = myRecipes[index];

            // Check materials
            const check = await hasMaterials(userId, recipe.materials);
            if (!check.ok) return msg.reply(
                `╔══〘 ✦ FORGE 〙══╗\n` +
                `┃★ ❌ Missing materials.\n` +
                `┃★ Need: ${recipe.materials[check.missing]}× ${check.missing}\n` +
                `┃★ Have: ${check.have}\n` +
                `┃★ Clear dungeons to find more.\n` +
                `╚═══════════════════════╝`
            );

            // Consume materials
            await consumeMaterials(userId, recipe.materials);

            const gradeMap = { common: 'C', uncommon: 'U', rare: 'R', legendary: 'S' };
            const grade = gradeMap[recipe.rarity] || 'C';
            const durability = recipe.durability || 100;

            await db.execute(
                `INSERT INTO inventory 
                 (player_id, item_name, item_type, quantity, grade,
                  strength_bonus, agility_bonus, intelligence_bonus, stamina_bonus,
                  attack_bonus, defense_bonus, durability, max_durability, equipped)
                 VALUES (?, ?, 'weapon', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
                [
                    userId, recipe.name, grade,
                    recipe.stats.strength || 0,
                    recipe.stats.agility || 0,
                    recipe.stats.intelligence || 0,
                    recipe.stats.stamina || 0,
                    recipe.stats.attack || 0,
                    recipe.stats.defense || 0,
                    durability, durability
                ]
            );

            // Announce in blacksmith GC
            await client.sendMessage(BLACKSMITH_GC, {
                text:
                    `╭══〘 ⚒️ WEAPON FORGED 〙══╮\n` +
                    `┃★ \n` +
                    `┃★ ${RARITY_EMOJI[recipe.rarity]} *${recipe.name}*\n` +
                    `┃★ Rarity: ${recipe.rarity.toUpperCase()}\n` +
                    `┃★ Forged by: *${player[0].nickname}*\n` +
                    `┃★ \n` +
                    `┃★ 〝${recipe.description}〞\n` +
                    `┃★ \n` +
                    `┃★ ── STATS ──\n` +
                    `${Object.entries(recipe.stats).map(([s, v]) => `┃★   ${s} +${v}`).join('\n')}\n` +
                    `┃★ \n` +
                    `┃★ Use !equip to wield it.\n` +
                    `┃★ \n` +
                    `╰═══════════════════════════╯`
            });

            return msg.reply(
                `╔══〘 ✦ FORGE 〙══╗\n` +
                `┃★ ✅ *${recipe.name}* forged!\n` +
                `┃★ ${RARITY_EMOJI[recipe.rarity]} ${recipe.rarity.toUpperCase()}\n` +
                `┃★ Added to your inventory.\n` +
                `┃★ Use !equip to wield it.\n` +
                `╚═══════════════════════╝`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`╔══〘 ✦ FORGE 〙══╗\n┃★ ❌ Forge failed.\n┃★ ${err.message}\n╚═══════════════════════╝`);
        }
    }
};