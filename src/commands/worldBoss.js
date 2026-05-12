const { getActiveWorldBoss, WORLD_BOSSES } = require('../systems/worldBossSystem');

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
        const filled    = Math.max(0, Math.floor((Number(boss.current_hp) / Number(boss.max_hp)) * 10));
        const bar       = '█'.repeat(filled) + '░'.repeat(10 - filled);

        // Find lore from WORLD_BOSSES
        const bossData  = WORLD_BOSSES.find(b => b.name === boss.name);
        const loreText  = bossData?.lore ? `┃◆ \n┃◆ 📖 ${bossData.lore}\n┃◆ \n` : '';

        // Void moves if Leviathan
        let movesText = '';
        if (bossData?.voidMoves) {
            movesText = `┃◆ \n┃◆ ⚡ VOID ABILITIES:\n`;
            bossData.voidMoves.forEach(m => {
                movesText += `┃◆   • ${m.name} — ${m.msg}\n`;
            });
            movesText += `┃◆ \n`;
        }

        return msg.reply(
            `╭══〘 🌍 WORLD BOSS 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ 👹 *${boss.name}*\n` +
            `┃◆ 🏅 Rank: ${boss.rank}\n` +
            `┃◆ \n` +
            `┃◆ ❤️ [${bar}] ${hpPct}%\n` +
            `┃◆ ${Number(boss.current_hp).toLocaleString()} / ${Number(boss.max_hp).toLocaleString()} HP\n` +
            `┃◆ ⚔️ ATK: ${boss.atk}  🛡️ DEF: ${boss.def}\n` +
            `${loreText}` +
            `${movesText}` +
            `┃◆ ━━━━━━━━━━━━━━━━\n` +
            `┃◆ 💰 ${Number(boss.gold_reward).toLocaleString()} Gold\n` +
            `┃◆ ⭐ ${Number(boss.exp_reward).toLocaleString()} XP on defeat\n` +
            `┃◆ \n` +
            `┃◆ Use !attackboss to fight\n` +
            `╰═══════════════════════╯`
        );
    }
};