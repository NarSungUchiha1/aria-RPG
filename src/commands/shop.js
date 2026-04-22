const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { getPlayerShop, getRestockTimeRemaining } = require('../systems/shopSystem');
const { tagUser } = require('../utils/tag');

module.exports = {
    name: 'shop',
    async execute(msg, args, { userId, client }) {
        try {
            const [rows] = await db.execute("SELECT nickname, role, `rank` FROM players WHERE id=?", [userId]);
            if (!rows.length) return msg.reply("❌ Not registered.");

            const player = rows[0];

            const [inDungeon] = await db.execute(
                "SELECT * FROM dungeon_players WHERE player_id=? AND is_alive=1",
                [userId]
            );
            if (inDungeon.length) {
                return msg.reply("❌ You cannot view the shop while inside a dungeon.");
            }

            const shopItems = await getPlayerShop(userId, player.role, player.rank);
            const [money] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const gold = money[0]?.gold || 0;
            const restockTime = getRestockTimeRemaining(); // ✅ no longer async

            if (shopItems.length === 0) {
                return msg.reply(`══〘 🛒 SHOP 〙══╮\n┃◆ The shop is currently empty. Check back later!\n┃◆ Restocks in: ${restockTime}\n╰═══════════════════════╯`);
            }

            let text = `══〘 🛒 ARIA SHOP 〙══╮\n`;
            text += `┃◆ 👤 ${player.nickname.toUpperCase()}\n`;
            text += `┃◆ 🎭 ${player.role}  •  Rank: ${player.rank}\n`;
            text += `┃◆ 💰 Gold: ${gold}\n`;
            text += `┃◆ ⏳ Restocks in: ${restockTime}\n`;
            text += `┃◆━━━━━━━━━━━━\n`;

            shopItems.forEach(item => {
                text += `┃◆ ${item.id}. ${item.name} [${item.grade || 'F'}] [${item.stock}/${item.restockedAmount}]\n`;
                text += `┃   ➤ ${item.emoji} +${item.value} ${item.stat.toUpperCase()}\n`;
                text += `┃   ➤ 💰 ${item.price} GOLD\n`;
                if (item.moves) text += `┃   ➤ 🗡️ Moves: ${item.moves}\n`;
                text += `┃────────────\n`;
            });

            text += `┃◆━━━━━━━━━━━━\n`;
            text += `┃◆ 🧭 Use: !buy <number>\n`;
            text += `╰═══════════════════════╯`;

            const contact = await tagUser(client, userId);
            return msg.reply(text, undefined, { mentions: contact ? [contact] : [] });
        } catch (err) {
            console.error(err);
            msg.reply("❌ Shop failed.");
        }
    }
};