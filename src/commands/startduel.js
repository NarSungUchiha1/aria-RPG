const { readyPartyDuel } = require('../systems/pvpsystem');

module.exports = {
    name: 'startduel',
    async execute(msg, args, { userId, client }) {
        const result = await readyPartyDuel(userId, msg);

        if (result.error) return msg.reply(
            `══〘 ⚔️ START DUEL 〙══╮\n┃◆ ❌ ${result.error}\n╰═══════════════════════╯`
        );

        if (result.started) {
            return; // startPvPDuel already sent the duel-start messages
        }

        // Other team not ready yet
        return msg.reply(
            `══〘 ⚔️ START DUEL 〙══╮\n` +
            `┃◆ ✅ Your side is ready!\n` +
            `┃◆ Waiting for *${result.waiting}* to !startduel.\n` +
            `╰═══════════════════════╯`
        );
    }
};