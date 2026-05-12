const { RAID_GROUP } = require('../engine/dungeon');
const { tagAll } = require('../utils/tagAll');

module.exports = {
    name: 'announce',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply(
            `══〘 📢 ANNOUNCE 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );

        const rawText = msg.body || '';
        const message = rawText.replace(/^!announce\s*/i, '').trim();
        if (!message) return msg.reply(
            `══〘 📢 ANNOUNCE 〙══╮\n┃◆ ❌ Use: !announce <message>\n╰═══════════════════════╯`
        );

        // Each line becomes a bulleted ┃◆ line
        const lines = message.split('\n').map(l => `┃◆ ${l.trim()}`).join('\n');

        try {
            let mentions = [];
        try { const t = await tagAll(client); mentions = t.mentions || []; } catch(e) { console.log('tagAll failed, continuing without mentions.'); }

            const text =
                `╭══〘 📢 ANNOUNCEMENT 〙══╮\n` +
                `┃◆ \n` +
                `${lines}\n` +
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