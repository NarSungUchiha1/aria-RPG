/**
 * BOUNTY BOARD
 * Admin posts bounties. First player to complete claims the reward.
 */
const db = require('../database/db');

async function ensureBountyTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS bounties (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            title        VARCHAR(100) NOT NULL,
            description  TEXT NOT NULL,
            objective    VARCHAR(50) NOT NULL,
            target       VARCHAR(100) DEFAULT NULL,
            count        INT DEFAULT 1,
            reward_gold  INT DEFAULT 0,
            reward_xp    INT DEFAULT 0,
            reward_item  VARCHAR(100) DEFAULT NULL,
            is_active    TINYINT DEFAULT 1,
            claimed_by   VARCHAR(50) DEFAULT NULL,
            created_at   DATETIME DEFAULT NOW(),
            expires_at   DATETIME DEFAULT NULL
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS bounty_progress (
            player_id  VARCHAR(50) NOT NULL,
            bounty_id  INT NOT NULL,
            progress   INT DEFAULT 0,
            PRIMARY KEY (player_id, bounty_id)
        )
    `).catch(() => {});
}

async function getActiveBounties() {
    await ensureBountyTable();
    const [rows] = await db.execute(
        "SELECT * FROM bounties WHERE is_active=1 AND claimed_by IS NULL AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY created_at DESC"
    );
    return rows;
}

async function updateBountyProgress(playerId, objective, target = null, amount = 1, client = null, RAID_GROUP = null) {
    await ensureBountyTable();
    const bounties = await getActiveBounties();
    for (const b of bounties) {
        if (b.objective !== objective) continue;
        if (b.target && target && !target.toLowerCase().includes(b.target.toLowerCase())) continue;

        await db.execute(`
            INSERT INTO bounty_progress (player_id, bounty_id, progress) VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE progress = progress + ?
        `, [playerId, b.id, amount, amount]);

        const [prog] = await db.execute(
            "SELECT progress FROM bounty_progress WHERE player_id=? AND bounty_id=?",
            [playerId, b.id]
        );
        const current = prog[0]?.progress || 0;

        if (current >= b.count) {
            // Claim bounty
            await db.execute("UPDATE bounties SET is_active=0, claimed_by=? WHERE id=?", [playerId, b.id]);
            await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [b.reward_gold, playerId]);
            await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [b.reward_xp, playerId]);

            const [p] = await db.execute("SELECT nickname FROM players WHERE id=?", [playerId]);
            const nick = p[0]?.nickname || playerId;

            if (client && RAID_GROUP) {
                await client.sendMessage(RAID_GROUP, {
                    text:
                        `╔══〘 📋 BOUNTY CLAIMED 〙══╗\n` +
                        `┃◆\n` +
                        `┃◆ *${b.title}*\n` +
                        `┃◆ Claimed by: *${nick}*\n` +
                        `┃◆\n` +
                        `┃◆ 💰 +${b.reward_gold.toLocaleString()}G\n` +
                        `┃◆ ⭐ +${b.reward_xp.toLocaleString()}XP\n` +
                        (b.reward_item ? `┃◆ 🎁 +${b.reward_item}\n` : '') +
                        `╚═══════════════════════════╝`
                }).catch(() => {});
            }
        }
    }
}

module.exports = { ensureBountyTable, getActiveBounties, updateBountyProgress };