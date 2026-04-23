const db = require('../database/db');
const { RAID_GROUP } = require('../engine/dungeon');

// ── Event Config ──────────────────────────────────────────────────────────────
const EVENT_NAME      = 'The Void Fracture';
const EVENT_ITEM      = 'Void Shard';
const REQUIRED_SHARDS = 5;
const DROP_CHANCE     = 0.10;  // 10/100 — one shard per ~20 cleared dungeons
const EVENT_HOURS     = 24;

// ── DB Setup ──────────────────────────────────────────────────────────────────
async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS events (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            name       VARCHAR(100) NOT NULL,
            is_active  TINYINT DEFAULT 1,
            ends_at    DATETIME NOT NULL,
            created_at DATETIME DEFAULT NOW()
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS event_progress (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            event_id     INT NOT NULL,
            player_id    VARCHAR(50) NOT NULL,
            shards       INT DEFAULT 0,
            completed    TINYINT DEFAULT 0,
            completed_at DATETIME NULL,
            UNIQUE KEY unique_player_event (event_id, player_id)
        )
    `).catch(() => {});
}

// ── Helpers (exported for other files) ───────────────────────────────────────
async function getActiveEvent() {
    const [rows] = await db.execute(
        "SELECT * FROM events WHERE is_active=1 AND ends_at > NOW() ORDER BY id DESC LIMIT 1"
    );
    return rows[0] || null;
}

/**
 * Called from onward.js when a dungeon is FULLY cleared (boss stage done).
 * One roll for the whole dungeon — if it hits, every surviving player gets a shard.
 */
async function handleShardDrop(dungeonId, client) {
    const event = await getActiveEvent();
    if (!event) return;

    // ✅ One roll for the entire dungeon
    const roll = Math.random();
    if (roll > DROP_CHANCE) return; // No shard this run

    // Get all surviving players in this dungeon
    const [survivors] = await db.execute(
        `SELECT dp.player_id, p.nickname
         FROM dungeon_players dp
         JOIN players p ON p.id = dp.player_id
         WHERE dp.dungeon_id = ? AND dp.is_alive = 1`,
        [dungeonId]
    );
    if (!survivors.length) return;

    const names = survivors.map(s => `*${s.nickname}*`).join(', ');

    // Give every survivor a shard
    for (const s of survivors) {
        await db.execute(
            `INSERT INTO event_progress (event_id, player_id, shards)
             VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE shards = shards + 1`,
            [event.id, s.player_id]
        );

                // ✅ Track for quests — fire and forget
                (async () => {
                    try {
                        const { updateQuestProgress } = require('./questSystem');
                        await updateQuestProgress(s.player_id, 'shard_collect', 1, client);
                    } catch (e) {}
                })();

        // Check if this player just completed the event
        const [progress] = await db.execute(
            "SELECT shards, completed FROM event_progress WHERE event_id=? AND player_id=?",
            [event.id, s.player_id]
        );
        const current   = progress[0]?.shards || 0;
        const completed = progress[0]?.completed || 0;

        if (current >= REQUIRED_SHARDS && !completed) {
            await db.execute(
                "UPDATE event_progress SET completed=1, completed_at=NOW() WHERE event_id=? AND player_id=?",
                [event.id, s.player_id]
            );

            // Announce individual completion in GC
            await client.sendMessage(RAID_GROUP, {
                text:
                    `╭══〘 💠 VOID FRACTURE — COMPLETE 〙══╮\n` +
                    `┃◆ \n` +
                    `┃◆ ⚡ *${s.nickname}* has gathered\n` +
                    `┃◆ all ${REQUIRED_SHARDS} Void Shards!\n` +
                    `┃◆ \n` +
                    `┃◆ The void trembles at their resolve.\n` +
                    `┃◆ A true adventurer emerges.\n` +
                    `┃◆ \n` +
                    `┃◆ 🏆 Awaiting the final reckoning.\n` +
                    `┃◆ \n` +
                    `╰═══════════════════════════╯`
            });
        }
    }

    // ✅ Announce shard found to the whole group — team discovery
    const teamSize = survivors.length;
    await client.sendMessage(RAID_GROUP, {
        text:
            `══〘 💠 VOID SHARD FOUND 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ ✨ A Void Shard tears free from\n` +
            `┃◆ the defeated enemies!\n` +
            `┃◆ \n` +
            `┃◆ The whole party stumbled upon it.\n` +
            `┃◆ ${teamSize > 1 ? `All ${teamSize} raiders claim it!` : `${survivors[0].nickname} claims it!`}\n` +
            `┃◆ \n` +
            `┃◆ 👥 ${names}\n` +
            `┃◆ each gain 💠 +1 Void Shard\n` +
            `┃◆ \n` +
            `┃◆ The void does not yield easily.\n` +
            `┃◆ Keep hunting.\n` +
            `┃◆ \n` +
            `╰═══════════════════════╯`
    });
}

// ── Main Command ──────────────────────────────────────────────────────────────
module.exports = {
    name: 'event',
    getActiveEvent,
    handleShardDrop,
    EVENT_ITEM,
    REQUIRED_SHARDS,
    DROP_CHANCE,

    async execute(msg, args, { isAdmin, client }) {
        await ensureTables();

        if (!isAdmin) {
            return msg.reply(
                `══〘 💠 EVENT 〙══╮\n` +
                `┃◆ ❌ Admin only.\n` +
                `╰═══════════════════════╯`
            );
        }

        // Block if already running
        const existing = await getActiveEvent();
        if (existing) {
            const timeLeft = Math.max(0, new Date(existing.ends_at) - Date.now());
            const hours    = Math.floor(timeLeft / (60 * 60 * 1000));
            const minutes  = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
            return msg.reply(
                `══〘 💠 EVENT 〙══╮\n` +
                `┃◆ ⚠️ Event already active.\n` +
                `┃◆ "${existing.name}"\n` +
                `┃◆ ⏳ Ends in: ${hours}h ${minutes}m\n` +
                `╰═══════════════════════╯`
            );
        }

        // Create event
        const endsAt = new Date(Date.now() + EVENT_HOURS * 60 * 60 * 1000);
        await db.execute(
            "INSERT INTO events (name, is_active, ends_at) VALUES (?, 1, ?)",
            [EVENT_NAME, endsAt]
        );

        await msg.reply(
            `══〘 💠 EVENT LAUNCHED 〙══╮\n` +
            `┃◆ ✅ ${EVENT_NAME} is now live.\n` +
            `┃◆ ⏳ Duration: ${EVENT_HOURS} hours\n` +
            `┃◆ Announcement sent to the group.\n` +
            `╰═══════════════════════╯`
        );

        // ── Grand announcement ────────────────────────────────────────────────
        await client.sendMessage(RAID_GROUP, {
            text:
                `╭══〘 ⚡ SYSTEM ALERT — ARIA 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ ════ LORE ════\n` +
                `┃◆ \n` +
                `┃◆ Long before the first adventurer\n` +
                `┃◆ ever awakened, a god fell.\n` +
                `┃◆ \n` +
                `┃◆ The Void Weaver — an ancient\n` +
                `┃◆ entity that consumed entire\n` +
                `┃◆ dimensions ,was shattered by\n` +
                `┃◆ a force even ARIA cannot name.\n` +
                `┃◆ Its remains drifted across the\n` +
                `┃◆ rift between worlds, crystallising\n` +
                `┃◆ into fragments of pure void\n` +
                `┃◆ energy — the Void Shards.\n` +
                `┃◆ \n` +
                `┃◆ Today, the rift cracks open.\n` +
                `┃◆ The shards are bleeding into\n` +
                `┃◆ every dungeon realm at once.\n` +
                `┃◆ The monsters have absorbed\n` +
                `┃◆ their energy stronger, faster,\n` +
                `┃◆ more numerous than ever before.\n` +
                `┃◆ \n` +
                `┃◆ Whoever gathers these shards\n` +
                `┃◆ claims a piece of a fallen god.\n` +
                `┃◆ \n` +
                `┃◆ ════ 💠 THE VOID FRACTURE ════\n` +
                `┃◆ \n` +
                `┃◆ ━━ 📋 CONDITIONS ━━\n` +
                `┃◆ 💠 Collect ${REQUIRED_SHARDS} Void Shards\n` +
                `┃◆ 🎲 ${DROP_CHANCE * 100}/100 drop chance\n` +
                `┃◆    per dungeon fully cleared\n` +
                `┃◆ ♾️ No daily entry limit\n` +
                `┃◆ ⚔️ 5+ enemies per stage\n` +
                `┃◆ 👹 Bosses are empowered\n` +
                `┃◆ 🏰 Dungeons spawn every 20 min\n` +
                `┃◆ ⏳ Event ends in ${EVENT_HOURS} hours\n` +
                `┃◆ \n` +
                `┃◆ ━━ 🏆 REWARDS ━━\n` +
                `┃◆ Massive gold, XP & SP for all\n` +
                `┃◆ who complete the hunt.\n` +
                `┃◆ A ranked leaderboard drops\n` +
                `┃◆ when the event closes.\n` +
                `┃◆ \n` +
                `┃◆ The void does not wait.\n` +
                `┃◆ Use !enter. Start hunting.\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`
        });
    }
};