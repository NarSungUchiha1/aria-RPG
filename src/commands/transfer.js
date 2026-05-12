const db = require('../database/db');

module.exports = {
    name: 'transfer',
    async execute(msg, args, { userId }) {
        if (!args[0] || !args[1]) {
            return msg.reply(
                `══〘 ⭐ XP TRANSFER 〙══╮\n` +
                `┃◆ ❌ Use: !transfer @user <amount>\n` +
                `╰═══════════════════════╯`
            );
        }

        const mentioned = msg.mentionedIds;
        if (!mentioned.length) {
            return msg.reply(
                `══〘 ⭐ XP TRANSFER 〙══╮\n` +
                `┃◆ ❌ Mention a player.\n` +
                `╰═══════════════════════╯`
            );
        }

        const targetId = mentioned[0].replace(/@c\.us/g, "").split("@")[0];
        const amount   = parseInt(args[1]);

        if (isNaN(amount) || amount <= 0) {
            return msg.reply(
                `══〘 ⭐ XP TRANSFER 〙══╮\n` +
                `┃◆ ❌ Invalid amount.\n` +
                `╰═══════════════════════╯`
            );
        }

        if (targetId === userId) {
            return msg.reply(
                `══〘 ⭐ XP TRANSFER 〙══╮\n` +
                `┃◆ ❌ You cannot transfer XP to yourself.\n` +
                `╰═══════════════════════╯`
            );
        }

        try {
            const [target] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
            if (!target.length) {
                return msg.reply(
                    `══〘 ⭐ XP TRANSFER 〙══╮\n` +
                    `┃◆ ❌ That player is not registered.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const [sender] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const senderXp = sender[0]?.xp || 0;

            if (senderXp < amount) {
                return msg.reply(
                    `══〘 ⭐ XP TRANSFER 〙══╮\n` +
                    `┃◆ ❌ Not enough XP.\n` +
                    `┃◆ You have: ${senderXp} XP\n` +
                    `╰═══════════════════════╯`
                );
            }

            await db.execute("UPDATE xp SET xp = xp - ? WHERE player_id=?", [amount, userId]);
            await db.execute(
                "INSERT INTO xp (player_id, xp) VALUES (?, ?) ON DUPLICATE KEY UPDATE xp = xp + ?",
                [targetId, amount, amount]
            );

            return msg.reply(
                `══〘 ⭐ XP TRANSFER 〙══╮\n` +
                `┃◆ To:     ${target[0].nickname}\n` +
                `┃◆ Amount: ${amount} XP\n` +
                `┃◆ ✅ Transfer successful.\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(
                `══〘 ⭐ XP TRANSFER 〙══╮\n` +
                `┃◆ ❌ Transfer failed.\n` +
                `╰═══════════════════════╯`
            );
        }
    }
};