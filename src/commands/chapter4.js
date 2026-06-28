const { CHAPTER4_LORE } = require('../systems/chapter4lore');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

module.exports = {
    name: 'chapter4',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');
        await client.sendMessage(RAID_GROUP, { text: CHAPTER4_LORE });
        await msg.reply('✅ Chapter 4 lore announced.');
    }
};