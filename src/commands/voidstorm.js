const { startStorm, isStormActive } = require('../systems/voidStorm');
const { EXPLORATION_GC } = require('../systems/explorationSystem');

module.exports = {
    name: 'voidstorm',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');
        const active = await isStormActive();
        if (active) return msg.reply('⚡ A storm is already active.');
        const RAID_GROUP = process.env.RAID_GROUP_JID;
        await startStorm(client, RAID_GROUP, EXPLORATION_GC);
        await msg.reply('✅ Void Storm started.');
    }
};