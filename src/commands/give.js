const db = require('../database/db');

module.exports = {
    name: 'give',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");

        if (args.length < 3) {
            return msg.reply("❌ Use: !give @user <type> <amount>\nType: gold, xp, item");
        }

        const mentioned = msg.mentionedIds;
        let targetId = mentioned.length ? mentioned[0].replace(/@c\.us/g, "").split("@")[0] : null;
        if (!targetId) return msg.reply("❌ Mention a player.");

        const type = args[1].toLowerCase();
        const amount = parseInt(args[2]);

        try {
            const [target] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
            if (!target.length) return msg.reply("❌ Player not registered.");

            switch (type) {
                case 'gold':
                    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [amount, targetId]);
                    return msg.reply(`✅ Gave ${amount} gold to ${target[0].nickname}.`);
                case 'xp':
                    await db.execute(
                        "INSERT INTO xp (player_id, xp) VALUES (?, ?) ON DUPLICATE KEY UPDATE xp = xp + ?",
                        [targetId, amount, amount]
                    );
                    return msg.reply(`✅ Gave ${amount} XP to ${target[0].nickname}.`);
                case 'item':
                    const itemName = args.slice(2).join(' ');
                    await db.execute(
                        "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped) VALUES (?, ?, 'strength', 1, 0)",
                        [targetId, itemName]
                    );
                    return msg.reply(`✅ Gave item "${itemName}" to ${target[0].nickname}.`);
                default:
                    return msg.reply("❌ Invalid type. Use: gold, xp, item.");
            }
        } catch (err) {
            console.error(err);
            msg.reply("❌ Give failed.");
        }
    }
};