const db = require('../database/db');

const EXPLORER_GC = process.env.EXPLORER_GC_JID || process.env.EXPLORATION_GC_JID || '120363213735662100@g.us';

async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS explorer_listings (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            explorer_id VARCHAR(60) NOT NULL,
            nickname    VARCHAR(60) NOT NULL,
            description TEXT NOT NULL,
            price_gold  INT DEFAULT 0,
            price_xp    INT DEFAULT 0,
            is_active   TINYINT DEFAULT 1,
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX (explorer_id),
            INDEX (is_active)
        )
    `).catch(() => {});
}

module.exports = { ensureTables, EXPLORER_GC };