const { processFuse, battleState, openFinalStrike, MIN_FUSED_TO_STRIKE } = require('../systems/leviathan');

module.exports = {
    name: 'fuse',
    async execute(msg, args, { userId, client }) {
        if (!battleState.active || !battleState.finalPhase) return msg.reply(
            `══〘 💠 FUSE 〙══╮\n┃◆ ❌ Final phase not active.\n╰═══════════════════════╯`
        );

        const result = await processFuse(userId, client);

        if (!result.ok) {
            const reasons = {
                no_shard:      '❌ You hold no Void Shards.',
                dead:          '❌ You have fallen. You cannot fuse.',
                already_fused: '❌ Already fused.',
                not_in_final_phase: '❌ Not in final phase.'
            };
            return msg.reply(
                `══〘 💠 FUSE 〙══╮\n┃◆ ${reasons[result.reason] || '❌ Cannot fuse.'}\n╰═══════════════════════╯`
            );
        }

        // Open final strike window if threshold reached and not already open
        if (result.canStrike && !battleState.strikeOpen) {
            await openFinalStrike(client);
        }
    }
};