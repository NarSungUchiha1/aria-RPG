const db = require('../database/db');

module.exports = {
    name: 'givexp',
    async execute(msg, args, { userId, isAdmin }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");
        if (!args[0] || !args[1]) return msg.reply("❌ Use: !givexp @user <amount>");
        const mentioned = msg.mentionedIds;
        if (!mentioned.length) return msg.reply("❌ Mention a player.");
        const target = mentioned[0].replace(/@c\.us/g, "").split("@")[0];
        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount <= 0) return msg.reply("❌ Invalid amount.");

        try {
            await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [amount, target]);
            return msg.reply(`⭐ ${amount} XP sent.`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Give XP failed.");
        }
    }
};