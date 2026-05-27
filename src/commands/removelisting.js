const db = require('../database/db');
const { ensureTables: ensureHealer } = require('../systems/healerMarket');
const { ensureTables: ensureExplorer } = require('../systems/explorerMarket');

module.exports = {
    name: 'removelisting',
    async execute(msg, args, { userId }) {
        await ensureHealer();
        await ensureExplorer();
        try {
            const [player] = await db.execute('SELECT role FROM players WHERE id=?', [userId]);
            const role = player[0]?.role || '';

            if (role === 'Explorer') {
                const [result] = await db.execute(
                    'UPDATE explorer_listings SET is_active=0 WHERE explorer_id=? AND is_active=1',
                    [userId]
                );
                if (result.affectedRows === 0) return msg.reply(
                    '══〘 🌀 REMOVE LISTING 〙══╮\n┃◆ ❌ You have no active listing.\n╰═══════════════════════╯'
                );
                return msg.reply(
                    '══〘 🌀 REMOVE LISTING 〙══╮\n┃◆ ✅ Your explorer listing has been removed.\n╰═══════════════════════╯'
                );
            }

            // Default: healer listing
            const [result] = await db.execute(
                'UPDATE healer_listings SET is_active=0 WHERE healer_id=? AND is_active=1',
                [userId]
            );
            if (result.affectedRows === 0) return msg.reply(
                '══〘 💚 REMOVE LISTING 〙══╮\n┃◆ ❌ You have no active listing.\n╰═══════════════════════╯'
            );
            return msg.reply(
                '══〘 💚 REMOVE LISTING 〙══╮\n┃◆ ✅ Your listing has been removed.\n╰═══════════════════════╯'
            );
        } catch (err) {
            console.error('removelisting error:', err);
            msg.reply('❌ Failed to remove listing.');
        }
    }
};