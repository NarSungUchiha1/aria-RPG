// !hollowsun — owner-only. Posts THE HOLLOW SUN reboot story drop to the raid
// group and activates the era: Sunshard invasions + faction war.
const { isOwner } = require('../utils/identity');
const { getRaidGroup } = require('../utils/raidContext');
const { REBOOT_DROP } = require('../systems/hollowSunLore');
const { setFlag } = require('../systems/gameFlags');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = {
    name: 'hollowsun',
    async execute(msg, args, { userId, client }) {
        if (!isOwner(userId)) return msg.reply('❌ Owner only.');
        try {
            const jid = getRaidGroup();
            for (const block of REBOOT_DROP) {
                await client.sendMessage(jid, { text: block });
                await sleep(5000);
            }
            await setFlag('hollow_sun_active', '1');
            return msg.reply('🌑 THE HOLLOW SUN is live — Sunshard invasions and faction war are ACTIVE.');
        } catch (e) {
            console.error('hollowsun error:', e);
            return msg.reply('❌ Hollow Sun drop failed: ' + e.message);
        }
    }
};
