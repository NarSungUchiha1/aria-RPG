const db = require('../database/db');
const { startPvPDuel } = require('../systems/pvpsystem');

async function ensureTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS pvp_challenges (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            challenger_id VARCHAR(50) NOT NULL,
            target_id     VARCHAR(50) NOT NULL,
            bet_amount    INT DEFAULT 0,
            status        ENUM('pending','accepted','declined') DEFAULT 'pending',
            team_key      VARCHAR(64) DEFAULT NULL,
            created_at    DATETIME DEFAULT NOW()
        )
    `).catch(() => {});

    await db.execute(`ALTER TABLE pvp_challenges ADD COLUMN IF NOT EXISTS team_key VARCHAR(64) DEFAULT NULL`).catch(() => {});
}

module.exports = {
    name: 'accept',
    async execute(msg, args, { userId, client }) {
        let challengerId = null;
        if (msg.mentionedIds.length > 0) {
            challengerId = msg.mentionedIds[0].replace(/@c\.us/g, "").split("@")[0];
        } else {
            return msg.reply(
                `══〘 ⚔️ ACCEPT 〙══╮\n` +
                `┃◆ ❌ Mention the challenger.\n` +
                `┃◆ Use: !accept @challenger\n` +
                `╰═══════════════════════╯`
            );
        }

        await ensureTable();

        const [challenge] = await db.execute(
            "SELECT * FROM pvp_challenges WHERE challenger_id=? AND target_id=? AND status='pending' ORDER BY id DESC LIMIT 1",
            [challengerId, userId]
        );
        if (!challenge.length) {
            return msg.reply(
                `══〘 ⚔️ ACCEPT 〙══╮\n` +
                `┃◆ ❌ No pending challenge from that player.\n` +
                `┃◆ It may have expired.\n` +
                `╰═══════════════════════╯`
            );
        }

        const betAmount = challenge[0].bet_amount || 0;
        const teamKey = challenge[0].team_key;

        if (betAmount > 0) {
            const [challengerGold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [challengerId]);
            const [targetGold]     = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);

            if (!challengerGold.length || challengerGold[0].gold < betAmount) {
                return msg.reply(
                    `══〘 ⚔️ ACCEPT 〙══╮\n` +
                    `┃◆ ❌ Challenger no longer has enough gold.\n` +
                    `┃◆ Bet: ${betAmount} Gold\n` +
                    `╰═══════════════════════╯`
                );
            }
            if (!targetGold.length || targetGold[0].gold < betAmount) {
                return msg.reply(
                    `══〘 ⚔️ ACCEPT 〙══╮\n` +
                    `┃◆ ❌ You don't have enough gold.\n` +
                    `┃◆ Bet: ${betAmount} Gold\n` +
                    `╰═══════════════════════╯`
                );
            }

            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [betAmount, challengerId]);
            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [betAmount, userId]);
        }

        await db.execute("UPDATE pvp_challenges SET status='accepted' WHERE id=?", [challenge[0].id]);

        if (teamKey) {
            const [teamRows] = await db.execute(
                "SELECT * FROM pvp_challenges WHERE team_key=? ORDER BY id ASC",
                [teamKey]
            );
            const pending = teamRows.filter(row => row.status === 'pending');
            if (pending.length > 0) {
                const waitingIds = pending.map(row => row.target_id);
                return msg.reply(
                    `══〘 ⚔️ ACCEPT 〙══╮\n` +
                    `┃◆ ✅ Challenge accepted.\n` +
                    `┃◆ Waiting on ${pending.length} more player(s) to accept.\n` +
                    `┃◆ Pending: ${waitingIds.map(id => `@${id}`).join(', ')}\n` +
                    `╰═══════════════════════╯`
                );
            }

            const targetIds = teamRows.map(row => row.target_id);
            const result = await startPvPDuel(challengerId, targetIds, betAmount, client, msg);
            if (result.error) {
                if (betAmount > 0) {
                    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [betAmount, challengerId]);
                    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [betAmount, userId]);
                }
                return msg.reply(
                    `══〘 ⚔️ ACCEPT 〙══╮\n` +
                    `┃◆ ❌ ${result.error}\n` +
                    `${betAmount > 0 ? '┃◆ 💰 Bets have been refunded.\n' : ''}` +
                    `╰═══════════════════════╯`
                );
            }
            return;
        }

        const result = await startPvPDuel(challengerId, userId, betAmount, client, msg);
        if (result.error) {
            if (betAmount > 0) {
                await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [betAmount, challengerId]);
                await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [betAmount, userId]);
            }
            return msg.reply(
                `══〘 ⚔️ ACCEPT 〙══╮\n` +
                `┃◆ ❌ ${result.error}\n` +
                `${betAmount > 0 ? '┃◆ 💰 Bets have been refunded.\n' : ''}` +
                `╰═══════════════════════╯`
            );
        }
    }
};
