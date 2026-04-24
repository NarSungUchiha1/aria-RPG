const db = require('../database/db');
const { RAID_GROUP } = require('../engine/dungeon');

const REFERRAL_XP_REFERRER  = 20;
const REFERRAL_GOLD_NEW      = 200; // bonus gold for new player joining via referral

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
}

module.exports = {
    name: 'referral',
    ensureTable,
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
                const code = await client.groupInviteCode(RAID_GROUP);
                inviteLink = `https://chat.whatsapp.com/${code}`;
            } catch (e) {
                inviteLink = 'Could not fetch invite link — make sure bot is admin.';
            }

            // Count referrals so far
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
            msg.reply(`══〘 🔗 REFERRAL 〙══╮\n┃◆ ❌ Failed to load referral.\n╰═══════════════════════╯`);
        }
    }
};