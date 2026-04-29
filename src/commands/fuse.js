const db = require('../database/db');
const { processFFuse, battleState } = require('../systems/leviathan');

module.exports = {
    name: 'fuse',
    async execute(msg, args, { userId, client }) {
        if (!battleState.active || !battleState.finalPhase) return msg.reply(
            `══〘 💠 FUSE 〙══╮\n` +
            `┃◆ ❌ The final phase has not begun.\n` +
            `┃◆ Only usable when only shard holders remain.\n` +
            `╰═══════════════════════╯`
        );

        const result = await processFFuse(userId, client);

        if (!result.ok) {
            const reasons = {
                no_shard:     '❌ You don\'t hold any Void Shards.',
                dead:         '❌ You have fallen. You cannot fuse.',
                already_fused:'❌ You have already fused your shard.',
                not_in_final_phase: '❌ Final phase not active.'
            };
            return msg.reply(
                `══〘 💠 FUSE 〙══╮\n┃◆ ${reasons[result.reason] || '❌ Cannot fuse.'}\n╰═══════════════════════╯`
            );
        }

        // Silent — the announcement is handled in leviathan.js
    }
};