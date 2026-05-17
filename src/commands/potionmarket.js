const db = require('../database/db');
const { POTIONS, MIN_PRICES } = require('../systems/potions');

const MAX_LISTINGS = 5;

async function ensurePotionTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS potion_inventory (
            player_id   VARCHAR(50) NOT NULL,
            potion_name VARCHAR(100) NOT NULL,
            quantity    INT DEFAULT 0,
            PRIMARY KEY (player_id, potion_name)
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS potion_market (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            seller_id   VARCHAR(50) NOT NULL,
            potion_name VARCHAR(100) NOT NULL,
            price       INT NOT NULL,
            stock       INT DEFAULT 1,
            listed_at   DATETIME DEFAULT NOW()
        )
    `).catch(() => {});
}

module.exports = {
    name: 'potionmarket',
    async execute(msg, args, { userId }) {
        try {
            await ensurePotionTables();

            const sub = args[0]?.toLowerCase();

            // ── !potionmarket ─────────────────────────────────────────────────
            if (!sub) {
                const [listings] = await db.execute(
                    `SELECT pm.*, p.nickname FROM potion_market pm
                     JOIN players p ON p.id = pm.seller_id
                     WHERE pm.stock > 0 ORDER BY pm.listed_at DESC`
                );
                if (!listings.length) return msg.reply(
                    `╔══〘 🧪 POTION MARKET 〙══╗\n┃◆ No potions listed yet.\n┃◆ Brewers: !listpotion <name> <price>\n╚═══════════════════════════╝`
                );

                let text = `╔══〘 🧪 POTION MARKET 〙══╗\n┃◆\n`;
                listings.forEach((l, i) => {
                    const pot = POTIONS[l.potion_name];
                    text +=
                        `┃◆ ${i+1}. *${l.potion_name}*\n` +
                        `┃◆    ${pot?.desc || ''}\n` +
                        `┃◆    💰 ${l.price.toLocaleString()}G  📦 ${l.stock} left\n` +
                        `┃◆    Seller: ${l.nickname}\n` +
                        `┃◆\n`;
                });
                text += `┃◆ !buypot <number> to purchase\n╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            // ── !potionmarket list <name> <price> ─────────────────────────────
            if (sub === 'list') {
                const price     = parseInt(args[args.length - 1]);
                const potName   = args.slice(1, args.length - 1).join(' ');
                if (!potName || isNaN(price)) return msg.reply("❌ !potionmarket list <potion name> <price>");

                const potion = POTIONS[potName];
                if (!potion) return msg.reply("❌ Unknown potion. Check !brew for names.");

                const minPrice = MIN_PRICES[potName] || 500;
                if (price < minPrice) return msg.reply(`❌ Minimum price: ${minPrice.toLocaleString()}G`);

                // Check inventory
                const [inv] = await db.execute(
                    "SELECT quantity FROM potion_inventory WHERE player_id=? AND potion_name=?",
                    [userId, potName]
                );
                if (!inv.length || inv[0].quantity < 1) return msg.reply(`❌ You don't have *${potName}* in your inventory.`);

                // Check listing limit
                const [myListings] = await db.execute(
                    "SELECT COUNT(*) as cnt FROM potion_market WHERE seller_id=? AND stock > 0",
                    [userId]
                );
                if (myListings[0].cnt >= MAX_LISTINGS) return msg.reply(`❌ Max ${MAX_LISTINGS} listings at a time.`);

                await db.execute("UPDATE potion_inventory SET quantity = quantity - 1 WHERE player_id=? AND potion_name=?", [userId, potName]);
                await db.execute("INSERT INTO potion_market (seller_id, potion_name, price, stock) VALUES (?, ?, ?, 1)", [userId, potName, price]);

                return msg.reply(
                    `╔══〘 🧪 LISTED 〙══╗\n` +
                    `┃◆ *${potName}*\n` +
                    `┃◆ Price: ${price.toLocaleString()}G\n` +
                    `┃◆ Buyers: !buypot <number>\n` +
                    `╚═══════════════════════════╝`
                );
            }

            // ── !potionmarket unlist <number> ─────────────────────────────────
            if (sub === 'unlist') {
                const num = parseInt(args[1]);
                const [myListings] = await db.execute(
                    "SELECT * FROM potion_market WHERE seller_id=? AND stock > 0 ORDER BY listed_at DESC",
                    [userId]
                );
                const listing = myListings[num - 1];
                if (!listing) return msg.reply("❌ Invalid listing number.");

                await db.execute("UPDATE potion_market SET stock=0 WHERE id=?", [listing.id]);
                await db.execute(
                    "INSERT INTO potion_inventory (player_id, potion_name, quantity) VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1",
                    [userId, listing.potion_name]
                );
                return msg.reply(`✅ *${listing.potion_name}* unlisted and returned to inventory.`);
            }

        } catch (err) {
            console.error('potionmarket error:', err);
            msg.reply('❌ Market error.');
        }
    }
};