const db = require('../database/db');
const { getMaterials } = require('../systems/explorationSystem');

// Pending trades: offerId -> { fromId, toId, material, quantity, price, expires }
const pendingTrades = new Map();
let nextOfferId = 1;

async function ensureTradeTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS material_trades (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            from_id    VARCHAR(50) NOT NULL,
            to_id      VARCHAR(50) NOT NULL,
            material   VARCHAR(100) NOT NULL,
            quantity   INT NOT NULL,
            price      INT NOT NULL DEFAULT 0,
            status     ENUM('pending','accepted','declined','expired') DEFAULT 'pending',
            created_at DATETIME DEFAULT NOW()
        )
    `).catch(() => {});
}

module.exports = {
    name: 'materialtrade',
    pendingTrades,

    async execute(msg, args, { userId }) {
        try {
            await ensureTradeTable();

            const [player] = await db.execute(
                "SELECT nickname, role FROM players WHERE id=?", [userId]
            );
            if (!player.length) return msg.reply("❌ Not registered.");
            const p = player[0];

            if (p.role !== 'Explorer') return msg.reply(
                `╔══〘 🔄 MATERIAL TRADE 〙══╗\n┃◆ ❌ Explorers only.\n╚═══════════════════════════╝`
            );

            const sub = args[0]?.toLowerCase();

            // ── !materialtrade — view your materials ───────────────────────────
            if (!sub) {
                const mats = await getMaterials(userId);
                if (!mats.length) return msg.reply(
                    `╔══〘 🔄 MATERIAL TRADE 〙══╗\n┃◆ No materials to trade.\n┃◆ !explore to find some.\n╚═══════════════════════════╝`
                );
                let text = `╔══〘 🔄 MATERIAL TRADE 〙══╗\n┃◆\n`;
                mats.forEach(m => {
                    text += `┃◆ • *${m.material}* ×${m.quantity}\n`;
                });
                text +=
                    `┃◆\n` +
                    `┃◆ !materialtrade offer @player\n` +
                    `┃◆   <material> <qty> <price>\n` +
                    `┃◆ !materialtrade accept <id>\n` +
                    `┃◆ !materialtrade decline <id>\n` +
                    `┃◆ !materialtrade inbox\n` +
                    `╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            // ── !materialtrade offer @player <material> <qty> <price> ──────────
            if (sub === 'offer') {
                const targetId = msg.mentionedIds?.[0];
                if (!targetId) return msg.reply("❌ Tag the player: !materialtrade offer @player <material> <qty> <price>");

                // Parse remaining args — skip the @mention arg
                const remainArgs = args.slice(1).filter(a => !a.includes('@'));
                const price    = parseInt(remainArgs[remainArgs.length - 1]);
                const qty      = parseInt(remainArgs[remainArgs.length - 2]);
                const material = remainArgs.slice(0, remainArgs.length - 2).join(' ');

                if (!material || isNaN(qty) || isNaN(price) || qty < 1 || price < 0) return msg.reply(
                    "❌ !materialtrade offer @player <material> <quantity> <price>"
                );

                // Check target is an Explorer
                const [target] = await db.execute("SELECT nickname, role FROM players WHERE id=?", [targetId]);
                if (!target.length) return msg.reply("❌ That player isn't registered.");
                if (target[0].role !== 'Explorer') return msg.reply("❌ Can only trade with other Explorers.");

                // Check sender has the materials
                const [have] = await db.execute(
                    "SELECT quantity FROM exploration_materials WHERE player_id=? AND material=?",
                    [userId, material]
                );
                if (!have.length || have[0].quantity < qty) return msg.reply(
                    `❌ You only have ${have[0]?.quantity || 0} ${material}.`
                );

                const offerId = nextOfferId++;
                const expires = Date.now() + 10 * 60 * 1000; // 10 min
                pendingTrades.set(offerId, { fromId: userId, toId: targetId, material, quantity: qty, price, expires });

                setTimeout(() => pendingTrades.delete(offerId), 10 * 60 * 1000);

                // Notify target in DM
                try {
                    await msg.client?.sendMessage(`${targetId}@s.whatsapp.net`, {
                        text:
                            `╔══〘 🔄 TRADE OFFER 〙══╗\n` +
                            `┃◆\n` +
                            `┃◆ *${p.nickname}* wants to trade:\n` +
                            `┃◆\n` +
                            `┃◆ 📦 *${material}* ×${qty}\n` +
                            `┃◆ 💰 Price: ${price.toLocaleString()}G\n` +
                            `┃◆\n` +
                            `┃◆ !materialtrade accept ${offerId}\n` +
                            `┃◆ !materialtrade decline ${offerId}\n` +
                            `┃◆ ⏳ Expires in 10 minutes\n` +
                            `╚═══════════════════════════╝`
                    });
                } catch(e) {}

                return msg.reply(
                    `╔══〘 🔄 OFFER SENT 〙══╗\n` +
                    `┃◆ Offer #${offerId} sent to ${target[0].nickname}\n` +
                    `┃◆ 📦 ${material} ×${qty}\n` +
                    `┃◆ 💰 ${price.toLocaleString()}G\n` +
                    `┃◆ ⏳ Expires in 10 minutes\n` +
                    `╚═══════════════════════════╝`
                );
            }

            // ── !materialtrade accept <id> ─────────────────────────────────────
            if (sub === 'accept') {
                const offerId = parseInt(args[1]);
                const offer   = pendingTrades.get(offerId);
                if (!offer) return msg.reply("❌ No offer found with that ID.");
                if (offer.toId !== userId) return msg.reply("❌ That offer isn't for you.");
                if (Date.now() > offer.expires) {
                    pendingTrades.delete(offerId);
                    return msg.reply("❌ Offer expired.");
                }

                // Check buyer has gold
                if (offer.price > 0) {
                    const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
                    if ((gold[0]?.gold || 0) < offer.price) return msg.reply(
                        `❌ Need ${offer.price.toLocaleString()}G. You have ${(gold[0]?.gold||0).toLocaleString()}G.`
                    );
                }

                // Check seller still has materials
                const [have] = await db.execute(
                    "SELECT quantity FROM exploration_materials WHERE player_id=? AND material=?",
                    [offer.fromId, offer.material]
                );
                if (!have.length || have[0].quantity < offer.quantity) return msg.reply(
                    "❌ Seller no longer has enough materials."
                );

                // Execute trade
                await db.execute(
                    "UPDATE exploration_materials SET quantity = quantity - ? WHERE player_id=? AND material=?",
                    [offer.quantity, offer.fromId, offer.material]
                );
                await db.execute(
                    "INSERT INTO exploration_materials (player_id, material, quantity) VALUES (?,?,?) ON DUPLICATE KEY UPDATE quantity = quantity + ?",
                    [userId, offer.material, offer.quantity, offer.quantity]
                );

                if (offer.price > 0) {
                    await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [offer.price, userId]);
                    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [offer.price, offer.fromId]);
                }

                pendingTrades.delete(offerId);

                const [sellerNick] = await db.execute("SELECT nickname FROM players WHERE id=?", [offer.fromId]);

                // Notify seller
                try {
                    await msg.client?.sendMessage(`${offer.fromId}@s.whatsapp.net`, {
                        text:
                            `╔══〘 🔄 TRADE ACCEPTED 〙══╗\n` +
                            `┃◆ ${p.nickname} accepted your offer!\n` +
                            `┃◆ 📦 ${offer.material} ×${offer.quantity} transferred\n` +
                            `┃◆ 💰 +${offer.price.toLocaleString()}G received\n` +
                            `╚═══════════════════════════╝`
                    });
                } catch(e) {}

                return msg.reply(
                    `╔══〘 🔄 TRADE COMPLETE 〙══╗\n` +
                    `┃◆\n` +
                    `┃◆ ✅ Trade with ${sellerNick[0]?.nickname} done!\n` +
                    `┃◆ 📦 +${offer.material} ×${offer.quantity}\n` +
                    `┃◆ 💰 -${offer.price.toLocaleString()}G\n` +
                    `╚═══════════════════════════╝`
                );
            }

            // ── !materialtrade decline <id> ────────────────────────────────────
            if (sub === 'decline') {
                const offerId = parseInt(args[1]);
                const offer   = pendingTrades.get(offerId);
                if (!offer) return msg.reply("❌ No offer found.");
                if (offer.toId !== userId && offer.fromId !== userId) return msg.reply("❌ Not your offer.");
                pendingTrades.delete(offerId);
                return msg.reply(`╔══〘 🔄 TRADE 〙══╗\n┃◆ Offer #${offerId} declined.\n╚═══════════════════════════╝`);
            }

            // ── !materialtrade inbox ───────────────────────────────────────────
            if (sub === 'inbox') {
                const myOffers = [...pendingTrades.entries()].filter(
                    ([, o]) => o.toId === userId || o.fromId === userId
                );
                if (!myOffers.length) return msg.reply(
                    `╔══〘 🔄 INBOX 〙══╗\n┃◆ No pending trades.\n╚═══════════════════════════╝`
                );
                let text = `╔══〘 🔄 TRADE INBOX 〙══╗\n┃◆\n`;
                for (const [id, o] of myOffers) {
                    const dir = o.fromId === userId ? '→ outgoing' : '← incoming';
                    const [nick] = await db.execute("SELECT nickname FROM players WHERE id=?", [o.fromId === userId ? o.toId : o.fromId]);
                    text += `┃◆ #${id} ${dir} ${nick[0]?.nickname}\n`;
                    text += `┃◆   📦 ${o.material} ×${o.quantity}  💰 ${o.price.toLocaleString()}G\n┃◆\n`;
                }
                text += `╚═══════════════════════════╝`;
                return msg.reply(text);
            }

        } catch(err) {
            console.error('materialtrade error:', err);
            msg.reply('❌ Trade failed.');
        }
    }
};