const db = require('../database/db');
const getUserId = require('../utils/getUserId');

module.exports = {
    name: 'unequip',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply("❌ Use: !unequip <number>");
        const idx = parseInt(args[0]) - 1;
        if (isNaN(idx) || idx < 0) return msg.reply("❌ Invalid number.");

        try {
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? ORDER BY id",
                [userId]
            );
            const item = items[idx];
            if (!item) return msg.reply("❌ Item not found.");
            if (!item.equipped) return msg.reply("❌ Item not equipped.");

            await db.execute("UPDATE inventory SET equipped=0 WHERE id=?", [item.id]);
            const validStats = ['strength','agility','intelligence','stamina'];
            if (validStats.includes(item.item_type)) {
                await db.execute(`UPDATE players SET ${item.item_type} = ${item.item_type} - 5 WHERE id=?`, [userId]);
            }

            return msg.reply(`🎒 Unequipped ${item.item_name}`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Unequip failed.");
        }
    }
};