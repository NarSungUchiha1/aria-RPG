const db = require('../database/db');
const { repairCostPerDurability } = require('../data/weaponGrades');

module.exports = {
    name: 'repair',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply(
            `══〘 🔧 REPAIR 〙══╮\n┃◆ ❌ Use: !repair <item number>\n╰═══════════════════════╯`
        );
        const index = parseInt(args[0]) - 1;
        if (isNaN(index) || index < 0) return msg.reply(
            `══〘 🔧 REPAIR 〙══╮\n┃◆ ❌ Invalid number.\n╰═══════════════════════╯`
        );
        try {
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? ORDER BY id", [userId]
            );
            const item = items[index];
            if (!item) return msg.reply(
                `══〘 🔧 REPAIR 〙══╮\n┃◆ ❌ Item not found.\n┃◆ Use !inventory to check.\n╰═══════════════════════╯`
            );
            const maxDur     = item.max_durability || 100;
            const currentDur = item.durability !== null ? item.durability : maxDur;
            if (currentDur >= maxDur) return msg.reply(
                `══〘 🔧 REPAIR 〙══╮\n┃◆ ✅ ${item.item_name} is already at full durability.\n╰═══════════════════════╯`
            );
            const grade        = item.grade || 'F';
            const costPerPoint = repairCostPerDurability[grade] || 1;
            const totalCost    = (maxDur - currentDur) * costPerPoint;
            const [money]      = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const gold         = money[0]?.gold || 0;
            if (gold < totalCost) return msg.reply(
                `══〘 🔧 REPAIR 〙══╮\n┃◆ ❌ Not enough gold.\n┃◆ Need: ${totalCost} Gold\n┃◆ Have: ${gold} Gold\n╰═══════════════════════╯`
            );
            await db.execute("UPDATE currency SET gold=gold-? WHERE player_id=?", [totalCost, userId]);
            await db.execute("UPDATE inventory SET durability=max_durability WHERE id=?", [item.id]);
            return msg.reply(
                `══〘 🔧 REPAIR 〙══╮\n` +
                `┃◆ ✅ ${item.item_name} [${grade}] repaired!\n` +
                `┃◆ 💰 Cost: ${totalCost} Gold\n` +
                `┃◆ 🔧 Durability: ${currentDur} → ${maxDur}\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🔧 REPAIR 〙══╮\n┃◆ ❌ Repair failed.\n╰═══════════════════════╯`);
        }
    }
};