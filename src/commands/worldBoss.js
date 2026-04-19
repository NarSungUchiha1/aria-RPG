const { getActiveWorldBoss } = require('../systems/worldBossSystem');

module.exports = {
    name: 'worldboss',
    async execute(msg) {
        const boss = await getActiveWorldBoss();
        if (!boss) return msg.reply("❌ No world boss is currently active.");
        const hpPercent = (boss.current_hp / boss.max_hp * 100).toFixed(1);
        return msg.reply(`══〘 🌍 WORLD BOSS 〙══╮
┃◆ ${boss.name} (${boss.rank})
┃◆ ❤️ HP: ${boss.current_hp}/${boss.max_hp} (${hpPercent}%)
┃◆ ⚔️ ATK: ${boss.atk}  🛡️ DEF: ${boss.def}
┃◆────────────
┃◆ 🧭 Use !attackboss to deal damage
╰═══════════════════════╯`);
    }
};