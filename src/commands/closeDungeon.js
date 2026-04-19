const db = require('../database/db');

module.exports = {
    name: 'closedungeon',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");
        try {
            const [result] = await db.execute("UPDATE dungeon SET is_active = 0, locked = 0 WHERE is_active = 1");
            if (result.affectedRows === 0) {
                return msg.reply("❌ No active dungeon to close.");
            }
            return msg.reply("✅ Active dungeon has been forcefully closed.");
        } catch (err) {
            console.error(err);
            msg.reply("❌ Failed to close dungeon.");
        }
    }
};