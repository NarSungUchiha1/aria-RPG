const db = require('../database/db');
const itemStats = require('../data/itemStats');

module.exports = {
    name: 'gift',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");

        // Usage: !gift @user <item name>
        if (args.length < 2) {
            return msg.reply(
                `❌ Use: !gift @user <item name>\n` +
                `Example: !gift @player Mana Potion\n` +
                `Example: !gift @player Shadow Dagger`
            );
        }

        const mentioned = msg.mentionedIds;
        if (!mentioned.length) return msg.reply("❌ Mention a player.");
        const targetId = mentioned[0];

        // Item name is everything after the mention
        // args[0] is the mention itself so item name starts at args[1]
        const itemName = args.slice(1).join(' ').trim();
        if (!itemName) return msg.reply("❌ Provide an item name.");

        try {
            const [target] = await db.execute(
                "SELECT nickname FROM players WHERE id=?",
                [targetId]
            );
            if (!target.length) return msg.reply("❌ Player not registered.");

            // Look up item data for correct type and bonuses
            const data = itemStats[itemName];
            const itemType = data?.primaryStat || 'consumable';

            // Insert the item
            const [result] = await db.execute(
                `INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped, grade, durability, max_durability)
                 VALUES (?, ?, ?, 1, 0, 'F', 100, 100)`,
                [targetId, itemName, itemType]
            );

            // If item has base stats, apply them
            if (data?.base) {
                await db.execute(
                    `UPDATE inventory SET
                        strength_bonus    = ?,
                        agility_bonus     = ?,
                        intelligence_bonus= ?,
                        stamina_bonus     = ?,
                        attack_bonus      = ?,
                        defense_bonus     = ?
                     WHERE id = ?`,
                    [
                        data.base.strength     || 0,
                        data.base.agility      || 0,
                        data.base.intelligence || 0,
                        data.base.stamina      || 0,
                        data.base.attack       || 0,
                        data.base.defense      || 0,
                        result.insertId
                    ]
                );
            }

            return msg.reply(
                `╭══〘 🎁 ITEM GIFTED 〙══╮\n` +
                `┃◆ Item: ${itemName}\n` +
                `┃◆ Type: ${itemType.toUpperCase()}\n` +
                `┃◆ To: ${target[0].nickname}\n` +
                `┃◆ Grade: F\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply("❌ Gift failed.");
        }
    }
};