const db = require('../database/db');

module.exports = {
    name: 'inspect',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply(
            `══〘 🔍 INSPECT 〙══╮\n┃◆ ❌ Use: !inspect <item number>\n╰═══════════════════════╯`
        );
        const index = parseInt(args[0]) - 1;
        if (isNaN(index) || index < 0) return msg.reply(
            `══〘 🔍 INSPECT 〙══╮\n┃◆ ❌ Invalid item number.\n╰═══════════════════════╯`
        );
        try {
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? ORDER BY id", [userId]
            );
            const item = items[index];
            if (!item) return msg.reply(
                `══〘 🔍 INSPECT 〙══╮\n┃◆ ❌ Item not found.\n┃◆ Use !inventory to check.\n╰═══════════════════════╯`
            );
            const grade = item.grade || 'F';
            const dur   = item.durability !== null ? `${item.durability}/${item.max_durability}` : '—';
            const bonuses = [];
            if (item.strength_bonus)     bonuses.push(`💪 STR +${item.strength_bonus}`);
            if (item.agility_bonus)      bonuses.push(`⚡ AGI +${item.agility_bonus}`);
            if (item.intelligence_bonus) bonuses.push(`🧠 INT +${item.intelligence_bonus}`);
            if (item.stamina_bonus)      bonuses.push(`🛡️ STA +${item.stamina_bonus}`);
            if (item.attack_bonus)       bonuses.push(`⚔️ ATK +${item.attack_bonus}`);
            if (item.defense_bonus)      bonuses.push(`🛡️ DEF +${item.defense_bonus}`);

            let text =
                `══〘 🔍 INSPECT 〙══╮\n` +
                `┃◆ ${item.item_name} [${grade}]\n` +
                `┃◆ Type: ${item.item_type.toUpperCase()}\n` +
                `┃◆ Durability: ${dur}\n` +
                `┃◆ Equipped: ${item.equipped ? '✅ YES' : '❌ NO'}\n` +
                `┃◆────────────\n`;
            if (bonuses.length) {
                text += `┃◆ BONUSES:\n`;
                bonuses.forEach(b => { text += `┃◆   ${b}\n`; });
            } else {
                text += `┃◆ No stat bonuses\n`;
            }
            text +=
                `┃◆────────────\n` +
                `┃◆ !upgradeweapon ${args[0]} • !repair ${args[0]}\n` +
                `╰═══════════════════════╯`;
            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🔍 INSPECT 〙══╮\n┃◆ ❌ Could not inspect item.\n╰═══════════════════════╯`);
        }
    }
};