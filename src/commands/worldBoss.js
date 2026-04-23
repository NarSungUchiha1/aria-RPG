const { getActiveWorldBoss } = require('../systems/worldBossSystem');

module.exports = {
    name: 'worldboss',
    async execute(msg) {
        const boss = await getActiveWorldBoss();
        if (!boss) return msg.reply(
            `══〘 🌍 WORLD BOSS 〙══╮\n┃◆ ❌ No world boss is currently active.\n╰═══════════════════════╯`
        );
        const hpPercent = (boss.current_hp / boss.max_hp * 100).toFixed(1);
        return msg.reply(
            `══〘 🌍 WORLD BOSS 〙══╮\n` +
            `┃◆ ${boss.name} [${boss.rank}]\n` +
            `┃◆ ❤️ HP: ${boss.current_hp}/${boss.max_hp} (${hpPercent}%)\n` +
            `┃◆ ⚔️ ATK: ${boss.atk}  🛡️ DEF: ${boss.def}\n` +
            `┃◆────────────\n` +
            `┃◆ Use !attackboss to deal damage\n` +
            `╰═══════════════════════╯`
        );
    }
};