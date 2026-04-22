const db = require('../database/db');

module.exports = {
    name: 'inventory',
    async execute(msg, args, { userId }) {
        try {
            const [items] = await db.execute(
                `SELECT id, item_name, item_type, equipped, grade, durability, max_durability
                 FROM inventory WHERE player_id=?
                 ORDER BY equipped DESC, item_name, grade, id`,
                [userId]
            );
            if (!items.length) return msg.reply("🎒 Your inventory is empty.");

            const equipped   = items.filter(i => i.equipped);
            const unequipped = items.filter(i => !i.equipped);

            // Group unequipped items by name + grade into { item, count }
            const groups = new Map();
            for (const item of unequipped) {
                const key = `${item.item_name}||${item.grade || 'F'}`;
                if (groups.has(key)) {
                    groups.get(key).count++;
                } else {
                    groups.set(key, { item, count: 1 });
                }
            }

            let text = `══〘 🎒 INVENTORY 〙══╮\n`;
            let idx  = 1;

            // Equipped items — always shown individually
            if (equipped.length) {
                text += `┃◆ ── EQUIPPED ──\n`;
                for (const it of equipped) {
                    const grade = it.grade || 'F';
                    const dur   = it.durability !== null ? `${it.durability}/${it.max_durability}` : '—';
                    text += `┃◆ ${idx}. ${it.item_name} [${grade}] 🔧${dur}\n`;
                    text += `┃◆   ➤ ${it.item_type.toUpperCase()}  ✅ EQUIPPED\n`;
                    text += `┃◆────────────\n`;
                    idx++;
                }
            }

            // Unequipped items — grouped
            if (groups.size) {
                text += `┃◆ ── BAG ──\n`;
                for (const { item, count } of groups.values()) {
                    const grade    = item.grade || 'F';
                    const dur      = item.durability !== null ? `${item.durability}/${item.max_durability}` : '—';
                    const countTxt = count > 1 ? ` (x${count})` : '';
                    text += `┃◆ ${idx}. ${item.item_name}${countTxt} [${grade}] 🔧${dur}\n`;
                    text += `┃◆   ➤ ${item.item_type.toUpperCase()}  ❌ UNEQUIPPED\n`;
                    text += `┃◆────────────\n`;
                    idx++;
                }
            }

            text += `┃◆ !equip <#> | !inspect <#> | !repair <#>\n`;
            text += `┃◆ !upgradeweapon <#>\n`;
            text += `╰═══════════════════════╯`;

            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Could not load inventory.");
        }
    }
};