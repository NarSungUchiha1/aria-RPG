const db = require('../database/db');
const { getActiveDungeon, getCurrentEnemies, getDungeonStatusText, isPlayerInAnyDungeon } = require('../engine/dungeon');

module.exports = {
    name: 'dungeon',
    async execute(msg, args, { userId }) {
        try {
            // FIX: Show the dungeon the player is actually IN first
            // If they are not in any dungeon, show the active normal dungeon
            const playerDungeonId = await isPlayerInAnyDungeon(userId);
            let dungeon = null;

            if (playerDungeonId) {
                const [rows] = await db.execute('SELECT * FROM dungeon WHERE id=?', [playerDungeonId]);
                dungeon = rows[0] || null;
            }

            if (!dungeon) dungeon = await getActiveDungeon(false); // normal dungeon
            if (!dungeon) dungeon = await getActiveDungeon(true);  // any dungeon including territory

            if (!dungeon) return msg.reply('❌ No active dungeon.');

            const statusText = await getDungeonStatusText(dungeon.id);
            return msg.reply(statusText);
        } catch (err) {
            console.error(err);
            msg.reply('❌ Could not fetch dungeon status.');
        }
    }
};