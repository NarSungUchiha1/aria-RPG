const db = require('../database/db');
const { CLAN_BLESSINGS, ensureClanTables } = require('../systems/clanSystem');

module.exports = {
    name: 'clanlist',
    async execute(msg, args, { userId }) {
        try {
            await ensureClanTables();

            const [clans] = await db.execute(
                `SELECT c.*, COUNT(cm.player_id) as member_count
                 FROM clans c
                 LEFT JOIN clan_members cm ON cm.clan_id = c.id
                 GROUP BY c.id
                 ORDER BY c.id ASC`
            );

            let text =
                `╔══〘 🏰 THE THREE CLANS 〙══╗\n` +
                `┃◆\n`;

            if (!clans.length) {
                text += `┃◆ No clans have been founded yet.\n`;
            } else {
                for (const clan of clans) {
                    const blessing = CLAN_BLESSINGS[clan.blessing_id];
                    if (!blessing) continue;

                    text +=
                        `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                        `┃◆ ${clan.name}\n` +
                        `┃◆ 👥 ${clan.member_count}/10 members\n` +
                        `┃◆\n` +
                        `┃◆ 🩸 Bloodline : ${blessing.emoji} *${blessing.name}*\n` +
                        `┃◆ 📌 Condition to be met : ${blessing.condition}\n` +
                        `┃◆ ⚡ ${blessing.effect}\n` +
                        `┃◆\n`;
                }
            }

            text +=
                `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃◆ !clan join <name> to join\n` +
                `┃◆ Rank D+ required\n` +
                `╚═══════════════════════════╝`;

            return msg.reply(text);
        } catch (err) {
            console.error('clanlist error:', err);
            msg.reply('❌ Failed to load clan list.');
        }
    }
};