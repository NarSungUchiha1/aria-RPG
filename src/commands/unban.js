const db = require('../database/db');

module.exports = {
    name: 'unban',
    async execute(msg, args, { userId, isAdmin }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');
        const mention = msg.mentionedIds?.[0] || args[0];
        if (!mention) return msg.reply('❌ Tag a player: !unban @user');
        const targetId = String(mention).replace(/@[^@]+$/, '').split(':')[0];
        await db.execute('DELETE FROM banned_players WHERE player_id=?', [targetId]);
        // Remove from in-memory set immediately
        try { if (global.bannedPlayers) global.bannedPlayers.delete(targetId); } catch(e) {}
        return msg.reply('══〘 ✅ UNBANNED 〙══╮\n┃◆ ' + targetId + ' can use the bot again.\n╰═══════════════╯');
    }
};