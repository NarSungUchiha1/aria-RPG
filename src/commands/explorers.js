/**
 * !explorers — view all active explorer service listings
 */
const db = require('../database/db');
const { ensureTables } = require('../systems/explorerMarket');

module.exports = {
    name: 'explorers',
    async execute(msg, args, { userId }) {
        await ensureTables();
        try {
            const [listings] = await db.execute(
                'SELECT * FROM explorer_listings WHERE is_active=1 ORDER BY updated_at DESC LIMIT 20'
            );

            if (!listings.length) return msg.reply(
                '══〘 🌀 EXPLORER MARKET 〙══╮\n' +
                '┃◆ No active explorer listings.\n' +
                '┃◆ Explorers: !explorerlist <gold> <xp> <desc>\n' +
                '╰═══════════════════════╯'
            );

            let text =
                '╔══〘 🌀 EXPLORER MARKET 〙══╗\n' +
                '┃◆\n';

            listings.forEach((l, i) => {
                text +=
                    '┃◆ *' + (i + 1) + '. ' + l.nickname + '*\n' +
                    '┃◆ ' + l.description + '\n' +
                    '┃◆ 💰 ' + Number(l.price_gold).toLocaleString() + 'G  ⭐ ' + Number(l.price_xp).toLocaleString() + ' XP\n' +
                    '┃◆\n';
            });

            text +=
                '┃◆ !hireexplorer <#> — hire an explorer\n' +
                '╚═══════════════════════════╝';

            return msg.reply(text);
        } catch (err) {
            console.error('explorers error:', err);
            msg.reply('❌ Failed to fetch listings.');
        }
    }
};