const db = require('../database/db');
const { getActiveDungeon } = require('../engine/dungeon');

module.exports = {
    name: 'clear',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");
        
        try {
            const dungeon = await getActiveDungeon();
            if (!dungeon) return msg.reply("❌ No active dungeon.");
            
            await db.execute("UPDATE dungeon SET stage_cleared=1 WHERE id=?", [dungeon.id]);
            return msg.reply("✅ Stage force-cleared. Use !onward to advance.");
        } catch (err) {
            console.error(err);
            msg.reply("❌ Clear failed.");
        }
    }
};