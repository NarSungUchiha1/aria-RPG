const db = require('../database/db');

module.exports = {
    name: 'stats',
    async execute(msg, args, { userId }) {
        try {
            const [rows] = await db.execute(
                `SELECT p.nickname, p.role, p.\`rank\`, p.title, p.hp, p.max_hp,
                        p.pvp_wins, p.pvp_losses, p.strength, p.agility,
                        p.intelligence, p.stamina, p.sp,
                        COALESCE(p.prestige_level, 0) as prestige_level,
                        c.gold, x.xp
                 FROM players p
                 LEFT JOIN currency c ON p.id = c.player_id
                 LEFT JOIN xp x ON p.id = x.player_id
                 WHERE p.id = ?`,
                [userId]
            );
            if (!rows.length) return msg.reply('❌ Not registered.');

            const p = rows[0];
            const total    = (p.pvp_wins || 0) + (p.pvp_losses || 0);
            const winRate  = total ? Math.round((p.pvp_wins / total) * 100) : 0;
            const prestigeLvl = p.prestige_level || 0;
            const stars    = prestigeLvl > 0 ? '☆'.repeat(Math.min(prestigeLvl, 5)) + ' ' : '';
            const rankLine = prestigeLvl > 0 ? `${stars}${p.rank}` : p.rank;

            let reply;

            if (prestigeLvl > 0) {
                reply =
                    `══〘 ✦ PRESTIGE STATS 〙══╮\n` +
                    `┃★ 👤 ${p.nickname}\n` +
                    `┃★ 🎭 ${p.role}\n` +
                    `┃★ 🏅 Rank: ${rankLine}  •  Prestige ${prestigeLvl}\n` +
                    `┃★ 📜 Title: ${p.title || 'None'}\n` +
                    `┃★────────────\n` +
                    `┃★ 🏆 PvP Wins:   ${p.pvp_wins || 0}\n` +
                    `┃★ 💀 PvP Losses: ${p.pvp_losses || 0}\n` +
                    `┃★ ⚔️ Win Rate:   ${winRate}%\n` +
                    `┃★────────────\n` +
                    `┃★ 💪 Strength:     ${p.strength}\n` +
                    `┃★ ⚡ Agility:      ${p.agility}\n` +
                    `┃★ 🧠 Intelligence: ${p.intelligence}\n` +
                    `┃★ 🛡️ Stamina:      ${p.stamina}\n` +
                    `┃★ ✨ SP: ${p.sp || 0}\n` +
                    `┃★────────────\n` +
                    `┃★ ❤️ HP: ${p.hp}/${p.max_hp}\n` +
                    `┃★ 💰 Gold: ${(p.gold || 0).toLocaleString()}\n` +
                    `┃★ ⭐ XP: ${(p.xp || 0).toLocaleString()}\n` +
                    `╰═══════════════════════╯`;
            } else {
                reply =
                    `══〘 📊 COMBAT RECORD 〙══╮\n` +
                    `┃◆ 👤 ${p.nickname}\n` +
                    `┃◆ 🎭 ${p.role}\n` +
                    `┃◆ 🏅 Rank: ${p.rank}  •  Title: ${p.title || 'None'}\n` +
                    `┃◆────────────\n` +
                    `┃◆ 🏆 PvP Wins:   ${p.pvp_wins || 0}\n` +
                    `┃◆ 💀 PvP Losses: ${p.pvp_losses || 0}\n` +
                    `┃◆ ⚔️ Win Rate:   ${winRate}%\n` +
                    `┃◆────────────\n` +
                    `┃◆ 💪 Strength:     ${p.strength}\n` +
                    `┃◆ ⚡ Agility:      ${p.agility}\n` +
                    `┃◆ 🧠 Intelligence: ${p.intelligence}\n` +
                    `┃◆ 🛡️ Stamina:      ${p.stamina}\n` +
                    `┃◆ ✨ SP: ${p.sp || 0}\n` +
                    `┃◆────────────\n` +
                    `┃◆ ❤️ HP: ${p.hp}/${p.max_hp}\n` +
                    `┃◆ 💰 Gold: ${(p.gold || 0).toLocaleString()}\n` +
                    `┃◆ ⭐ XP: ${(p.xp || 0).toLocaleString()}\n` +
                    `╰═══════════════════════╯`;
            }

            return msg.reply(reply);
        } catch (err) {
            console.error(err);
            msg.reply('❌ Could not fetch stats.');
        }
    }
};