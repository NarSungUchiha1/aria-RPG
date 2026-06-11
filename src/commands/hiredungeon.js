const db = require('../database/db');
const { ensureTables } = require('../systems/healerMarket');
const { getActiveDungeon, promoteRaider } = require('../engine/dungeon');

module.exports = {
    name: 'hiredungeon',
    async execute(msg, args, { userId, client }) {
        await ensureTables();

        if (!args[0]) return msg.reply(
            `══〘 💚 HIRE HEALER 〙══╮\n` +
            `┃◆ ❌ Use: !hiredungeon <listing #>\n` +
            `┃◆ Use !healers to see available healers.\n` +
            `╰═══════════════════════╯`
        );

        try {
            const dungeon = await getActiveDungeon();
            if (!dungeon) return msg.reply(
                `══〘 💚 HIRE HEALER 〙══╮\n` +
                `┃◆ ❌ No active dungeon right now.\n` +
                `╰═══════════════════════╯`
            );

            if (dungeon.locked) return msg.reply(
                `══〘 💚 HIRE HEALER 〙══╮\n` +
                `┃◆ ❌ Dungeon has already started.\n` +
                `┃◆ Hire a healer during the lobby.\n` +
                `╰═══════════════════════╯`
            );

            // Check existing hire for this dungeon
            const [existing] = await db.execute(
                "SELECT * FROM dungeon_healer WHERE dungeon_id=?", [dungeon.id]
            );
            if (existing.length) return msg.reply(
                `══〘 💚 HIRE HEALER 〙══╮\n` +
                `┃◆ ❌ A healer is already hired for this dungeon.\n` +
                `┃◆ *${existing[0].healer_nick}* is on standby.\n` +
                `╰═══════════════════════╯`
            );

            // Get listings
            const [listings] = await db.execute(
                "SELECT * FROM healer_listings WHERE is_active=1 ORDER BY price_gold ASC"
            );
            if (!listings.length) return msg.reply(
                `══〘 💚 HIRE HEALER 〙══╮\n` +
                `┃◆ ❌ No healers available right now.\n` +
                `╰═══════════════════════╯`
            );

            const index = parseInt(args[0]) - 1;
            if (isNaN(index) || index < 0 || index >= listings.length) return msg.reply(
                `══〘 💚 HIRE HEALER 〙══╮\n` +
                `┃◆ ❌ Invalid listing number.\n` +
                `╰═══════════════════════╯`
            );

            const listing = listings[index];

            // Can't hire yourself
            if (listing.healer_id === userId) return msg.reply(
                `══〘 💚 HIRE HEALER 〙══╮\n` +
                `┃◆ ❌ You can't hire yourself.\n` +
                `╰═══════════════════════╯`
            );

            // Check healer is registered
            const [healer] = await db.execute(
                "SELECT nickname FROM players WHERE id=?", [listing.healer_id]
            );
            if (!healer.length) return msg.reply(
                `══〘 💚 HIRE HEALER 〙══╮\n` +
                `┃◆ ❌ Healer not found.\n` +
                `╰═══════════════════════╯`
            );

            const [hirer] = await db.execute(
                "SELECT nickname FROM players WHERE id=?", [userId]
            );

            // Record the hire
            await db.execute(
                `INSERT INTO dungeon_healer (dungeon_id, healer_id, healer_nick, fee_gold, hired_by)
                 VALUES (?, ?, ?, ?, ?)`,
                [dungeon.id, listing.healer_id, listing.nickname, listing.price_gold, userId]
            );

            // Promote healer into raid group
            const getRaidGroup = () => global.overrideRaidGroup || (global.overrideRaidGroup || process.env.RAID_GROUP_JID) || (global.overrideRaidGroup || '120363213735662100@g.us');
            try {
                await promoteRaider(client, listing.healer_id);
            } catch (e) {}

            // Notify raid group
            await client.sendMessage(getRaidGroup(), {
                text:
                    `══〘 💚 HEALER HIRED 〙══╮\n` +
                    `┃◆ \n` +
                    `┃◆ *${listing.nickname}* has been hired!\n` +
                    `┃◆ Hired by: *${hirer[0].nickname}*\n` +
                    `┃◆ \n` +
                    `┃◆ 💰 Fee: ${listing.price_gold} Gold\n` +
                    `┃◆    (split between party on clear)\n` +
                    `┃◆ \n` +
                    `┃◆ 💚 ${listing.description || 'Ready to heal.'}\n` +
                    `┃◆ \n` +
                    `╰═══════════════════════╯`
            });

            // Notify healer
            await client.sendMessage(`${listing.healer_id}@s.whatsapp.net`, {
                text:
                    `══〘 💚 YOU'VE BEEN HIRED 〙══╮\n` +
                    `┃◆ \n` +
                    `┃◆ *${hirer[0].nickname}* hired you\n` +
                    `┃◆ for dungeon Rank ${dungeon.dungeon_rank}!\n` +
                    `┃◆ \n` +
                    `┃◆ 💰 Fee: ${listing.price_gold} Gold\n` +
                    `┃◆    Paid on successful clear.\n` +
                    `┃◆ \n` +
                    `┃◆ Join the raid group now.\n` +
                    `┃◆ \n` +
                    `╰═══════════════════════╯`
            });

            return msg.reply(
                `══〘 💚 HEALER HIRED 〙══╮\n` +
                `┃◆ ✅ *${listing.nickname}* hired!\n` +
                `┃◆ 💰 Fee: ${listing.price_gold} Gold on clear.\n` +
                `┃◆ They have been notified.\n` +
                `╰═══════════════════════╯`
            );

        } catch (err) {
            console.error(err);
            msg.reply(`══〘 💚 HIRE HEALER 〙══╮\n┃◆ ❌ Hire failed.\n╰═══════════════════════╯`);
        }
    }
};