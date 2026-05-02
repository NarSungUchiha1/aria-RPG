const db = require('../database/db');
const { getPrestigeShopItems, buyPrestigeItem } = require('../systems/prestigeShop');

module.exports = {
    name: 'prestigeshop',
    async execute(msg, args, { userId }) {
        try {
            const [player] = await db.execute(
                "SELECT nickname, role, `rank`, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
                [userId]
            );
            if (!player.length) return msg.reply(
                `══〘 ✦ PRESTIGE SHOP 〙══╮\n┃★ ❌ Not registered.\n╰═══════════════════════╯`
            );

            const p = player[0];
            if (!p.prestige_level) return msg.reply(
                `══〘 ✦ PRESTIGE SHOP 〙══╮\n` +
                `┃★ ❌ Prestige players only.\n` +
                `┃★ Reach S rank then !prestige confirm\n` +
                `╰═══════════════════════╯`
            );

            const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const playerGold = gold[0]?.gold || 0;
            const stars = '☆'.repeat(Math.min(p.prestige_level, 5));

            // Buying
            if (args[0]?.toLowerCase() === 'buy') {
                const itemName = args.slice(1).join(' ');
                if (!itemName) return msg.reply(
                    `══〘 ✦ PRESTIGE SHOP 〙══╮\n┃★ ❌ !shop buy <item name>\n╰═══════════════════════╯`
                );
                const result = await buyPrestigeItem(userId, itemName, p.role, p.prestige_level);
                if (!result.ok) return msg.reply(
                    `══〘 ✦ PRESTIGE SHOP 〙══╮\n┃★ ❌ ${result.reason}\n╰═══════════════════════╯`
                );
                return msg.reply(
                    `╔══〘 ✦ PURCHASED 〙══╗\n` +
                    `┃★ ✅ *${result.item.name}*\n` +
                    `┃★ 〝${result.item.desc}〞\n` +
                    `┃★────────────\n` +
                    `┃★ 💰 -${result.item.price.toLocaleString()} Gold\n` +
                    `┃★ Remaining: ${(playerGold - result.item.price).toLocaleString()}\n` +
                    `╚═══════════════════════╝`
                );
            }

            // Display shop
            const { weapons, consumables } = await getPrestigeShopItems(userId, p.role, p.prestige_level);

            let text =
                `╔══〘 ✦ PRESTIGE SHOP 〙══╗\n` +
                `┃★ ${stars} ${p.nickname}  •  P${p.prestige_level}\n` +
                `┃★ 💰 ${playerGold.toLocaleString()} Gold\n` +
                `┃★────────────\n` +
                `┃★ ⚔️ ${p.role.toUpperCase()} WEAPONS\n┃★ \n`;

            weapons.forEach((w, i) => {
                const statLine = Object.entries(w.stats)
                    .map(([k, v]) => `+${v} ${k.charAt(0).toUpperCase()+k.slice(1)}`)
                    .join('  ');
                text +=
                    `┃★ ${i+1}. *${w.name}*\n` +
                    `┃★    ${statLine}\n` +
                    `┃★    💰 ${w.price.toLocaleString()} Gold\n` +
                    `┃★    〝${w.desc}〞\n` +
                    `┃★ \n`;
            });

            text +=
                `┃★────────────\n` +
                `┃★ 🧪 CONSUMABLES\n┃★ \n`;

            consumables.forEach(c => {
                text +=
                    `┃★ • *${c.name}*  💰 ${c.price}G\n` +
                    `┃★   ${c.desc}\n`;
            });

            text +=
                `┃★ \n` +
                `┃★ !shop buy <name> to purchase\n` +
                `╚═══════════════════════════╝`;

            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ✦ PRESTIGE SHOP 〙══╮\n┃★ ❌ Failed.\n╰═══════════════════════╯`);
        }
    }
};