const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { getAllMoves, getMoveCooldown } = require('../systems/skillSystem');

module.exports = {
    name: 'moveset',
    async execute(msg, args, { userId }) {
        try {
            const [rows] = await db.execute("SELECT * FROM players WHERE id=?", [userId]);
            if (!rows.length) return msg.reply(
                `══〘 ⚔️ MOVESET 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );

            const player = rows[0];
            const isPrestige = (player.prestige_level || 0) > 0;
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? AND equipped=1", [userId]
            );
            const moves = getAllMoves(player, items);

            const roleMoveList   = moves.filter(m => m.source === 'role');
            const weaponMoveList = moves.filter(m => m.source === 'weapon');

            if (isPrestige) {
                const stars = '☆'.repeat(Math.min(player.prestige_level, 5));
                let text =
                    `╔══〘 ✦ VOID MOVESET 〙══╗\n` +
                    `┃★ ${stars} ${player.nickname.toUpperCase()}\n` +
                    `┃★ 🎭 ${player.role} — Prestige ${player.prestige_level}\n` +
                    `┃★────────────\n` +
                    `┃★ VOID SKILLS:\n`;

                roleMoveList.forEach(m => {
                    const cd = getMoveCooldown(userId, m.name);
                    const cdText = cd > 0 ? `⏳ ${Math.ceil(cd/1000)}s` : '✅ Ready';
                    const typeIcon = m.type === 'heal' ? '💚' : m.type === 'buff' ? '⬆️' : m.type === 'debuff' ? '⬇️' : m.type === 'shield' ? '🛡️' : '⚔️';
                    text += `┃★   ${typeIcon} ${m.name} | ${cdText}\n`;
                });

                if (weaponMoveList.length) {
                    text += `┃★────────────\n`;
                    text += `┃★ VOID WEAPON SKILLS:\n`;
                    weaponMoveList.forEach(m => {
                        const cd = getMoveCooldown(userId, m.name);
                        const cdText = cd > 0 ? `⏳ ${Math.ceil(cd/1000)}s` : '✅ Ready';
                        const typeIcon = m.type === 'heal' ? '💚' : m.type === 'buff' ? '⬆️' : m.type === 'debuff' ? '⬇️' : m.type === 'shield' ? '🛡️' : '⚔️';
                        text += `┃★   ${typeIcon} ${m.name} | ${cdText}\n`;
                    });
                }

                text +=
                    `┃★────────────\n` +
                    `┃★ 🧭 Use !skill <move>\n` +
                    `╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            // Normal player UI
            let text = `══〘 ⚔️ MOVESET 〙══╮\n`;
            text += `┃◆ 👤 ${player.nickname.toUpperCase()}\n`;
            text += `┃◆ 🎭 ${player.role}\n`;
            text += `┃◆────────────\n`;
            text += `┃◆ ROLE SKILLS:\n`;

            roleMoveList.forEach(m => {
                const cd = getMoveCooldown(userId, m.name);
                const cdText = cd > 0 ? `⏳ ${Math.ceil(cd/1000)}s` : '✅ Ready';
                text += `┃◆   ${m.name} - ${m.type} | ${cdText}\n`;
            });

            if (weaponMoveList.length) {
                text += `┃◆────────────\n`;
                text += `┃◆ WEAPON SKILLS:\n`;
                weaponMoveList.forEach(m => {
                    const cd = getMoveCooldown(userId, m.name);
                    const cdText = cd > 0 ? `⏳ ${Math.ceil(cd/1000)}s` : '✅ Ready';
                    text += `┃◆   ${m.name} (${m.weapon}) - ${m.type} | ${cdText}\n`;
                });
            }

            text += `┃◆────────────\n`;
            text += `┃◆ 🧭 Use !skill <move>\n`;
            text += `╰═══════════════════════╯`;
            return msg.reply(text);

        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ⚔️ MOVESET 〙══╮\n┃◆ ❌ Could not load moveset.\n╰═══════════════════════╯`);
        }
    }
};