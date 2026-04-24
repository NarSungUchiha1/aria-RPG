const db = require('../database/db');
const { ensureTables, HEALER_GC } = require('../systems/healerMarket');

module.exports = {
    name: 'hire',
    async execute(msg, args, { userId, client }) {

        await ensureTables();

        if (!args[0]) return msg.reply(
            `══〘 💚 HIRE 〙══╮\n┃◆ ❌ Use: !hire <number>\n┃◆ Check !healers for the list.\n╰═══════════════════════╯`
        );

        const index = parseInt(args[0]) - 1;
        if (isNaN(index) || index < 0) return msg.reply(
            `══〘 💚 HIRE 〙══╮\n┃◆ ❌ Invalid number.\n╰═══════════════════════╯`
        );

        try {
            const [clientPlayer] = await db.execute(
                "SELECT nickname, hp, max_hp FROM players WHERE id=?", [userId]
            );
            if (!clientPlayer.length) return msg.reply(
                `══〘 💚 HIRE 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );

            const [listings] = await db.execute(
                "SELECT * FROM healer_listings WHERE is_active=1 ORDER BY updated_at DESC"
            );
            const listing = listings[index];
            if (!listing) return msg.reply(
                `══〘 💚 HIRE 〙══╮\n┃◆ ❌ Healer not found.\n┃◆ Use !healers to see the list.\n╰═══════════════════════╯`
            );
            if (listing.healer_id === userId) return msg.reply(
                `══〘 💚 HIRE 〙══╮\n┃◆ ❌ You cannot hire yourself.\n╰═══════════════════════╯`
            );

            // Validate gold
            const [money] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const gold = money[0]?.gold || 0;
            if (gold < listing.price_gold) return msg.reply(
                `══〘 💚 HIRE 〙══╮\n┃◆ ❌ Not enough gold.\n┃◆ Need: ${listing.price_gold} Gold\n┃◆ Have: ${gold} Gold\n╰═══════════════════════╯`
            );

            // Validate XP
            const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const xp = xpRow[0]?.xp || 0;
            if (xp < listing.price_xp) return msg.reply(
                `══〘 💚 HIRE 〙══╮\n┃◆ ❌ Not enough XP.\n┃◆ Need: ${listing.price_xp} XP\n┃◆ Have: ${xp} XP\n╰═══════════════════════╯`
            );

            const clientNick = clientPlayer[0].nickname;
            const healerNick = listing.nickname;

            // Deduct from client
            if (listing.price_gold > 0) await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [listing.price_gold, userId]);
            if (listing.price_xp   > 0) await db.execute("UPDATE xp SET xp = xp - ? WHERE player_id=?",           [listing.price_xp,   userId]);

            // Pay healer
            if (listing.price_gold > 0) await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [listing.price_gold, listing.healer_id]);
            if (listing.price_xp   > 0) await db.execute(
                "INSERT INTO xp (player_id, xp) VALUES (?, ?) ON DUPLICATE KEY UPDATE xp = xp + ?",
                [listing.healer_id, listing.price_xp, listing.price_xp]
            );

            // Log contract
            await db.execute(
                `INSERT INTO healer_contracts (healer_id, healer_nick, client_id, client_nick, gold_paid, xp_paid, status)
                 VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
                [listing.healer_id, healerNick, userId, clientNick, listing.price_gold, listing.price_xp]
            );

            // Tag healer in GC
            await client.sendMessage(HEALER_GC, {
                text:
                    `══〘 💚 HEALING REQUEST 〙══╮\n` +
                    `┃◆ \n` +
                    `┃◆ @${listing.healer_id} you've been hired!\n` +
                    `┃◆ \n` +
                    `┃◆ 👤 Client: *${clientNick}*\n` +
                    `┃◆ ❤️ Their HP: ${clientPlayer[0].hp}/${clientPlayer[0].max_hp}\n` +
                    `┃◆ \n` +
                    `┃◆ 💰 +${listing.price_gold} Gold received\n` +
                    `┃◆ ⭐ +${listing.price_xp} XP received\n` +
                    `┃◆ \n` +
                    `┃◆ Head to them and heal:\n` +
                    `┃◆ !skill Heal @${userId}\n` +
                    `┃◆ \n` +
                    `╰═══════════════════════╯`,
                mentions: [`${listing.healer_id}@s.whatsapp.net`, `${userId}@s.whatsapp.net`]
            });

            return msg.reply(
                `══〘 💚 HIRED 〙══╮\n` +
                `┃◆ ✅ *${healerNick}* notified!\n` +
                `┃◆ 💰 -${listing.price_gold} Gold\n` +
                `┃◆ ⭐ -${listing.price_xp} XP\n` +
                `┃◆ They will come to you.\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 💚 HIRE 〙══╮\n┃◆ ❌ Hire failed.\n╰═══════════════════════╯`);
        }
    }
};