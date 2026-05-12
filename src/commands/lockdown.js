const { RAID_GROUP } = require('../engine/dungeon');

module.exports = {
    name: 'lockdown',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply(
            `══〘 🔒 LOCKDOWN 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );

        if (!global.isLockdown) {
            // ── ACTIVATE ─────────────────────────────────────
            global.isLockdown = true;

            await msg.reply(
                `══〘 🔒 LOCKDOWN 〙══╮\n` +
                `┃◆ ✅ Lockdown activated.\n` +
                `┃◆ Only admins can use the bot.\n` +
                `╰═══════════════════════╯`
            );

            await client.sendMessage(RAID_GROUP, {
                text:
                    `╭══〘 🌍📍 ARIA SYSTEM NOTICE 〙══╮\n` +
                    `┃◆ \n` +
                    `┃◆        A · R · I · A\n` +
                    `┃◆ \n` +
                    `┃◆   The system is going offline\n` +
                    `┃◆   for scheduled maintenance.\n` +
                    `┃◆ \n` +
                    `┃◆   🔧 Our engineers are working\n` +
                    `┃◆      to improve your experience.\n` +
                    `┃◆ \n` +
                    `┃◆   ⏳ We'll be back shortly.\n` +
                    `┃◆   Thank you for your patience.\n` +
                    `┃◆ \n` +
                    `┃◆         — ARIA Control\n` +
                    `┃◆ \n` +
                    `╰═══════════════════════════╯`
            });

        } else {
            // ── DEACTIVATE ────────────────────────────────────
            global.isLockdown = false;

            await msg.reply(
                `══〘 🔓 LOCKDOWN 〙══╮\n` +
                `┃◆ ✅ Lockdown lifted.\n` +
                `┃◆ Bot is back online for all.\n` +
                `╰═══════════════════════╯`
            );

            await client.sendMessage(RAID_GROUP, {
                text:
                    `╭══〘 🌍📍 ARIA SYSTEM NOTICE 〙══╮\n` +
                    `┃◆ \n` +
                    `┃◆        A · R · I · A\n` +
                    `┃◆ \n` +
                    `┃◆   ✅ Maintenance complete.\n` +
                    `┃◆   The system is back online.\n` +
                    `┃◆ \n` +
                    `┃◆   Welcome back, hunters.\n` +
                    `┃◆   The hunt continues.\n` +
                    `┃◆ \n` +
                    `┃◆         — ARIA Control\n` +
                    `┃◆ \n` +
                    `╰═══════════════════════════╯`
            });
        }
    }
};