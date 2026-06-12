/**
 * !testmode — explains the current test GC isolation model.
 * The old on/off global override is gone — test GC is now always
 * a parallel universe automatically. No manual toggling needed.
 */
module.exports = {
    name: 'testmode',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');

        return msg.reply(
            `╔══〘 🧪 TEST MODE 〙══╗\n` +
            `┃◆\n` +
            `┃◆ Test GC is always isolated.\n` +
            `┃◆ No toggle needed.\n` +
            `┃◆\n` +
            `┃◆ Any command run from the\n` +
            `┃◆ test GC runs in its own\n` +
            `┃◆ parallel universe:\n` +
            `┃◆\n` +
            `┃◆ ◆ Dungeons spawn here\n` +
            `┃◆ ◆ Announcements stay here\n` +
            `┃◆ ◆ Tournaments run here\n` +
            `┃◆ ◆ Events run here\n` +
            `┃◆ ◆ Live game unaffected\n` +
            `┃◆\n` +
            `┃◆ Just !tester login and play.\n` +
            `┃◆\n` +
            `╚═══════════════════════════╝`
        );
    }
};
