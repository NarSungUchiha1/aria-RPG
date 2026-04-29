const { processFinalStrike, battleState } = require('../systems/leviathan');

module.exports = {
    name: 'finalstrike',
    async execute(msg, args, { userId, client }) {
        if (!battleState.active || !battleState.finalPhase) return msg.reply(
            `══〘 ⚔️ FINAL STRIKE 〙══╮\n` +
            `┃◆ ❌ The final phase has not begun.\n` +
            `╰═══════════════════════╯`
        );

        if (!battleState.fusedPlayers.has(userId)) return msg.reply(
            `══〘 ⚔️ FINAL STRIKE 〙══╮\n` +
            `┃◆ ❌ You must !fuse your shard first.\n` +
            `╰═══════════════════════╯`
        );

        const totalFused   = battleState.fusedPlayers.size;
        const totalHolders = battleState.shardHolders.size;

        if (totalFused < totalHolders) return msg.reply(
            `══〘 ⚔️ FINAL STRIKE 〙══╮\n` +
            `┃◆ ❌ Not everyone has fused yet.\n` +
            `┃◆ Waiting for ${totalHolders - totalFused} more hunters.\n` +
            `┃◆ They must type !fuse first.\n` +
            `╰═══════════════════════╯`
        );

        const result = await processFinalStrike(userId, client);

        if (!result.ok) return msg.reply(
            `══〘 ⚔️ FINAL STRIKE 〙══╮\n┃◆ ❌ ${result.msg || 'Cannot strike.'}\n╰═══════════════════════╯`
        );

        // Narration is handled in leviathan.js — silent here
    }
};