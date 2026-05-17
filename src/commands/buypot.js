const db = require('../database/db');
const { POTIONS } = require('../systems/potions');

module.exports = {
    name: 'buypot',
    async execute(msg, args, { userId }) {
        try {
            await db.execute(`CREATE TABLE IF NOT EXISTS potion_market (id INT AUTO_INCREMENT PRIMARY KEY, seller_id VARCHAR(50) NOT NULL, potion_name VARCHAR(100) NOT NULL, price INT NOT NULL, stock INT DEFAULT 1, listed_at DATETIME DEFAULT NOW())`).catch(() => {});
            await db.execute(`CREATE TABLE IF NOT EXISTS potion_inventory (player_id VARCHAR(50) NOT NULL, potion_name VARCHAR(100) NOT NULL, quantity INT DEFAULT 0, PRIMARY KEY (player_id, potion_name))`).catch(() => {});

            const num = parseInt(args[0]);
            if (isNaN(num)) return msg.reply("❌ !buypot <number> — see !potionmarket for listings.");

            const [listings] = await db.execute(
                "SELECT * FROM potion_market WHERE stock > 0 ORDER BY listed_at DESC"
            );
            const listing = listings[num - 1];
            if (!listing) return msg.reply("❌ Invalid listing number.");
            if (listing.seller_id === userId) return msg.reply("❌ Cannot buy your own listing.");

            const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            if ((gold[0]?.gold || 0) < listing.price) return msg.reply(
                `❌ Need ${listing.price.toLocaleString()}G. You have ${(gold[0]?.gold || 0).toLocaleString()}G.`
            );

            // Transfer gold
            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [listing.price, userId]);
            await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [listing.price, listing.seller_id]);

            // Give potion to buyer
            await db.execute(
                "INSERT INTO potion_inventory (player_id, potion_name, quantity) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1",
                [userId, listing.potion_name]
            );

            // Remove from market
            await db.execute("UPDATE potion_market SET stock = stock - 1 WHERE id=?", [listing.id]);

            const pot = POTIONS[listing.potion_name];
            const [seller] = await db.execute("SELECT nickname FROM players WHERE id=?", [listing.seller_id]);

            return msg.reply(
                `╔══〘 🧪 PURCHASED 〙══╗\n` +
                `┃◆\n` +
                `┃◆ *${listing.potion_name}*\n` +
                `┃◆ ${pot?.desc || ''}\n` +
                `┃◆\n` +
                `┃◆ 💰 Paid: ${listing.price.toLocaleString()}G\n` +
                `┃◆ Seller: ${seller[0]?.nickname}\n` +
                `┃◆\n` +
                `┃◆ Use !usepotion <name> in dungeon.\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error('buypot error:', err);
            msg.reply('❌ Purchase failed.');
        }
    }
};