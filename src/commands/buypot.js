const db = require('../database/db');
const { POTIONS } = require('../systems/potions');

const POTION_GC = "120363425913743048@g.us";

module.exports = {
    name: 'buypot',

    async execute(msg, args, { userId }) {

        try {

            // ✅ Potion market restriction
            if (msg.from !== POTION_GC) {
                return msg.reply(
`╔══〘 🧪 POTION MARKET 〙══╗
┃◆ ❌ Potion trading is only
┃◆ allowed inside the Potion GC.
╚═══════════════════════════╝`
                );
            }

            const num = parseInt(args[0]);

            if (isNaN(num)) {
                return msg.reply("❌ Use: !buypot <listing number>");
            }

            const [listings] = await db.execute(
                "SELECT * FROM potion_market WHERE stock > 0 ORDER BY listed_at DESC"
            );

            const listing = listings[num - 1];

            if (!listing) {
                return msg.reply("❌ Invalid listing.");
            }

            if (listing.seller_id === userId) {
                return msg.reply("❌ Cannot buy your own potion.");
            }

            const [money] = await db.execute(
                "SELECT gold FROM currency WHERE player_id=?",
                [userId]
            );

            const gold = money[0]?.gold || 0;

            if (gold < listing.price) {
                return msg.reply(
                    `❌ Need ${listing.price} gold.`
                );
            }

            // remove buyer gold
            await db.execute(
                "UPDATE currency SET gold = gold - ? WHERE player_id=?",
                [listing.price, userId]
            );

            // give seller gold
            await db.execute(
                "UPDATE currency SET gold = gold + ? WHERE player_id=?",
                [listing.price, listing.seller_id]
            );

            // give potion
            await db.execute(
                `INSERT INTO potion_inventory
                (player_id, potion_name, quantity)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
                [userId, listing.potion_name]
            );

            // reduce stock
            await db.execute(
                "UPDATE potion_market SET stock = stock - 1 WHERE id=?",
                [listing.id]
            );

            const pot = POTIONS[listing.potion_name];

            msg.reply(
`╔══〘 🧪 PURCHASED 〙══╗
┃◆ ${listing.potion_name}
┃◆ ${pot?.desc || ""}
┃◆
┃◆ 💰 ${listing.price} Gold
╚═══════════════════════════╝`
            );

        } catch (err) {
            console.error(err);
            msg.reply("❌ Purchase failed.");
        }
    }
};