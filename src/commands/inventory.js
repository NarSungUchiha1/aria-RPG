const db = require('../database/db');

const CONSUMABLES = new Set([
    'Potion', 'Mana Potion', 'Fortify Potion', 'Rage Potion', 'Eagle Eye Potion', 'Cleanse Potion',
    'Revive Scroll', 'Fire Scroll', 'Backstab Scroll', 'Taunt Scroll', 'War Cry Scroll',
    'Poison Vial', 'Smoke Bomb', 'Herb Kit', 'Holy Water', 'Elixir',
    'Blood Charm', 'Blessing Charm', 'Arrow Bundle', 'Trap Kit', 'Divine Protection',
]);

function getDisplayType(itemName, storedType) {
    if (CONSUMABLES.has(itemName)) return 'CONSUMABLE';
    return storedType?.toUpperCase() || 'MISC';
}

module.exports = {
    name: 'inventory',
    async execute(msg, args, { userId }) {
        try {
            // Block in dungeon
            const [inDungeon] = await db.execute(
                "SELECT * FROM dungeon_players WHERE player_id=? AND is_alive=1",
                [userId]
            );
            if (inDungeon.length) {
                return msg.reply(
                    `══〘 🎒 INVENTORY 〙══╮\n` +
                    `┃◆ ❌ Cannot view inventory\n` +
                    `┃◆ while inside a dungeon.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const [items] = await db.execute(
                `SELECT id, item_name, item_type, equipped, grade, durability, max_durability
                 FROM inventory WHERE player_id=? ORDER BY id`,
                [userId]
            );
            if (!items.length) {
                return msg.reply(
                    `══〘 🎒 INVENTORY 〙══╮\n` +
                    `┃◆ Your inventory is empty.\n` +
                    `┃◆ Visit !shop to buy items.\n` +
                    `╰═══════════════════════╯`
                );
            }

            let text = `══〘 🎒 INVENTORY 〙══╮\n`;

            items.forEach((it, i) => {
                const grade = it.grade || 'F';
                const dur   = it.durability !== null ? `${it.durability}/${it.max_durability}` : '—';
                const eq    = it.equipped ? '✅ EQUIPPED' : '❌ UNEQUIPPED';
                if (it.item_type === 'bag') {
                    try {
                        const { BAGS } = require('../systems/bagSystem');
                        const slots = BAGS[it.item_name]?.slots || '?';
                        text += `┃◆ ${i + 1}. 🎒 ${it.item_name}\n`;
                        text += `┃◆   📦 ${slots} slots  🔧 ${dur}  ${eq}\n`;
                    } catch(e) {
                        text += `┃◆ ${i + 1}. 🎒 ${it.item_name} 🔧${dur}  ${eq}\n`;
                    }
                } else {
                    text += `┃◆ ${i + 1}. ${it.item_name} [${grade}] 🔧${dur}\n`;
                    text += `┃◆   ➤ ${getDisplayType(it.item_name, it.item_type)}  ${eq}\n`;
                }
                text += `┃◆────────────\n`;
            });

            text += `┃◆ !equip <#> • !inspect <#>\n`;
            text += `┃◆ !repair <#> • !upgradeweapon <#>\n`;
            text += `╰═══════════════════════╯`;

            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(
                `══〘 🎒 INVENTORY 〙══╮\n` +
                `┃◆ ❌ Could not load inventory.\n` +
                `╰═══════════════════════╯`
            );
        }
    }
};