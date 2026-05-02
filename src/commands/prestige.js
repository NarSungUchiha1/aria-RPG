const db = require('../database/db');
const { doPrestige, getPrestigeBadge } = require('../systems/prestigeSystem');

module.exports = {
    name: 'prestige',
    async execute(msg, args, { userId, client }) {
        try {
            const [player] = await db.execute(
                "SELECT nickname, `rank`, prestige_level FROM players WHERE id=?", [userId]
            );
            if (!player.length) return msg.reply(
                `══〘 ⭐ PRESTIGE 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );

            const p = player[0];
            if (p.rank !== 'S') return msg.reply(
                `══〘 ⭐ PRESTIGE 〙══╮\n` +
                `┃◆ ❌ You must reach Rank S first.\n` +
                `┃◆ Current rank: ${p.rank}\n` +
                `╰═══════════════════════╯`
            );

            // Confirmation required
            if (!args[0] || args[0].toLowerCase() !== 'confirm') {
                const isFirst = !p.prestige_level;
                return msg.reply(
                    `══〘 ⭐ PRESTIGE 〙══╮\n` +
                    `┃◆ *${p.nickname}* — Rank S\n` +
                    `┃◆ \n` +
                    `┃◆ You have reached the peak.\n` +
                    `┃◆ Beyond this lies something harder.\n` +
                    `┃◆ \n` +
                    `${isFirst
                        ? `┃◆ ⚠️ FIRST PRESTIGE:\n` +
                          `┃◆ All gold and XP will be stripped.\n` +
                          `┃◆ Your rank resets to F.\n` +
                          `┃◆ You unlock prestige dungeons.\n` +
                          `┃◆ You unlock the Blacksmith.\n`
                        : `┃◆ Prestige level: ${p.prestige_level} → ${p.prestige_level + 1}\n` +
                          `┃◆ Rank resets to Prestige F.\n`
                    }` +
                    `┃◆ \n` +
                    `┃◆ Type *!prestige confirm* to proceed.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const result = await doPrestige(userId);
            if (!result.ok) return msg.reply(
                `══〘 ⭐ PRESTIGE 〙══╮\n┃◆ ❌ ${result.reason}\n╰═══════════════════════╯`
            );

            const stars = '⭐'.repeat(result.newLevel);
            const isFirst = result.newLevel === 1;

            return msg.reply(
                `╭══〘 ⭐ PRESTIGE UNLOCKED 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ *${p.nickname}*\n` +
                `┃◆ ${stars} Prestige ${result.newLevel}\n` +
                `┃◆ \n` +
                (isFirst
                    ? `┃◆ The path of the ordinary\n` +
                      `┃◆ is no longer yours.\n` +
                      `┃◆ \n` +
                      `┃◆ Your gold is gone.\n` +
                      `┃◆ Your XP is gone.\n` +
                      `┃◆ Your rank has reset.\n` +
                      `┃◆ \n` +
                      `┃◆ But something has changed.\n` +
                      `┃◆ The system recognises you now.\n` +
                      `┃◆ \n` +
                      `┃◆ ✅ Prestige dungeons unlocked\n` +
                      `┃◆ ✅ Blacksmith access granted\n` +
                      `┃◆ ✅ Prestige shop available\n`
                    : `┃◆ Further. Harder. Stronger.\n` +
                      `┃◆ \n` +
                      `┃◆ ✅ Prestige ${result.newLevel} achieved\n`
                ) +
                `┃◆ \n` +
                `╰═══════════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ⭐ PRESTIGE 〙══╮\n┃◆ ❌ Failed.\n╰═══════════════════════╯`);
        }
    }
};