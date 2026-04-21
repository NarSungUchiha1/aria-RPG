const db = require('../database/db');
const {
    getActiveDungeon,
    isPlayerInDungeon,
    addPlayerToDungeon,
    lockDungeon,
    spawnStageEnemies,
    promoteRaider,
    demoteAllRaiders,
    autoStartTimers,
    RAID_GROUP
} = require('../engine/dungeon');

const pendingConfirms = new Map();
const AUTO_START_MINUTES = 5;

async function beginDungeon(dungeonId, client) {
    try {
        const [dungeon] = await db.execute("SELECT * FROM dungeon WHERE id=?", [dungeonId]);
        if (!dungeon.length || dungeon[0].locked) return;

        const [players] = await db.execute(
            "SELECT player_id FROM dungeon_players WHERE dungeon_id=?",
            [dungeonId]
        );

        if (players.length === 0) {
            await db.execute("UPDATE dungeon SET is_active=0 WHERE id=?", [dungeonId]);
            autoStartTimers.delete(dungeonId);
            return;
        }

        await lockDungeon(dungeonId);
        await spawnStageEnemies(dungeonId, dungeon[0].dungeon_rank, dungeon[0].stage);
        autoStartTimers.delete(dungeonId);

        console.log(`⚔️ Dungeon ${dungeonId} auto-started with ${players.length} players.`);

        // Notify group
        await client.sendMessage(RAID_GROUP, {
            text: `╭══〘 ⚔️ DUNGEON BEGINS 〙══╮\n┃◆ \n┃◆ The raid has started!\n┃◆ Raiders — use !dungeon to see enemies.\n┃◆ Use !skill or !attack to fight!\n┃◆ \n╰═══════════════════════════╯`
        });

        // Notify each player in DM
        for (const p of players) {
            try {
                await client.sendMessage(`${p.player_id}@s.whatsapp.net`, {
                    text: `⚔️ The dungeon has begun! Use !dungeon to see enemies and start fighting!`
                });
            } catch (e) {}
        }
    } catch (err) {
        console.error("Auto-start dungeon error:", err);
    }
}

module.exports = {
    name: 'enter',
    beginDungeon,
    async execute(msg, args, { userId, client }) {
        try {
            // Must be used in DM only
            if (msg.from === RAID_GROUP) {
                return msg.reply("⚠️ Use !enter in the bot's DM, not in the group.");
            }

            const [player] = await db.execute(
                "SELECT nickname, hp, max_hp FROM players WHERE id=?",
                [userId]
            );
            if (!player.length) return msg.reply("❌ Not registered. Use !awaken");
            if (player[0].hp <= 0) return msg.reply("💀 You are dead. Use !respawn first.");

            const dungeon = await getActiveDungeon();
            if (!dungeon) return msg.reply("❌ No active dungeon right now. Watch the group for announcements.");

            if (dungeon.locked) {
                return msg.reply("🔒 Dungeon has already begun. Wait for the next one.");
            }

            if (await isPlayerInDungeon(userId, dungeon.id)) {
                return msg.reply("⚠️ You are already inside the dungeon.");
            }

            const [count] = await db.execute(
                "SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=?",
                [dungeon.id]
            );
            const currentPlayers = count[0].cnt;
            if (currentPlayers >= 5) return msg.reply("❌ Dungeon is full (5/5).");

            // ── STEP 2: Confirmation ──
            if (pendingConfirms.has(userId)) {
                const pending = pendingConfirms.get(userId);

                if (pending.dungeonId !== dungeon.id) {
                    pendingConfirms.delete(userId);
                    return msg.reply("❌ Dungeon changed. Use !enter again.");
                }

                clearTimeout(pending.timer);
                pendingConfirms.delete(userId);

                // Add to dungeon
                await addPlayerToDungeon(userId, dungeon.id);
                const newCount = currentPlayers + 1;
                const isFirstPlayer = newCount === 1;

                // Promote to group admin
                await promoteRaider(client, userId);

                // Start auto-timer if first player
                if (isFirstPlayer && !autoStartTimers.has(dungeon.id)) {
                    const autoTimer = setTimeout(() => {
                        beginDungeon(dungeon.id, client);
                    }, AUTO_START_MINUTES * 60 * 1000);
                    autoStartTimers.set(dungeon.id, autoTimer);
                    console.log(`⏱️ Auto-start timer set for dungeon ${dungeon.id}`);
                }

                // Announce in group
                await client.sendMessage(RAID_GROUP, {
                    text: `╭══〘 ⚔️ RAIDER JOINED 〙══╮\n┃◆ \n┃◆ 👤 ${player[0].nickname} has entered the dungeon!\n┃◆ 👥 Raiders: ${newCount}/5\n┃◆ 🏰 Rank: ${dungeon.dungeon_rank}\n┃◆ \n${isFirstPlayer ? `┃◆ ⏱️ Auto-starts in ${AUTO_START_MINUTES} minutes!\n` : ''}╰═══════════════════════════╯`,
                    mentions: [`${userId}@s.whatsapp.net`]
                });

                // Reply in DM
                return msg.reply(`✅ You have entered the dungeon!\n\n⚔️ Rank: ${dungeon.dungeon_rank}\n👥 Raiders: ${newCount}/5\n\nGet ready — stock up and equip your gear!\n🛒 !shop • 📦 !equip`);
            }

            // ── STEP 1: Ask to confirm ──
            const confirmTimer = setTimeout(() => {
                pendingConfirms.delete(userId);
            }, 30000);

            pendingConfirms.set(userId, { dungeonId: dungeon.id, timer: confirmTimer });

            return msg.reply(`╭══〘 🏰 DUNGEON ALERT 〙══╮
┃◆ Rank: ${dungeon.dungeon_rank}
┃◆ Raiders: ${currentPlayers}/5
┃◆────────────
┃◆ ⚠️ Are you ready to enter?
┃◆ Type !enter again to confirm.
┃◆ (Expires in 30 seconds)
┃◆────────────
┃◆ 🛒 Stock up: !shop
┃◆ 📦 Equip gear: !equip
╰═══════════════════════╯`);

        } catch (err) {
            console.error("Enter command error:", err);
            msg.reply("❌ Failed to enter dungeon.");
        }
    }
};