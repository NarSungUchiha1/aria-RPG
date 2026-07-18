// Tiny persistent key/value flags for world state (e.g. chapter6_active,
// faction_champion). Cached 60s — flags are read on hot paths.
const db = require('../database/db');

let tableReady = false;
async function ensureFlagsTable() {
    if (tableReady) return;
    await db.execute(`
        CREATE TABLE IF NOT EXISTS game_flags (
            flag_name VARCHAR(50) PRIMARY KEY,
            value     VARCHAR(200),
            updated_at DATETIME DEFAULT NOW()
        )
    `).catch(() => {});
    tableReady = true;
}

const cache = new Map(); // name -> { v, ts }
const TTL = 60000;

async function getFlag(name) {
    const hit = cache.get(name);
    if (hit && Date.now() - hit.ts < TTL) return hit.v;
    await ensureFlagsTable();
    const [rows] = await db.execute('SELECT value FROM game_flags WHERE flag_name=?', [name]).catch(() => [[]]);
    const v = rows[0]?.value ?? null;
    cache.set(name, { v, ts: Date.now() });
    return v;
}

async function setFlag(name, value) {
    await ensureFlagsTable();
    await db.execute(
        'INSERT INTO game_flags (flag_name, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value=?, updated_at=NOW()',
        [name, String(value), String(value)]
    );
    cache.set(name, { v: String(value), ts: Date.now() });
}

module.exports = { getFlag, setFlag };
