const db = require('../database/db');
const { getReferrerByCode, ensureTable, REFERRAL_XP_REFERRER, REFERRAL_GOLD_NEW, REFERRAL_GROUP_JID } = require('./referral');

module.exports = {
    name: 'referred',
    async execute(msg, args, { userId, client }) {
        await ensureTable();

        if (!args[0]) return msg.reply(
            `══〘 🔗 REFERRED 〙══╮\n` +
            `┃◆ ❌ Use: !referred <code>\n` +
            `┃◆ Example: !referred ABC123\n` +
            `╰═══════════════════════╯`
        );

        const code = args[0].toUpperCase().trim();

        try {
            // Check already referred
            const [alreadyReferred] = await db.execute(
                "SELECT id FROM referrals WHERE referred_id=?", [userId]
            );
            if (alreadyReferred.length) return msg.reply(
                `══〘 🔗 REFERRED 〙══╮\n` +
                `┃◆ ❌ You have already used a referral code.\n` +
                `╰═══════════════════════╯`
            );

            // Find referrer by code
            const referrerId = await getReferrerByCode(code);
            if (!referrerId) return msg.reply(
                `══〘 🔗 REFERRED 〙══╮\n` +
                `┃◆ ❌ Invalid referral code.\n` +
                `┃◆ Ask your inviter for their code.\n` +
                `╰═══════════════════════╯`
            );

            if (referrerId === userId) return msg.reply(
                `══〘 🔗 REFERRED 〙══╮\n` +
                `┃◆ ❌ You cannot use your own code.\n` +
                `╰═══════════════════════╯`
            );

            const [referrer] = await db.execute("SELECT nickname FROM players WHERE id=?", [referrerId]);
            if (!referrer.length) return msg.reply(
                `══〘 🔗 REFERRED 〙══╮\n` +
                `┃◆ ❌ Referrer not found.\n` +
                `╰═══════════════════════╯`
            );

            // Log referral
            await db.execute(
                "INSERT IGNORE INTO referrals (referrer_id, referred_id, xp_rewarded) VALUES (?, ?, ?)",
                [referrerId, userId, REFERRAL_XP_REFERRER]
            );

            // ✅ Give XP to referrer immediately
            await db.execute(
                "UPDATE xp SET xp = xp + ? WHERE player_id=?",
                [REFERRAL_XP_REFERRER, referrerId]
            );

            // ✅ Give gold bonus to new player (if registered) or store pending
            const [newPlayer] = await db.execute("SELECT id FROM players WHERE id=?", [userId]);
            if (newPlayer.length) {
                await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [REFERRAL_GOLD_NEW, userId]);
            } else {
                await db.execute(
                    `INSERT INTO referral_pending_bonus (player_id, gold) VALUES (?, ?)
                     ON DUPLICATE KEY UPDATE gold = gold + ?`,
                    [userId, REFERRAL_GOLD_NEW, REFERRAL_GOLD_NEW]
                ).catch(() => {});
            }

            // Announce in referral group
            await client.sendMessage(REFERRAL_GROUP_JID, {
                text:
                    `══〘 🔗 REFERRAL REWARD 〙══╮\n` +
                    `┃◆ @${userId} used *${referrer[0].nickname}*'s code!\n` +
                    `┃◆ \n` +
                    `┃◆ ⭐ ${referrer[0].nickname} +${REFERRAL_XP_REFERRER} XP\n` +
                    `┃◆ 💰 @${userId} +${REFERRAL_GOLD_NEW} Gold\n` +
                    `┃◆ \n` +
                    `╰═══════════════════════╯`,
                mentions: [`${userId}@s.whatsapp.net`, `${referrerId}@s.whatsapp.net`]
            });

            return msg.reply(
                `══〘 🔗 REFERRED 〙══╮\n` +
                `┃◆ ✅ Referral confirmed!\n` +
                `┃◆ Invited by: *${referrer[0].nickname}*\n` +
                `┃◆ \n` +
                `┃◆ ⭐ They got +${REFERRAL_XP_REFERRER} XP\n` +
                `┃◆ 💰 You got +${REFERRAL_GOLD_NEW} Gold\n` +
                `┃◆ \n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🔗 REFERRED 〙══╮\n┃◆ ❌ Failed.\n╰═══════════════════════╯`);
        }
    }
};