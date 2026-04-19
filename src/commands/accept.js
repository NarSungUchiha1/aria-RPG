const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { startPvPDuel } = require('../systems/pvpsystem');

module.exports = {
    name: 'accept',
    async execute(msg, args, { userId, client }) {
        if (args.length < 1) {
            return msg.reply("❌ Use: !accept @challenger");
        }

        let challengerId = null;
        if (msg.mentionedIds.length > 0) {
            challengerId = msg.mentionedIds[0].replace(/@c\.us/g, "").split("@")[0];
        } else {
            return msg.reply("❌ You must mention the challenger.");
        }

        // Find pending challenge
        const [challenge] = await db.execute(
            "SELECT * FROM pvp_challenges WHERE challenger_id=? AND target_id=? AND status='pending' AND expires_at > NOW()",
            [challengerId, userId]
        );
        if (!challenge.length) {
            return msg.reply("❌ No pending challenge from that player.");
        }

        const betAmount = challenge[0].bet_amount;

        // Deduct bet from both players (if any)
        if (betAmount > 0) {
            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [betAmount, challengerId]);
            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [betAmount, userId]);
        }

        // Mark challenge as accepted
        await db.execute("UPDATE pvp_challenges SET status='accepted' WHERE id=?", [challenge[0].id]);

        // Start the duel (bet amount is passed for record-keeping; actual pot is handled in victory)
        const result = await startPvPDuel(challengerId, userId, betAmount, client, msg);
        if (result.error) {
            return msg.reply(`❌ ${result.error}`);
        }

        // If duel ended immediately (e.g., one player already dead), handle
        if (result.winner) {
            const loser = result.winner === challengerId ? userId : challengerId;
            // Update wins/losses
            await db.execute("UPDATE players SET pvp_wins = pvp_wins + 1 WHERE id=?", [result.winner]);
            await db.execute("UPDATE players SET pvp_losses = pvp_losses + 1 WHERE id=?", [loser]);

            // Transfer total bet to winner
            if (betAmount > 0) {
                await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [betAmount * 2, result.winner]);
            }

            // Clean up challenge
            await db.execute("DELETE FROM pvp_challenges WHERE id=?", [challenge[0].id]);
        }
        // If duel is ongoing, it will be resolved later by attack commands
    }
};