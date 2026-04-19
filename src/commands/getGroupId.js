module.exports = {
    name: 'getgroupid',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");
        const chat = await msg.getChat();
        if (!chat.isGroup) return msg.reply("❌ This command must be used in a group.");
        return msg.reply(`══〘 🆔 GROUP ID 〙══╮\n┃◆ ${chat.id._serialized}\n╰═══════════════════════╯`);
    }
};