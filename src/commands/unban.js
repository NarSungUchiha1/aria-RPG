const db = require('../database/db');

module.exports = {
    name: 'unban',
    async execute(msg, args, { userId, isAdmin }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');
        const mention = msg.mentionedJids?.[0] || args[0];
        if (!mention) return msg.reply('❌ Tag a player: !unban @user');
        const targetId = String(mention).replace(/@s\.whatsapp\.net|@c\.us/g, '').split(':')[0];
        await db.execute('DELETE FROM banned_players WHERE player_id=?', [targetId]);
        return msg.reply('══〘 ✅ UNBANNED 〙══╮\n┃◆ Player ' + targetId + ' unbanned.\n╰═══════════════╯');
    }
};