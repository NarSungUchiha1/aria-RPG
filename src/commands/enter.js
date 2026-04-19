const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { getActiveDungeon, isPlayerInDungeon, addPlayerToDungeon, isDungeonLocked } = require('../engine/dungeon');

module.exports = {
    name: 'enter',
    async execute(msg, args, { userId }) {
        try {
            const [player] = await db.execute("SELECT nickname FROM players WHERE id=?", [userId]);
            if (!player.length) return msg.reply("❌ Not registered.");

            const dungeon = await getActiveDungeon();
            if (!dungeon) return msg.reply("❌ No active dungeon.");

            if (isDungeonLocked(dungeon.id)) {
                return msg.reply("🔒 Dungeon has already begun. No more entries allowed.");
            }

            if (await isPlayerInDungeon(userId, dungeon.id)) {
                return msg.reply("⚠️ You are already inside the dungeon.");
            }

            const [count] = await db.execute("SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=?", [dungeon.id]);
            if (count[0].cnt >= 10) return msg.reply("❌ Dungeon is full.");

            await addPlayerToDungeon(userId, dungeon.id);

            return msg.reply(`╭══〘 🏰 DUNGEON ENTRY 〙══╮
┃
┃   👤 ${player[0].nickname.toUpperCase()}
┃   🏰 Rank: ${dungeon.dungeon_rank}
┃   👥 Players: ${count[0].cnt+1}/10
┃
┃━━━━━━━━━━━━━━━━━━━━━━
┃   「 Use !begin to start the raid 」 
╰══════════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Entry failed.");
        }
    }
};