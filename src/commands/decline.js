const db = require('../database/db');

module.exports = {
    name: 'decline',
    async execute(msg, args, { userId }) {
        let challengerId = null;
        if (msg.mentionedIds.length > 0) {
            challengerId = msg.mentionedIds[0].replace(/@c\.us/g, "").split("@")[0];
        } else if (args[0]) {
            challengerId = args[0];
        } else {
            return msg.reply(
                `══〘 ⚔️ DECLINE 〙══╮\n┃◆ ❌ Use: !decline @challenger\n╰═══════════════════════╯`
            );
        }
        const [challenge] = await db.execute(
            "SELECT * FROM pvp_challenges WHERE challenger_id=? AND target_id=? AND status='pending'",
            [challengerId, userId]
        );
        if (!challenge.length) return msg.reply(
            `══〘 ⚔️ DECLINE 〙══╮\n┃◆ ❌ No pending challenge from that player.\n╰═══════════════════════╯`
        );
        await db.execute("UPDATE pvp_challenges SET status='declined' WHERE id=?", [challenge[0].id]);
        return msg.reply(
            `══〘 ⚔️ DECLINE 〙══╮\n┃◆ ✅ Challenge declined.\n╰═══════════════════════╯`
        );
    }
};