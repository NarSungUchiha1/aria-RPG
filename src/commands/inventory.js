const db = require('../database/db');
const getUserId = require('../utils/getUserId');

module.exports = {
    name: 'inventory',
    async execute(msg, args, { userId }) {
        try {
            const [items] = await db.execute(
                "SELECT id, item_name, item_type, equipped, grade, durability, max_durability FROM inventory WHERE player_id=? ORDER BY id",
                [userId]
            );
            if (!items.length) return msg.reply("🎒 Your inventory is empty.");

             let text = `══〘 🎒 INVENTORY 〙══╮\n`;
              text += `┃◆────────────\n`;
             items.forEach((it, i) => {
             const grade = it.grade || 'F';
             const dur = it.durability !== null ? `${it.durability}/${it.max_durability}` : '—';
              text += `┃◆ ${i+1}. ${it.item_name} [${grade}] 🔧${dur}\n`;
              text += `┃◆   ➤ ${it.item_type.toUpperCase()}\n`;
              text += `┃◆   ➤ ${it.equipped ? '✅ EQUIPPED' : '❌ UNEQUIPPED'}\n`;
              text += `┃◆────────────\n`;
});
              text += `┃◆ Use: !equip <#> | !inspect <#> | !repair <#>\n`;
              text += `┃◆ !upgradeweapon <#>\n`;
              text += `╰═══════════════════════╯`;
            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Could not load inventory.");
        }
    }
};