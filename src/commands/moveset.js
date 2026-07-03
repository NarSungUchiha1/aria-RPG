const db = require('../database/db');
const { getAllMoves, getMoveCooldown, ensureSignatureMoves } = require('../systems/skillSystem');

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
            await ensureSignatureMoves(player.id);
            const moves       = getAllMoves(player, items);
            const roleMoves   = moves.filter(m => m.source === 'role');
            const weaponMoves = moves.filter(m => m.source === 'weapon');
            const sigMoves    = moves.filter(m => m.source === 'signature');

            function cdText(cd) {
                return cd > 0 ? `⏳ ${Math.ceil(cd / 1000)}s` : '✅ Ready';
            }

            // ── ASCENDANT: reborn kit — ONLY signature moves + the unique weapon.
            // No role moves, no void weapon moves (stripped at rebirth).
            if (sigMoves.length) {
                const TYPE_ICON = { damage: '⚔️', heal: '💚', shield: '🛡️', evasion: '💨', buff: '⬆️', debuff: '⬇️' };
                const weaponName = weaponMoves[0]?.weapon || 'Unique Weapon';
                let text =
                    `╔═══〘 ✧ ASCENDANT MOVESET 〙═══╗\n` +
                    `┃✧ 👤 ${player.nickname}\n` +
                    `┃✧▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃✧ 👁️ *SIGNATURE MOVES*\n`;
                sigMoves.forEach(m => {
                    const cd = getMoveCooldown(userId, m.name);
                    text += `┃✧ ${TYPE_ICON[m.type] || '⚔️'} ${m.name}  ·  Lv${m.level || 1}  ·  ${cdText(cd)}\n`;
                });
                text += `┃✧▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n┃✧ 🗡️ *${weaponName}*\n`;
                weaponMoves.forEach(m => {
                    const cd = getMoveCooldown(userId, m.name);
                    text += `┃✧ ${TYPE_ICON[m.type] || '⚔️'} ${m.name}  ·  ${cdText(cd)}\n`;
                });
                text += `┃✧▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n┃✧ 🧭 Use *!skill <move>*\n╚═══════════════════════════╝`;
                return msg.reply(text);
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

                if (sigMoves.length) {
                    text += `┃◆────────────\n┃◆ 👁️ SIGNATURE MOVES:\n`;
                    sigMoves.forEach(m => {
                        const cd = getMoveCooldown(userId, m.name);
                        text += `┃◆   ${m.name} - ${m.type} (Lv${m.level || 1}) | ${cdText(cd)}\n`;
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

            if (sigMoves.length) {
                text += `┃★────────────\n┃★ 👁️ SIGNATURE MOVES:\n`;
                sigMoves.forEach(m => {
                    const cd = getMoveCooldown(userId, m.name);
                    text += `┃★   ${m.name} - ${m.type} (Lv${m.level || 1}) | ${cdText(cd)}\n`;
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