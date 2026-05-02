const db = require('../database/db');
const { doPrestige, PRESTIGE_BASE_STATS } = require('../systems/prestigeSystem');

module.exports = {
    name: 'prestige',
    async execute(msg, args, { userId }) {
        try {
            const [player] = await db.execute(
                "SELECT nickname, `rank`, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
                [userId]
            );
            if (!player.length) return msg.reply(
                `══〘 ✦ PRESTIGE 〙══╮\n┃★ ❌ Not registered.\n╰═══════════════════════╯`
            );

            const p = player[0];

            if (p.rank !== 'S') return msg.reply(
                `══〘 ✦ PRESTIGE 〙══╮\n` +
                `┃★ ❌ Rank S required.\n` +
                `┃★ Your rank: ${p.rank}\n` +
                `╰═══════════════════════╯`
            );

            if (!args[0] || args[0].toLowerCase() !== 'confirm') {
                const isFirst = !p.prestige_level;
                const stars = p.prestige_level > 0 ? '☆'.repeat(p.prestige_level) + ' ' : '';
                return msg.reply(
                    `╔══〘 ✦ PRESTIGE 〙══╗\n` +
                    `┃★ \n` +
                    `┃★ *${p.nickname}* — ${stars}S\n` +
                    `┃★ \n` +
                    `┃★ You have reached the peak.\n` +
                    `┃★ Beyond this lies something harder.\n` +
                    `┃★ \n` +
                    (isFirst
                        ? `┃★ ⚠️ FIRST PRESTIGE:\n` +
                          `┃★ All gold and XP stripped.\n` +
                          `┃★ Rank resets to ☆ F.\n` +
                          `┃★ \n` +
                          `┃★ ✅ Prestige dungeons unlock\n` +
                          `┃★ ✅ Blacksmith access granted\n` +
                          `┃★ ✅ Prestige shop opens\n`
                        : `┃★ Prestige ${p.prestige_level} → ${p.prestige_level + 1}\n` +
                          `┃★ Rank resets to ☆ F.\n`
                    ) +
                    `┃★ \n` +
                    `┃★ !prestige confirm to proceed.\n` +
                    `╚═══════════════════════════╝`
                );
            }

            const result = await doPrestige(userId);
            if (!result.ok) return msg.reply(
                `══〘 ✦ PRESTIGE 〙══╮\n┃★ ❌ ${result.reason}\n╰═══════════════════════╯`
            );

            const stars = '☆'.repeat(result.newLevel);
            const isFirst = result.newLevel === 1;
            const s = result.stats || {};
            const statLine =
                `┃★   STR ${s.strength}  AGI ${s.agility}  INT ${s.intelligence}\n` +
                `┃★   STA ${s.stamina}   HP  ${s.hp}\n`;

            return msg.reply(
                `╔══〘 ✦ PRESTIGE UNLOCKED 〙══╗\n` +
                `┃★ \n` +
                `┃★ *${p.nickname}*\n` +
                `┃★ ${stars} Prestige ${result.newLevel}\n` +
                `┃★ \n` +
                (isFirst
                    ? `┃★ The path of the ordinary\n` +
                      `┃★ is no longer yours.\n` +
                      `┃★ \n` +
                      `┃★ Gold stripped. XP stripped.\n` +
                      `┃★ Rank reset to ☆ F.\n` +
                      `┃★ \n` +
                      `┃★ But something has changed.\n` +
                      `┃★ The system recognises you now.\n` +
                      `┃★ \n` +
                      `┃★ ✅ Prestige dungeons unlocked\n` +
                      `┃★ ✅ Blacksmith access granted\n` +
                      `┃★ ✅ Prestige shop available\n`
                    : `┃★ Further. Harder. Stronger.\n` +
                      `┃★ Gold stripped. XP stripped.\n` +
                      `┃★ Rank reset to ☆ F.\n` +
                      `┃★ \n` +
                      `┃★ ✅ Prestige ${result.newLevel} achieved\n`
                ) +
                `┃★────────────\n` +
                `┃★ 📊 ${result.role} Starting Stats:\n` +
                statLine +
                `┃★ \n` +
                `╚═══════════════════════════╝`
            );

        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ✦ PRESTIGE 〙══╮\n┃★ ❌ Failed.\n╰═══════════════════════╯`);
        }
    }
};