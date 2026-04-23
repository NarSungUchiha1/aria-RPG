const db = require('../database/db');
const { stylize, rankBadge, roleIcon } = require('../utils/styles');

module.exports = {
    name: 'me',
    async execute(msg, args, { userId }) {
        try {
            const [rows] = await db.execute(
                "SELECT nickname, role, `rank`, title, hp, max_hp, strength, agility, intelligence, stamina, awakened, sp, mana, max_mana FROM players WHERE id=?",
                [userId]
            );
            if (!rows.length) return msg.reply(
                `══〘 👤 PROFILE 〙══╮\n┃◆ ❌ Not registered. Use !awaken\n╰═══════════════════════╯`
            );
            const p = rows[0];
            const [equipped] = await db.execute(
                `SELECT COALESCE(SUM(strength_bonus),0) as str_bonus,
                        COALESCE(SUM(agility_bonus),0) as agi_bonus,
                        COALESCE(SUM(intelligence_bonus),0) as int_bonus,
                        COALESCE(SUM(stamina_bonus),0) as sta_bonus,
                        COALESCE(SUM(attack_bonus),0) as atk_bonus,
                        COALESCE(SUM(defense_bonus),0) as def_bonus
                 FROM inventory WHERE player_id=? AND equipped=1`,
                [userId]
            );
            const b = equipped[0] || {};
            const [money] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const gold = money[0]?.gold || 0;
            const xp   = xpRow[0]?.xp   || 0;

            const strBonus = Number(b.str_bonus) + Number(b.atk_bonus);
            const agiBonus = Number(b.agi_bonus);
            const intBonus = Number(b.int_bonus);
            const staBonus = Number(b.sta_bonus);

            const totalStr = Number(p.strength)     + strBonus;
            const totalAgi = Number(p.agility)      + agiBonus;
            const totalInt = Number(p.intelligence) + intBonus;
            const totalSta = Number(p.stamina)      + staBonus;

            let reply =
                `══〘 👤 PLAYER STATUS 〙══╮\n` +
                `┃◆ ${rankBadge(p.rank)} *${p.nickname.toUpperCase()}*\n` +
                `┃◆ ${roleIcon(p.role)} ${p.role}  •  ${p.title || 'No Title'}\n` +
                `┃◆────────────\n` +
                `┃◆ 💪 STR: ${totalStr}${strBonus > 0 ? ` (+${strBonus})` : ''}\n` +
                `┃◆ ⚡ AGI: ${totalAgi}${agiBonus > 0 ? ` (+${agiBonus})` : ''}\n` +
                `┃◆ 🧠 INT: ${totalInt}${intBonus > 0 ? ` (+${intBonus})` : ''}\n` +
                `┃◆ 🛡️ STA: ${totalSta}${staBonus > 0 ? ` (+${staBonus})` : ''}\n` +
                `┃◆────────────\n` +
                `┃◆ ❤️ HP: ${p.hp}/${p.max_hp}\n`;

            if (p.role === 'Mage' || p.role === 'Healer') {
                reply += `┃◆ 💙 Mana: ${p.mana || 0}/${p.max_mana || 50}\n`;
            }

            reply +=
                `┃◆ ✨ SP: ${p.sp || 0}  •  💰 ${gold}  •  ⭐ ${xp}\n` +
                `╰═══════════════════════╯`;

            return msg.reply(reply);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 👤 PROFILE 〙══╮\n┃◆ ❌ Could not fetch profile.\n╰═══════════════════════╯`);
        }
    }
};