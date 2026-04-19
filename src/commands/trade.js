const db = require('../database/db');
const getUserId = require('../utils/getUserId');

module.exports = {
    name: 'trade',
    async execute(msg, args, { userId }) {
        if (!args[0] || !args[1]) {
            return msg.reply("❌ Use: !trade @user <item number>");
        }

        const mentioned = msg.mentionedIds;
        if (!mentioned.length) return msg.reply("❌ Mention a player.");

        const targetId = mentioned[0].replace(/@c\.us/g, "").split("@")[0];
        const index = parseInt(args[1]) - 1;
        if (isNaN(index) || index < 0) return msg.reply("❌ Invalid item number.");

        if (targetId === userId) return msg.reply("❌ You cannot trade with yourself.");

        try {
            const [target] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
            if (!target.length) return msg.reply("❌ Player not registered.");

            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? ORDER BY id",
                [userId]
            );
            if (index >= items.length) return msg.reply("❌ You don't have that item.");
            const item = items[index];
            if (item.equipped) return msg.reply("❌ Unequip the item first.");

            await db.execute("UPDATE inventory SET player_id=? WHERE id=?", [targetId, item.id]);

            return msg.reply(`╭══〘 🎁 TRADE COMPLETE 〙══╮
┃
┃   You gave ${item.item_name}
┃   to ${target[0].nickname}
┃
╰══════════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Trade failed.");
        }
    }
};