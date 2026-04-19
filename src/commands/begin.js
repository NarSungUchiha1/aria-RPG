const db = require('../database/db');
const { getActiveDungeon, lockDungeon, isDungeonLocked, spawnStageEnemies, getDungeonStatusText, removePlayerFromDungeon } = require('../engine/dungeon');
const { startDungeonTimers } = require('../engine/dungeonTimer');

module.exports = {
    name: 'begin',
    async execute(msg, args, { userId, client }) {
        try {
            const dungeon = await getActiveDungeon();
            if (!dungeon) return msg.reply("❌ No active dungeon.");

            if (isDungeonLocked(dungeon.id)) {
                return msg.reply("⚠️ Dungeon has already begun.");
            }

            const [inDungeon] = await db.execute(
                "SELECT * FROM dungeon_players WHERE player_id=? AND dungeon_id=?",
                [userId, dungeon.id]
            );
            if (!inDungeon.length) return msg.reply("❌ You are not inside the dungeon.");

            await lockDungeon(dungeon.id);
            await spawnStageEnemies(dungeon.id, dungeon.dungeon_rank, 1);

            // Start both timers (stage & overall)
            const targetChat = await msg.getChat();
            const failCallback = async (type) => {
                const failMsg = type === 'stage' 
                    ? `══〘 💀 STAGE FAILED 〙══╮\n┃◆ Reinforcements have arrived!\n┃◆ The dungeon overwhelms you. You have died.\n╰═══════════════════════╯`
                    : `══〘 💀 DUNGEON COLLAPSED 〙══╮\n┃◆ The dungeon's energy dissipates!\n┃◆ You are crushed by the collapsing realm. You have died.\n╰═══════════════════════╯`;
                
                const [players] = await db.execute(
                    "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                    [dungeon.id]
                );
                for (const p of players) {
                    // Death penalty: HP = 0
                    await db.execute("UPDATE players SET hp = 0 WHERE id=?", [p.player_id]);
                    await removePlayerFromDungeon(p.player_id, dungeon.id);
                }
                await db.execute("UPDATE dungeon SET is_active=0 WHERE id=?", [dungeon.id]);
                await targetChat.sendMessage(failMsg);
            };
            
            await startDungeonTimers(dungeon.id, client, targetChat, failCallback);

            await msg.reply(`══〘 🏰 DUNGEON BEGINS 〙══╮
┃◆ ⚔️ The gates slam shut!
┃◆ No one may enter or leave.
┃◆ Stage 1/${dungeon.max_stage}
╰═══════════════════════╯`);

            const statusText = await getDungeonStatusText(dungeon.id);
            return msg.reply(statusText);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Failed to begin dungeon.");
        }
    }
};