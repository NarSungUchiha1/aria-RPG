const { battleState, checkFinalPhase, getShardHolders } = require('../systems/leviathan');
const db = require('../database/db');

module.exports = {
    name: 'leviathanphase',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply(
            `══〘 🌊 LEVIATHAN 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );

        // Force init battle state if not active
        if (!battleState.active) {
            const { initBattle } = require('../systems/leviathan');
            await initBattle(client);
        }

        // Kill all mortal participants
        for (const [id, data] of battleState.participants) {
            if (!battleState.shardHolders.has(id)) {
                data.alive = false;
            }
        }

        // Force final phase
        battleState.finalPhase = true;

        const holders = [];
        for (const id of battleState.shardHolders) {
            const data = battleState.participants.get(id);
            if (data) holders.push(data.nickname);
        }

        const RAID_GROUP = process.env.RAID_GROUP_JID;
        const { sendWithRetry } = require('../utils/sendWithRetry');

        await sendWithRetry(client, RAID_GROUP, {
            text:
                `╭══〘 💠 THE SHARDS AWAKEN 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ The battlefield falls silent.\n` +
                `┃◆ The Leviathan pauses.\n` +
                `┃◆ \n` +
                `┃◆ It recognises the shards.\n` +
                `┃◆ \n` +
                `┃◆ 💠 SHARD HOLDERS:\n` +
                `${holders.length ? holders.map(n => `┃◆   💠 ${n}`).join('\n') : '┃◆   None found'}\n` +
                `┃◆ \n` +
                `┃◆ Channel your shard → *!fuse*\n` +
                `┃◆ Then → *!finalstrike*\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`
        });

        return msg.reply(
            `══〘 🌊 LEVIATHAN 〙══╮\n` +
            `┃◆ ✅ Forced to final phase.\n` +
            `┃◆ Shard holders: ${holders.length}\n` +
            `┃◆ They can now !fuse then !finalstrike\n` +
            `╰═══════════════════════╯`
        );
    }
};