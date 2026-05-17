const db = require('../database/db');
const { returnFromRift, EXPLORATION_GC } = require('../systems/explorationSystem');

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

            if (result.expired) return msg.reply(
                `══〘 🌀 RIFT 〙══╮\n┃◆ ⚠️ ${result.narrative}\n╰═══════════════════════╯`
            );

            const drops = result.drops;
            const hasDrops = Object.keys(drops).length > 0;

            let text =
                `╔══〘 🌀 RETURNED FROM THE RIFT 〙══╗\n` +
                `┃◆\n` +
                `┃◆ 〝${result.narrative}〞\n` +
                `┃◆\n` +
                `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃◆ 🎒 MATERIALS FOUND:\n` +
                `┃◆\n`;

            if (hasDrops) {
                for (const [mat, qty] of Object.entries(drops)) {
                    text += `┃◆ • ${mat} ×${qty}\n`;
                }
            } else {
                text += `┃◆ • Nothing. The rift gave nothing.\n`;
            }

            text +=
                `┃◆\n` +
                `┃◆ !materials — view your stock\n` +
                `┃◆ !brew <potion> — use them\n` +
                `╚═══════════════════════════╝`;

            return msg.reply(text);
        } catch (err) {
            console.error('return error:', err);
            msg.reply('❌ Return failed.');
        }
    }
};