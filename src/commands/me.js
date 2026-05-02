const db = require('../database/db');
const { getPrestigeBadge } = require('../systems/prestigeSystem');
const getUserId = require('../utils/getUserId');
const { stylize, rankBadge, roleIcon } = require('../utils/styles');

module.exports = {
    name: 'me',
    async execute(msg, args, { userId }) {
        try {
            const [rows] = await db.execute(
                `SELECT nickname, role, \`rank\`, title, hp, max_hp, strength, agility, intelligence, stamina, awakened, sp, mana, max_mana
                 FROM players WHERE id=?`,
                [userId]
            );
            if (!rows.length) return msg.reply("❌ You are not registered. Use !awaken");

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
            const strBonus = Number(b.str_bonus) + Number(b.atk_bonus);
            const agiBonus = Number(b.agi_bonus);
            const intBonus = Number(b.int_bonus);
            const staBonus = Number(b.sta_bonus);
            
            const totalStr = Number(p.strength) + strBonus;
            const totalAgi = Number(p.agility) + agiBonus;
            const totalInt = Number(p.intelligence) + intBonus;
            const totalSta = Number(p.stamina) + staBonus;
            
            const [money] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const gold = money[0]?.gold || 0;
            const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const xp = xpRow[0]?.xp || 0;

            const styledName = stylize(p.nickname.toUpperCase());
            const badge = rankBadge(p.rank);
            const icon = roleIcon(p.role);
            const prestigeLvl = p.prestige_level || 0;
            const stars = prestigeLvl > 0 ? '☆'.repeat(Math.min(prestigeLvl, 5)) : '';
            const rankLine = prestigeLvl > 0 ? `${stars} ${p.rank}` : p.rank;

            const manaLine = (p.role === 'Mage' || p.role === 'Healer')
                ? `\n┃◆ 💙 Mana: ${p.mana || 0}/${p.max_mana || 50}`
                : '';

            let reply;

            if (prestigeLvl > 0) {
                reply =
                    `══〘 ✦ PRESTIGE HUNTER 〙══╮\n` +
                    `┃◆ 👤 ${badge} ${styledName}\n` +
                    `┃◆ 🎭 ${icon} ${p.role}\n` +
                    `┃◆ 🏅 Rank: ${rankLine}  •  Prestige ${prestigeLvl}\n` +
                    `┃◆ 📜 Title: ${p.title || 'None'}\n` +
                    `┃◆────────────\n` +
                    `┃◆ 💪 Strength: ${totalStr}\n` +
                    `┃◆ ⚡ Agility: ${totalAgi}\n` +
                    `┃◆ 🧠 Intelligence: ${totalInt}\n` +
                    `┃◆ 🛡️ Stamina: ${totalSta}\n` +
                    `┃◆────────────\n` +
                    `┃◆ ❤️ HP: ${p.hp}/${p.max_hp}` +
                    manaLine +
                    `\n┃◆ ⚡ Reawakened: ${p.awakened ? 'YES' : 'NO'}\n` +
                    `┃◆ ✨ SP: ${p.sp || 0}\n` +
                    `┃◆────────────\n` +
                    `┃◆ 💰 Gold: ${gold.toLocaleString()}\n` +
                    `┃◆ ⭐ XP: ${xp.toLocaleString()}\n` +
                    `╰═══════════════════════╯`;
            } else {
                reply =
                    `══〘 👤 PLAYER STATUS 〙══╮\n` +
                    `┃◆ 👤 ${badge} ${styledName}\n` +
                    `┃◆ 🎭 ${icon} ${p.role}\n` +
                    `┃◆ 🏅 Rank: ${p.rank}  •  Title: ${p.title || 'None'}\n` +
                    `┃◆────────────\n` +
                    `┃◆ 💪 Strength: ${totalStr}\n` +
                    `┃◆ ⚡ Agility: ${totalAgi}\n` +
                    `┃◆ 🧠 Intelligence: ${totalInt}\n` +
                    `┃◆ 🛡️ Stamina: ${totalSta}\n` +
                    `┃◆────────────\n` +
                    `┃◆ ❤️ HP: ${p.hp}/${p.max_hp}` +
                    manaLine +
                    `\n┃◆ ⚡ Awakened: ${p.awakened ? 'YES' : 'NO'}\n` +
                    `┃◆ ✨ SP: ${p.sp || 0}\n` +
                    `┃◆ 💰 Gold: ${gold}\n` +
                    `┃◆ ⭐ XP: ${xp}\n` +
                    `╰═══════════════════════╯`;
            }

            return msg.reply(reply);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Could not fetch profile.");
        }
    }
};