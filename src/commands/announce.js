const { RAID_GROUP } = require('../engine/dungeon');
const { tagAll } = require('../utils/tagAll');

module.exports = {
    name: 'announce',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply(
            `══〘 📢 ANNOUNCE 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );

        const message = args.join(' ').trim();
        if (!message) return msg.reply(
            `══〘 📢 ANNOUNCE 〙══╮\n┃◆ ❌ Use: !announce <message>\n╰═══════════════════════╯`
        );

        try {
            const { mentions } = await tagAll(client);

            const text =
                `╭══〘 📢 ANNOUNCEMENT 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ ${message}\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`;

            await client.sendMessage(RAID_GROUP, { text, mentions });

            return msg.reply(
                `══〘 📢 ANNOUNCE 〙══╮\n┃◆ ✅ Announcement sent.\n╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 📢 ANNOUNCE 〙══╮\n┃◆ ❌ Failed to send.\n╰═══════════════════════╯`);
        }
    }
};