const db = require('../database/db');
const { ensureTables } = require('../systems/healerMarket');

module.exports = {
    name: 'listservice',
    async execute(msg, args, { userId }) {
        await ensureTables();
        try {
            const [pRows] = await db.execute('SELECT nickname, role FROM players WHERE id=?', [userId]);
            if (!pRows.length) return msg.reply('❌ Not registered.');
            const { role, nickname } = pRows[0];

            if (role !== 'Healer') return msg.reply(
                '══〘 💚 LIST SERVICE 〙══╮\n' +
                '┃◆ ❌ Healer role only.\n' +
                '┃◆ Your role: ' + role + '\n' +
                (role === 'Explorer' ? '┃◆ Explorers use !potionmarket to sell.\n' : '') +
                '╰═══════════════════════╯'
            );

            if (args.length < 3) return msg.reply(
                '══〘 💚 LIST SERVICE 〙══╮\n' +
                '┃◆ !listservice <gold> <xp> <description>\n' +
                '┃◆ Example: !listservice 200 100 Full dungeon heal\n' +
                '╰═══════════════════════╯'
            );

            const gold = Math.max(0, parseInt(args[0]) || 0);
            const xp   = Math.max(0, parseInt(args[1]) || 0);
            const desc = args.slice(2).join(' ').trim();
            if (!desc) return msg.reply('❌ Add a description.');

            await db.execute(
                `INSERT INTO healer_listings (healer_id, nickname, description, price_gold, price_xp, is_active, updated_at)
                 VALUES (?,?,?,?,?,1,NOW())
                 ON DUPLICATE KEY UPDATE nickname=?, description=?, price_gold=?, price_xp=?, is_active=1, updated_at=NOW()`,
                [userId, nickname, desc, gold, xp, nickname, desc, gold, xp]
            );
            return msg.reply(
                '══〘 💚 HEALER LISTED 〙══╮\n' +
                '┃◆ ✅ *' + nickname + '*\n' +
                '┃◆ 📋 ' + desc + '\n' +
                '┃◆ 💰 ' + gold.toLocaleString() + ' Lumens  ⭐ ' + xp.toLocaleString() + ' XP\n' +
                '┃◆ Players hire you with !healers\n' +
                '╰═══════════════════════╯'
            );
        } catch (err) {
            console.error('listservice error:', err);
            msg.reply('❌ Failed to list service.');
        }
    }
};