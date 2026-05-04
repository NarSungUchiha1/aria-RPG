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
            const stars      = '⭐'.repeat(Math.min(p.prestige_level, 5));


            // ── BUY ──────────────────────────────────────────────────────────
            if (args[0]?.toLowerCase() === 'buy') {
                const itemName = args.slice(1).join(' ');
                if (!itemName) return msg.reply(
                    `╔══〘 ✦ SYSTEM ARMORY 〙══╗\n┃★ CMD: !prestigeshop buy <name>\n╚════════════════════════════╝`
                );
                const result = await buyPrestigeItem(userId, itemName, p.role, p.prestige_level);
                if (!result.ok) return msg.reply(
                    `╔══〘 ✦ SYSTEM ARMORY 〙══╗\n┃★ ❌ ${result.reason}\n╚════════════════════════════╝`
                );
                const remaining = playerGold - result.item.price;
                return msg.reply(
                    `╔══〘 ✦ ACQUISITION CONFIRMED 〙══╗\n` +
                    `┃★ ITEM: ${result.item.name}\n` +
                    `┃★ 〝${result.item.desc}〞\n` +
                    `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃★ COST:    -${result.item.price.toLocaleString()}G\n` +
                    `┃★ BALANCE: ${remaining.toLocaleString()}G\n` +
                    `╚════════════════════════════╝`
                );
            }

            // ── DISPLAY ──────────────────────────────────────────────────────
            const { weapons, consumables } = await getPrestigeShopItems(userId, p.role, p.prestige_level);

            let text =
                `╔══〘 ✦ SYSTEM ARMORY 〙══╗\n` +
                `┃★ CLEARANCE: PRESTIGE ${p.prestige_level}  ${stars}\n` +
                `┃★ HUNTER: ${p.nickname.toUpperCase()} [${p.role.toUpperCase()}]\n` +
                `┃★ RANK: ${p.rank}\n` +
                `┃★ BALANCE: ${playerGold.toLocaleString()}G\n` +
                `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃★ WEAPONS — VOID CLASS\n` +
                `┃★\n`;

            weapons.forEach((w, i) => {
                const num      = String(i + 1).padStart(2, '0');
                const statLine = Object.entries(w.stats)
                    .map(([k, v]) => `${k.toUpperCase().slice(0,3)}+${v}`)
                    .join('  ');
                const stock    = w.stock <= 0 ? 'OUT OF STOCK' : `[${w.stock} LEFT]`;
                const locked   = (w.minPrestige || 1) > p.prestige_level ? ` 🔒 P${w.minPrestige}` : '';
                text +=
                    `┃★ ${num}. ${w.name}${locked}\n` +
                    `┃★     ${statLine}  DUR:${w.stats.durability || w.durability}\n` +
                    `┃★     COST: ${w.price.toLocaleString()}G  ${stock}\n` +
                    `┃★\n`;
            });

            text += `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n┃★ CONSUMABLES\n┃★\n`;

            consumables.forEach(c => {
                const stock = c.stock <= 0 ? 'OUT OF STOCK' : `[${c.stock} LEFT]`;
                text +=
                    `┃★ • ${c.name}\n` +
                    `┃★   ${c.desc}\n` +
                    `┃★   COST: ${c.price.toLocaleString()}G  ${stock}\n` +
                    `┃★\n`;
            });

            text +=
                `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃★ CMD: !prestigeshop buy <name>\n` +
                `╚════════════════════════════╝`;

            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(`╔══〘 ✦ SYSTEM ARMORY 〙══╗\n┃★ ❌ SYSTEM ERROR\n╚════════════════════════════╝`);
        }
    }
};