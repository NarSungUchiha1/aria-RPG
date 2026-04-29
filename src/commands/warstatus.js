const { getActiveWar, isCorrupted, VOID_WAR_GOAL } = require('../systems/voidwar');
const db = require('../database/db');

module.exports = {
    name: 'warstatus',
    async execute(msg, args, { userId }) {
        try {
            const war = await getActiveWar();

            // Check corruption
            const corrupted = await isCorrupted(userId);
            const corruptionLine = corrupted
                ? `┃◆ ☠️ You are VOID CORRUPTED (-30% stats)\n┃◆ \n`
                : '';

            if (!war) return msg.reply(
                `══〘 ⚡ VOID WAR 〙══╮\n` +
                `${corruptionLine}` +
                `┃◆ No active Void War.\n` +
                `┃◆ The seal holds... for now.\n` +
                `╰═══════════════════════╯`
            );

            const pct = Math.min(100, Math.floor((war.total_damage / war.goal) * 100));
            const filled = Math.floor(pct / 10);
            const bar = '🟥'.repeat(filled) + '⬛'.repeat(10 - filled);

            const endsAt = new Date(war.ends_at);
            const remaining = Math.max(0, endsAt - Date.now());
            const hrs = Math.floor(remaining / 3600000);
            const mins = Math.floor((remaining % 3600000) / 60000);

            // Top 5 contributors
            const [top] = await db.execute(
                `SELECT nickname, damage, dungeons FROM void_war_contributions
                 WHERE war_id=? ORDER BY damage DESC LIMIT 5`,
                [war.id]
            );

            let board = '';
            const medals = ['🥇','🥈','🥉','4.','5.'];
            top.forEach((c, i) => {
                board += `┃◆ ${medals[i]} *${c.nickname}* — ${c.damage.toLocaleString()} (${c.dungeons} raids)\n`;
            });

            return msg.reply(
                `╭══〘 ⚡ VOID WAR STATUS 〙══╮\n` +
                `┃◆ \n` +
                `${corruptionLine}` +
                `┃◆ ⚡ THE VOID WAR\n` +
                `┃◆ \n` +
                `┃◆ Progress: ${pct}%\n` +
                `┃◆ ${bar}\n` +
                `┃◆ ${war.total_damage.toLocaleString()} / ${war.goal.toLocaleString()} damage\n` +
                `┃◆ \n` +
                `┃◆ ⏳ Time left: ${hrs}h ${mins}m\n` +
                `┃◆ \n` +
                `┃◆ 🏆 TOP HUNTERS:\n` +
                `${board || '┃◆ No contributions yet.\n'}` +
                `┃◆ \n` +
                `┃◆ Clear dungeons to deal damage!\n` +
                `╰═══════════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ⚡ VOID WAR 〙══╮\n┃◆ ❌ Failed to load status.\n╰═══════════════════════╯`);
        }
    }
};