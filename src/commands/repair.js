const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { repairCostPerDurability } = require('../data/weaponGrades');

module.exports = {
    name: 'repair',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply("❌ Use: !repair <item number>");
        const index = parseInt(args[0]) - 1;
        if (isNaN(index) || index < 0) return msg.reply("❌ Invalid number.");

        try {
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? ORDER BY id",
                [userId]
            );
            const item = items[index];
            if (!item) return msg.reply("❌ Item not found.");
            
            const maxDur = item.max_durability || 100;
            const currentDur = item.durability !== null ? item.durability : maxDur;
            if (currentDur >= maxDur) return msg.reply("✅ Item is already at full durability.");

            const damage = maxDur - currentDur;
            const grade = item.grade || 'F';
            const costPerPoint = repairCostPerDurability[grade] || 1;
            const totalCost = damage * costPerPoint;

            const [money] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const gold = money[0]?.gold || 0;
            if (gold < totalCost) return msg.reply(`❌ You need ${totalCost} gold to repair this item.`);

            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [totalCost, userId]);
            await db.execute("UPDATE inventory SET durability = max_durability WHERE id=?", [item.id]);

            return msg.reply(`══〘 🔧 REPAIR 〙══╮
┃◆ ${item.item_name} (${grade}-Grade) repaired!
┃◆ Cost: ${totalCost} gold
┃◆ Durability: ${currentDur} → ${maxDur}
╰═══════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Repair failed.");
        }
    }
};