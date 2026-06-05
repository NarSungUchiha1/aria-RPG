module.exports = {
    name: 'communityid',
    async execute(msg, args, { userId, isAdmin, client }) {
        if (!isAdmin) return;
        try {
            const jid = msg.from;
            const meta = await client.groupMetadata(jid);
            return msg.reply(
                `╔══〘 🏘️ GROUP INFO 〙══╗\n` +
                `┃◆ Group JID: ${jid}\n` +
                `┃◆ linkedParent: ${meta.linkedParent || 'none'}\n` +
                `┃◆ name: ${meta.subject}\n` +
                `╚═══════════════════════════╝`
            );
        } catch(e) {
            msg.reply('Error: ' + e.message);
        }
    }
};