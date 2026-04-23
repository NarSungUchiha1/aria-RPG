module.exports = {
    name: 'getgroupid',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply(
            `══〘 🆔 GROUP ID 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );
        const chat = await msg.getChat();
        if (!chat.isGroup) return msg.reply(
            `══〘 🆔 GROUP ID 〙══╮\n┃◆ ❌ Use this in a group.\n╰═══════════════════════╯`
        );
        return msg.reply(
            `══〘 🆔 GROUP ID 〙══╮\n┃◆ ${chat.id._serialized}\n╰═══════════════════════╯`
        );
    }
};