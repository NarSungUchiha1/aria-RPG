const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { getAllMoves, getMoveCooldown } = require('../systems/skillSystem');

module.exports = {
    name: 'moveset',
    async execute(msg, args, { userId }) {
        try {
            const [rows] = await db.execute("SELECT * FROM players WHERE id=?", [userId]);
            if (!rows.length) return msg.reply("❌ Not registered.");

            const player = rows[0];
            const [items] = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [userId]);
            const moves = getAllMoves(player, items);

            let text = `══〘 ⚔️ MOVESET 〙══╮\n`;
            text += `┃◆ 👤 ${player.nickname.toUpperCase()}\n`;
            text += `┃◆ 🎭 ${player.role}\n`;
            text += `┃◆────────────\n`;

            const roleMoves = moves.filter(m => m.source === 'role');
            const weaponMoves = moves.filter(m => m.source === 'weapon');

            text += `┃◆ ROLE SKILLS:\n`;
            roleMoves.forEach(m => {
                const cd = getMoveCooldown(userId, m.name);
                const cdText = cd > 0 ? `⏳ ${Math.ceil(cd/1000)}s` : '✅ Ready';
                text += `┃◆   ${m.name} - ${m.type} | ${cdText}\n`;
            });

            if (weaponMoves.length) {
                text += `┃◆────────────\n`;
                text += `┃◆ WEAPON SKILLS:\n`;
                weaponMoves.forEach(m => {
                    const cd = getMoveCooldown(userId, m.name);
                    const cdText = cd > 0 ? `⏳ ${Math.ceil(cd/1000)}s` : '✅ Ready';
                    text += `┃◆   ${m.name} (${m.weapon}) - ${m.type} | ${cdText}\n`;
                });
            }

            text += `┃◆────────────\n`;
            text += `┃◆ 🧭 Use !skill <name>\n`;
            text += `╰═══════════════════════╯`;
            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Could not load moveset.");
        }
    }
};