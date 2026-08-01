// !strike — a basic swing at Vesperion, for hunters who are out of mana or
// just want to keep hitting. The real fight is !skill <move>, which runs the
// full moveset; both resolve through the same round handler.
const { attack } = require('../systems/vesperionRaid');
const { finishVesperionRound } = require('../systems/vesperionRound');

module.exports = {
    name: 'strike',
    aliases: ['swing'],
    async execute(msg, args, { userId, client }) {
        try {
            const r = await attack(userId, client);

            if (r.error === 'no_raid')        return msg.reply('❌ Nothing to strike. Vesperion sleeps.');
            if (r.error === 'not_registered') return msg.reply('❌ You are not registered. Use !register <name>.');
            if (r.error === 'dead')           return msg.reply('☠️ You are down. You cannot swing again.');
            if (r.error === 'cooldown')       return msg.reply(`⏳ Catch your breath — ${r.wait}s.`);
            if (r.error)                      return msg.reply('❌ Could not strike.');

            return finishVesperionRound(msg, client, r, null, null, null);
        } catch (err) {
            console.error('strike error:', err);
            return msg.reply('❌ Strike failed: ' + err.message);
        }
    }
};
