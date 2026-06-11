/**
 * !testmode on  — activate test group isolation (all announcements → test GC)
 * !testmode off — deactivate, real groups resume normal routing
 * !testmode     — show current status
 * Admin only.
 */
const TEST_GROUP_JID = process.env.TEST_GROUP_JID || '120363408323584748@g.us';

module.exports = {
    name: 'testmode',
    async execute(msg, args, { userId, isAdmin }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');

        const sub = args[0]?.toLowerCase();

        if (sub === 'on') {
            global.overrideRaidGroup = TEST_GROUP_JID;
            return msg.reply(
                `╔══〘 🧪 TEST MODE ON 〙══╗\n` +
                `┃◆\n` +
                `┃◆ All announcements now route\n` +
                `┃◆ to the test group only.\n` +
                `┃◆\n` +
                `┃◆ Real groups still work normally.\n` +
                `┃◆ Run *!testmode off* when done.\n` +
                `╚═══════════════════════════╝`
            );
        }

        if (sub === 'off') {
            global.overrideRaidGroup = null;
            return msg.reply(
                `╔══〘 ✅ TEST MODE OFF 〙══╗\n` +
                `┃◆\n` +
                `┃◆ Announcements restored to\n` +
                `┃◆ real raid group.\n` +
                `╚═══════════════════════════╝`
            );
        }

        // Status
        const active = !!global.overrideRaidGroup;
        return msg.reply(
            `══〘 🧪 TEST MODE 〙══╮\n` +
            `┃◆ Status: ${active ? '🟢 ON — routing to test GC' : '🔴 OFF — routing normally'}\n` +
            `┃◆ !testmode on / off\n` +
            `╰═══════════════════════╯`
        );
    }
};