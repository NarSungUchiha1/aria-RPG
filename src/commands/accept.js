const db = require('../database/db');
const { startPvPDuel, startPartyAssembly } = require('../systems/pvpsystem');

async function ensureTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS pvp_challenges (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            challenger_id VARCHAR(50) NOT NULL,
            target_id     VARCHAR(50) NOT NULL,
            bet_amount    INT DEFAULT 0,
            status        ENUM('pending','accepted','declined') DEFAULT 'pending',
            duel_type     ENUM('solo','party') DEFAULT 'solo',
            created_at    DATETIME DEFAULT NOW()
        )
    `).catch(() => {});

    // Migrate tables that predate duel_type column
    await db.execute(`ALTER TABLE pvp_challenges ADD COLUMN duel_type ENUM('solo','party') DEFAULT 'solo'`).catch(() => {});
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
        const duelType  = challenge[0].duel_type || 'solo';

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

        // ── PARTY DUEL — group by challenger_id (replaces team_key) ──────────
        if (duelType === 'party') {
            // All party challenges sent by this challenger in the last 10 minutes
            const [allRows] = await db.execute(
                `SELECT * FROM pvp_challenges
                 WHERE challenger_id=? AND duel_type='party'
                   AND created_at >= DATE_SUB(NOW(), INTERVAL 10 MINUTE)
                 ORDER BY id ASC`,
                [challengerId]
            );

            const pending = allRows.filter(row => row.status === 'pending');
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

            // All accepted — enter assembly phase so both sides can recruit allies
            const teamBIds = allRows.map(row => row.target_id);
            const assemblyChat = await msg.getChat();
            await startPartyAssembly(challengerId, teamBIds, betAmount, assemblyChat, `party_${challengerId}`);
            return;
        }

        // ── SOLO DUEL — 1v1, start immediately ───────────────────────────────
        const result = await startPvPDuel([challengerId], [userId], betAmount, client, msg);
        if (result?.error) {
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