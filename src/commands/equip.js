const db = require('../database/db');

module.exports = {
    name: 'equip',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply(
            `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Use: !equip <number>\n╰═══════════════════════╯`
        );
        const idx = parseInt(args[0]) - 1;
        if (isNaN(idx) || idx < 0) return msg.reply(
            `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Invalid number.\n╰═══════════════════════╯`
        );

        try {
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? ORDER BY id",
                [userId]
            );
            const item = items[idx];
            if (!item) return msg.reply(
                `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Item not found.\n┃◆ Use !inventory to check.\n╰═══════════════════════╯`
            );
            if (item.equipped) return msg.reply(
                `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ⚡ ${item.item_name} is already equipped.\n╰═══════════════════════╯`
            );
            if (item.item_type === 'consumable') return msg.reply(
                `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Consumables cannot be equipped.\n┃◆ Use !use ${item.item_name}\n╰═══════════════════════╯`
            );

            // Block equipping same type twice
            const [alreadyEquipped] = await db.execute(
                "SELECT id, item_name FROM inventory WHERE player_id=? AND item_type=? AND equipped=1",
                [userId, item.item_type]
            );
            if (alreadyEquipped.length) return msg.reply(
                `══〘 ⚔️ EQUIP 〙══╮\n` +
                `┃◆ ❌ Already have a ${item.item_type} equipped.\n` +
                `┃◆ Unequip: ${alreadyEquipped[0].item_name} first.\n` +
                `╰═══════════════════════╯`
            );

            await db.execute("UPDATE inventory SET equipped=1 WHERE id=?", [item.id]);

            // ✅ Do NOT modify base stats — combat system reads item bonuses
            // directly from inventory (strength_bonus, agility_bonus etc.)
            // Adding to base stats here was causing double-counting.

            // Build bonus display from actual item data
            const bonuses = [];
            if (item.strength_bonus     > 0) bonuses.push(`💪 STR +${item.strength_bonus}`);
            if (item.agility_bonus      > 0) bonuses.push(`⚡ AGI +${item.agility_bonus}`);
            if (item.intelligence_bonus > 0) bonuses.push(`🧠 INT +${item.intelligence_bonus}`);
            if (item.stamina_bonus      > 0) bonuses.push(`🛡️ STA +${item.stamina_bonus}`);
            if (item.attack_bonus       > 0) bonuses.push(`⚔️ ATK +${item.attack_bonus}`);
            if (item.defense_bonus      > 0) bonuses.push(`🛡️ DEF +${item.defense_bonus}`);
            const bonusLine = bonuses.length ? bonuses.join('  ') : 'No stat bonuses';
            const dur = item.durability !== null ? `${item.durability}/${item.max_durability}` : '100/100';

            return msg.reply(
                `══〘 ⚔️ EQUIPPED 〙══╮\n` +
                `┃◆ ${item.item_name} [${item.grade || 'F'}]\n` +
                `┃◆ ${bonusLine}\n` +
                `┃◆ 🔧 Durability: ${dur}\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Equip failed.\n╰═══════════════════════╯`);
        }
    }
};