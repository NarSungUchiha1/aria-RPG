const db = require('../database/db');

const DAILY_GOLD = 2000;
const DAILY_XP   = 2000;

const NARRATIVES = [
    'The void remembers those who serve it. The system has deposited your allowance.',
    'Every hunter who walks the void path receives sustenance. The abyss provides.',
    'Malachar\'s absence leaves resources unclaimed. The system redistributes them to you.',
    'The fractures bleed energy. As a Void Hunter you are entitled to collect it.',
    'The old world\'s gates have fallen. What remains belongs to those still standing.',
    'The system logs your continued survival. Compensation has been issued accordingly.',
    'Void energy crystallises overnight. Your share has been extracted and deposited.',
    'Another day beyond the threshold. The abyss compensates those who endure it.'
];

async function ensureDailyTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS prestige_daily_claims (
            player_id VARCHAR(50) PRIMARY KEY,
            last_claim DATETIME DEFAULT NULL
        )
    `).catch(() => {});
}

module.exports = {
    name: 'daily',
    async execute(msg, args, { userId }) {
        try {
            const [playerRow] = await db.execute(
                "SELECT nickname, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
                [userId]
            );
            if (!playerRow.length) return msg.reply(
                `╔══〘 ✦ DAILY 〙══╗\n┃★ ❌ Not registered.\n╚════════════════════════════╝`
            );

            const p = playerRow[0];
            if (!p.prestige_level) return msg.reply(
                `╔══〘 ✦ DAILY 〙══╗\n` +
                `┃★ ❌ Prestige players only.\n` +
                `┃★ The void does not reward\n` +
                `┃★ those who have not crossed over.\n` +
                `╚════════════════════════════╝`
            );

            await ensureDailyTable();

            const [claim] = await db.execute(
                "SELECT last_claim FROM prestige_daily_claims WHERE player_id=?",
                [userId]
            );

            if (claim.length && claim[0].last_claim) {
                const last     = new Date(claim[0].last_claim);
                const now      = new Date();
                const diffMs   = now - last;
                const diffHrs  = diffMs / (1000 * 60 * 60);

                if (diffHrs < 24) {
                    const remaining = 24 - diffHrs;
                    const h = Math.floor(remaining);
                    const m = Math.floor((remaining - h) * 60);
                    return msg.reply(
                        `╔══〘 ✦ DAILY 〙══╗\n` +
                        `┃★ Already collected today.\n` +
                        `┃★ Next allowance in: ${h}h ${m}m\n` +
                        `╚════════════════════════════╝`
                    );
                }
            }

            // Grant rewards
            await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [DAILY_GOLD, userId]);
            await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [DAILY_XP, userId]);

            // Update claim time
            await db.execute(
                `INSERT INTO prestige_daily_claims (player_id, last_claim)
                 VALUES (?, NOW())
                 ON DUPLICATE KEY UPDATE last_claim=NOW()`,
                [userId]
            );

            const [goldRow] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const narrative = NARRATIVES[Math.floor(Math.random() * NARRATIVES.length)];

            return msg.reply(
                `╔══〘 ✦ VOID ALLOWANCE 〙══╗\n` +
                `┃★ \n` +
                `┃★ 〝${narrative}〞\n` +
                `┃★ \n` +
                `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃★ 💰 +${DAILY_GOLD.toLocaleString()} Gold\n` +
                `┃★ ⭐ +${DAILY_XP.toLocaleString()} XP\n` +
                `┃★ \n` +
                `┃★ Balance: ${(goldRow[0]?.gold || 0).toLocaleString()}G\n` +
                `┃★ Next: 24h from now\n` +
                `╚════════════════════════════╝`
            );
        } catch (err) {
            console.error('daily error:', err);
            msg.reply(`╔══〘 ✦ DAILY 〙══╗\n┃★ ❌ Failed.\n╚════════════════════════════╝`);
        }
    }
};