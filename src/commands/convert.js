const db = require('../database/db');
const getUserId = require('../utils/getUserId');

const XP_PER_SP = 20;

module.exports = {
    name: 'convert',
    async execute(msg, args, { userId }) {
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount <= 0) {
            return msg.reply(`❌ Use: !convert <xp amount>\n${XP_PER_SP} XP = 1 SP`);
        }

        try {
            const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const currentXp = xpRow[0]?.xp || 0;
            if (currentXp < amount) {
                return msg.reply(`❌ You only have ${currentXp} XP.`);
            }

            const spGained = Math.floor(amount / XP_PER_SP);
            if (spGained === 0) {
                return msg.reply(`❌ Minimum ${XP_PER_SP} XP required for 1 SP.`);
            }

            const xpCost = spGained * XP_PER_SP;

            await db.execute("UPDATE xp SET xp = xp - ? WHERE player_id=?", [xpCost, userId]);
            await db.execute("UPDATE players SET sp = sp + ? WHERE id=?", [spGained, userId]);

            return msg.reply(`╭══〘 ✨ CONVERSION 〙══╮
┃
┃   ${xpCost} XP → ${spGained} SP
┃   You now have ${spGained} SP to spend!
┃
┃   Use !upgrade <stat> <points>
╰══════════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Conversion failed.");
        }
    }
};