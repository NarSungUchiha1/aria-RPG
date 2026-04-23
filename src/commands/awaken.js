const db = require('../database/db');

module.exports = {
    name: 'awaken',
    async execute(msg, args, { userId, client }) {
        try {
            const [rows] = await db.execute("SELECT * FROM players WHERE id=?", [userId]);
            if (!rows.length) {
                // ✅ Mark player as allowed to !register — safe, no circular require
                // register.js exports allowRegister which adds userId to its Set
                try {
                    const registerCmd = require('./register');
                    if (typeof registerCmd.allowRegister === 'function') {
                        registerCmd.allowRegister(userId);
                    }
                } catch (e) {}

                return msg.reply(
                    `╭══〘 🌌 SYSTEM INITIALIZATION 〙══╮\n` +
                    `┃◆ ✦ New Entity Detected...\n` +
                    `┃◆━━━━━━━━━━━━\n` +
                    `┃◆ ⚡ WELCOME TO ARIA\n` +
                    `┃◆━━━━━━━━━━━━\n` +
                    `┃◆ ◈ Status: UNREGISTERED\n` +
                    `┃◆ ◈ Action Required\n` +
                    `┃◆━━━━━━━━━━━━\n` +
                    `┃◆ 🧭 Command: !register <name>\n` +
                    `┃◆━━━━━━━━━━━━\n` +
                    `┃◆ ❖ Survive. Evolve. Dominate.\n` +
                    `╰══════════════════════════╯`
                );
            }

            const player = rows[0];
            if (player.awakened) {
                const contact = await msg.getContact();
                return msg.reply(
                    `╭══〘 🌌 SYSTEM STATUS 〙══╮\n` +
                    `┃◆ 👤 ${player.nickname}\n` +
                    `┃◆ 🎭 ${player.role}\n` +
                    `┃◆━━━━━━━━━━━━\n` +
                    `┃◆ ⚡ Status: ALREADY AWAKENED\n` +
                    `┃◆ 🧭 Use !me to view stats\n` +
                    `╰══════════════════════╯`,
                    undefined, { mentions: [contact] }
                );
            }

            await db.execute("UPDATE players SET awakened=1 WHERE id=?", [userId]);
            const contact = await msg.getContact();
            return msg.reply(
                `╭══〘 🌌 AWAKENING COMPLETE 〙══╮\n` +
                `┃◆ 👤 ${player.nickname}\n` +
                `┃◆━━━━━━━━━━━━\n` +
                `┃◆ ⚡ Status: AWAKENED\n` +
                `┃◆ 🧬 Your soul has synced with the system\n` +
                `┃◆ 🧭 Use !me to view stats\n` +
                `╰══════════════════════╯`,
                undefined, { mentions: [contact] }
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🌌 AWAKEN 〙══╮\n┃◆ ❌ System error.\n╰═══════════════════════╯`);
        }
    }
};