const db = require('../database/db');

module.exports = {
    name: 'trade',
    async execute(msg, args, { userId }) {
        if (!args[0] || !args[1]) {
            return msg.reply(
                `══〘 🔄 TRADE 〙══╮\n` +
                `┃◆ ❌ Use: !trade @user <item #>\n` +
                `╰═══════════════════════╯`
            );
        }

        const mentioned = msg.mentionedIds;
        if (!mentioned.length) {
            return msg.reply(
                `══〘 🔄 TRADE 〙══╮\n` +
                `┃◆ ❌ Mention a player.\n` +
                `╰═══════════════════════╯`
            );
        }

        const targetId = mentioned[0].replace(/@c\.us/g, "").split("@")[0];
        const index    = parseInt(args[1]) - 1;

        if (isNaN(index) || index < 0) {
            return msg.reply(
                `══〘 🔄 TRADE 〙══╮\n` +
                `┃◆ ❌ Invalid item number.\n` +
                `╰═══════════════════════╯`
            );
        }

        if (targetId === userId) {
            return msg.reply(
                `══〘 🔄 TRADE 〙══╮\n` +
                `┃◆ ❌ You cannot trade with yourself.\n` +
                `╰═══════════════════════╯`
            );
        }

        try {
            const [target] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
            if (!target.length) {
                return msg.reply(
                    `══〘 🔄 TRADE 〙══╮\n` +
                    `┃◆ ❌ Player not registered.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? ORDER BY id",
                [userId]
            );

            if (index >= items.length) {
                return msg.reply(
                    `══〘 🔄 TRADE 〙══╮\n` +
                    `┃◆ ❌ Item not found.\n` +
                    `┃◆ Use !inventory to check your items.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const item = items[index];

            if (item.equipped) {
                return msg.reply(
                    `══〘 🔄 TRADE 〙══╮\n` +
                    `┃◆ ❌ Unequip the item first.\n` +
                    `┃◆ Use !unequip ${args[1]}\n` +
                    `╰═══════════════════════╯`
                );
            }

            await db.execute("UPDATE inventory SET player_id=? WHERE id=?", [targetId, item.id]);

            return msg.reply(
                `══〘 🔄 TRADE COMPLETE 〙══╮\n` +
                `┃◆ Item:  ${item.item_name}\n` +
                `┃◆ To:    ${target[0].nickname}\n` +
                `┃◆ ✅ Trade successful.\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(
                `══〘 🔄 TRADE 〙══╮\n` +
                `┃◆ ❌ Trade failed.\n` +
                `╰═══════════════════════╯`
            );
        }
    }
};