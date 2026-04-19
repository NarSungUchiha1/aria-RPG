const db = require('../database/db');
const getUserId = require('../utils/getUserId');

module.exports = {
    name: 'transfer',
    async execute(msg, args, { userId }) {
        if (!args[0] || !args[1]) {
            return msg.reply("❌ Use: !transfer @user <amount>");
        }

        const mentioned = msg.mentionedIds;
        if (!mentioned.length) {
            return msg.reply("❌ You must mention a player.");
        }

        const targetId = mentioned[0].replace(/@c\.us/g, "").split("@")[0];
        const amount = parseInt(args[1]);

        if (isNaN(amount) || amount <= 0) {
            return msg.reply("❌ Invalid amount.");
        }

        if (targetId === userId) {
            return msg.reply("❌ You cannot transfer XP to yourself.");
        }

        try {
            const [target] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
            if (!target.length) return msg.reply("❌ That player is not registered.");

            const [sender] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const senderXp = sender[0]?.xp || 0;

            if (senderXp < amount) {
                return msg.reply(`❌ You only have ${senderXp} XP.`);
            }

            await db.execute("UPDATE xp SET xp = xp - ? WHERE player_id=?", [amount, userId]);
            await db.execute(
                "INSERT INTO xp (player_id, xp) VALUES (?, ?) ON DUPLICATE KEY UPDATE xp = xp + ?",
                [targetId, amount, amount]
            );

            return msg.reply(`╭══〘 ⭐ XP TRANSFER 〙══╮
┃
┃   You sent ${amount} XP
┃   to ${target[0].nickname}
┃
╰══════════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Transfer failed.");
        }
    }
};