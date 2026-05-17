/**
 * VOID STORM SYSTEM
 * Random event — doubles all exploration material drops for 1 hour.
 * Admin can trigger manually or it fires on a weighted random schedule.
 */
const db = require('../database/db');

const STORM_DURATION = 60 * 60 * 1000; // 1 hour
let stormActive = false;
let stormEndsAt = null;

async function ensureStormTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS void_storms (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            started_at DATETIME DEFAULT NOW(),
            ends_at    DATETIME NOT NULL,
            is_active  TINYINT DEFAULT 1
        )
    `).catch(() => {});
}

async function isStormActive() {
    await ensureStormTable();
    const [rows] = await db.execute(
        "SELECT * FROM void_storms WHERE is_active=1 AND ends_at > NOW() LIMIT 1"
    );
    return rows[0] || null;
}

async function startStorm(client, RAID_GROUP, EXPLORATION_GC) {
    await ensureStormTable();
    const endsAt = new Date(Date.now() + STORM_DURATION);
    await db.execute(
        "UPDATE void_storms SET is_active=0 WHERE is_active=1"
    );
    await db.execute(
        "INSERT INTO void_storms (ends_at) VALUES (?)",
        [endsAt]
    );

    const msg =
        `╔══〘 ⚡ VOID STORM 〙══╗\n` +
        `┃◆\n` +
        `┃◆ The rifts are destabilising.\n` +
        `┃◆ The void is bleeding through.\n` +
        `┃◆\n` +
        `┃◆ ⚡ ALL exploration drops\n` +
        `┃◆    are DOUBLED for 1 hour.\n` +
        `┃◆\n` +
        `┃◆ Get in a rift. Now.\n` +
        `┃◆\n` +
        `┃◆ ⏳ Storm ends in 60 minutes.\n` +
        `╚═══════════════════════════╝`;

    if (client && EXPLORATION_GC) await client.sendMessage(EXPLORATION_GC, { text: msg }).catch(() => {});
    if (client && RAID_GROUP) await client.sendMessage(RAID_GROUP, { text: msg }).catch(() => {});
    return endsAt;
}

async function endStorm(client, EXPLORATION_GC) {
    await db.execute("UPDATE void_storms SET is_active=0 WHERE is_active=1");
    if (client && EXPLORATION_GC) {
        await client.sendMessage(EXPLORATION_GC, {
            text:
                `══〘 ⚡ VOID STORM ENDS 〙══╮\n` +
                `┃◆ The rifts stabilise.\n` +
                `┃◆ The void recedes — for now.\n` +
                `╰═══════════════════════╯`
        }).catch(() => {});
    }
}

module.exports = { isStormActive, startStorm, endStorm, ensureStormTable };