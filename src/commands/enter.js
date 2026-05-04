const db = require('../database/db');
const {
    getActiveDungeon,
    isPlayerInDungeon,
    addPlayerToDungeon,
    lockDungeon,
    spawnStageEnemies,
    promoteRaider,
    demoteAllRaiders,
    getDungeonEnemyRevealText,
    isDungeonLockedDB,
    autoStartTimers,
    RAID_GROUP
} = require('../engine/dungeon');
const { startDungeonTimers, clearDungeonTimers } = require('../engine/dungeonTimer');

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

        // Build targetChat pointing directly at the raid group
        // (no msg object in auto-start context)
        const targetChat = {
            sendMessage: async (content) => {
                await client.sendMessage(RAID_GROUP, { text: content });
            }
        };

        // ── Stage & overall timers ──
        const failCallback = async (type) => {
            const failMsg = type === 'stage'
                ? `══〘 💀 STAGE FAILED 〙══╮\n┃◆ Reinforcements have arrived!\n┃◆ The dungeon overwhelms you. You have died.\n┃◆ ☠️ All raiders: HP set to 0\n┃◆ 💸 Respawn penalties apply on revival.\n╰═══════════════════════╯`
                : `══〘 💀 DUNGEON COLLAPSED 〙══╮\n┃◆ The dungeon's energy dissipates!\n┃◆ You are crushed by the collapsing realm.\n┃◆ ☠️ All raiders: HP set to 0\n┃◆ 💸 Respawn penalties apply on revival.\n╰═══════════════════════╯`;

            try {
                const [alive] = await db.execute(
                    "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                    [dungeonId]
                );
                for (const p of alive) {
                    await db.execute("UPDATE players SET hp = 0 WHERE id=?", [p.player_id]);
                }
                await demoteAllRaiders(client, dungeonId);
                await db.execute("DELETE FROM dungeon_players WHERE dungeon_id=?", [dungeonId]);
                await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [dungeonId]);
                clearDungeonTimers(dungeonId);
                await targetChat.sendMessage(failMsg);
            } catch (err) {
                console.error("Dungeon fail callback error:", err);
            }
        };

        await startDungeonTimers(dungeonId, client, targetChat, failCallback);

        // ── Message 1: Dungeon begins ──
        await client.sendMessage(RAID_GROUP, {
            text:
                `╭══〘 ⚔️ DUNGEON BEGINS 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ 🚪 The gates slam shut.\n` +
                `┃◆ No one enters. No one leaves.\n` +
                `┃◆ You fight until victory — or death.\n` +
                `┃◆ \n` +
                `┃◆ The air grows heavy. Shadows stir\n` +
                `┃◆ in the depths ahead. Steel yourselves.\n` +
                `┃◆ \n` +
                `┃◆ Stage ${dungeon[0].stage}/${dungeon[0].max_stage}  •  Rank: ${dungeon[0].dungeon_rank}\n` +
                `┃◆ ⏱️ 5 min per stage  •  25 min total\n` +
                `┃◆ \n` +
                `┃◆ ⚠️ Defeat all enemies to advance.\n` +
                `┃◆ Use !skill <move> [enemy #] to fight!\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`
        });

        // ── Message 2: Enemy stats reveal ──
        const revealText = await getDungeonEnemyRevealText(dungeonId);
        if (revealText) {
            await client.sendMessage(RAID_GROUP, { text: revealText });
        }

        // Notify each player in DM
        for (const p of players) {
            try {
                await client.sendMessage(`${p.player_id}@s.whatsapp.net`, {
                    text: `⚔️ The dungeon has begun! Check the dungeon GC for enemies and start fighting!`
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
            // Must be used in DM only (also enforced by index.js routing)
            if (msg.from === RAID_GROUP) {
                return msg.reply(
                    `══〘 🏰 ENTER 〙══╮\n` +
                    `┃◆ ⚠️ Use !enter in the bot's DM,\n` +
                    `┃◆ not in the group.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const [player] = await db.execute(
                "SELECT nickname, hp, max_hp FROM players WHERE id=?",
                [userId]
            );
            if (!player.length) {
                return msg.reply(
                    `══〘 🏰 ENTER 〙══╮\n` +
                    `┃◆ ❌ Not registered.\n` +
                    `┃◆ Use !awaken to get started.\n` +
                    `╰═══════════════════════╯`
                );
            }
            if (player[0].hp <= 0) {
                return msg.reply(
                    `══〘 🏰 ENTER 〙══╮\n` +
                    `┃◆ 💀 You are dead.\n` +
                    `┃◆ Use !respawn to revive first.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const dungeon = await getActiveDungeon();
            if (!dungeon) {
                return msg.reply(
                    `══〘 🏰 ENTER 〙══╮\n` +
                    `┃◆ ❌ No active dungeon right now.\n` +
                    `┃◆ Watch the group for announcements.\n` +
                    `╰═══════════════════════╯`
                );
            }

            // ✅ Check if dungeon is prestige type
            const isPrestigeDungeon = dungeon.dungeon_rank?.startsWith('P');
            const [pCheck] = await db.execute(
                "SELECT COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?", [userId]
            );
            const isPrestigePlayer = (pCheck[0]?.prestige_level || 0) > 0;

            if (isPrestigeDungeon && !isPrestigePlayer) return msg.reply(
                `╔══〘 ✦ PRESTIGE DUNGEON 〙══╗\n` +
                `┃★ ❌ This dungeon is for\n` +
                `┃★ Prestige Hunters only.\n` +
                `┃★ Reach S rank → !prestige confirm\n` +
                `╚═══════════════════════════╝`
            );

            if (!isPrestigeDungeon && isPrestigePlayer) return msg.reply(
                `╔══〘 ✦ PRESTIGE HUNTER 〙══╗\n` +
                `┃★ ❌ You can no longer enter\n` +
                `┃★ normal dungeons.\n` +
                `┃★ Wait for a Prestige dungeon.\n` +
                `╚═══════════════════════════╝`
            );


            // ✅ Rank restriction — players can only enter dungeons ±1 their rank
            if (!isPrestigeDungeon) {
                const RANK_ORDER = ['F','E','D','C','B','A','S'];
                const [playerRankRow] = await db.execute('SELECT `rank` FROM players WHERE id=?', [userId]);
                const playerRank   = playerRankRow[0]?.rank || 'F';
                const dungeonRank  = dungeon.dungeon_rank;
                const playerIdx    = RANK_ORDER.indexOf(playerRank);
                const dungeonIdx   = RANK_ORDER.indexOf(dungeonRank);

                if (dungeonIdx !== -1 && playerIdx !== -1 && Math.abs(dungeonIdx - playerRank) > 1) {
                    // Correct the abs diff to use indices
                }
                if (dungeonIdx !== -1 && playerIdx !== -1 && Math.abs(dungeonIdx - playerIdx) > 1) {
                    const allowed = [
                        RANK_ORDER[playerIdx - 1],
                        RANK_ORDER[playerIdx],
                        RANK_ORDER[playerIdx + 1]
                    ].filter(Boolean).join(', ');
                    return msg.reply(
                        `══〘 🏰 ENTER 〙══╮\n` +
                        `┃◆ ❌ Rank mismatch.\n` +
                        `┃◆ You are rank ${playerRank}. This is a ${dungeonRank} dungeon.\n` +
                        `┃◆ You can enter: ${allowed}\n` +
                        `╰═══════════════════════╯`
                    );
                }
            }
            if (await isDungeonLockedDB(dungeon.id)) {
                return msg.reply(
                    `══〘 🏰 ENTER 〙══╮\n` +
                    `┃◆ 🔒 Dungeon has already begun.\n` +
                    `┃◆ Wait for the next one.\n` +
                    `╰═══════════════════════╯`
                );
            }

            if (await isPlayerInDungeon(userId, dungeon.id)) {
                return msg.reply(
                    `══〘 🏰 ENTER 〙══╮\n` +
                    `┃◆ ⚠️ You are already inside\n` +
                    `┃◆ the dungeon.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const [count] = await db.execute(
                "SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=?",
                [dungeon.id]
            );
            const currentPlayers = count[0].cnt;
            
            // ✅ Raider limit by dungeon rank
            const MAX_RAIDERS = { F:3, E:3, D:4, C:4, B:5, A:5, S:5 };
            const maxRaiders = MAX_RAIDERS[dungeon.dungeon_rank] || 3;
            if (currentPlayers >= maxRaiders) {
                return msg.reply(
                    `══〘 🏰 ENTER 〙══╮\n` +
                    `┃◆ ❌ Dungeon is full (5/5).\n` +
                    `┃◆ Wait for the next one.\n` +
                    `╰═══════════════════════╯`
                );
            }

            // ── STEP 2: Confirmation ──
            if (pendingConfirms.has(userId)) {
                const pending = pendingConfirms.get(userId);

                if (pending.dungeonId !== dungeon.id) {
                    pendingConfirms.delete(userId);
                    return msg.reply(
                        `══〘 🏰 ENTER 〙══╮\n` +
                        `┃◆ ❌ Dungeon changed.\n` +
                        `┃◆ Use !enter again.\n` +
                        `╰═══════════════════════╯`
                    );
                }

                clearTimeout(pending.timer);
                pendingConfirms.delete(userId);

                // ✅ Daily entry limit — bypassed during active event
                const today = new Date().toISOString().split('T')[0];
                let isEvent = false;
                let remaining = 5; // updated after chapter check
                try {
                    const [eventCheck] = await db.execute(
                        "SELECT id FROM events WHERE is_active=1 AND ends_at > NOW() LIMIT 1"
                    );
                    isEvent = eventCheck.length > 0;
                } catch (e) { isEvent = false; }

                if (!isEvent) {
                    // ✅ Get daily limit based on chapter
                    let dailyLimit = 5;
                    try {
                        const { getCurrentChapter } = require('../systems/loreSystem');
                        const ch = await getCurrentChapter();
                        if (ch >= 3) dailyLimit = 15;
                    } catch(e) {}

                    const [entryLog] = await db.execute(
                        "SELECT count FROM dungeon_entry_log WHERE player_id=? AND entry_date=?",
                        [userId, today]
                    );
                    const todayCount = entryLog[0]?.count || 0;
                    remaining = dailyLimit - todayCount;

                    if (todayCount >= dailyLimit) {
                        return msg.reply(
                            `══〘 🏰 DUNGEON ENTRY 〙══╮\n` +
                            `┃◆ ❌ Daily limit reached.\n` +
                            `┃◆ You can only enter ${dailyLimit} dungeons\n` +
                            `┃◆ per day. Come back tomorrow!\n` +
                            `╰═══════════════════════╯`
                        );
                    }
                }

                // Add to dungeon
                await addPlayerToDungeon(userId, dungeon.id);

                // ✅ Log the entry + track quest — fire and forget
                await db.execute(
                    `INSERT INTO dungeon_entry_log (player_id, entry_date, count)
                     VALUES (?, ?, 1)
                     ON DUPLICATE KEY UPDATE count = count + 1`,
                    [userId, today]
                );
                (async () => {
                    try {
                        const { updateQuestProgress } = require('../systems/questSystem');
                        await updateQuestProgress(userId, 'dungeon_enter', 1);
                    } catch (e) {}
                })();
                const newCount = currentPlayers + 1;
                const isFirstPlayer = newCount === 1;

                // Promote to group admin
                await promoteRaider(client, userId);

                // Start auto-start timer if first player
                if (isFirstPlayer && !autoStartTimers.has(dungeon.id)) {
                    const autoTimer = setTimeout(() => {
                        beginDungeon(dungeon.id, client);
                    }, AUTO_START_MINUTES * 60 * 1000);
                    autoStartTimers.set(dungeon.id, autoTimer);
                    console.log(`⏱️ Auto-start timer set for dungeon ${dungeon.id}`);
                }

                // Announce in group
                await client.sendMessage(RAID_GROUP, {
                    text:
                        `╭══〘 ⚔️ RAIDER JOINED 〙══╮\n` +
                        `┃◆ \n` +
                        `┃◆ 👤 ${player[0].nickname} has entered the dungeon!\n` +
                        `┃◆ 👥 Raiders: ${newCount}/5\n` +
                        `┃◆ 🏰 Rank: ${dungeon.dungeon_rank}\n` +
                        `┃◆ \n` +
                        (isFirstPlayer ? `┃◆ ⏱️ Auto-starts in ${AUTO_START_MINUTES} minutes!\n` : '') +
                        `╰═══════════════════════════╯`,
                    mentions: [`${userId}@s.whatsapp.net`]
                });

                // Reply in DM
                return msg.reply(
                    `══〘 🏰 DUNGEON ENTERED 〙══╮\n` +
                    `┃◆ ✅ You have entered!\n` +
                    `┃◆ ⚔️ Rank: ${dungeon.dungeon_rank}\n` +
                    `┃◆ 👥 Raiders: ${newCount}/5\n` +
                    `┃◆ 📅 Entries left today: ${remaining}/15\n` +
                    `┃◆────────────\n` +
                    `┃◆ Get ready before it starts!\n` +
                    `┃◆ 🛒 !shop  •  📦 !equip\n` +
                    `╰═══════════════════════╯`
                );
            }

            // ── STEP 1: Ask to confirm ──
            const today = new Date().toISOString().split('T')[0];
            let isEventActive = false;
            try {
                const [eventRows] = await db.execute(
                    "SELECT id FROM events WHERE is_active=1 AND ends_at > NOW() LIMIT 1"
                );
                isEventActive = eventRows.length > 0;
            } catch (e) { isEventActive = false; }

            let entryLine = '';
            if (isEventActive) {
                entryLine = `┃◆ ♾️ EVENT MODE — No entry limit!\n`;
            } else {
                const [entryLog] = await db.execute(
                    "SELECT count FROM dungeon_entry_log WHERE player_id=? AND entry_date=?",
                    [userId, today]
                );
                const todayCount = entryLog[0]?.count || 0;
                let dl2 = 5; try { const { getCurrentChapter: gch } = require('../systems/loreSystem'); const chNum = await gch(); if (chNum >= 3) dl2 = 15; } catch(e) {} const remaining = dl2 - todayCount;
                entryLine = `┃◆ 📅 Entries left today: ${remaining}/15\n`;
            }

            const confirmTimer = setTimeout(() => {
                pendingConfirms.delete(userId);
            }, 30000);

            pendingConfirms.set(userId, { dungeonId: dungeon.id, timer: confirmTimer });

            return msg.reply(
                `╭══〘 🏰 DUNGEON ALERT 〙══╮\n` +
                `┃◆ Rank: ${dungeon.dungeon_rank}\n` +
                `┃◆ Raiders: ${currentPlayers}/5\n` +
                `${entryLine}` +
                `┃◆────────────\n` +
                `┃◆ ⚠️ Are you ready to enter?\n` +
                `┃◆ Type !enter again to confirm.\n` +
                `┃◆ (Expires in 30 seconds)\n` +
                `┃◆────────────\n` +
                `┃◆ 🛒 Stock up: !shop\n` +
                `┃◆ 📦 Equip gear: !equip\n` +
                `╰═══════════════════════╯`
            );

        } catch (err) {
            console.error("Enter command error:", err);
            msg.reply(
                `══〘 🏰 ENTER 〙══╮\n` +
                `┃◆ ❌ Failed to enter dungeon.\n` +
                `╰═══════════════════════╯`
            );
        }
    }
};