const db = require('../database/db');
const { CLAN_BLESSINGS, PRESET_CLANS, ensureClanTables } = require('../systems/clanSystem');

module.exports = {
    name: 'clanlist',
    async execute(msg, args, { userId }) {
        try {
            await ensureClanTables();

            const [existingClans] = await db.execute(
                "SELECT c.*, COUNT(cm.player_id) as member_count FROM clans c LEFT JOIN clan_members cm ON cm.clan_id = c.id GROUP BY c.id"
            );

            let text =
                `╔══〘 🏰 THE THREE CLANS 〙══╗\n` +
                `┃◆\n`;

            // Show all 3 preset clans whether created or not
            for (const preset of PRESET_CLANS) {
                const existing = existingClans.find(c => c.name === preset.name);
                const blessing = CLAN_BLESSINGS[preset.blessing_id];
                const members  = existing ? existing.member_count : 0;
                const status   = existing ? `👥 ${members}/10 members` : `⚠️ Not yet founded`;

                text +=
                    `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃◆ ${preset.name}\n` +
                    `┃◆ ${status}\n` +
                    `┃◆\n` +
                    `┃◆ ${blessing.emoji} *${blessing.name}*\n` +
                    `┃◆ 📌 ${blessing.condition}\n` +
                    `┃◆ ⚡ ${blessing.effect}\n` +
                    `┃◆\n`;
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