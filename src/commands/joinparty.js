const { joinPartyAssembly, getAssemblyByPlayer } = require('../systems/pvpsystem');

module.exports = {
    name: 'joinparty',
    async execute(msg, args, { userId }) {
        if (!msg.mentionedIds?.length && !args[0]) return msg.reply(
            `╭══〘 ⚔️  JOIN PARTY 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ Mention the leader of the side you want to join.\n` +
            `┃◆ \n` +
            `┃◆ Example:\n` +
            `┃◆    !joinparty @Challenger\n` +
            `┃◆    !joinparty @Enemy\n` +
            `┃◆ \n` +
            `┃◆ Check the assembly message for leader names.\n` +
            `╰════════════════════════════════╯`
        );

        const existingAssembly = getAssemblyByPlayer(userId);
        if (existingAssembly) {
            // Already in assembly — show current roster so they know they're in
            const { buildRosterMessage } = require('../systems/pvpsystem');
            const rosterMsg = await buildRosterMessage(existingAssembly);
            return msg.reply(
                `╭══〘 ⚔️  PARTY ASSEMBLY 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ ✅ You are already in this party!\n` +
                `┃◆ \n` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ 📋  CURRENT ROSTERS\n` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ \n` +
                `${rosterMsg}` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ Leaders — lock in when ready:\n` +
                `┃◆    !startduel\n` +
                `╰════════════════════════════════╯`
            );
        }

        const leaderTag = msg.mentionedIds?.[0]
            ? msg.mentionedIds[0].replace(/@c\.us$/i, '').split('@')[0]
            : args[0]?.replace('@', '');

        const result = await joinPartyAssembly(userId, leaderTag);

        if (result.error) return msg.reply(
            `╭══〘 ⚔️  JOIN PARTY 〙══╮\n` +
            `┃◆ ❌ ${result.error}\n` +
            `╰════════════════════════════════╯`
        );

        return msg.reply(
            `╭══〘 ⚔️  JOINED — ${result.leaderNick.toUpperCase()}'S SIDE 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ ✅ *${result.jNick}* is now on *${result.leaderNick}*'s team!\n` +
            `┃◆ \n` +
            `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `┃◆ 📋  CURRENT ROSTERS\n` +
            `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `┃◆ \n` +
            `${result.rosterMsg}` +
            `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `┃◆ Leaders — lock in when ready:\n` +
            `┃◆    !startduel\n` +
            `╰════════════════════════════════╯`
        );
    }
};