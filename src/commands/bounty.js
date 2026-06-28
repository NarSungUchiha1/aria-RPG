/**
 * BOUNTY SYSTEM — Weekly Most Wanted
 * 
 * Every Monday a player is chosen as THE MOST WANTED.
 * Chosen based on: highest PvP wins, or highest rank, or most gold.
 * Everyone must duel them. Beat them = claim the bounty reward.
 * The Most Wanted earns bonus gold for every win they defend.
 * 
 * Commands:
 * !bounty        — see current Most Wanted + reward pool
 * !bounty claim  — claim bounty after beating them in a duel
 * !bounty history — past Most Wanted players
 */

const db = require('../database/db');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS bounty_board (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            target_id     VARCHAR(60) NOT NULL,
            target_nick   VARCHAR(60) NOT NULL,
            target_rank   VARCHAR(10),
            reward_gold   INT DEFAULT 0,
            reward_xp     INT DEFAULT 0,
            week_start    DATE NOT NULL,
            week_end      DATE NOT NULL,
            status        ENUM('active','claimed','expired') DEFAULT 'active',
            claimed_by    VARCHAR(60),
            claimed_nick  VARCHAR(60),
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS bounty_claims (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            bounty_id  INT NOT NULL,
            claimer_id VARCHAR(60) NOT NULL,
            claimed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS bounty_duels (
            id        INT AUTO_INCREMENT PRIMARY KEY,
            bounty_id INT NOT NULL,
            winner_id VARCHAR(60) NOT NULL,
            target_id VARCHAR(60) NOT NULL,
            fought_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(() => {});
}

async function getActiveBounty() {
    await ensureTables();
    const [rows] = await db.execute(
        "SELECT * FROM bounty_board WHERE status='active' AND week_end >= CURDATE() ORDER BY id DESC LIMIT 1"
    );
    return rows[0] || null;
}

async function selectWeeklyTarget() {
    await ensureTables();

    // Already have an active bounty this week?
    const existing = await getActiveBounty();
    if (existing) return existing;

    // Pick the Most Wanted — top PvP winner who isn't already this week's target
    const [candidates] = await db.execute(`
        SELECT p.id, p.nickname, p.rank, p.pvp_wins, p.prestige_level,
               c.gold
        FROM players p
        LEFT JOIN currency c ON c.player_id = p.id
        WHERE p.pvp_wins > 0
        ORDER BY (p.pvp_wins * 3 + COALESCE(p.prestige_level,0) * 10) DESC
        LIMIT 10
    `);

    if (!candidates.length) return null;

    // Pick randomly from top 3 so it's not always the same person
    const pool = candidates.slice(0, Math.min(3, candidates.length));
    const chosen = pool[Math.floor(Math.random() * pool.length)];

    // Reward = 10k base + 1k per pvp_win (capped at 100k)
    const rewardGold = Math.min(100000, 10000 + (chosen.pvp_wins * 1000));
    const rewardXp   = Math.min(50000,  5000  + (chosen.pvp_wins * 500));

    const [result] = await db.execute(
        `INSERT INTO bounty_board (target_id, target_nick, target_rank, reward_gold, reward_xp, week_start, week_end, status)
         VALUES (?, ?, ?, ?, ?, CURDATE(), DATE_ADD(CURDATE(), INTERVAL 6 DAY), 'active')`,
        [chosen.id, chosen.nickname, chosen.rank, rewardGold, rewardXp]
    );

    return { id: result.insertId, ...chosen, reward_gold: rewardGold, reward_xp: rewardXp };
}

module.exports = {
    name: 'bounty',
    ensureTables,
    getActiveBounty,
    selectWeeklyTarget,
    async execute(msg, args, { userId, isAdmin, client }) {
        await ensureTables();
        const sub = args[0]?.toLowerCase();

        // ── !bounty claim ──────────────────────────────────────────────────
        if (sub === 'claim') {
            const bounty = await getActiveBounty();
            if (!bounty) return msg.reply(
                `══〘 🎯 BOUNTY 〙══╮\n┃◆ No active bounty this week.\n╰═══════════════════════╯`
            );

            if (bounty.target_id === userId) return msg.reply(
                `══〘 🎯 BOUNTY 〙══╮\n┃◆ ❌ You can't claim your own bounty.\n╰═══════════════════════╯`
            );

            // Check if they actually beat the target — look at pvp_wins logged in bounty_duels
            // We track this when a duel is won against the bounty target
            const [duelCheck] = await db.execute(
                'SELECT id FROM bounty_duels WHERE winner_id=? AND target_id=? AND bounty_id=?',
                [userId, bounty.target_id, bounty.id]
            ).catch(() => [[]]);

            if (!duelCheck.length) return msg.reply(
                `══〘 🎯 BOUNTY 〙══╮\n` +
                `┃◆ ❌ No record of you beating *${bounty.target_nick}*\n` +
                `┃◆ this week.\n` +
                `┃◆ Duel them first — !startduel @${bounty.target_nick}\n` +
                `╰═══════════════════════╯`
            );

            // Already claimed?
            const [alreadyClaimed] = await db.execute(
                'SELECT id FROM bounty_claims WHERE bounty_id=? AND claimer_id=?',
                [bounty.id, userId]
            );
            if (alreadyClaimed.length) return msg.reply(
                `══〘 🎯 BOUNTY 〙══╮\n┃◆ ❌ You already claimed this bounty.\n╰═══════════════════════╯`
            );

            // Pay out
            await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [bounty.reward_gold, userId]);
            await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [bounty.reward_xp, userId]);
            await db.execute('INSERT INTO bounty_claims (bounty_id, claimer_id) VALUES (?,?)', [bounty.id, userId]);

            const [claimer] = await db.execute('SELECT nickname FROM players WHERE id=?', [userId]);
            const claimerNick = claimer[0]?.nickname || userId;

            // Announce in raid GC
            await client.sendMessage(RAID_GROUP, {
                text:
                    `╔══〘 🎯 BOUNTY CLAIMED 〙══╗\n` +
                    `┃◆\n` +
                    `┃◆ *${claimerNick}* has taken down\n` +
                    `┃◆ the Most Wanted *${bounty.target_nick}*!\n` +
                    `┃◆\n` +
                    `┃◆ 💰 +${bounty.reward_gold.toLocaleString()} Gold\n` +
                    `┃◆ ⭐ +${bounty.reward_xp.toLocaleString()} XP\n` +
                    `┃◆\n` +
                    `┃◆ The hunt is over. For now.\n` +
                    `╚═══════════════════════════╝`
            }).catch(() => {});

            return msg.reply(
                `╔══〘 🎯 BOUNTY CLAIMED 〙══╗\n` +
                `┃◆ 💰 +${bounty.reward_gold.toLocaleString()} Gold\n` +
                `┃◆ ⭐ +${bounty.reward_xp.toLocaleString()} XP\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── !bounty history ────────────────────────────────────────────────
        if (sub === 'history') {
            const [history] = await db.execute(
                "SELECT * FROM bounty_board ORDER BY id DESC LIMIT 5"
            );
            if (!history.length) return msg.reply('══〘 🎯 BOUNTY 〙══╮\n┃◆ No history yet.\n╰═══════════════════════╯');

            let text = '╔══〘 🎯 BOUNTY HISTORY 〙══╗\n┃◆\n';
            history.forEach(b => {
                const emoji = b.status === 'claimed' ? '✅' : b.status === 'expired' ? '💀' : '🎯';
                text += `┃◆ ${emoji} *${b.target_nick}* [${b.target_rank}]\n`;
                text += `┃◆    Week of ${b.week_start}\n`;
                if (b.claimed_nick) text += `┃◆    Taken down by: ${b.claimed_nick}\n`;
                text += `┃◆\n`;
            });
            text += '╚═══════════════════════════╝';
            return msg.reply(text);
        }

        // ── !bounty (view current) ─────────────────────────────────────────
        const bounty = await getActiveBounty();
        if (!bounty) return msg.reply(
            `══〘 🎯 BOUNTY BOARD 〙══╮\n` +
            `┃◆ No bounty this week yet.\n` +
            `┃◆ The board updates every Monday.\n` +
            `╰═══════════════════════╯`
        );

        // Check how many times the target has defended
        const [defenses] = await db.execute(
            'SELECT COUNT(*) as cnt FROM bounty_claims WHERE bounty_id=?', [bounty.id]
        );
        const claimCount = defenses[0]?.cnt || 0;

        // Check if this player is the target
        const isTarget = bounty.target_id === userId;

        return msg.reply(
            `╔══〘 🎯 MOST WANTED 〙══╗\n` +
            `┃◆\n` +
            `┃◆ 🎯 *${bounty.target_nick}* [${bounty.target_rank}]\n` +
            `┃◆\n` +
            `┃◆ Reward for taking them down:\n` +
            `┃◆ 💰 ${bounty.reward_gold.toLocaleString()} Gold\n` +
            `┃◆ ⭐ ${bounty.reward_xp.toLocaleString()} XP\n` +
            `┃◆\n` +
            `┃◆ Hunters taken down: ${claimCount}\n` +
            `┃◆ Week ends: ${bounty.week_end}\n` +
            `┃◆\n` +
            (isTarget
                ? `┃◆ ⚠️ You are the Most Wanted.\n┃◆ Defend yourself from challengers.\n`
                : `┃◆ !startduel @${bounty.target_nick} to challenge\n┃◆ !bounty claim after winning\n`) +
            `╚═══════════════════════════╝`
        );
    }
};