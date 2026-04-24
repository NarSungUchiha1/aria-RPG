const db = require('../database/db');

const HEALER_GC = '120363427051780444@g.us';

// ── Table Setup ───────────────────────────────────────────────────────────────
async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS healer_listings (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            healer_id   VARCHAR(50) NOT NULL UNIQUE,
            nickname    VARCHAR(100) NOT NULL,
            description TEXT,
            price_gold  INT NOT NULL DEFAULT 0,
            price_xp    INT NOT NULL DEFAULT 0,
            is_active   TINYINT DEFAULT 1,
            updated_at  DATETIME DEFAULT NOW()
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS healer_contracts (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            healer_id    VARCHAR(50) NOT NULL,
            healer_nick  VARCHAR(100) NOT NULL,
            client_id    VARCHAR(50) NOT NULL,
            client_nick  VARCHAR(100) NOT NULL,
            gold_paid    INT NOT NULL DEFAULT 0,
            xp_paid      INT NOT NULL DEFAULT 0,
            status       ENUM('pending','completed','cancelled') DEFAULT 'pending',
            created_at   DATETIME DEFAULT NOW(),
            completed_at DATETIME NULL
        )
    `).catch(() => {});
}

module.exports = { ensureTables, HEALER_GC };
