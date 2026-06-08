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
            const [roleCheck] = await db.execute("SELECT role FROM players WHERE id=?", [userId]);
            if (roleCheck[0]?.role === 'Explorer') return msg.reply(
                `╔══〘 🎒 INVENTORY 〙══╗\n┃◆ ❌ Explorers don't carry\n┃◆ weapons or equipment.\n┃◆ Use !expmaterials for\n┃◆ your materials.\n┃◆ Use !usepotion for potions.\n╚═══════════════════════════╝`
            );

            const [inDungeon] = await db.execute(
                "SELECT * FROM dungeon_players WHERE player_id=? AND is_alive=1", [userId]
            );
            if (inDungeon.length) return msg.reply(
                `══〘 🎒 INVENTORY 〙══╮\n┃◆ ❌ Cannot view inventory\n┃◆ while inside a dungeon.\n╰═══════════════════════╯`
            );

            const [playerRow] = await db.execute(
                "SELECT COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?", [userId]
            );
            const isPrestige = (playerRow[0]?.prestige_level || 0) > 0;

            // Fetch ALL items — exclude Void Shards
            // Weapons and armor keep individual rows (so !equip <#> numbering stays correct)
            // Consumables/materials/potions are stacked by name
            const [items] = await db.execute(
                `SELECT id, item_name, item_type, equipped, grade, durability, max_durability
                 FROM inventory
                 WHERE player_id=?
                 AND item_name NOT LIKE '%Void Shard%'
                 ORDER BY equipped DESC, item_type, grade DESC, item_name, id`,
                [userId]
            );

            const STACKABLE_TYPES = new Set(['potion','consumable','material','scroll','charm']);
            const stacked = [];
            const seenStack = new Map();
            items.forEach((it) => {
                const isStackable = STACKABLE_TYPES.has(it.item_type?.toLowerCase()) || CONSUMABLES.has(it.item_name);
                if (isStackable) {
                    const key = `${it.item_name}__${it.item_type}`;
                    if (seenStack.has(key)) {
                        seenStack.get(key).count++;
                    } else {
                        const entry = { ...it, count: 1 };
                        seenStack.set(key, entry);
                        stacked.push(entry);
                    }
                } else {
                    // Weapons/armor/bags keep individual rows — count always 1
                    stacked.push({ ...it, count: 1 });
                }
            });

            if (!stacked.length) {
                return msg.reply(
                    `${isPrestige ? '╔══〘 ✦ VOID INVENTORY 〙══╗' : '══〘 🎒 INVENTORY 〙══╮'}\n` +
                    `${isPrestige ? '┃★' : '┃◆'} Your inventory is empty.\n` +
                    `${isPrestige ? '┃★' : '┃◆'} ${isPrestige ? 'Visit !prestigeshop.' : 'Visit !shop.'}\n` +
                    `${isPrestige ? '╚═══════════════════════════╝' : '╰═══════════════════════╯'}`
                );
            }

            const p = isPrestige ? '┃★' : '┃◆';

            if (isPrestige) {
                let text = `╔══〘 ✦ VOID INVENTORY 〙══╗\n${p} \n`;
                stacked.forEach((it, i) => {
                    const grade    = it.grade || 'F';
                    const dur      = it.durability !== null ? `${it.durability}/${it.max_durability}` : '—';
                    const eq       = it.equipped ? '✅' : '❌';
                    const gradeTag = grade === 'P' ? '[✦]' : `[${grade}]`;
                    const qty      = it.count > 1 ? ` ×${it.count}` : '';

                    if (it.item_type === 'bag') {
                        try {
                            const { BAGS } = require('../systems/bagSystem');
                            const slots = BAGS[it.item_name]?.slots || '?';
                            text += `${p} ${i+1}. 🎒 *${it.item_name}*${qty} ${gradeTag}\n`;
                            text += `${p}   📦 ${slots} slots  🔧 ${dur}  ${eq}\n`;
                        } catch(e) {
                            text += `${p} ${i+1}. 🎒 *${it.item_name}*${qty} 🔧${dur}  ${eq}\n`;
                        }
                    } else {
                        text += `${p} ${i+1}. *${it.item_name}*${qty} ${gradeTag} 🔧${dur}\n`;
                        text += `${p}   ➤ ${getDisplayType(it.item_name, it.item_type)}  ${eq}\n`;
                    }
                    text += `${p}────────────\n`;
                });
                text += `${p} !equip <#> • !inspect <#>\n${p} !melt <#> to convert to gold\n╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            // Normal player
            let text = `══〘 🎒 INVENTORY 〙══╮\n`;
            stacked.forEach((it, i) => {
                const grade = it.grade || 'F';
                const dur   = it.durability !== null ? `${it.durability}/${it.max_durability}` : '—';
                const eq    = it.equipped ? '✅ EQUIPPED' : '❌';
                const qty   = it.count > 1 ? ` ×${it.count}` : '';

                if (it.item_type === 'bag') {
                    try {
                        const { BAGS } = require('../systems/bagSystem');
                        const slots = BAGS[it.item_name]?.slots || '?';
                        text += `┃◆ ${i+1}. 🎒 ${it.item_name}${qty}\n`;
                        text += `┃◆   📦 ${slots} slots  🔧 ${dur}  ${eq}\n`;
                    } catch(e) {
                        text += `┃◆ ${i+1}. 🎒 ${it.item_name}${qty} 🔧${dur}  ${eq}\n`;
                    }
                } else {
                    text += `┃◆ ${i+1}. ${it.item_name}${qty} [${grade}] 🔧${dur}\n`;
                    text += `┃◆   ➤ ${getDisplayType(it.item_name, it.item_type)}  ${eq}\n`;
                }
                text += `┃◆────────────\n`;
            });
            text += `┃◆ !equip <#> • !inspect <#>\n`;
            text += `┃◆ !repair <#> • !upgradeweapon <#>\n`;

            try {
                const [potions] = await db.execute(
                    "SELECT potion_name, quantity FROM potion_inventory WHERE player_id=? AND quantity > 0 ORDER BY potion_name",
                    [userId]
                );
                if (potions.length) {
                    text += `┃◆────────────\n┃◆ 🧪 POTIONS:\n`;
                    potions.forEach(pot => {
                        text += `┃◆   • *${pot.potion_name}* ×${pot.quantity}\n`;
                    });
                    text += `┃◆ !use or !usepotion to activate\n`;
                }
            } catch(e) {}

            text += `╰═══════════════════════╯`;
            return msg.reply(text);

        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🎒 INVENTORY 〙══╮\n┃◆ ❌ Could not load inventory.\n╰═══════════════════════╯`);
        }
    }
};