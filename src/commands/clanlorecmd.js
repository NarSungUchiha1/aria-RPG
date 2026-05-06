const { CLAN_LORE } = require('../systems/clanlore');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

module.exports = {
    name: 'clanlore',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');
        await client.sendMessage(RAID_GROUP, { text: CLAN_LORE });
        await msg.reply('✅ Clan lore announced.');
    }
};