const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { stylize, rankBadge, roleIcon } = require('../utils/styles');

module.exports = {
    name: 'awaken',
    async execute(msg, args, { userId, client }) {
        try {
            const [rows] = await db.execute("SELECT * FROM players WHERE id=?", [userId]);
            if (!rows.length) {
                return msg.reply(`╭══〘 🌌 SYSTEM INITIALIZATION 〙══╮
┃◆ ✦ New Entity Detected...
┃◆━━━━━━━━━━━━
┃◆ ⚡ WELCOME TO ARIA
┃◆━━━━━━━━━━━━
┃◆ ◈ Status: UNREGISTERED
┃◆ ◈ Action Required
┃◆━━━━━━━━━━━━
┃◆ 🧭 Command: !register <name>
┃◆━━━━━━━━━━━━
┃◆ ❖ Survive. Evolve. Dominate.
╰══════════════════════════╯`);
            }

            const player = rows[0];
            if (player.awakened) {
                const contact = await msg.getContact();
                return msg.reply(`╭══〘 🌌 SYSTEM STATUS 〙══╮
┃◆ 👤 ${player.nickname}
┃◆ 🎭 ${player.role}
┃◆━━━━━━━━━━━━
┃◆ ⚡ Status: ALREADY AWAKENED
┃◆ 🧭 Use !me to view stats
╰══════════════════════╯`, undefined, { mentions: [contact] });
            }

            await db.execute("UPDATE players SET awakened=1 WHERE id=?", [userId]);
            const contact = await msg.getContact();
            return msg.reply(`╭══〘 🌌 AWAKENING COMPLETE 〙══╮
┃◆ 👤 ${player.nickname}
┃◆━━━━━━━━━━━━
┃◆ ⚡ Status: AWAKENED
┃◆ 🧬 Your soul has synced with the system
┃◆ 🧭 Use !me to view stats
╰══════════════════════╯`, undefined, { mentions: [contact] });
        } catch (err) {
            console.error(err);
            msg.reply('❌ System error.');
        }
    }
};