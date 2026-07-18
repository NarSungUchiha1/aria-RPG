// !chapter6 — owner-only. Posts the Chapter 6 "The Source" story drop to the
// raid group and activates the era: Malachar's Echo invasions + faction war.
const { isOwner } = require('../utils/identity');
const { getRaidGroup } = require('../utils/raidContext');
const { CHAPTER6_DROP } = require('../systems/chapter6lore');
const { setFlag } = require('../systems/gameFlags');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

module.exports = {
    name: 'chapter6',
    async execute(msg, args, { userId, client }) {
        if (!isOwner(userId)) return msg.reply('❌ Owner only.');
        try {
            const jid = getRaidGroup();
            for (const block of CHAPTER6_DROP) {
                await client.sendMessage(jid, { text: block });
                await sleep(5000);
            }
            await setFlag('chapter6_active', '1');
            return msg.reply('📖 Chapter 6 is live — Echo invasions and faction war are ACTIVE.');
        } catch (e) {
            console.error('chapter6 error:', e);
            return msg.reply('❌ Chapter 6 drop failed: ' + e.message);
        }
    }
};
