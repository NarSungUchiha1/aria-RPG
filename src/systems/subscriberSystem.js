/**
 * VIP subscriber system (monetization).
 *
 * Access is OWNER-GRANTED only — the owner verifies payment out-of-band
 * (GHS 5 / ~NGN equivalent) and runs !vip grant. Subscription lasts 30 days.
 *
 * Perks credited on EVERY grant (the owner is the paywall — a grant means a
 * payment; monthly renewals re-credit, that's the incentive to renew):
 *   • 1,000,000 gold  • 1,000,000 XP
 *   • 6× Fatigue Potion  • 2× Fracture Potion   (consumables → inventory)
 *   • 1 random explorer-brewed potion            (POTIONS catalog → potion_inventory)
 * Plus: custom card image and the VIP-styled !me interface.
 */
const db = require('../database/db');

const GRANT_GOLD = 1_000_000;
const GRANT_XP   = 1_000_000;
const SUB_DAYS   = 30;
const PRICE_GHS  = 10;
const PRICE_NGN  = 1500; // approx — adjust to the current GHS→NGN rate

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
    await db.execute('ALTER TABLE vip_subscribers ADD COLUMN expires_at DATETIME DEFAULT NULL').catch(() => {});
    tableReady = true;
}

// Active AND not expired. Expiry is passive — no cron needed.
const ACTIVE_SQL = 'active=1 AND (expires_at IS NULL OR expires_at > NOW())';

async function isVip(playerId) {
    await ensureVipTable();
    const [rows] = await db.execute(`SELECT 1 FROM vip_subscribers WHERE player_id=? AND ${ACTIVE_SQL} LIMIT 1`, [playerId]);
    return rows.length > 0;
}

// Cached isVip for the hot reply path (every command reply checks it).
// 60s TTL; invalidated immediately on grant/revoke.
const vipCache = new Map(); // playerId -> { v, ts }
const VIP_CACHE_TTL = 60000;
async function isVipCached(playerId) {
    const hit = vipCache.get(playerId);
    if (hit && Date.now() - hit.ts < VIP_CACHE_TTL) return hit.v;
    const v = await isVip(playerId).catch(() => false);
    vipCache.set(playerId, { v, ts: Date.now() });
    return v;
}

// ── VIP UI TRANSFORM ─────────────────────────────────────────────────────────
// Restyles any standard-UI card into the VIP look at the reply layer, so EVERY
// command a VIP runs answers in their gold interface without touching each
// command file: ┃◆/┃★ rails → ┃◈, box headers/footers → ◆═══◆, crown in the
// first header. Resonance ┃✧ rails are left untouched.
function applyVipStyle(text) {
    if (!text || typeof text !== 'string') return text;
    let t = text
        .replace(/┃[◆★]/g, '┃◈')
        .replace(/[╔╭]?══+〘/g, '◆═══〘')
        .replace(/〙══+[╗╮]?/g, '〙═══◆')
        .replace(/[╰╚](═+)[╯╝]/g, (m, eq) => '◆' + eq + '◆');
    if (!t.includes('👑')) t = t.replace('〘 ', '〘 👑 ');
    return t;
}

async function getVip(playerId) {
    await ensureVipTable();
    const [rows] = await db.execute(`SELECT * FROM vip_subscribers WHERE player_id=? AND ${ACTIVE_SQL} LIMIT 1`, [playerId]);
    return rows[0] || null;
}

// Stackable consumable grant (matches buy.js semantics: item_type 'consumable').
async function grantConsumable(playerId, itemName, qty) {
    const [r] = await db.execute(
        "UPDATE inventory SET quantity = COALESCE(quantity,0) + ? WHERE player_id=? AND item_name=? AND equipped=0 LIMIT 1",
        [qty, playerId, itemName]
    );
    if (r.affectedRows === 0) {
        await db.execute(
            "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped) VALUES (?, ?, 'consumable', ?, 0)",
            [playerId, itemName, qty]
        );
    }
}

// One random explorer-brewed potion from the POTIONS catalog → potion_inventory.
function randomExplorerPotion() {
    const { POTIONS } = require('./potions');
    const names = Object.keys(POTIONS);
    return names[Math.floor(Math.random() * names.length)];
}

async function grantVip(playerId, grantedBy) {
    await ensureVipTable();
    const [existing] = await db.execute(`SELECT 1 FROM vip_subscribers WHERE player_id=? AND ${ACTIVE_SQL} LIMIT 1`, [playerId]);
    if (existing.length) return { ok: false, reason: 'already_vip' };

    await db.execute(
        `INSERT INTO vip_subscribers (player_id, active, granted_by, granted_at, revoked_at, expires_at)
         VALUES (?, 1, ?, NOW(), NULL, DATE_ADD(NOW(), INTERVAL ${SUB_DAYS} DAY))
         ON DUPLICATE KEY UPDATE active=1, granted_by=?, granted_at=NOW(), revoked_at=NULL,
                                 expires_at=DATE_ADD(NOW(), INTERVAL ${SUB_DAYS} DAY)`,
        [playerId, grantedBy, grantedBy]
    );

    // Perk package (every grant = a verified payment)
    await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [GRANT_GOLD, playerId]).catch(() => {});
    await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [GRANT_XP, playerId]).catch(() => {});
    await grantConsumable(playerId, 'Fatigue Potion', 6).catch(() => {});
    await grantConsumable(playerId, 'Fracture Potion', 2).catch(() => {});

    let bonusPotion = null;
    try {
        bonusPotion = randomExplorerPotion();
        await db.execute(
            `INSERT INTO potion_inventory (player_id, potion_name, quantity) VALUES (?, ?, 1)
             ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
            [playerId, bonusPotion]
        );
    } catch (e) { console.error('[VIP] bonus potion failed:', e.message); bonusPotion = null; }

    vipCache.set(playerId, { v: true, ts: Date.now() });
    return { ok: true, bonusPotion, days: SUB_DAYS };
}

async function revokeVip(playerId) {
    await ensureVipTable();
    const [r] = await db.execute('UPDATE vip_subscribers SET active=0, revoked_at=NOW() WHERE player_id=? AND active=1', [playerId]);
    vipCache.set(playerId, { v: false, ts: Date.now() });
    return r.affectedRows > 0;
}

async function setVipImage(playerId, base64) {
    await ensureVipTable();
    await db.execute(`UPDATE vip_subscribers SET vip_image=? WHERE player_id=? AND ${ACTIVE_SQL}`, [base64, playerId]);
}

async function listVips() {
    await ensureVipTable();
    const [rows] = await db.execute(
        `SELECT v.player_id, v.granted_at, v.expires_at, p.nickname
         FROM vip_subscribers v LEFT JOIN players p ON p.id = v.player_id
         WHERE v.${ACTIVE_SQL} ORDER BY v.expires_at`
    );
    return rows;
}

module.exports = {
    GRANT_GOLD, GRANT_XP, SUB_DAYS, PRICE_GHS, PRICE_NGN,
    isVip, isVipCached, getVip, grantVip, revokeVip, setVipImage, listVips,
    applyVipStyle
};
