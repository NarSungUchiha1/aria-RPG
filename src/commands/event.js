const db = require('../database/db');
const { RAID_GROUP } = require('../engine/dungeon');
const { tagAll } = require('../utils/tagAll');

const EVENT_NAME      = 'The Void Fracture';
const EVENT_ITEM      = 'Void Shard';
const REQUIRED_SHARDS = 5;
const DROP_CHANCE     = 0.05;
const EVENT_HOURS     = 24;

// ── Rewards by placement ──────────────────────────────────────────────────────
const PLACEMENT_REWARDS = [
    { gold: 10000, xp: 5000, sp: 25, title: 'Void Keeper' },  // 1st
    { gold:  6000, xp: 3000, sp: 15, title: 'Shard Hunter' }, // 2nd
    { gold:  3000, xp: 1500, sp: 10, title: 'Void Walker' },  // 3rd
    { gold:  1000, xp:  500, sp:  5, title: null },            // 4th+
];

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

// ── Helpers ───────────────────────────────────────────────────────────────────
async function getActiveEvent() {
    const [rows] = await db.execute(
        "SELECT * FROM events WHERE is_active=1 AND ends_at > NOW() ORDER BY id DESC LIMIT 1"
    );
    return rows[0] || null;
}

// ── End Event — leaderboard + rewards ─────────────────────────────────────────
async function endEvent(eventId, client) {
    await db.execute("UPDATE events SET is_active=0 WHERE id=?", [eventId]);

    const [leaderboard] = await db.execute(
        `SELECT ep.player_id, ep.shards, p.nickname
         FROM event_progress ep
         JOIN players p ON p.id = ep.player_id
         WHERE ep.event_id = ?
         ORDER BY ep.shards DESC`,
        [eventId]
    );

    if (!leaderboard.length) {
        await client.sendMessage(RAID_GROUP, {
            text:
                `══〘 💠 VOID FRACTURE — ENDED 〙══╮\n` +
                `┃◆ The rift has sealed.\n` +
                `┃◆ No Void Shards were collected.\n` +
                `┃◆ The void retreats... for now.\n` +
                `╰═══════════════════════════╯`
        });
        return;
    }

    // Distribute rewards
    for (let i = 0; i < leaderboard.length; i++) {
        const entry   = leaderboard[i];
        const rewards = PLACEMENT_REWARDS[Math.min(i, PLACEMENT_REWARDS.length - 1)];
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [rewards.gold, entry.player_id]);
        await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?",          [rewards.xp,   entry.player_id]);
        if (rewards.sp)    await db.execute("UPDATE players SET sp = sp + ? WHERE id=?",    [rewards.sp,    entry.player_id]);
        if (rewards.title) await db.execute("UPDATE players SET title=? WHERE id=?",        [rewards.title, entry.player_id]);
    }

    // Build leaderboard announcement
    const { mentions } = await tagAll(client);

    let text =
        `╭══〘 💠 VOID FRACTURE — CLOSED 〙══╮\n` +
        `┃◆ \n` +
        `┃◆ The rift seals. The void recedes.\n` +
        `┃◆ Those who hunted in the dark\n` +
        `┃◆ now claim their power.\n` +
        `┃◆ \n` +
        `┃◆ ━━ 🏆 FINAL LEADERBOARD ━━\n`;

    leaderboard.forEach((entry, i) => {
        const medal   = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
        const rewards = PLACEMENT_REWARDS[Math.min(i, PLACEMENT_REWARDS.length - 1)];
        text +=
            `┃◆ ${medal} ${entry.nickname}\n` +
            `┃◆    💠 ${entry.shards}/${REQUIRED_SHARDS} Shards\n` +
            `┃◆    💰 +${rewards.gold}  ⭐ +${rewards.xp}  ✨ +${rewards.sp} SP\n`;
        if (rewards.title) text += `┃◆    🎖️ Title: "${rewards.title}"\n`;
    });

    text +=
        `┃◆ \n` +
        `╰═══════════════════════════╯`;

    await client.sendMessage(RAID_GROUP, { text, mentions });
}

// ── Shard Drop ────────────────────────────────────────────────────────────────
async function handleShardDrop(dungeonId, client) {
    const event = await getActiveEvent();
    if (!event) return;

    const roll = Math.random();
    if (roll > DROP_CHANCE) return;

    const [survivors] = await db.execute(
        `SELECT dp.player_id, p.nickname
         FROM dungeon_players dp
         JOIN players p ON p.id = dp.player_id
         WHERE dp.dungeon_id=? AND dp.is_alive=1`,
        [dungeonId]
    );
    if (!survivors.length) return;

    const names    = survivors.map(s => `*${s.nickname}*`).join(', ');
    const teamSize = survivors.length;

    for (const s of survivors) {
        await db.execute(
            `INSERT INTO event_progress (event_id, player_id, shards)
             VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE shards = shards + 1`,
            [event.id, s.player_id]
        );

        (async () => {
            try {
                const { updateQuestProgress } = require('../systems/questSystem');
                await updateQuestProgress(s.player_id, 'shard_collect', 1, client);
            } catch (e) {}
        })();

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
            await client.sendMessage(RAID_GROUP, {
                text:
                    `╭══〘 💠 VOID FRACTURE — COMPLETE 〙══╮\n` +
                    `┃◆ \n` +
                    `┃◆ ⚡ *${s.nickname}* has gathered\n` +
                    `┃◆ all ${REQUIRED_SHARDS} Void Shards!\n` +
                    `┃◆ \n` +
                    `┃◆ The void trembles at their resolve.\n` +
                    `┃◆ 🏆 Awaiting the final reckoning.\n` +
                    `┃◆ \n` +
                    `╰═══════════════════════════╯`
            });
        }
    }

    // Team shard found announcement
    await client.sendMessage(RAID_GROUP, {
        text:
            `══〘 💠 VOID SHARD FOUND 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ ✨ A Void Shard tears free!\n` +
            `┃◆ \n` +
            `┃◆ ${teamSize > 1 ? `All ${teamSize} raiders claim it!` : `${survivors[0].nickname} claims it!`}\n` +
            `┃◆ 👥 ${names}\n` +
            `┃◆ each gain 💠 +1 Void Shard\n` +
            `┃◆ \n` +
            `╰═══════════════════════╯`
    });
}

// ── Main Command ──────────────────────────────────────────────────────────────
module.exports = {
    name: 'event',
    getActiveEvent,
    handleShardDrop,
    endEvent,
    EVENT_ITEM,
    REQUIRED_SHARDS,
    DROP_CHANCE,

    async execute(msg, args, { isAdmin, client }) {
        await ensureTables();

        if (!isAdmin) {
            return msg.reply(
                `══〘 💠 EVENT 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
            );
        }

        const sub = (args[0] || '').toLowerCase();

        // ── !event end ────────────────────────────────────────────────────────
        if (sub === 'end') {
            const existing = await getActiveEvent();
            if (!existing) return msg.reply(
                `══〘 💠 EVENT 〙══╮\n┃◆ ❌ No active event to end.\n╰═══════════════════════╯`
            );
            await msg.reply(
                `══〘 💠 EVENT 〙══╮\n┃◆ ✅ Ending event...\n┃◆ Leaderboard being sent to group.\n╰═══════════════════════╯`
            );
            await endEvent(existing.id, client);
            return;
        }

        // ── !event start ──────────────────────────────────────────────────────
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
                `┃◆ Use !event end to close early.\n` +
                `╰═══════════════════════╯`
            );
        }

        const endsAt = new Date(Date.now() + EVENT_HOURS * 60 * 60 * 1000);
        await db.execute(
            "INSERT INTO events (name, is_active, ends_at) VALUES (?, 1, ?)",
            [EVENT_NAME, endsAt]
        );

        await msg.reply(
            `══〘 💠 EVENT LAUNCHED 〙══╮\n` +
            `┃◆ ✅ ${EVENT_NAME} is now live.\n` +
            `┃◆ ⏳ Duration: ${EVENT_HOURS} hours\n` +
            `┃◆ Auto-ends with leaderboard.\n` +
            `┃◆ Announcement sent to group.\n` +
            `╰═══════════════════════╯`
        );

        const { mentions } = await tagAll(client);

        await client.sendMessage(RAID_GROUP, {
            text:
                `╭══〘 ⚡ SYSTEM ALERT — ARIA 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ Long before the first hunter\n` +
                `┃◆ ever awakened, a god fell.\n` +
                `┃◆ \n` +
                `┃◆ The Void Weaver — an ancient\n` +
                `┃◆ entity that consumed entire\n` +
                `┃◆ dimensions — was shattered.\n` +
                `┃◆ Its remains crystallised into\n` +
                `┃◆ fragments of pure void energy.\n` +
                `┃◆ The Void Shards.\n` +
                `┃◆ \n` +
                `┃◆ Today, the rift cracks open.\n` +
                `┃◆ The monsters have absorbed\n` +
                `┃◆ their energy — stronger than\n` +
                `┃◆ ever before.\n` +
                `┃◆ \n` +
                `┃◆ ════ 💠 THE VOID FRACTURE ════\n` +
                `┃◆ \n` +
                `┃◆ ━━ 📋 CONDITIONS ━━\n` +
                `┃◆ 💠 Collect ${REQUIRED_SHARDS} Void Shards\n` +
                `┃◆ 🎲 ${DROP_CHANCE * 100}/100 drop chance\n` +
                `┃◆    per dungeon fully cleared\n` +
                `┃◆ ♾️ No daily entry limit\n` +
                `┃◆ ⚔️ 5–8 enemies per stage\n` +
                `┃◆ 👹 Bosses empowered\n` +
                `┃◆ 🏰 Dungeons every 20 min\n` +
                `┃◆ ⏳ Event ends in ${EVENT_HOURS} hours\n` +
                `┃◆ \n` +
                `┃◆ ━━ 🏆 REWARDS ━━\n` +
                `┃◆ 🥇 10,000 Gold • 5,000 XP • Title\n` +
                `┃◆ 🥈  6,000 Gold • 3,000 XP • Title\n` +
                `┃◆ 🥉  3,000 Gold • 1,500 XP • Title\n` +
                `┃◆ \n` +
                `┃◆ The void does not wait.\n` +
                `┃◆ Use !enter. Start hunting.\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`,
            mentions
        });
    }
};