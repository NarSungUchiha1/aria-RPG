const { getActiveWorldBoss } = require('../systems/worldBossSystem');

module.exports = {
    name: 'worldboss',
    async execute(msg) {
        const boss = await getActiveWorldBoss();
        if (!boss) return msg.reply(
            `══〘 🌍 WORLD BOSS 〙══╮\n` +
            `┃◆ ❌ No world boss is currently active.\n` +
            `┃◆ Watch the group for announcements.\n` +
            `╰═══════════════════════╯`
        );

        const hpPct     = ((Number(boss.current_hp) / Number(boss.max_hp)) * 100).toFixed(1);
        const filledBars = Math.max(0, Math.floor((Number(boss.current_hp) / Number(boss.max_hp)) * 10));
        const bar        = '█'.repeat(filledBars) + '░'.repeat(10 - filledBars);

        return msg.reply(
            `══〘 🌍 WORLD BOSS 〙══╮\n` +
            `┃◆ 👹 ${boss.name}\n` +
            `┃◆ 🏅 Rank: ${boss.rank}\n` +
            `┃◆────────────\n` +
            `┃◆ ❤️ [${bar}] ${hpPct}%\n` +
            `┃◆ HP: ${Number(boss.current_hp).toLocaleString()}/${Number(boss.max_hp).toLocaleString()}\n` +
            `┃◆ ⚔️ ATK: ${boss.atk}  🛡️ DEF: ${boss.def}\n` +
            `┃◆────────────\n` +
            `┃◆ Use !attackboss to fight\n` +
            `╰═══════════════════════╯`
        );
    }
};