const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { getActiveDungeon, isPlayerInDungeon, addPlayerToDungeon } = require('../engine/dungeon');

// Track auto-start timers per dungeon
const autoStartTimers = new Map();

module.exports = {
    name: 'enter',
    async execute(msg, args, { userId, client }) {
        try {
            const [player] = await db.execute("SELECT nickname FROM players WHERE id=?", [userId]);
            if (!player.length) return msg.reply("❌ Not registered.");

            const dungeon = await getActiveDungeon();
            if (!dungeon) return msg.reply("❌ No active dungeon.");

            // Check if already locked (auto-started)
            if (dungeon.locked) {
                return msg.reply("🔒 Dungeon has already begun. No more entries allowed.");
            }

            if (await isPlayerInDungeon(userId, dungeon.id)) {
                return msg.reply("⚠️ You are already inside the dungeon.");
            }

            const [count] = await db.execute("SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=?", [dungeon.id]);
            if (count[0].cnt >= 10) return msg.reply("❌ Dungeon is full.");

            await addPlayerToDungeon(userId, dungeon.id);

            // Send preparation message to player (DM)
            await msg.reply(`══〘 🏰 PREPARE FOR BATTLE 〙══╮
┃◆ You have entered the dungeon raid.
┃◆ The dungeon will begin in 5 minutes.
┃◆ Stock up on potions and equip your best gear!
┃◆ You will be unable to access the shop once inside.
╰══════════════════════════╯`);

            // Notify the raid group that this player has joined
            if (process.env.ANNOUNCEMENT_GROUP) {
                try {
                    const groupChat = await client.getChatById(process.env.ANNOUNCEMENT_GROUP);
                    const contact = await client.getContactById(userId);
                    await groupChat.sendMessage(
                        `⚔️ ${player[0].nickname} has entered the dungeon!`,
                        { mentions: [contact] }
                    );
                } catch (e) {
                    console.error("Failed to send group join notification:", e);
                }
            }

            // If this is the first player, start the 5-minute auto-start timer
            const currentCount = count[0].cnt + 1;
            if (currentCount === 1 && !autoStartTimers.has(dungeon.id)) {
                const timer = setTimeout(async () => {
                    try {
                        // Re-fetch dungeon to ensure it's still active and not locked
                        const [d] = await db.execute("SELECT * FROM dungeon WHERE id=? AND is_active=1 AND locked=0", [dungeon.id]);
                        if (d.length) {
                            const { lockDungeon, spawnStageEnemies, getDungeonStatusText } = require('../engine/dungeon');
                            await lockDungeon(dungeon.id);
                            await spawnStageEnemies(dungeon.id, dungeon.dungeon_rank, 1);

                            // Send begin announcement to group
                            if (process.env.ANNOUNCEMENT_GROUP) {
                                const groupChat = await client.getChatById(process.env.ANNOUNCEMENT_GROUP);
                                await groupChat.sendMessage(`══〘 🏰 DUNGEON BEGINS 〙══╮
┃◆ ⚔️ The gates slam shut!
┃◆ No one may enter or leave.
┃◆ Stage 1/${dungeon.max_stage}
╰═══════════════════════╯`);
                                const statusText = await getDungeonStatusText(dungeon.id);
                                await groupChat.sendMessage(statusText);
                            }

                            // Also notify each player in DM (optional)
                            const [players] = await db.execute("SELECT player_id FROM dungeon_players WHERE dungeon_id=?", [dungeon.id]);
                            for (const p of players) {
                                try {
                                    const contact = await client.getContactById(p.player_id);
                                    await contact.getChat().then(chat => chat.sendMessage(
                                        `══〘 🏰 DUNGEON BEGINS 〙══╮\n┃◆ The raid has started!\n╰═══════════════════════╯`
                                    ));
                                } catch (e) {}
                            }
                        }
                    } catch (err) {
                        console.error("Auto-start dungeon failed:", err);
                    } finally {
                        autoStartTimers.delete(dungeon.id);
                    }
                }, 5 * 60 * 1000); // 5 minutes

                autoStartTimers.set(dungeon.id, timer);
            }

            return msg.reply(`✅ You have joined the dungeon. The raid will begin in approximately 5 minutes.`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Entry failed.");
        }
    }
};