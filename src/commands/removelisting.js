const db = require('../database/db');
const { ensureTables } = require('../systems/healerMarket');

module.exports = {
    name: 'removelisting',
    async execute(msg, args, { userId }) {
        await ensureTables();
        try {
            const [r] = await db.execute(
                'UPDATE healer_listings SET is_active=0 WHERE healer_id=? AND is_active=1', [userId]
            );
            if (!r.affectedRows) return msg.reply(
                '══〘 💚 REMOVE LISTING 〙══╮\n┃◆ ❌ No active listing.\n╰═══════════════════════╯'
            );
            return msg.reply(
                '══〘 💚 REMOVE LISTING 〙══╮\n┃◆ ✅ Listing removed.\n╰═══════════════════════╯'
            );
        } catch (err) {
            console.error('removelisting error:', err);
            msg.reply('❌ Failed.');
        }
    }
};