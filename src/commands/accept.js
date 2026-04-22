const db = require('../database/db');
const { startPvPDuel } = require('../systems/pvpsystem');

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

        // Find pending challenge
        const [challenge] = await db.execute(
            "SELECT * FROM pvp_challenges WHERE challenger_id=? AND target_id=? AND status='pending' AND expires_at > NOW()",
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

        // Validate both players have enough gold for bet
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

            // Deduct from both — winner gets it back ×2 on victory
            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [betAmount, challengerId]);
            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [betAmount, userId]);
        }

        // Mark challenge as accepted
        await db.execute("UPDATE pvp_challenges SET status='accepted' WHERE id=?", [challenge[0].id]);

        // Start duel — pvpsystem handles all combat, victory, and bet payout
        const result = await startPvPDuel(challengerId, userId, betAmount, client, msg);
        if (result.error) {
            // Refund bets if duel failed to start
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