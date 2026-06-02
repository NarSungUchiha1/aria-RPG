const db = require('../database/db');
const { POTIONS, MIN_PRICES } = require('../systems/potions');

// No listing limit — explorers can list as many potions as they have

// ✅ Potion Market GC
const POTION_GC = "120363425913743048@g.us";

async function ensurePotionTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS potion_inventory (
            player_id VARCHAR(50) NOT NULL,
            potion_name VARCHAR(100) NOT NULL,
            quantity INT DEFAULT 0,
            PRIMARY KEY (player_id, potion_name)
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS potion_market (
            id INT AUTO_INCREMENT PRIMARY KEY,
            seller_id VARCHAR(50) NOT NULL,
            potion_name VARCHAR(100) NOT NULL,
            price INT NOT NULL,
            stock INT DEFAULT 1,
            listed_at DATETIME DEFAULT NOW()
        )
    `).catch(() => {});
}

module.exports = {
    name: 'potionmarket',

    async execute(msg, args, { userId }) {

        try {

            await ensurePotionTables();

            // ✅ Restrict ALL potion market activity
            if (msg.from !== POTION_GC) {
                return msg.reply(
`╔══〘 🧪 POTION MARKET 〙══╗
┃◆ ❌ Potion trading is only
┃◆ available inside the
┃◆ Potion Market GC.
╚═══════════════════════════╝`
                );
            }

            const sub = args[0]?.toLowerCase();

            /* =====================================
               🧪 VIEW MARKET
            ===================================== */

            if (!sub) {

                const [listings] = await db.execute(
                    `SELECT pm.*, p.nickname
                     FROM potion_market pm
                     JOIN players p
                     ON p.id = pm.seller_id
                     WHERE pm.stock > 0
                     ORDER BY pm.listed_at DESC`
                );

                if (!listings.length) {
                    return msg.reply(
`╔══〘 🧪 VOID MARKET 〙══╗
┃◆
┃◆ No potions listed yet.
┃◆
┃◆ Explorers can:
┃◆ !potionmarket list
┃◆
╚═══════════════════════════╝`
                    );
                }

                let text =
`╔══〘 🧪 VOID MARKET 〙══╗
┃◆\n`;

                listings.forEach((l, i) => {

                    const pot = POTIONS[l.potion_name];

                    text +=
`┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
┃◆ ${i+1}. ${l.potion_name}
┃◆ ${pot?.desc || ''}
┃◆
┃◆ 💰 ${l.price.toLocaleString()}G
┃◆ 📦 x${l.stock}
┃◆ 🧪 ${l.nickname}
┃◆\n`;
                });

                text +=
`┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
┃◆ !buypot <number>
╚═══════════════════════════╝`;

                return msg.reply(text);
            }

            /* =====================================
               🧪 LIST POTION
            ===================================== */

            if (sub === 'list') {

                // ✅ Explorer only
                const [player] = await db.execute(
                    "SELECT role FROM players WHERE id=?",
                    [userId]
                );

                if (!player.length) {
                    return msg.reply("❌ Not registered.");
                }

                if (player[0].role !== "Explorer") {
                    return msg.reply(
`╔══〘 🧪 MARKET 〙══╗
┃◆ ❌ Only Explorers
┃◆ can list potions.
╚════════════════════╝`
                    );
                }

                const price = parseInt(args[args.length - 1]);

                const potName =
                    args.slice(1, args.length - 1).join(' ');

                if (!potName || isNaN(price)) {
                    return msg.reply(
                        "❌ !potionmarket list <potion> <price>"
                    );
                }

                const potion = POTIONS[potName];

                if (!potion) {
                    return msg.reply("❌ Unknown potion.");
                }

                const minPrice =
                    MIN_PRICES[potName] || 500;

                if (price < minPrice) {
                    return msg.reply(
                        `❌ Minimum price: ${minPrice.toLocaleString()}G`
                    );
                }

                // inventory check
                const [inv] = await db.execute(
                    `SELECT quantity
                     FROM potion_inventory
                     WHERE player_id=?
                     AND potion_name=?`,
                    [userId, potName]
                );

                if (!inv.length || inv[0].quantity < 1) {
                    return msg.reply(
                        `❌ You don't have ${potName}`
                    );
                }

                // No listing limit — explorers can list as many as they want
                // remove from inventory
                await db.execute(
                    `UPDATE potion_inventory
                     SET quantity = quantity - 1
                     WHERE player_id=?
                     AND potion_name=?`,
                    [userId, potName]
                );

                // add listing
                await db.execute(
                    `INSERT INTO potion_market
                     (seller_id, potion_name, price, stock)
                     VALUES (?, ?, ?, 1)`,
                    [userId, potName, price]
                );

                return msg.reply(
`╔══〘 🧪 LISTED 〙══╗
┃◆ ${potName}
┃◆ 💰 ${price.toLocaleString()}G
┃◆
┃◆ Visible in the Void Market.
╚═══════════════════════════╝`
                );
            }

            /* =====================================
               🧪 MY LISTINGS
            ===================================== */

            if (sub === 'mylistings' || sub === 'mine') {

                const [myListings] = await db.execute(
                    `SELECT * FROM potion_market WHERE seller_id=? AND stock > 0 ORDER BY listed_at DESC`,
                    [userId]
                );

                if (!myListings.length) return msg.reply(
`╔══〘 🧪 MY LISTINGS 〙══╗
┃◆ You have no active listings.
┃◆ !potionmarket list <potion> <price>
╚═══════════════════════════╝`
                );

                let text = `╔══〘 🧪 MY LISTINGS 〙══╗
┃◆
`;
                myListings.forEach((l, i) => {
                    text += `┃◆ ${i+1}. ${l.potion_name} — 💰 ${l.price.toLocaleString()}G
`;
                });
                text += `┃◆
┃◆ !potionmarket unlist <#> to remove
╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            /* =====================================
               🧪 UNLIST POTION
            ===================================== */

            if (sub === 'unlist') {

                const num = parseInt(args[1]);

                const [myListings] = await db.execute(
                    `SELECT *
                     FROM potion_market
                     WHERE seller_id=?
                     AND stock > 0
                     ORDER BY listed_at DESC`,
                    [userId]
                );

                const listing = myListings[num - 1];

                if (!listing) {
                    return msg.reply("❌ Invalid listing.");
                }

                // deactivate listing
                await db.execute(
                    "UPDATE potion_market SET stock=0 WHERE id=?",
                    [listing.id]
                );

                // return potion
                await db.execute(
                    `INSERT INTO potion_inventory
                     (player_id, potion_name, quantity)
                     VALUES (?, ?, 1)
                     ON DUPLICATE KEY UPDATE
                     quantity = quantity + 1`,
                    [userId, listing.potion_name]
                );

                return msg.reply(
`╔══〘 🧪 UNLISTED 〙══╗
┃◆ ${listing.potion_name}
┃◆ Returned to your vault.
╚═══════════════════════════╝`
                );
            }

        } catch (err) {
            console.error('potionmarket error:', err);
            msg.reply('❌ Market error.');
        }
    }
};