const { battleState, addStriker, executeFinalStrike } = require('../systems/leviathan');

module.exports = {
    name: 'finalstrike',
    async execute(msg, args, { userId, client }) {
        if (!battleState.active || !battleState.finalPhase) return msg.reply(
            `══〘 ⚔️ FINAL STRIKE 〙══╮\n┃◆ ❌ Final phase not active.\n╰═══════════════════════╯`
        );

        if (!battleState.fusedPlayers.has(userId)) return msg.reply(
            `══〘 ⚔️ FINAL STRIKE 〙══╮\n┃◆ ❌ You must !fuse first.\n╰═══════════════════════╯`
        );

        if (!battleState.strikeOpen) return msg.reply(
            `══〘 ⚔️ FINAL STRIKE 〙══╮\n` +
            `┃◆ ❌ Window not open yet.\n` +
            `┃◆ Need ${battleState.fusedPlayers.size < 2 ? 'at least 2 fused' : 'window to open'}.\n` +
            `╰═══════════════════════╯`
        );

        const result = await addStriker(userId, client);
        if (!result.ok) return msg.reply(
            `══〘 ⚔️ FINAL STRIKE 〙══╮\n┃◆ ❌ ${result.reason}\n╰═══════════════════════╯`
        );

        // Silent — narration fires after 5s window from leviathan.js
    }
};