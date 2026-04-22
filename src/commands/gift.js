const db = require('../database/db');
const itemStats = require('../data/itemStats');

const CONSUMABLES = new Set([
    'Potion', 'Mana Potion', 'Fortify Potion', 'Rage Potion', 'Eagle Eye Potion', 'Cleanse Potion',
    'Revive Scroll', 'Fire Scroll', 'Backstab Scroll', 'Taunt Scroll', 'War Cry Scroll',
    'Poison Vial', 'Smoke Bomb', 'Herb Kit', 'Holy Water', 'Elixir',
    'Blood Charm', 'Blessing Charm', 'Arrow Bundle', 'Trap Kit', 'Divine Protection',
]);

module.exports = {
    name: 'gift',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) {
            return msg.reply(
                `══〘 🎁 GIFT 〙══╮\n` +
                `┃◆ ❌ Admin only.\n` +
                `╰═══════════════════════╯`
            );
        }

        if (args.length < 2 || !msg.mentionedIds.length) {
            return msg.reply(
                `══〘 🎁 GIFT 〙══╮\n` +
                `┃◆ ❌ Usage: !gift @user <item name>\n` +
                `┃◆ Example: !gift @player Mana Potion\n` +
                `╰═══════════════════════╯`
            );
        }

        const targetId = msg.mentionedIds[0];
        const itemName = args.slice(1).join(' ').trim();
        if (!itemName) {
            return msg.reply(
                `══〘 🎁 GIFT 〙══╮\n` +
                `┃◆ ❌ Provide an item name.\n` +
                `╰═══════════════════════╯`
            );
        }

        try {
            const [target] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
            if (!target.length) {
                return msg.reply(
                    `══〘 🎁 GIFT 〙══╮\n` +
                    `┃◆ ❌ Player not registered.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const data     = itemStats[itemName];
            const itemType = CONSUMABLES.has(itemName) ? 'consumable' : (data?.primaryStat || 'misc');

            const [result] = await db.execute(
                `INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped, grade, durability, max_durability)
                 VALUES (?, ?, ?, 1, 0, 'F', 100, 100)`,
                [targetId, itemName, itemType]
            );

            if (data?.base) {
                await db.execute(
                    `UPDATE inventory SET
                        strength_bonus     = ?,
                        agility_bonus      = ?,
                        intelligence_bonus = ?,
                        stamina_bonus      = ?,
                        attack_bonus       = ?,
                        defense_bonus      = ?
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
                `══〘 🎁 GIFT SENT 〙══╮\n` +
                `┃◆ Item: ${itemName}\n` +
                `┃◆ Type: ${itemType.toUpperCase()}\n` +
                `┃◆ To:   ${target[0].nickname}\n` +
                `┃◆ Grade: F\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(
                `══〘 🎁 GIFT 〙══╮\n` +
                `┃◆ ❌ Gift failed.\n` +
                `╰═══════════════════════╯`
            );
        }
    }
};