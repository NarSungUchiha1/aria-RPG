const db = require('../database/db');
const { getPrestigeShopItems, buyPrestigeItem } = require('../systems/prestigeShop');

function getRestockTime() {
    const now = new Date();
    const midnight = new Date();
    midnight.setUTCHours(24, 0, 0, 0);
    const diff = midnight - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return `${h}h ${m}m`;
}

module.exports = {
    name: 'prestigeshop',
    async execute(msg, args, { userId }) {
        try {
            const [player] = await db.execute(
                "SELECT nickname, role, `rank`, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
                [userId]
            );
            if (!player.length) return msg.reply(
                `╔══〘 ✦ SYSTEM ARMORY 〙══╗\n┃★ ❌ NOT REGISTERED\n╚════════════════════════════╝`
            );

            const p = player[0];
            if (!p.prestige_level) return msg.reply(
                `╔══〘 ✦ SYSTEM ARMORY 〙══╗\n` +
                `┃★ ❌ ACCESS DENIED\n` +
                `┃★ CLEARANCE: PRESTIGE REQUIRED\n` +
                `┃★ Reach S rank → !prestige confirm\n` +
                `╚════════════════════════════╝`
            );

            const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const playerGold = gold[0]?.gold || 0;
            const stars = '⭐'.repeat(Math.min(p.prestige_level, 5));

            // ── BUY BY NUMBER ────────────────────────────────────────────────
            if (args[0]?.toLowerCase() === 'buy') {
                const itemNum = parseInt(args[1]);
                if (isNaN(itemNum)) return msg.reply(
                    `╔══〘 ✦ SYSTEM ARMORY 〙══╗\n┃★ CMD: !prestigeshop buy <number>\n╚════════════════════════════╝`
                );

                const { weapons, consumables } = await getPrestigeShopItems(userId, p.role, p.prestige_level);
                const allItems = [...weapons, ...consumables];
                const item = allItems[itemNum - 1];

                if (!item) return msg.reply(
                    `╔══〘 ✦ SYSTEM ARMORY 〙══╗\n┃★ ❌ Invalid number.\n╚════════════════════════════╝`
                );

                const result = await buyPrestigeItem(userId, item.name, p.role, p.prestige_level);
                if (!result.ok) return msg.reply(
                    `╔══〘 ✦ SYSTEM ARMORY 〙══╗\n┃★ ❌ ${result.reason}\n╚════════════════════════════╝`
                );
                const remaining = playerGold - result.item.price;
                return msg.reply(
                    `╔══〘 ✦ ACQUISITION CONFIRMED 〙══╗\n` +
                    `┃★ ITEM: ${result.item.name}\n` +
                    `┃★ 〝${result.item.desc}〞\n` +
                    `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃★ COST:    -${result.item.price.toLocaleString()}L\n` +
                    `┃★ BALANCE: ${remaining.toLocaleString()}L\n` +
                    `╚════════════════════════════╝`
                );
            }

            // ── DISPLAY ──────────────────────────────────────────────────────
            const { weapons, consumables } = await getPrestigeShopItems(userId, p.role, p.prestige_level);

            let itemNum = 1;
            let text =
                `╔══〘 ✦ SYSTEM ARMORY 〙══╗\n` +
                `┃★ CLEARANCE: PRESTIGE ${p.prestige_level}  ${stars}\n` +
                `┃★ HUNTER: ${p.nickname.toUpperCase()} [${p.role.toUpperCase()}]\n` +
                `┃★ RANK: ${p.rank}\n` +
                `┃★ BALANCE: ${playerGold.toLocaleString()}L\n` +
                `┃★ RESTOCK: ${getRestockTime()}\n` +
                `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃★ WEAPONS — VOID CLASS\n` +
                `┃★\n`;

            weapons.forEach(w => {
                const num      = String(itemNum).padStart(2, '0');
                const statLine = Object.entries(w.stats)
                    .map(([k, v]) => `${k.toUpperCase().slice(0,3)}+${v}`)
                    .join('  ');
                const stock    = w.stock <= 0 ? 'OUT OF STOCK' : `[${w.stock} LEFT]`;
                const locked   = (w.minPrestige || 1) > p.prestige_level ? ` 🔒 P${w.minPrestige}` : '';
                text +=
                    `┃★ ${num}. ${w.name}${locked}\n` +
                    `┃★     ${statLine}  DUR:${w.durability}\n` +
                    `┃★     COST: ${w.price.toLocaleString()}L  ${stock}\n` +
                    `┃★\n`;
                itemNum++;
            });

            text += `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n┃★ CONSUMABLES\n┃★\n`;

            consumables.forEach(c => {
                const num   = String(itemNum).padStart(2, '0');
                const stock = c.stock <= 0 ? 'OUT OF STOCK' : `[${c.stock} LEFT]`;
                text +=
                    `┃★ ${num}. ${c.name}\n` +
                    `┃★   ${c.desc}\n` +
                    `┃★   COST: ${c.price.toLocaleString()}L  ${stock}\n` +
                    `┃★\n`;
                itemNum++;
            });

            text +=
                `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃★ CMD: !prestigeshop buy <number>\n` +
                `╚════════════════════════════╝`;

            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(`╔══〘 ✦ SYSTEM ARMORY 〙══╗\n┃★ ❌ SYSTEM ERROR\n╚════════════════════════════╝`);
        }
    }
};