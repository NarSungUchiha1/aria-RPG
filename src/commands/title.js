const db = require('../database/db');
const { getPlayerTitles, getEquippedTitle, TITLES } = require('../systems/titleSystem');

module.exports = {
    name: 'title',
    async execute(msg, args, { userId }) {
        try {
            const sub = args[0]?.toLowerCase();
            const titles = await getPlayerTitles(userId);

            // ── !title equip <number> ─────────────────────────────────────────
            if (sub === 'equip') {
                const num = parseInt(args[1]);
                if (isNaN(num) || !titles[num-1]) return msg.reply("❌ !title equip <number>");
                const chosen = titles[num-1].title;
                await db.execute("UPDATE player_titles SET is_equipped=0 WHERE player_id=?", [userId]);
                await db.execute("UPDATE player_titles SET is_equipped=1 WHERE player_id=? AND title=?", [userId, chosen]);
                return msg.reply(`✅ Title equipped: 〝*${chosen}*〞`);
            }

            // ── !title ── list all ────────────────────────────────────────────
            if (!titles.length) return msg.reply(
                `╔══〘 🏅 TITLES 〙══╗\n┃◆ No titles earned yet.\n┃◆ Complete achievements to earn them.\n╚═══════════════════════════╝`
            );

            let text = `╔══〘 🏅 YOUR TITLES 〙══╗\n┃◆\n`;
            titles.forEach((t, i) => {
                const equipped = t.is_equipped ? ' ◀ EQUIPPED' : '';
                const desc = TITLES[t.title]?.desc || '';
                text += `┃◆ ${i+1}. 〝*${t.title}*〞${equipped}\n┃◆    ${desc}\n┃◆\n`;
            });
            text += `┃◆ !title equip <number>\n╚═══════════════════════════╝`;
            return msg.reply(text);
        } catch (err) {
            console.error('title error:', err);
            msg.reply('❌ Failed.');
        }
    }
};