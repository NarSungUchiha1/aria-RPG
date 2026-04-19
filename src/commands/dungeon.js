const db = require('../database/db');
const { getActiveDungeon, getCurrentEnemies, getDungeonStatusText } = require('../engine/dungeon');

module.exports = {
    name: 'dungeon',
    async execute(msg, args, { userId }) {
        try {
            const dungeon = await getActiveDungeon();
            if (!dungeon) return msg.reply("❌ No active dungeon.");

            const statusText = await getDungeonStatusText(dungeon.id);
            return msg.reply(statusText);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Could not fetch dungeon status.");
        }
    }
};