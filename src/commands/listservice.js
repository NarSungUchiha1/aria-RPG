const db = require('../database/db');
const { ensureTables: ensureHealer } = require('../systems/healerMarket');
const { ensureTables: ensureExplorer } = require('../systems/explorerMarket');

module.exports = {
    name: 'listservice',
    async execute(msg, args, { userId }) {
        await ensureHealer();
        await ensureExplorer();
        try {
            const [player] = await db.execute('SELECT nickname, role FROM players WHERE id=?', [userId]);
            if (!player.length) return msg.reply('❌ Not registered.');

            const role = player[0].role;
            const nick = player[0].nickname;

            if (!['Healer', 'Explorer'].includes(role)) return msg.reply(
                '══〘 LIST SERVICE 〙══╮\n' +
                '┃◆ ❌ Only Healers and Explorers can list services.\n' +
                '┃◆ Your role: ' + role + '\n' +
                '╰═══════════════════════╯'
            );

            if (args.length < 3) return msg.reply(
                '══〘 LIST SERVICE 〙══╮\n' +
                '┃◆ Use: !listservice <gold> <xp> <description>\n' +
                '┃◆ Example: !listservice 200 100 Full dungeon heal\n' +
                '╰═══════════════════════╯'
            );

            const priceGold   = parseInt(args[0]);
            const priceXp     = parseInt(args[1]);
            const description = args.slice(2).join(' ');

            if (isNaN(priceGold) || isNaN(priceXp) || priceGold < 0 || priceXp < 0) return msg.reply(
                '══〘 LIST SERVICE 〙══╮\n┃◆ ❌ Invalid prices.\n╰═══════════════════════╯'
            );

            if (role === 'Explorer') {
                await db.execute(
                    'UPDATE explorer_listings SET is_active=0 WHERE explorer_id=? AND is_active=1',
                    [userId]
                );
                await db.execute(
                    'INSERT INTO explorer_listings (explorer_id, nickname, description, price_gold, price_xp, is_active) VALUES (?,?,?,?,?,1)',
                    [userId, nick, description, priceGold, priceXp]
                );
                return msg.reply(
                    '══〘 🌀 SERVICE LISTED 〙══╮\n' +
                    '┃◆ ✅ ' + nick + '\n' +
                    '┃◆ 💰 ' + priceGold + ' Gold  ⭐ ' + priceXp + ' XP\n' +
                    '┃◆ 📋 ' + description + '\n' +
                    '┃◆\n' +
                    '┃◆ Players can find you with !explorers\n' +
                    '╰═══════════════════════╯'
                );
            }

            // Healer
            await db.execute(
                `INSERT INTO healer_listings (healer_id, nickname, description, price_gold, price_xp, is_active, updated_at)
                 VALUES (?, ?, ?, ?, ?, 1, NOW())
                 ON DUPLICATE KEY UPDATE
                     nickname=?, description=?, price_gold=?, price_xp=?, is_active=1, updated_at=NOW()`,
                [userId, nick, description, priceGold, priceXp, nick, description, priceGold, priceXp]
            );
            return msg.reply(
                '══〘 💚 SERVICE LISTED 〙══╮\n' +
                '┃◆ ✅ ' + nick + '\n' +
                '┃◆ 💰 ' + priceGold + ' Gold  ⭐ ' + priceXp + ' XP\n' +
                '┃◆ 📋 ' + description + '\n' +
                '┃◆\n' +
                '┃◆ Players can hire you with !healers\n' +
                '╰═══════════════════════╯'
            );
        } catch (err) {
            console.error('listservice error:', err);
            msg.reply('❌ Failed to list service.');
        }
    }
};