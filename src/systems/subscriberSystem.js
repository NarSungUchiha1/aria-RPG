/**
 * VIP / VVIP subscriber system (monetization).
 *
 * Access is OWNER-GRANTED only — the owner verifies payment out-of-band and
 * runs !vip grant / !vip vvip. Subscriptions last 30 days; renewals re-credit.
 *
 * 👑 VIP  — GH₵10:  500k Lumens + 500k XP, one-time 6× Fatigue + 2× Fracture
 *           Potion + 1 random explorer potion, custom card image, gold UI.
 * 💎 VVIP — GH₵25:  1M Lumens + 1M XP, and a DAILY SUPPLY DRIP for all 30
 *           days: 2× Fatigue + 1× Fracture Potion every day, plus 2 random
 *           explorer potions every 2nd day (delivered by the daily cron).
 *           Custom card image + gold UI included.
 */
const db = require('../database/db');

const TIERS = {
    VIP:  { lumens: 500_000,   xp: 500_000,   priceGhs: 10, priceNgn: 1500 },
    VVIP: { lumens: 1_000_000, xp: 1_000_000, priceGhs: 25, priceNgn: 3750 }
};
const SUB_DAYS = 30;
// Back-compat display constants (VIP tier)
const GRANT_GOLD = TIERS.VIP.lumens;
const GRANT_XP   = TIERS.VIP.xp;
const PRICE_GHS  = TIERS.VIP.priceGhs;
const PRICE_NGN  = TIERS.VIP.priceNgn;

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
    await db.execute("ALTER TABLE vip_subscribers ADD COLUMN tier VARCHAR(10) DEFAULT 'VIP'").catch(() => {});
    await db.execute('ALTER TABLE vip_subscribers ADD COLUMN last_drip DATE DEFAULT NULL').catch(() => {});
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
        .replace(/[╔╭]?═+〘/g, '◆══〘')
        .replace(/〙═+[╗╮]?/g, '〙══ ◆')
        .replace(/[╰╚](═+)[╯╝]/g, (m, eq) => '◆' + eq + '◆');
    if (!t.includes('👑')) t = t.replace('〘 ', '〘 👑 ');
    return t;
}

async function getVip(playerId) {
    await ensureVipTable();
    const [rows] = await db.execute(`SELECT * FROM vip_subscribers WHERE player_id=? AND ${ACTIVE_SQL} LIMIT 1`, [playerId]);
    return rows[0] || null;
}

// Consumable grant — ONE ROW PER POTION, quantity=1 each. That's the game's
// convention: buy.js inserts a fresh row per purchase and !use deletes the
// WHOLE row (DELETE WHERE id) regardless of quantity. Stacking qty into a
// single row made 6 potions display/consume as 1.
async function grantConsumable(playerId, itemName, qty) {
    const rows = Array.from({ length: qty }, () => `(?, ?, 'consumable', 1, 0)`).join(',');
    const params = [];
    for (let i = 0; i < qty; i++) params.push(playerId, itemName);
    await db.execute(
        `INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped) VALUES ${rows}`,
        params
    );
}

// One random explorer-brewed potion from the POTIONS catalog → potion_inventory.
function randomExplorerPotion() {
    const { POTIONS } = require('./potions');
    const names = Object.keys(POTIONS);
    return names[Math.floor(Math.random() * names.length)];
}

async function grantExplorerPotion(playerId) {
    const name = randomExplorerPotion();
    await db.execute(
        `INSERT INTO potion_inventory (player_id, potion_name, quantity) VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
        [playerId, name]
    );
    return name;
}

async function grantVip(playerId, grantedBy, tier = 'VIP') {
    await ensureVipTable();
    tier = TIERS[tier] ? tier : 'VIP';
    const [existing] = await db.execute(`SELECT tier FROM vip_subscribers WHERE player_id=? AND ${ACTIVE_SQL} LIMIT 1`, [playerId]);
    // Allow upgrading an active VIP to VVIP; block same-tier re-grant.
    if (existing.length && !(existing[0].tier !== 'VVIP' && tier === 'VVIP')) {
        return { ok: false, reason: 'already_vip', tier: existing[0].tier };
    }

    await db.execute(
        `INSERT INTO vip_subscribers (player_id, active, granted_by, granted_at, revoked_at, expires_at, tier, last_drip)
         VALUES (?, 1, ?, NOW(), NULL, DATE_ADD(NOW(), INTERVAL ${SUB_DAYS} DAY), ?, NULL)
         ON DUPLICATE KEY UPDATE active=1, granted_by=?, granted_at=NOW(), revoked_at=NULL,
                                 expires_at=DATE_ADD(NOW(), INTERVAL ${SUB_DAYS} DAY), tier=?, last_drip=NULL`,
        [playerId, grantedBy, tier, grantedBy, tier]
    );

    // Lumens + XP by tier (every grant = a verified payment)
    const t = TIERS[tier];
    await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [t.lumens, playerId]).catch(() => {});
    await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [t.xp, playerId]).catch(() => {});

    let bonusPotion = null;
    if (tier === 'VVIP') {
        // Day 1 of the supply drip lands immediately; the cron takes over tomorrow.
        await grantConsumable(playerId, 'Fatigue Potion', 2).catch(() => {});
        await grantConsumable(playerId, 'Fracture Potion', 1).catch(() => {});
        try { bonusPotion = await grantExplorerPotion(playerId); await grantExplorerPotion(playerId); } catch (e) {}
        await db.execute('UPDATE vip_subscribers SET last_drip=CURDATE() WHERE player_id=?', [playerId]).catch(() => {});
    } else {
        // VIP: one-time potion package
        await grantConsumable(playerId, 'Fatigue Potion', 6).catch(() => {});
        await grantConsumable(playerId, 'Fracture Potion', 2).catch(() => {});
        try { bonusPotion = await grantExplorerPotion(playerId); } catch (e) { bonusPotion = null; }
    }

    vipCache.set(playerId, { v: true, ts: Date.now() });
    return { ok: true, bonusPotion, days: SUB_DAYS, tier, lumens: t.lumens, xp: t.xp };
}

// ── VVIP DAILY SUPPLY DRIP (called by the daily cron) ────────────────────────
// 2× Fatigue + 1× Fracture Potion every day; 2 random explorer potions every
// 2nd day. last_drip guards against double delivery across restarts.
async function dripVvipDaily() {
    await ensureVipTable();
    const [vvips] = await db.execute(
        `SELECT player_id, granted_at FROM vip_subscribers
         WHERE tier='VVIP' AND ${ACTIVE_SQL} AND (last_drip IS NULL OR last_drip < CURDATE())`
    );
    let delivered = 0;
    for (const v of vvips) {
        try {
            await grantConsumable(v.player_id, 'Fatigue Potion', 2);
            await grantConsumable(v.player_id, 'Fracture Potion', 1);
            const dayN = Math.floor((Date.now() - new Date(v.granted_at)) / 86400000);
            if (dayN % 2 === 0) { await grantExplorerPotion(v.player_id); await grantExplorerPotion(v.player_id); }
            await db.execute('UPDATE vip_subscribers SET last_drip=CURDATE() WHERE player_id=?', [v.player_id]);
            delivered++;
        } catch (e) { console.error('[VVIP drip] failed for', v.player_id, e.message); }
    }
    if (delivered) console.log(`💎 VVIP daily supply delivered to ${delivered} subscriber(s).`);
    return delivered;
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
        `SELECT v.player_id, v.granted_at, v.expires_at, v.tier, p.nickname
         FROM vip_subscribers v LEFT JOIN players p ON p.id = v.player_id
         WHERE v.${ACTIVE_SQL} ORDER BY v.tier DESC, v.expires_at`
    );
    return rows;
}

module.exports = {
    TIERS, GRANT_GOLD, GRANT_XP, SUB_DAYS, PRICE_GHS, PRICE_NGN,
    isVip, isVipCached, getVip, grantVip, revokeVip, setVipImage, listVips,
    dripVvipDaily, applyVipStyle
};
