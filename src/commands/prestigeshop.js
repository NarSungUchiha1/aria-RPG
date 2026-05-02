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
                `══〘 ✦ PRESTIGE SHOP 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );

            const p = player[0];
            if (!p.prestige_level) return msg.reply(
                `══〘 ✦ PRESTIGE SHOP 〙══╮\n` +
                `┃◆ ❌ Prestige players only.\n` +
                `┃◆ Reach Rank S then !prestige confirm\n` +
                `╰═══════════════════════╯`
            );

            const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const playerGold = gold[0]?.gold || 0;
            const stars = '☆'.repeat(p.prestige_level);

            // Buying
            if (args[0]?.toLowerCase() === 'buy') {
                const itemName = args.slice(1).join(' ');
                if (!itemName) return msg.reply(
                    `══〘 ✦ PRESTIGE SHOP 〙══╮\n┃◆ ❌ !prestigeshop buy <item name>\n╰═══════════════════════╯`
                );
                const result = await buyPrestigeItem(userId, itemName, p.role, p.prestige_level);
                if (!result.ok) return msg.reply(
                    `══〘 ✦ PRESTIGE SHOP 〙══╮\n┃◆ ❌ ${result.reason}\n╰═══════════════════════╯`
                );
                return msg.reply(
                    `╔══〘 ✦ PURCHASED 〙══╗\n` +
                    `┃◆ ✅ *${result.item.name}*\n` +
                    `┃◆ ${result.item.desc}\n` +
                    `┃◆ 💰 -${result.item.price} Gold\n` +
                    `┃◆ Remaining: ${playerGold - result.item.price}\n` +
                    `╰═══════════════════════╯`
                );
            }

            // Display shop
            const { weapons, consumables } = await getPrestigeShopItems(userId, p.role, p.prestige_level);

            let text = `╔══〘 ✦ PRESTIGE SHOP 〙══╗\n`;
            text += `┃◆ ${stars} ${p.nickname} — Prestige ${p.prestige_level}\n`;
            text += `┃◆ 💰 Gold: ${playerGold.toLocaleString()}\n`;
            text += `┃◆━━━━━━━━━━━━━━━━━\n`;
            text += `┃◆ ⚔️ ${p.role.toUpperCase()} WEAPONS\n┃◆ \n`;

            weapons.forEach((w, i) => {
                const statLine = Object.entries(w.stats)
                    .map(([k, v]) => `+${v} ${k.charAt(0).toUpperCase()+k.slice(1)}`)
                    .join(' ');
                text += `┃◆ ${i+1}. *${w.name}*\n`;
                text += `┃◆    ${statLine}\n`;
                text += `┃◆    💰 ${w.price.toLocaleString()} Gold\n`;
                text += `┃◆    〝${w.desc}〞\n┃◆ \n`;
            });

            text += `┃◆━━━━━━━━━━━━━━━━━\n`;
            text += `┃◆ 🧪 CONSUMABLES\n┃◆ \n`;
            consumables.forEach(c => {
                text += `┃◆ • *${c.name}* — ${c.price}G\n`;
                text += `┃◆   ${c.desc}\n`;
            });

            text += `┃◆ \n┃◆ !prestigeshop buy <name>\n`;
            text += `╰═══════════════════════════╯`;

            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ✦ PRESTIGE SHOP 〙══╮\n┃◆ ❌ Failed.\n╰═══════════════════════╯`);
        }
    }
};