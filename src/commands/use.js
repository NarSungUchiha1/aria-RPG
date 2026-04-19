const db = require('../database/db');
const getUserId = require('../utils/getUserId');

module.exports = {
    name: 'use',
    async execute(msg, args, { userId }) {
        const itemName = args.join(' ').trim();
        if (!itemName) return msg.reply("❌ Use: !use <item name>");

        try {
            // Find the item in inventory
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? AND item_name=? LIMIT 1",
                [userId, itemName]
            );
            if (!items.length) {
                return msg.reply(`❌ You don't have a ${itemName}.`);
            }
            const item = items[0];

            if (item.item_name === 'Mana Potion') {
                const [player] = await db.execute(
                    "SELECT role, mana, max_mana FROM players WHERE id=?",
                    [userId]
                );
                if (!player.length) return msg.reply("❌ Not registered.");

                const role = player[0].role;
                if (role !== 'Mage' && role !== 'Healer') {
                    return msg.reply("❌ Only Mages and Healers can use mana potions.");
                }

                const grade = item.grade || 'F';
                const restoreMap = {
                    F: 30, E: 45, D: 60, C: 80, B: 100, A: 130, S: 170
                };
                const restore = restoreMap[grade] || 30;

                const currentMana = Number(player[0].mana) || 0;
                const maxMana = Number(player[0].max_mana) || 50;
                const newMana = Math.min(maxMana, currentMana + restore);

                await db.execute("UPDATE players SET mana = ? WHERE id=?", [newMana, userId]);
                // Consume the potion
                await db.execute("DELETE FROM inventory WHERE id=?", [item.id]);

                return msg.reply(`══〘 💙 MANA POTION 〙══╮
┃◆ You drink the ${grade}-grade Mana Potion.
┃◆ Mana restored: +${restore}
┃◆ Mana: ${currentMana}/${maxMana} → ${newMana}/${maxMana}
┃◆ The potion is consumed.
╰═══════════════════════╯`);
            }

            return msg.reply("❌ Cannot use that item.");
        } catch (err) {
            console.error(err);
            msg.reply("❌ Failed to use item.");
        }
    }
};