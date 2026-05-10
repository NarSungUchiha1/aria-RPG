const { readyPartyDuel } = require('../systems/pvpsystem');

module.exports = {
    name: 'startduel',
    async execute(msg, args, { userId }) {
        const result = await readyPartyDuel(userId, msg);

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