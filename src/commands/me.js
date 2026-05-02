const db = require('../database/db');
const { getPrestigeBadge } = require('../systems/prestigeSystem');

module.exports = {
    name: 'me',
    async execute(msg, args, { userId }) {
        try {
            const [rows] = await db.execute(
                `SELECT p.nickname, p.role, p.\`rank\`, p.title, p.hp, p.max_hp,
                        p.strength, p.agility, p.intelligence, p.stamina,
                        p.awakened, p.sp, p.mana, p.max_mana,
                        COALESCE(p.prestige_level, 0) as prestige_level
                 FROM players p WHERE p.id = ?`,
                [userId]
            );
            if (!rows.length) return msg.reply('❌ Not registered.');
            const p = rows[0];

            const [items] = await db.execute(
                "SELECT strength_bonus, agility_bonus, intelligence_bonus, stamina_bonus FROM inventory WHERE player_id=? AND equipped=1",
                [userId]
            );
            const totalStr = p.strength + items.reduce((s, i) => s + (i.strength_bonus || 0), 0);
            const totalAgi = p.agility + items.reduce((s, i) => s + (i.agility_bonus || 0), 0);
            const totalInt = p.intelligence + items.reduce((s, i) => s + (i.intelligence_bonus || 0), 0);
            const totalSta = p.stamina + items.reduce((s, i) => s + (i.stamina_bonus || 0), 0);

            const [money] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const gold = money[0]?.gold || 0;
            const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const xp = xpRow[0]?.xp || 0;

            const prestigeLvl = p.prestige_level || 0;
            const stars = prestigeLvl > 0 ? '☆'.repeat(Math.min(prestigeLvl, 5)) + ' ' : '';
            const rankLine = prestigeLvl > 0 ? `${stars}${p.rank}` : p.rank;

            // Role/rank helpers inline
            const roleIcons = { Tank:'🛡️', Assassin:'🗡️', Mage:'🔮', Healer:'💚', Berserker:'⚔️', Ranger:'🏹' };
            const rankBadges = { F:'⚫', E:'🟤', D:'🟢', C:'🔵', B:'🟣', A:'🔴', S:'🟡' };
            const icon = roleIcons[p.role] || '⚔️';
            const badge = rankBadges[p.rank] || '⚫';

            const stylize = (s) => s.split('').join(' ');
            const styledName = stylize(p.nickname.toUpperCase());

            const manaLine = (p.role === 'Mage' || p.role === 'Healer')
                ? `\n┃◆ 💙 Mana: ${p.mana || 0}/${p.max_mana || 50}`
                : '';

            let reply;

            if (prestigeLvl > 0) {
                // ✅ PRESTIGE — star bullets
                const manaLineP = (p.role === 'Mage' || p.role === 'Healer')
                    ? `\n┃★ 💙 Mana: ${p.mana || 0}/${p.max_mana || 50}`
                    : '';

                reply =
                    `══〘 ✦ PRESTIGE HUNTER 〙══╮\n` +
                    `┃★ 👤 ${badge} ${styledName}\n` +
                    `┃★ 🎭 ${icon} ${p.role}\n` +
                    `┃★ 🏅 Rank: ${rankLine}  •  Prestige ${prestigeLvl}\n` +
                    `┃★ 📜 Title: ${p.title || 'None'}\n` +
                    `┃★────────────\n` +
                    `┃★ 💪 Strength: ${totalStr}\n` +
                    `┃★ ⚡ Agility: ${totalAgi}\n` +
                    `┃★ 🧠 Intelligence: ${totalInt}\n` +
                    `┃★ 🛡️ Stamina: ${totalSta}\n` +
                    `┃★────────────\n` +
                    `┃★ ❤️ HP: ${p.hp}/${p.max_hp}` +
                    manaLineP +
                    `\n┃★ ⚡ Awakened: ${p.awakened ? 'YES' : 'NO'}\n` +
                    `┃★ ✨ SP: ${p.sp || 0}\n` +
                    `┃★────────────\n` +
                    `┃★ 💰 Gold: ${gold.toLocaleString()}\n` +
                    `┃★ ⭐ XP: ${xp.toLocaleString()}\n` +
                    `╰═══════════════════════╯`;
            } else {
                // NORMAL — diamond bullets
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
            msg.reply('❌ Could not fetch profile.');
        }
    }
};