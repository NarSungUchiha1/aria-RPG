const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { getPlayerShop, decreaseStock, clearShopCacheForRoleRank } = require('../systems/shopSystem');
const itemStats = require('../data/itemStats');

module.exports = {
    name: 'buy',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply("❌ Use: !buy <number>");
        const choice = parseInt(args[0]);
        if (isNaN(choice)) return msg.reply("❌ Invalid number.");

        try {
            const [player] = await db.execute("SELECT role, `rank` FROM players WHERE id=?", [userId]);
            if (!player.length) return msg.reply("❌ Not registered.");

            // ❌ Block purchase if player is inside an active dungeon
            const [inDungeon] = await db.execute(
                "SELECT * FROM dungeon_players WHERE player_id=? AND is_alive=1",
                [userId]
            );
            if (inDungeon.length) {
                return msg.reply("❌ You cannot access the shop while inside a dungeon.");
            }

            const shop = await getPlayerShop(userId, player[0].role, player[0].rank);
            const item = shop.find(i => i.id === choice);
            if (!item) return msg.reply("❌ Item not found.");

            const [money] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const gold = money[0]?.gold || 0;
            if (gold < item.price) return msg.reply("❌ Not enough gold.");

            const [stockRow] = await db.execute("SELECT stock FROM shop_stock WHERE item_name = ?", [item.name]);
            if (!stockRow.length || stockRow[0].stock <= 0) {
                return msg.reply("❌ This item is out of stock.");
            }

            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [item.price, userId]);

            const itemType = item.name.includes('Potion') ? 'consumable' : item.stat;
            const [result] = await db.execute(
                "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped) VALUES (?, ?, ?, 1, 0)",
                [userId, item.name, itemType]
            );

            const itemData = itemStats[item.name];
            if (itemData) {
                await db.execute(
                    `UPDATE inventory SET 
                        grade = 'F',
                        strength_bonus = ?,
                        agility_bonus = ?,
                        intelligence_bonus = ?,
                        stamina_bonus = ?,
                        attack_bonus = ?,
                        defense_bonus = ?,
                        durability = 100,
                        max_durability = 100
                     WHERE id = ?`,
                    [
                        itemData.base?.strength || 0,
                        itemData.base?.agility || 0,
                        itemData.base?.intelligence || 0,
                        itemData.base?.stamina || 0,
                        itemData.base?.attack || 0,
                        itemData.base?.defense || 0,
                        result.insertId
                    ]
                );
            }

            await decreaseStock(item.name);
            clearShopCacheForRoleRank(player[0].role, player[0].rank);

            return msg.reply(`══〘 ✅ PURCHASE SUCCESS 〙══╮
┃◆ ${item.name}
┃◆ 💰 -${item.price} Gold
┃◆━━━━━━━━━━━━
┃◆ Added to inventory
╰═══════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Purchase failed.");
        }
    }
};