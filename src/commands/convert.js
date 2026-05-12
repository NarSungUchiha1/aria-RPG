const db = require('../database/db');

const XP_PER_SP = 250;

module.exports = {
    name: 'convert',
    async execute(msg, args, { userId }) {
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) {
            return msg.reply(
                `══〘 ✨ CONVERT 〙══╮\n` +
                `┃◆ ❌ Use: !convert <xp amount>\n` +
                `┃◆ Rate: ${XP_PER_SP} XP = 1 SP\n` +
                `╰═══════════════════════╯`
            );
        }

        try {
            const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const currentXp = xpRow[0]?.xp || 0;

            if (currentXp < amount) {
                return msg.reply(
                    `══〘 ✨ CONVERT 〙══╮\n` +
                    `┃◆ ❌ Not enough XP.\n` +
                    `┃◆ You have: ${currentXp} XP\n` +
                    `┃◆ Rate: ${XP_PER_SP} XP = 1 SP\n` +
                    `╰═══════════════════════╯`
                );
            }

            const spGained = Math.floor(amount / XP_PER_SP);
            if (spGained === 0) {
                return msg.reply(
                    `══〘 ✨ CONVERT 〙══╮\n` +
                    `┃◆ ❌ Minimum ${XP_PER_SP} XP required for 1 SP.\n` +
                    `┃◆ You tried: ${amount} XP\n` +
                    `╰═══════════════════════╯`
                );
            }

            const xpCost = spGained * XP_PER_SP;

            await db.execute("UPDATE xp SET xp = xp - ? WHERE player_id=?", [xpCost, userId]);
            await db.execute("UPDATE players SET sp = sp + ? WHERE id=?", [spGained, userId]);

            const [updated] = await db.execute("SELECT sp FROM players WHERE id=?", [userId]);

            return msg.reply(
                `══〘 ✨ CONVERT 〙══╮\n` +
                `┃◆ ${xpCost} XP → ${spGained} SP\n` +
                `┃◆━━━━━━━━━━━━\n` +
                `┃◆ ✅ Conversion successful!\n` +
                `┃◆ SP Balance: ${updated[0].sp}\n` +
                `┃◆ Use !upgrade <stat> <points>\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(
                `══〘 ✨ CONVERT 〙══╮\n` +
                `┃◆ ❌ Conversion failed.\n` +
                `╰═══════════════════════╯`
            );
        }
    }
};