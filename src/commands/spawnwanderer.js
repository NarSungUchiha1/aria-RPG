const { spawnWanderer } = require('../systems/wanderer');
const { EXPLORATION_GC } = require('../systems/explorationSystem');

module.exports = {
    name: 'spawnwanderer',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');
        await spawnWanderer(client, EXPLORATION_GC);
        await msg.reply('✅ Wanderer spawned.');
    }
};