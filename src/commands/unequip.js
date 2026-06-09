const db = require('../database/db');
const { getInventoryItem } = require('../utils/inventoryHelper');

module.exports = {
    name: 'unequip',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply(
            `══〘 🎒 UNEQUIP 〙══╮\n┃◆ ❌ Use: !unequip <number>\n╰═══════════════════════╯`
        );
        const num = parseInt(args[0]);
        if (isNaN(num) || num < 1) return msg.reply(
            `══〘 🎒 UNEQUIP 〙══╮\n┃◆ ❌ Invalid number.\n╰═══════════════════════╯`
        );

        try {
            const item = await getInventoryItem(userId, num);
            if (!item) return msg.reply(
                `══〘 🎒 UNEQUIP 〙══╮\n┃◆ ❌ Item not found.\n┃◆ Use !inventory to check.\n╰═══════════════════════╯`
            );
            if (!item.equipped) return msg.reply(
                `══〘 🎒 UNEQUIP 〙══╮\n┃◆ ❌ ${item.item_name} is not equipped.\n╰═══════════════════════╯`
            );

            await db.execute("UPDATE inventory SET equipped=0 WHERE id=?", [item.id]);

            // ✅ Do NOT modify base stats — removing the old -5 which was
            // incorrectly subtracting from base stats that were never changed on equip.
            // Item bonuses are read directly from inventory during combat, not from base stats.

            return msg.reply(
                `══〘 🎒 UNEQUIP 〙══╮\n` +
                `┃◆ ✅ ${item.item_name} unequipped.\n` +
                `┃◆ Moved back to bag.\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🎒 UNEQUIP 〙══╮\n┃◆ ❌ Unequip failed.\n╰═══════════════════════╯`);
        }
    }
};