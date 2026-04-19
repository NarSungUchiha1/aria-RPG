const db = require('../database/db');
const getUserId = require('../utils/getUserId');

module.exports = {
    name: 'inspect',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply("❌ Use: !inspect <item number>");
        const index = parseInt(args[0]) - 1;
        if (isNaN(index) || index < 0) return msg.reply("❌ Invalid item number.");

        try {
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? ORDER BY id",
                [userId]
            );
            const item = items[index];
            if (!item) return msg.reply("❌ Item not found.");

            const grade = item.grade || 'F';
            const dur = item.durability !== null ? `${item.durability}/${item.max_durability}` : '—';

            let text = `══〘 🔍 ITEM INSPECT 〙══╮\n`;
            text += `┃◆ ${item.item_name} [${grade}]\n`;
            text += `┃◆ Type: ${item.item_type.toUpperCase()}\n`;
            text += `┃◆ Durability: ${dur}\n`;
            text += `┃◆ Equipped: ${item.equipped ? '✅ YES' : '❌ NO'}\n`;
            text += `┃◆────────────\n`;
            
            // Show bonuses if any
            const bonuses = [];
            if (item.strength_bonus) bonuses.push(`💪 STR +${item.strength_bonus}`);
            if (item.agility_bonus) bonuses.push(`⚡ AGI +${item.agility_bonus}`);
            if (item.intelligence_bonus) bonuses.push(`🧠 INT +${item.intelligence_bonus}`);
            if (item.stamina_bonus) bonuses.push(`🛡️ STA +${item.stamina_bonus}`);
            if (item.attack_bonus) bonuses.push(`⚔️ ATK +${item.attack_bonus}`);
            if (item.defense_bonus) bonuses.push(`🛡️ DEF +${item.defense_bonus}`);
            
            if (bonuses.length) {
                text += `┃◆ STAT BONUSES:\n`;
                bonuses.forEach(b => text += `┃◆   ${b}\n`);
            } else {
                text += `┃◆ No stat bonuses\n`;
            }
            
            text += `┃◆────────────\n`;
            text += `┃◆ Upgrade: !upgradeweapon ${args[0]}\n`;
            text += `┃◆ Repair: !repair ${args[0]}\n`;
            text += `╰═══════════════════════╯`;
            
            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Could not inspect item.");
        }
    }
};