const db = require('../database/db');
const getUserId = require('../utils/getUserId');

module.exports = {
    name: 'stats',
    async execute(msg, args, { userId }) {
        try {
            const [rows] = await db.execute(
                `SELECT p.nickname, p.role, p.\`rank\`, p.title, p.hp, p.max_hp, p.pvp_wins, p.pvp_losses,
                        p.strength, p.agility, p.intelligence, p.stamina, p.sp,
                        c.gold, x.xp
                 FROM players p
                 LEFT JOIN currency c ON p.id = c.player_id
                 LEFT JOIN xp x ON p.id = x.player_id
                 WHERE p.id = ?`,
                [userId]
            );
            if (!rows.length) return msg.reply("❌ Not registered.");

            const p = rows[0];
            const total = (p.pvp_wins || 0) + (p.pvp_losses || 0);
            const winRate = total ? Math.round((p.pvp_wins / total) * 100) : 0;

            return msg.reply(`══〘 📊 COMBAT RECORD 〙══╮
┃◆ 👤 Name: ${p.nickname}
┃◆ 🎭 Role: ${p.role}
┃◆ 🏅 Rank: ${p.rank}  •  Title: ${p.title || 'None'}
┃◆────────────
┃◆ 🏆 PvP Wins: ${p.pvp_wins || 0}
┃◆ 💀 PvP Losses: ${p.pvp_losses || 0}
┃◆ ⚔️ Total Duels: ${total}
┃◆ 📊 Win Rate: ${winRate}%
┃◆────────────
┃◆ 💪 Strength: ${p.strength}
┃◆ ⚡ Agility: ${p.agility}
┃◆ 🧠 Intelligence: ${p.intelligence}
┃◆ 🛡️ Stamina: ${p.stamina}
┃◆ ✨ SP: ${p.sp || 0}
┃◆────────────
┃◆ ❤️ HP: ${p.hp}/${p.max_hp}
┃◆ 💰 Gold: ${p.gold || 0}
┃◆ ⭐ XP: ${p.xp || 0}
╰═══════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Could not fetch stats.");
        }
    }
};