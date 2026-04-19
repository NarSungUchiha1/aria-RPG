const db = require('../database/db');
const getUserId = require('../utils/getUserId');

module.exports = {
    name: 'decline',
    async execute(msg, args, { userId }) {
        let challengerId = null;
        if (msg.mentionedIds.length > 0) {
            challengerId = msg.mentionedIds[0].replace(/@c\.us/g, "").split("@")[0];
        } else if (args[0]) {
            challengerId = args[0];
        } else {
            return msg.reply("❌ Use: !decline @challenger");
        }

        const [challenge] = await db.execute(
            "SELECT * FROM pvp_challenges WHERE challenger_id=? AND target_id=? AND status='pending'",
            [challengerId, userId]
        );
        if (!challenge.length) {
            return msg.reply("❌ No pending challenge from that player.");
        }

        await db.execute("UPDATE pvp_challenges SET status='declined' WHERE id=?", [challenge[0].id]);
        return msg.reply(`✅ Challenge declined.`);
    }
};