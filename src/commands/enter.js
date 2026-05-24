const db = require('../database/db');
const { assignDailyQuests } = require('../systems/questSystem');

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

const {
    startDungeonTimers,
    clearDungeonTimers
} = require('../engine/dungeonTimer');

const pendingConfirms = new Map();
const AUTO_START_MINUTES = 5;

async function beginDungeon(dungeonId, client) {
    try {

        const [dungeon] = await db.execute(
            "SELECT * FROM dungeon WHERE id=?",
            [dungeonId]
        );

        if (
            !dungeon.length ||
            !dungeon[0].is_active ||
            dungeon[0].locked
        ) return;

        const dungeonData = dungeon[0];

        const [players] = await db.execute(
            "SELECT player_id FROM dungeon_players WHERE dungeon_id=?",
            [dungeonId]
        );

        if (players.length === 0) {

            await db.execute(
                "UPDATE dungeon SET is_active=0 WHERE id=?",
                [dungeonId]
            );

            autoStartTimers.delete(dungeonId);

            return;
        }

        const { clearLobbyTimer } = require('../engine/dungeon');

        clearLobbyTimer(dungeonId);
        autoStartTimers.delete(dungeonId);

        await lockDungeon(dungeonId);

        const isPrestige =
            dungeonData.dungeon_rank?.startsWith('P');

        const isMalachar =
            dungeonData.dungeon_rank === 'MALACHAR';

        if (isPrestige) {

            const {
                spawnPrestigeEnemies
            } = require('../engine/prestigeDungeon');

            await spawnPrestigeEnemies(
                dungeonId,
                dungeonData.dungeon_rank,
                dungeonData.stage
            );

        } else {

            await spawnStageEnemies(
                dungeonId,
                dungeonData.dungeon_rank,
                dungeonData.stage
            );
        }

        console.log(
            `⚔️ Dungeon ${dungeonId} auto-started with ${players.length} players.`
        );

        const targetChat = {
            sendMessage: async (content) => {
                await client.sendMessage(
                    RAID_GROUP,
                    { text: content }
                );
            }
        };

        const failCallback = async (type) => {

            const failMsg = type === 'stage'
                ? `══〘 💀 STAGE FAILED 〙══╮
┃◆ Reinforcements have arrived!
┃◆ The dungeon overwhelms you.
┃◆ ☠️ All raiders have died.
┃◆ 💸 Respawn penalties apply.
╰═══════════════════════╯`
                : `══〘 💀 DUNGEON COLLAPSED 〙══╮
┃◆ The dungeon collapses inward!
┃◆ ☠️ All raiders have died.
┃◆ 💸 Respawn penalties apply.
╰═══════════════════════╯`;

            try {

                const [alive] = await db.execute(
                    "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                    [dungeonId]
                );

                for (const p of alive) {

                    await db.execute(
                        "UPDATE players SET hp=0 WHERE id=?",
                        [p.player_id]
                    );
                }

                await demoteAllRaiders(client, dungeonId);

                await db.execute(
                    "DELETE FROM dungeon_players WHERE dungeon_id=?",
                    [dungeonId]
                );

                await db.execute(
                    "UPDATE dungeon SET is_active=0, locked=0 WHERE id=?",
                    [dungeonId]
                );

                clearDungeonTimers(dungeonId);

                await targetChat.sendMessage(failMsg);

            } catch (err) {

                console.error(
                    "Dungeon fail callback error:",
                    err
                );
            }
        };

        // ── IMPORTANT FIX ─────────────────────────────
        // DO NOT START TIMERS FOR MALACHAR
        if (!isMalachar) {

            await startDungeonTimers(
                dungeonId,
                client,
                targetChat,
                failCallback,
                dungeonData.dungeon_rank
            );
        }

        // ── START MESSAGE ─────────────────────────────

        let timerText = '';

        if (isMalachar) {

            timerText =
`┃◆ ♾️ No stage timer
┃◆ ♾️ No dungeon collapse
┃◆`;

        } else if (isPrestige) {

            timerText =
`┃◆ ⏱️ 7 min per stage
┃◆ ♾️ No overall limit
┃◆`;

        } else {

            timerText =
`┃◆ ⏱️ 5 min per stage
┃◆ ⏱️ 25 min total
┃◆`;
        }

        await client.sendMessage(RAID_GROUP, {
            text:
`╭══〘 ⚔️ DUNGEON BEGINS 〙══╮
┃◆
┃◆ 🚪 The gates slam shut.
┃◆ No one enters. No one leaves.
┃◆ Fight until victory — or death.
┃◆
┃◆ Stage ${dungeonData.stage}/${dungeonData.max_stage}
┃◆ Rank: ${dungeonData.dungeon_rank}
┃◆
${timerText}
┃◆ ⚠️ Defeat all enemies to advance.
┃◆ Use !skill <move> [enemy #]
┃◆
╰═══════════════════════════╯`
        });

        const revealText =
            await getDungeonEnemyRevealText(dungeonId);

        if (revealText) {

            await client.sendMessage(
                RAID_GROUP,
                { text: revealText }
            );
        }

        for (const p of players) {

            try {

                await client.sendMessage(
                    `${p.player_id}@s.whatsapp.net`,
                    {
                        text:
`⚔️ The dungeon has begun!
Check the raid group and start fighting!`
                    }
                );

            } catch (e) {}
        }

    } catch (err) {

        console.error(
            "Auto-start dungeon error:",
            err
        );
    }
}

module.exports = {

    name: 'enter',

    beginDungeon,

    async execute(msg, args, { userId, client }) {

        try {

            if (msg.from === RAID_GROUP) {

                return msg.reply(
`══〘 🏰 ENTER 〙══╮
┃◆ ⚠️ Use !enter in DM only.
╰═══════════════════════╯`
                );
            }

            const [player] = await db.execute(
                "SELECT nickname, hp, max_hp FROM players WHERE id=?",
                [userId]
            );

            if (!player.length) {

                return msg.reply(
`══〘 🏰 ENTER 〙══╮
┃◆ ❌ You are not registered.
┃◆ Use !awaken first.
╰═══════════════════════╯`
                );
            }

            if (player[0].hp <= 0) {

                return msg.reply(
`══〘 🏰 ENTER 〙══╮
┃◆ 💀 You are dead.
┃◆ Use !respawn first.
╰═══════════════════════╯`
                );
            }

            const dungeon = await getActiveDungeon();

            if (!dungeon) {

                return msg.reply(
`══〘 🏰 ENTER 〙══╮
┃◆ ❌ No active dungeon.
┃◆ Watch the raid group.
╰═══════════════════════╯`
                );
            }

            const isMalachar =
                dungeon.dungeon_rank === 'MALACHAR';

            const [flags] = await db.execute(
                "SELECT unlimited_entry, no_rank_check FROM dungeon_flags WHERE dungeon_id=?",
                [dungeon.id]
            ).catch(() => [[]]);

            const isUnlimited =
                isMalachar || flags[0]?.unlimited_entry === 1;

            const noRankCheck =
                isMalachar || flags[0]?.no_rank_check === 1;

            const isPrestigeDungeon =
                dungeon.dungeon_rank?.startsWith('P');

            const [pCheck] = await db.execute(
                "SELECT COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
                [userId]
            );

            const isPrestigePlayer =
                (pCheck[0]?.prestige_level || 0) > 0;

            if (
                !noRankCheck &&
                isPrestigeDungeon &&
                !isPrestigePlayer
            ) {

                return msg.reply(
`╔══〘 ✦ PRESTIGE DUNGEON 〙══╗
┃★ Prestige Hunters only.
╚═══════════════════════════╝`
                );
            }

            // FIX: Territory dungeons are also allowed for prestige players
            const isTerritoryDungeon = dungeon.dungeon_rank && dungeon.dungeon_rank.startsWith('TERRITORY_');

            if (
                !noRankCheck &&
                !isPrestigeDungeon &&
                !isMalachar &&
                !isTerritoryDungeon &&
                isPrestigePlayer
            ) {

                return msg.reply(
`╔══〘 ✦ PRESTIGE HUNTER 〙══╗
┃★ Prestige Hunters cannot
┃★ enter normal dungeons.
╚═══════════════════════════╝`
                );
            }

            if (
                await isDungeonLockedDB(dungeon.id)
            ) {

                return msg.reply(
`══〘 🏰 ENTER 〙══╮
┃◆ 🔒 Dungeon already started.
╰═══════════════════════╯`
                );
            }

            if (
                await isPlayerInDungeon(
                    userId,
                    dungeon.id
                )
            ) {

                return msg.reply(
`══〘 🏰 ENTER 〙══╮
┃◆ ⚠️ You are already inside.
╰═══════════════════════╯`
                );
            }

            const [count] = await db.execute(
                "SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=?",
                [dungeon.id]
            );

            const currentPlayers =
                count[0].cnt;

            const MAX_RAIDERS = {
                // Normal dungeons
                F:3, E:3, D:4, C:4, B:5, A:5, S:5,
                // Prestige dungeons
                PF:3, PE:4, PD:4, PC:4, PB:5, PA:5, PS:7
            };

            const maxRaiders =
                MAX_RAIDERS[dungeon.dungeon_rank] || 3;

            if (
                !isUnlimited &&
                currentPlayers >= maxRaiders
            ) {

                return msg.reply(
`══〘 🏰 ENTER 〙══╮
┃◆ ❌ Dungeon is full.
╰═══════════════════════╯`
                );
            }

            if (pendingConfirms.has(userId)) {

                const pending =
                    pendingConfirms.get(userId);

                if (
                    pending.dungeonId !== dungeon.id
                ) {

                    pendingConfirms.delete(userId);

                    return msg.reply(
`══〘 🏰 ENTER 〙══╮
┃◆ ❌ Dungeon changed.
┃◆ Use !enter again.
╰═══════════════════════╯`
                    );
                }

                clearTimeout(pending.timer);
                pendingConfirms.delete(userId);

                const today =
                    new Date()
                    .toISOString()
                    .split('T')[0];

                let isEvent = false;
                let remaining = 5;

                try {

                    const [eventCheck] =
                        await db.execute(
                            "SELECT id FROM events WHERE is_active=1 AND ends_at > NOW() LIMIT 1"
                        );

                    isEvent =
                        eventCheck.length > 0;

                } catch (e) {}

                if (
                    !isEvent &&
                    !isUnlimited
                ) {

                    const dailyLimit = 5;

                    const [entryLog] =
                        await db.execute(
                            "SELECT count FROM dungeon_entry_log WHERE player_id=? AND entry_date=?",
                            [userId, today]
                        );

                    const todayCount =
                        entryLog[0]?.count || 0;

                    remaining =
                        dailyLimit - todayCount;

                    if (
                        todayCount >= dailyLimit
                    ) {

                        return msg.reply(
`══〘 🏰 ENTRY LIMIT 〙══╮
┃◆ ❌ Daily limit reached.
┃◆ Come back tomorrow.
╰═══════════════════════╯`
                        );
                    }
                }

                await addPlayerToDungeon(
                    userId,
                    dungeon.id
                );

                await db.execute(
`INSERT INTO dungeon_entry_log
(player_id, entry_date, count)
VALUES (?, ?, 1)
ON DUPLICATE KEY UPDATE
count = count + 1`,
                    [
                        userId,
                        today
                    ]
                );

                (async () => {

                    try {

                        const {
                            updateQuestProgress
                        } = require('../systems/questSystem');

                        await updateQuestProgress(
                            userId,
                            'dungeon_enter',
                            1
                        );

                    } catch (e) {}

                })();

                const newCount =
                    currentPlayers + 1;

                const isFirstPlayer =
                    newCount === 1;

                await promoteRaider(
                    client,
                    userId
                );

                assignDailyQuests(userId)
                    .catch(() => {});

                if (
                    isFirstPlayer &&
                    !autoStartTimers.has(dungeon.id)
                ) {

                    const autoTimer =
                        setTimeout(() => {

                            beginDungeon(
                                dungeon.id,
                                client
                            );

                        }, AUTO_START_MINUTES * 60 * 1000);

                    autoStartTimers.set(
                        dungeon.id,
                        autoTimer
                    );
                }

                await client.sendMessage(
                    RAID_GROUP,
                    {
                        text:
`╭══〘 ⚔️ RAIDER JOINED 〙══╮
┃◆ 👤 ${player[0].nickname}
┃◆ 👥 Raiders:
┃◆ ${newCount}/${isUnlimited ? '∞' : maxRaiders}
┃◆ 🏰 Rank:
┃◆ ${dungeon.dungeon_rank}
${isFirstPlayer
? `┃◆ ⏱️ Auto-starts in ${AUTO_START_MINUTES} mins\n`
: ''}
╰═══════════════════════════╯`,
                        mentions: [
                            `${userId}@s.whatsapp.net`
                        ]
                    }
                );

                return msg.reply(
`══〘 🏰 DUNGEON ENTERED 〙══╮
┃◆ ✅ Entry successful.
┃◆ ⚔️ Rank:
┃◆ ${dungeon.dungeon_rank}
┃◆ 👥 Raiders:
┃◆ ${newCount}/${isUnlimited ? '∞' : maxRaiders}
${isUnlimited
? `┃◆ ♾️ Unlimited entries active!\n`
: `┃◆ 📅 Entries left today: ${remaining}/5\n`}
┃◆────────────
┃◆ 🛒 !shop
┃◆ 📦 !equip
╰═══════════════════════╯`
                );
            }

            const today =
                new Date()
                .toISOString()
                .split('T')[0];

            let isEventActive = false;

            try {

                const [eventRows] =
                    await db.execute(
                        "SELECT id FROM events WHERE is_active=1 AND ends_at > NOW() LIMIT 1"
                    );

                isEventActive =
                    eventRows.length > 0;

            } catch (e) {}

            let entryLine = '';

            if (
                isEventActive ||
                isUnlimited
            ) {

                entryLine =
`┃◆ ♾️ Unlimited entries active!
`;

            } else {

                const [entryLog] =
                    await db.execute(
                        "SELECT count FROM dungeon_entry_log WHERE player_id=? AND entry_date=?",
                        [userId, today]
                    );

                const todayCount =
                    entryLog[0]?.count || 0;

                const remaining =
                    5 - todayCount;

                entryLine =
`┃◆ 📅 Entries left today:
┃◆ ${remaining}/5
`;
            }

            const confirmTimer =
                setTimeout(() => {

                    pendingConfirms.delete(userId);

                }, 30000);

            pendingConfirms.set(
                userId,
                {
                    dungeonId: dungeon.id,
                    timer: confirmTimer
                }
            );

            return msg.reply(
`╭══〘 🏰 DUNGEON ALERT 〙══╮
┃◆ Rank:
┃◆ ${dungeon.dungeon_rank}
┃◆ Raiders:
┃◆ ${currentPlayers}/${isUnlimited ? '∞' : maxRaiders}
${entryLine}
┃◆────────────
┃◆ Type !enter again
┃◆ to confirm entry.
┃◆ Expires in 30 sec.
┃◆────────────
┃◆ 🛒 !shop
┃◆ 📦 !equip
╰═══════════════════════╯`
            );

        } catch (err) {

            console.error(
                "Enter command error:",
                err
            );

            return msg.reply(
`══〘 🏰 ENTER 〙══╮
┃◆ ❌ Failed to enter dungeon.
╰═══════════════════════╯`
            );
        }
    }
};