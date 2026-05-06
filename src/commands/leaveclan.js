const db = require('../database/db');
const { getPlayerClan, getClanMembers } = require('../systems/clanSystem');

module.exports = {
    name: 'leaveclan',
    async execute(msg, args, { userId }) {
        try {
            const clan = await getPlayerClan(userId);
            if (!clan) return msg.reply("❌ You are not in a clan.");

            const members = await getClanMembers(clan.id);

            if (clan.leader_id === userId) {
                if (members.length > 1) return msg.reply(
                    `══〘 🏰 CLAN 〙══╮\n` +
                    `┃◆ ❌ Transfer leadership first.\n` +
                    `┃◆ !clan promote @user\n` +
                    `╰═══════════════════════╯`
                );
                // Last member — disband
                await db.execute("DELETE FROM clans WHERE id=?", [clan.id]);
                return msg.reply(`🏚️ *${clan.name}* has been disbanded.`);
            }

            await db.execute("DELETE FROM clan_members WHERE player_id=?", [userId]);
            await db.execute("UPDATE clans SET member_count = member_count - 1 WHERE id=?", [clan.id]);
            return msg.reply(`✅ You have left *${clan.name}*.`);
        } catch (err) {
            console.error('leaveclan error:', err);
            msg.reply("❌ Failed.");
        }
    }
};