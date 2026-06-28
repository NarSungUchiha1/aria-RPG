const { readyPartyDuel } = require('../systems/pvpsystem');

module.exports = {
    name: 'startduel',
    async execute(msg, args, { userId, client }) {
        // Route to PvP group for live, or stay in test GC for testers
        const TEST_GC = process.env.TEST_GROUP_JID || '120363408323584748@g.us';
        const isTestGC = msg.from === TEST_GC;
        const pvpGroup = isTestGC ? TEST_GC : (process.env.PVP_GROUP_JID || msg.from);
        const chatObj = {
            client,
            sendMessage: async (text) => {
                await client.sendMessage(pvpGroup, typeof text === 'string' ? { text } : text).catch(() => {});
            },
            reply: async (text) => msg.reply(text)
        };
        const result = await readyPartyDuel(userId, chatObj);

        if (result.error) return msg.reply(
            `╭══〘 ⚔️  START DUEL 〙══╮\n` +
            `┃◆ ❌ ${result.error}\n` +
            `╰════════════════════════════════╯`
        );

        if (result.started) return; // startPvPDuel handles the duel-start message

        // Other side not ready yet — show updated rosters
        return msg.reply(
            `╭══〘 ✅  TEAM LOCKED IN 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ Your side is *ready!*\n` +
            `┃◆ Waiting for *${result.waiting}* to type !startduel.\n` +
            `┃◆ \n` +
            `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `┃◆ 📋  CURRENT ROSTERS\n` +
            `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `┃◆ \n` +
            `${result.rosterMsg}` +
            `╰════════════════════════════════╯`
        );
    }
};