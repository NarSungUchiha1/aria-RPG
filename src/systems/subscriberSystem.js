/**
 * VIP subscriber system (monetization).
 *
 * Access is OWNER-GRANTED only — the owner verifies payment out-of-band and
 * runs !vip grant. Perks: one-time 1M gold + 1M XP on grant, a custom card
 * image (like the resonance card), and a VIP-styled !me interface.
 */
const db = require('../database/db');

const GRANT_GOLD = 1_000_000;
const GRANT_XP   = 1_000_000;

let tableReady = false;
async function ensureVipTable() {
    if (tableReady) return;
    await db.execute(`
        CREATE TABLE IF NOT EXISTS vip_subscribers (
            player_id  VARCHAR(50) PRIMARY KEY,
            active     TINYINT DEFAULT 1,
            vip_image  LONGTEXT,
            granted_by VARCHAR(50),
            granted_at DATETIME DEFAULT NOW(),
            revoked_at DATETIME DEFAULT NULL
        )
    `).catch(e => console.error('[VIP] table error:', e.message));
    tableReady = true;
}

async function isVip(playerId) {
    await ensureVipTable();
    const [rows] = await db.execute('SELECT 1 FROM vip_subscribers WHERE player_id=? AND active=1 LIMIT 1', [playerId]);
    return rows.length > 0;
}

async function getVip(playerId) {
    await ensureVipTable();
    const [rows] = await db.execute('SELECT * FROM vip_subscribers WHERE player_id=? AND active=1 LIMIT 1', [playerId]);
    return rows[0] || null;
}

// Grant VIP. Credits the 1M/1M only on FIRST-ever grant (re-granting after a
// revoke doesn't re-pay — prevents grant/revoke farming).
async function grantVip(playerId, grantedBy) {
    await ensureVipTable();
    const [existing] = await db.execute('SELECT active FROM vip_subscribers WHERE player_id=? LIMIT 1', [playerId]);
    if (existing.length && existing[0].active === 1) return { ok: false, reason: 'already_vip' };

    const firstGrant = existing.length === 0;
    await db.execute(
        `INSERT INTO vip_subscribers (player_id, active, granted_by, granted_at, revoked_at)
         VALUES (?, 1, ?, NOW(), NULL)
         ON DUPLICATE KEY UPDATE active=1, granted_by=?, granted_at=NOW(), revoked_at=NULL`,
        [playerId, grantedBy, grantedBy]
    );
    if (firstGrant) {
        await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [GRANT_GOLD, playerId]).catch(() => {});
        await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [GRANT_XP, playerId]).catch(() => {});
    }
    return { ok: true, firstGrant };
}

async function revokeVip(playerId) {
    await ensureVipTable();
    const [r] = await db.execute('UPDATE vip_subscribers SET active=0, revoked_at=NOW() WHERE player_id=? AND active=1', [playerId]);
    return r.affectedRows > 0;
}

async function setVipImage(playerId, base64) {
    await ensureVipTable();
    await db.execute('UPDATE vip_subscribers SET vip_image=? WHERE player_id=? AND active=1', [base64, playerId]);
}

async function listVips() {
    await ensureVipTable();
    const [rows] = await db.execute(
        `SELECT v.player_id, v.granted_at, p.nickname
         FROM vip_subscribers v LEFT JOIN players p ON p.id = v.player_id
         WHERE v.active=1 ORDER BY v.granted_at`
    );
    return rows;
}

module.exports = { GRANT_GOLD, GRANT_XP, isVip, getVip, grantVip, revokeVip, setVipImage, listVips };
