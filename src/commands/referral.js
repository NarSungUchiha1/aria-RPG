const db = require('../database/db');

const REFERRAL_GROUP_JID    = '120363166048111971@g.us';
const REFERRAL_XP_REFERRER  = 20;
const REFERRAL_GOLD_NEW     = 200;

async function ensureTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS referrals (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            referrer_id   VARCHAR(50) NOT NULL,
            referred_id   VARCHAR(50) NOT NULL,
            xp_rewarded   INT DEFAULT 0,
            created_at    DATETIME DEFAULT NOW(),
            UNIQUE KEY unique_referral (referrer_id, referred_id)
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS referral_pending_bonus (
            player_id VARCHAR(50) PRIMARY KEY,
            gold      INT DEFAULT 0
        )
    `).catch(() => {});
}

module.exports = {
    name: 'referral',
    ensureTable,
    REFERRAL_GROUP_JID,
    REFERRAL_XP_REFERRER,
    REFERRAL_GOLD_NEW,

    async execute(msg, args, { userId, client }) {
        await ensureTable();

        try {
            const [player] = await db.execute(
                "SELECT nickname FROM players WHERE id=?", [userId]
            );
            if (!player.length) return msg.reply(
                `══〘 🔗 REFERRAL 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );

            // Get group invite link
            let inviteLink = '';
            try {
                const code = await client.groupInviteCode(REFERRAL_GROUP_JID);
                inviteLink = `https://chat.whatsapp.com/${code}`;
            } catch (e) {
                inviteLink = '(Could not fetch — make sure bot is admin of the group)';
            }

            // Count referrals and total XP earned
            const [refs] = await db.execute(
                "SELECT COUNT(*) as cnt, COALESCE(SUM(xp_rewarded),0) as total_xp FROM referrals WHERE referrer_id=?",
                [userId]
            );

            return msg.reply(
                `══〘 🔗 YOUR REFERRAL 〙══╮\n` +
                `┃◆ 👤 ${player[0].nickname}\n` +
                `┃◆────────────\n` +
                `┃◆ Share this link with friends:\n` +
                `┃◆ ${inviteLink}\n` +
                `┃◆────────────\n` +
                `┃◆ When they join & register:\n` +
                `┃◆ ⭐ You get: +${REFERRAL_XP_REFERRER} XP\n` +
                `┃◆ 💰 They get: +${REFERRAL_GOLD_NEW} bonus Gold\n` +
                `┃◆────────────\n` +
                `┃◆ 📊 Your referrals: ${refs[0].cnt}\n` +
                `┃◆ ⭐ Total XP earned: ${refs[0].total_xp}\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🔗 REFERRAL 〙══╮\n┃◆ ❌ Failed.\n╰═══════════════════════╯`);
        }
    }
};