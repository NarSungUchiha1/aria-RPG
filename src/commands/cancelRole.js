const { pendingRoleChanges } = require('./setRole');

module.exports = {
    name: 'cancelrole',
    async execute(msg, args, { userId }) {
        if (!pendingRoleChanges.has(userId)) {
            return msg.reply("❌ You have no pending role change to cancel.");
        }

        const { newRole, timer } = pendingRoleChanges.get(userId);
        clearTimeout(timer);
        pendingRoleChanges.delete(userId);

        return msg.reply(
            `╭══〘 ❌ ROLE CHANGE DECLINED 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ You have declined the offer to\n` +
            `┃◆ become a ${newRole}.\n` +
            `┃◆ \n` +
            `┃◆ Your role remains unchanged.\n` +
            `┃◆ \n` +
            `╰═══════════════════════════╯`
        );
    }
};