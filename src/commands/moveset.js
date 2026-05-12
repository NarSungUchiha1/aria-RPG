const db = require('../database/db');
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
            const moves       = getAllMoves(player, items);
            const roleMoves   = moves.filter(m => m.source === 'role');
            const weaponMoves = moves.filter(m => m.source === 'weapon');

            function cdText(cd) {
                return cd > 0 ? `⏳ ${Math.ceil(cd / 1000)}s` : '✅ Ready';
            }

            if (!isPrestige) {
                let text =
                    `══〘 ⚔️ MOVESET 〙══╮\n` +
                    `┃◆ 👤 ${player.nickname}\n` +
                    `┃◆ 🎭 ${player.role}\n` +
                    `┃◆────────────\n` +
                    `┃◆ ROLE SKILLS:\n`;

                roleMoves.forEach(m => {
                    const cd = getMoveCooldown(userId, m.name);
                    text += `┃◆   ${m.name} - ${m.type} | ${cdText(cd)}\n`;
                });

                if (weaponMoves.length) {
                    text += `┃◆────────────\n┃◆ WEAPON SKILLS:\n`;
                    weaponMoves.forEach(m => {
                        const cd = getMoveCooldown(userId, m.name);
                        text += `┃◆   ${m.name} (${m.weapon}) - ${m.type} | ${cdText(cd)}\n`;
                    });
                }

                text += `┃◆────────────\n┃◆ 🧭 Use !skill <move>\n╰═══════════════════════╯`;
                return msg.reply(text);
            }

            // ── PRESTIGE ─────────────────────────────────────────────────────
            const stars = '☆'.repeat(Math.min(player.prestige_level, 5));
            let text =
                `╔══〘 ✦ VOID MOVESET 〙══╗\n` +
                `┃★ ${stars} ${player.nickname}\n` +
                `┃★ 🎭 ${player.role}  •  Prestige ${player.prestige_level}\n` +
                `┃★────────────\n` +
                `┃★ VOID SKILLS:\n`;

            roleMoves.forEach(m => {
                const cd = getMoveCooldown(userId, m.name);
                text += `┃★   ${m.name} - ${m.type} | ${cdText(cd)}\n`;
            });

            if (weaponMoves.length) {
                text += `┃★────────────\n┃★ VOID WEAPON SKILLS:\n`;
                weaponMoves.forEach(m => {
                    const cd = getMoveCooldown(userId, m.name);
                    text += `┃★   ${m.name} (${m.weapon}) - ${m.type} | ${cdText(cd)}\n`;
                });
            }

            text += `┃★────────────\n┃★ 🧭 Use !skill <move>\n╚═══════════════════════════╝`;
            return msg.reply(text);

        } catch (err) {
            console.error('moveset error:', err);
            msg.reply(`══〘 ⚔️ MOVESET 〙══╮\n┃◆ ❌ Could not load moveset.\n╰═══════════════════════╯`);
        }
    }
};