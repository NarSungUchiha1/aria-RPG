const db = require('../database/db');
const { returnFromRift, EXPLORATION_GC } = require('../systems/explorationSystem');
const { narrateRift } = require('../systems/riftNarrator');

module.exports = {
    name: 'return',
    async execute(msg, args, { userId }) {
        try {
            const jid = msg.from;
            if (EXPLORATION_GC && jid !== EXPLORATION_GC) return msg.reply(
                `══〘 🌀 RIFT 〙══╮\n┃◆ ❌ Use this in the Exploration GC.\n╰═══════════════════════╯`
            );

            const result = await returnFromRift(userId);
            if (!result.ok) return msg.reply(
                `══〘 🌀 RIFT 〙══╮\n┃◆ ❌ ${result.reason}\n╰═══════════════════════╯`
            );

            // Timed out — came back empty
            if (result.expired) return msg.reply(
                `╔══〘 🌀 RIFT — TOO LONG 〙══╗\n` +
                `┃◆\n` +
                `┃◆ 〝${result.narrative}〞\n` +
                `┃◆\n` +
                `┃◆ You were gone too long.\n` +
                `┃◆ The void kept everything.\n` +
                `╚═══════════════════════════╝`
            );

            // Did not survive
            if (!result.survived) {
                return msg.reply(
                    `╔══〘 💀 YOU DID NOT RETURN 〙══╗\n` +
                    `┃◆\n` +
                    `┃◆ 〝${result.narrative}〞\n` +
                    `┃◆\n` +
                    `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃◆ HP reduced to 10%.\n` +
                    `┃◆ All materials lost.\n` +
                    `┃◆ Entry fee not refunded.\n` +
                    `┃◆\n` +
                    `┃◆ Survival chance was: ${result.survivalRate}%\n` +
                    `┃◆ The deeper rifts are not safe.\n` +
                    `┃◆ Use !respawn to recover.\n` +
                    `╚═══════════════════════════╝`
                );
            }

            // Survived but wounded
            const drops    = result.drops;
            const hasDrops = Object.keys(drops).length > 0;

            let text =
                `╔══〘 🌀 ${result.wounded ? 'RETURNED — WOUNDED' : 'RETURNED FROM THE RIFT'} 〙══╗\n` +
                `┃◆\n` +
                `┃◆ 〝${await narrateRift(result.wounded ? 'wound' : 'return', { drops: result.drops, rank: result.rank, nickname: 'Explorer' })}〞\n` +
                `┃◆\n` +
                `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n`;

            if (result.wounded) {
                text += `┃◆ ⚠️ HP reduced by 30%.\n┃◆\n`;
            }

            text +=
                `┃◆ 🎒 MATERIALS FOUND:\n` +
                `┃◆\n`;

            if (hasDrops) {
                for (const [mat, qty] of Object.entries(drops)) {
                    text += `┃◆ • ${mat} ×${qty}\n`;
                }
            } else {
                text += `┃◆ • Nothing of value.\n`;
            }

            text +=
                `┃◆\n` +
                `┃◆ ⭐ XP Earned: +${result.xpEarned || 0}\n` +
                `┃◆ Survival chance was: ${result.survivalRate}%\n` +
                `┃◆\n` +
                `┃◆ !expmaterials — view stock\n` +
                `┃◆ !brew — craft potions\n` +
                `╚═══════════════════════════╝`;

            return msg.reply(text);
        } catch (err) {
            console.error('return error:', err);
            msg.reply('❌ Return failed.');
        }
    }
};