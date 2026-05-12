const db = require('../database/db');

const REFERRAL_GROUP_JID   = '120363166048111971@g.us';
const REFERRAL_XP_REFERRER = 20;
const REFERRAL_GOLD_NEW    = 200;

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

    // ✅ Unique referral codes table
    await db.execute(`
        CREATE TABLE IF NOT EXISTS referral_codes (
            code        VARCHAR(10) PRIMARY KEY,
            player_id   VARCHAR(50) NOT NULL UNIQUE,
            created_at  DATETIME DEFAULT NOW()
        )
    `).catch(() => {});
}

// Generate a unique 6-char code for a player
async function getOrCreateCode(playerId) {
    await ensureTable();

    const [existing] = await db.execute(
        "SELECT code FROM referral_codes WHERE player_id=?", [playerId]
    );
    if (existing.length) return existing[0].code;

    // Generate unique code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code, exists;
    do {
        code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
        const [check] = await db.execute("SELECT code FROM referral_codes WHERE code=?", [code]);
        exists = check.length > 0;
    } while (exists);

    await db.execute("INSERT INTO referral_codes (code, player_id) VALUES (?, ?)", [code, playerId]);
    return code;
}

async function getReferrerByCode(code) {
    const [rows] = await db.execute(
        "SELECT player_id FROM referral_codes WHERE code=?", [code.toUpperCase()]
    );
    return rows[0]?.player_id || null;
}

module.exports = {
    name: 'referral',
    ensureTable,
    getOrCreateCode,
    getReferrerByCode,
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

            // Get or generate unique code
            const code = await getOrCreateCode(userId);

            // Get group invite link
            let inviteLink = '';
            try {
                const groupCode = await client.groupInviteCode(REFERRAL_GROUP_JID);
                inviteLink = `https://chat.whatsapp.com/${groupCode}`;
            } catch (e) {
                inviteLink = '(Bot must be group admin to generate link)';
            }

            // Count referrals and total XP
            const [refs] = await db.execute(
                "SELECT COUNT(*) as cnt, COALESCE(SUM(xp_rewarded),0) as total_xp FROM referrals WHERE referrer_id=?",
                [userId]
            );

            return msg.reply(
                `══〘 🔗 YOUR REFERRAL 〙══╮\n` +
                `┃◆ 👤 ${player[0].nickname}\n` +
                `┃◆────────────\n` +
                `┃◆ 🔑 Your code: *${code}*\n` +
                `┃◆ \n` +
                `┃◆ Share the group link:\n` +
                `┃◆ ${inviteLink}\n` +
                `┃◆ \n` +
                `┃◆ Ask them to type:\n` +
                `┃◆ *!referred ${code}*\n` +
                `┃◆ after joining to claim rewards.\n` +
                `┃◆────────────\n` +
                `┃◆ ⭐ You get: +${REFERRAL_XP_REFERRER} XP per referral\n` +
                `┃◆ 💰 They get: +${REFERRAL_GOLD_NEW} Gold on register\n` +
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