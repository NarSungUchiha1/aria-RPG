const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { getActiveDungeon, isPlayerInDungeon, advanceStage, removePlayerFromDungeon, getMaxStageForDungeon, getDungeonStatusText } = require('../engine/dungeon');
const { resetStageTimer, clearDungeonTimers } = require('../engine/dungeonTimer');

module.exports = {
    name: 'onward',
    async execute(msg, args, { userId, client }) {
        try {
            const dungeon = await getActiveDungeon();
            if (!dungeon) return msg.reply("❌ No active dungeon.");
            if (!dungeon.locked) return msg.reply("❌ Dungeon hasn't started. Use !begin");

            if (!(await isPlayerInDungeon(userId, dungeon.id))) {
                return msg.reply("❌ You are not inside the dungeon.");
            }

            if (!dungeon.stage_cleared) {
                return msg.reply(`══〘 ⚠️ BLOCKED 〙══╮\n┃◆ The path forward is sealed by a lingering malevolence. Defeat all enemies first!\n┃◆ Use !dungeon to check status.\n╰═══════════════════════╯`);
            }

            const maxStage = await getMaxStageForDungeon(dungeon.id);
            
            // Dungeon cleared
            if (dungeon.stage >= maxStage) {
                const [participants] = await db.execute(
                    "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                    [dungeon.id]
                );
                const rewardGold = Math.floor(Math.random() * 300) + 200;
                const rewardXp = Math.floor(Math.random() * 200) + 100;
                
                for (const p of participants) {
                    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [rewardGold, p.player_id]);
                    await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [rewardXp, p.player_id]);
                    await removePlayerFromDungeon(p.player_id, dungeon.id);
                }
                
                await db.execute("UPDATE dungeon SET is_active=0 WHERE id=?", [dungeon.id]);
                clearDungeonTimers(dungeon.id);
                
                return msg.reply(`══〘 👑 DUNGEON CLEARED 〙══╮
┃◆ The chamber falls silent. ${dungeon.boss_name} lies vanquished, its reign of terror ended.
┃◆ Each survivor feels the dungeon's gratitude:
┃◆ 💰 +${rewardGold} Gold   ⭐ +${rewardXp} XP
┃◆ As the exit shimmers into view, you step out into the light.
╰═══════════════════════╯`);
            }

            // Advance to next stage
            const next = dungeon.stage + 1;
            await advanceStage(dungeon.id, next);

            // Reset ONLY the stage timer (overall timer continues)
            const targetChat = await msg.getChat();
            const failCallback = async () => {
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
                clearDungeonTimers(dungeon.id);
                await targetChat.sendMessage(`══〘 💀 STAGE FAILED 〙══╮\n┃◆ Reinforcements have arrived!\n┃◆ The dungeon overwhelms you. You have died.\n╰═══════════════════════╯`);
            };
            
            await resetStageTimer(dungeon.id, client, targetChat, failCallback);

            await msg.reply(`══〘 🧭 STAGE ${next}/${maxStage} 〙══╮
┃◆ The stone door grinds open, revealing a deeper darkness. The air grows colder, and new threats stir in the shadows.
╰═══════════════════════╯`);

            const statusText = await getDungeonStatusText(dungeon.id);
            return msg.reply(statusText);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Onward failed.");
        }
    }
};