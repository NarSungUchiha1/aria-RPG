const db = require('../database/db');
const getUserId = require('../utils/getUserId');

module.exports = {
    name: 'pay',
    async execute(msg, args, { userId }) {
        if (!args[0] || !args[1]) return msg.reply("❌ Use: !pay @user <amount>");
        const mentioned = msg.mentionedIds;
        if (!mentioned.length) return msg.reply("❌ Mention a player.");
        const target = mentioned[0].replace(/@c\.us/g, "").split("@")[0];
        const amount = parseInt(args[1]);
        if (isNaN(amount) || amount <= 0) return msg.reply("❌ Invalid amount.");

        try {
            const [sender] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            if (!sender.length || sender[0].gold < amount) return msg.reply("❌ Not enough gold.");

            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [amount, userId]);
            await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [amount, target]);

            return msg.reply(`💰 Transfer successful: ${amount} gold`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Payment failed.");
        }
    }
};