const { joinPartyAssembly, getAssemblyByPlayer } = require('../systems/pvpsystem');

module.exports = {
    name: 'joinparty',
    async execute(msg, args, { userId }) {
        if (!msg.mentionedIds?.length && !args[0]) return msg.reply(
            `══〘 ⚔️ JOIN PARTY 〙══╮\n` +
            `┃◆ ❌ Mention the party leader.\n` +
            `┃◆ Example: !joinparty @leader\n` +
            `╰═══════════════════════╯`
        );

        // Check if already in an assembly
        if (getAssemblyByPlayer(userId)) return msg.reply(
            `══〘 ⚔️ JOIN PARTY 〙══╮\n` +
            `┃◆ ❌ You are already in a party assembly.\n` +
            `╰═══════════════════════╯`
        );

        const leaderTag = msg.mentionedIds?.[0]
            ? msg.mentionedIds[0].replace(/@c\.us$/i, '').split('@')[0]
            : args[0]?.replace('@', '');

        const result = await joinPartyAssembly(userId, leaderTag);

        if (result.error) return msg.reply(
            `══〘 ⚔️ JOIN PARTY 〙══╮\n┃◆ ❌ ${result.error}\n╰═══════════════════════╯`
        );

        const teamACount = result.teamA.length;
        const teamBCount = result.teamB.length;

        return msg.reply(
            `══〘 ⚔️ JOIN PARTY 〙══╮\n` +
            `┃◆ ✅ *${result.jNick}* joined *${result.teamTag}*'s side!\n` +
            `┃◆ \n` +
            `┃◆ Side A: ${teamACount}/5 players\n` +
            `┃◆ Side B: ${teamBCount}/5 players\n` +
            `┃◆ \n` +
            `┃◆ When your team is ready: !startduel\n` +
            `╰═══════════════════════╯`
        );
    }
};