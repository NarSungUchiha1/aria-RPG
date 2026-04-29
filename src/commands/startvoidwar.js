const { startVoidWar, endVoidWar, getActiveWar } = require('../systems/voidwar');

module.exports = {
    name: 'startvoidwar',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply(
            `══〘 ⚡ VOID WAR 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );

        const sub = args[0]?.toLowerCase();

        if (sub === 'end') {
            const war = await getActiveWar();
            if (!war) return msg.reply(
                `══〘 ⚡ VOID WAR 〙══╮\n┃◆ ❌ No active Void War.\n╰═══════════════════════╯`
            );
            await endVoidWar(client, true);
            return msg.reply(
                `══〘 ⚡ VOID WAR 〙══╮\n┃◆ ✅ Void War ended.\n╰═══════════════════════╯`
            );
        }

        const hours = parseInt(args[0]) || 48;
        const existing = await getActiveWar();
        if (existing) return msg.reply(
            `══〘 ⚡ VOID WAR 〙══╮\n` +
            `┃◆ ❌ A Void War is already running.\n` +
            `┃◆ Use !startvoidwar end to stop it first.\n` +
            `╰═══════════════════════╯`
        );

        await startVoidWar(hours, client);
        return msg.reply(
            `══〘 ⚡ VOID WAR 〙══╮\n` +
            `┃◆ ✅ Void War started!\n` +
            `┃◆ Duration: ${hours} hours\n` +
            `┃◆ Announcement sent to GC.\n` +
            `╰═══════════════════════╯`
        );
    }
};