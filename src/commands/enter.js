const db = require('../database/db');
const { 
    getActiveDungeon, 
    isPlayerInDungeon, 
    addPlayerToDungeon,
    lockDungeon,
    spawnStageEnemies,
    autoStartTimers
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

        if (client) {
            for (const p of players) {
                try {
                    const jid = p.player_id + '@s.whatsapp.net';
                    await client.sendMessage(jid, { 
                        text: `⚔️ The dungeon has begun! Use !dungeon to see enemies and !skill or !attack to fight!` 
                    });
                } catch (e) {}
            }
        }
    } catch (err) {
        console.error("Auto-start dungeon error:", err);
    }
}

module.exports = {
    name: 'enter',
    async execute(msg, args, { userId, client }) {
        try {
            const [player] = await db.execute(
                "SELECT nickname, hp, max_hp FROM players WHERE id=?", 
                [userId]
            );
            if (!player.length) return msg.reply("❌ Not registered. Use !awaken");
            if (player[0].hp <= 0) return msg.reply("💀 You are dead. Use !respawn first.");

            const dungeon = await getActiveDungeon();
            if (!dungeon) return msg.reply("❌ No active dungeon right now.");

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
            if (currentPlayers >= 10) return msg.reply("❌ Dungeon is full (10/10).");

            // ── STEP 2: Confirmation received ──
            if (pendingConfirms.has(userId)) {
                const pending = pendingConfirms.get(userId);

                if (pending.dungeonId !== dungeon.id) {
                    pendingConfirms.delete(userId);
                    return msg.reply("❌ Dungeon changed. Use !enter again.");
                }

                clearTimeout(pending.timer);
                pendingConfirms.delete(userId);

                // Add player to dungeon
                await addPlayerToDungeon(userId, dungeon.id);
                const newCount = currentPlayers + 1;
                const isFirstPlayer = newCount === 1;

                // ── PROMOTE TO GROUP ADMIN ──
                if (process.env.ANNOUNCEMENT_GROUP) {
                    try {
                        const groupJid = process.env.ANNOUNCEMENT_GROUP;
                        const participantJid = `${userId}@s.whatsapp.net`;

                        // Baileys way to promote
                        await client.groupParticipantsUpdate(groupJid, [participantJid], 'promote');

                        // Announce in group
                        await client.sendMessage(groupJid, {
                            text: `╭══〘 ⚔️ RAIDER PROMOTED 〙══╮\n┃◆ \n┃◆ ${player[0].nickname} has been granted\n┃◆ admin for the dungeon raid!\n┃◆ \n╰═══════════════════════════╯`
                        });

                        console.log(`👑 Promoted ${userId} to admin in group`);
                    } catch (e) {
                        console.error("Failed to promote player:", e.message);
                    }
                }

                // ── START AUTO-TIMER if first player ──
                if (isFirstPlayer && !autoStartTimers.has(dungeon.id)) {
                    const autoTimer = setTimeout(() => {
                        beginDungeon(dungeon.id, client);
                    }, AUTO_START_MINUTES * 60 * 1000);

                    autoStartTimers.set(dungeon.id, autoTimer);
                    console.log(`⏱️ Auto-start timer set for dungeon ${dungeon.id} (${AUTO_START_MINUTES} min)`);
                }

                const timerMsg = isFirstPlayer 
                    ? `┃◆ ⏱️ Auto-starts in ${AUTO_START_MINUTES} minutes!\n┃◆ Or use !begin to start early.`
                    : `┃◆ ⏱️ Dungeon starts in ${AUTO_START_MINUTES} min or when leader uses !begin.`;

                return msg.reply(`╭══〘 ⚔️ DUNGEON ENTERED 〙══╮
┃◆ 👤 ${player[0].nickname} has entered!
┃◆ ❤️ HP: ${player[0].hp}/${player[0].max_hp}
┃◆────────────
┃◆ 👥 Players: ${newCount}/10
┃◆ 🏰 Dungeon Rank: ${dungeon.dungeon_rank}
┃◆────────────
${timerMsg}
┃◆────────────
┃◆ 📦 Equip your gear: !equip
┃◆ 🛒 Stock potions now — shop closes on start!
╰═══════════════════════╯`);
            }

            // ── STEP 1: Show dungeon info and ask to confirm ──
            const [enemies] = await db.execute(
                "SELECT name FROM dungeon_enemies WHERE dungeon_id=? LIMIT 3",
                [dungeon.id]
            );

            const timerRunning = autoStartTimers.has(dungeon.id);

            const enemyPreview = enemies.length
                ? enemies.map(e => `┃◆   👹 ${e.name}`).join('\n')
                : '┃◆   👹 Unknown enemies lurk inside...';

            const confirmTimer = setTimeout(() => {
                pendingConfirms.delete(userId);
            }, 30000);

            pendingConfirms.set(userId, { dungeonId: dungeon.id, timer: confirmTimer });

            return msg.reply(`╭══〘 🏰 DUNGEON ALERT 〙══╮
┃◆ Rank: ${dungeon.dungeon_rank}
┃◆ Players Inside: ${currentPlayers}/10
┃◆────────────
┃◆ ENEMIES:
${enemyPreview}
┃◆────────────
${timerRunning 
    ? `┃◆ ⏱️ Dungeon is about to begin!\n┃◆ ⚠️ Enter quickly!` 
    : `┃◆ ⏱️ Auto-starts ${AUTO_START_MINUTES} min after first player enters`}
┃◆────────────
┃◆ ⚠️ Type !enter again to confirm entry.
┃◆ (Confirmation expires in 30 seconds)
╰═══════════════════════╯`);

        } catch (err) {
            console.error("Enter command error:", err);
            msg.reply("❌ Failed to enter dungeon.");
        }
    }
};