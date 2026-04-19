const db = require('../database/db');
const getUserId = require('../utils/getUserId');

module.exports = {
    
    name: 'equip',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply("❌ Use: !equip <number>");
        const idx = parseInt(args[0]) - 1;
        if (isNaN(idx) || idx < 0) return msg.reply("❌ Invalid number.");

        try {
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? ORDER BY id",
                [userId]
            );
            const item = items[idx];
            if (!item) return msg.reply("❌ Item not found.");
            if (item.equipped) return msg.reply("⚡ Already equipped.");

            // Check if same type already equipped
            const [equipped] = await db.execute(
                "SELECT id FROM inventory WHERE player_id=? AND item_type=? AND equipped=1",
                [userId, item.item_type]
            );
            if (equipped.length) return msg.reply(`❌ You already have a ${item.item_type} item equipped.`);

            await db.execute("UPDATE inventory SET equipped=1 WHERE id=?", [item.id]);
            // Apply stat bonus (assuming +5)
            const validStats = ['strength','agility','intelligence','stamina'];
            if (validStats.includes(item.item_type)) {
                await db.execute(`UPDATE players SET ${item.item_type} = ${item.item_type} + 5 WHERE id=?`, [userId]);
            }

            return msg.reply(`╭══〘 ⚔️ EQUIPPED 〙══╮\n┃◆ ${item.item_name}\n┃◆ +5 ${item.item_type.toUpperCase()}\n╰════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Equip failed.");
        }
    }
};