const { handleAriaCommand } = require('../systems/aiSystems');

module.exports = {
    name: 'aria',
    async execute(msg, args, { userId, client }) {
        const jid      = msg.from;
        const question = args.join(' ');
        await handleAriaCommand(client, jid, msg, userId, question);
    }
};