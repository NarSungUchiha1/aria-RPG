const db = require('../database/db');
const { SHOP_ITEMS, ensureShopTables, getExplorerItems, consumeShopItem } = require('../systems/explorerShopSystem');

module.exports = {
    name: 'explorershop',
    SHOP_ITEMS, ensureShopTables, getExplorerItems, consumeShopItem,

    async execute(msg, args, { userId }) {
        try {
            await ensureShopTables();

            const [player] = await db.execute(
                "SELECT role, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?", [userId]
            );
            if (!player.length) return msg.reply("❌ Not registered.");
            const p = player[0];

            if (p.role !== 'Explorer') return msg.reply(
                `╔══〘 🏪 EXPLORER SHOP 〙══╗\n┃◆ ❌ Explorers only.\n╚═══════════════════════════╝`
            );

            const sub = args[0]?.toLowerCase();

            if (!sub) {
                const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
                const myGold = gold[0]?.gold || 0;
                let text = `╔══〘 🏪 ADVENTURER OUTPOST 〙══╗\n┃◆\n┃◆ 💰 Your gold: ${myGold.toLocaleString()}G\n┃◆\n`;
                SHOP_ITEMS.forEach((item, i) => {
                    if (item.prestige && !p.prestige_level) return;
                    const canAfford = myGold >= item.price ? '✅' : '❌';
                    text +=
                        `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                        `┃◆ ${item.emoji} *${i+1}. ${item.name}*${item.prestige ? ' ✦' : ''}\n` +
                        `┃◆ ${item.desc}\n` +
                        `┃◆ 〝${item.lore}〞\n` +
                        `┃◆ ${canAfford} ${item.price.toLocaleString()}G  📦 ${item.uses} use${item.uses > 1 ? 's' : ''}\n┃◆\n`;
                });
                text += `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n┃◆ !shop buy <number>\n┃◆ !shop inv — your items\n╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            if (sub === 'inv') {
                const items = await getExplorerItems(userId);
                if (!items.length) return msg.reply(
                    `╔══〘 🎒 ADVENTURER PACK 〙══╗\n┃◆ Empty. Visit !shop.\n╚═══════════════════════════╝`
                );
                let text = `╔══〘 🎒 ADVENTURER PACK 〙══╗\n┃◆\n`;
                items.forEach(i => {
                    const def = SHOP_ITEMS.find(s => s.id === i.item_id);
                    text += `┃◆ ${def?.emoji || '📦'} *${i.item_name}* — ${i.uses_left} use${i.uses_left > 1 ? 's' : ''} left\n`;
                });
                text += `┃◆\n┃◆ Active on next !explore\n╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            if (sub === 'buy') {
                const num = parseInt(args[1]);
                const available = SHOP_ITEMS.filter(i => !i.prestige || p.prestige_level > 0);
                const item = available[num - 1];
                if (!item) return msg.reply("❌ Invalid number.");
                const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
                if ((gold[0]?.gold || 0) < item.price) return msg.reply(`❌ Need ${item.price.toLocaleString()}G.`);
                await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [item.price, userId]);
                await db.execute(
                    "INSERT INTO explorer_inventory (player_id, item_id, item_name, uses_left) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE uses_left = uses_left + ?",
                    [userId, item.id, item.name, item.uses, item.uses]
                );
                return msg.reply(
                    `╔══〘 🏪 PURCHASED 〙══╗\n┃◆\n┃◆ ${item.emoji} *${item.name}*\n┃◆ ${item.desc}\n┃◆\n┃◆ 〝${item.lore}〞\n┃◆\n┃◆ 💰 Paid: ${item.price.toLocaleString()}G\n┃◆ Active on your next !explore\n╚═══════════════════════════╝`
                );
            }
        } catch (err) {
            console.error('explorershop error:', err);
            msg.reply('❌ Shop failed.');
        }
    }
};