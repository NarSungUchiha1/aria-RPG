/**
 * setupTables.js
 * Creates ALL tables that are used but not created elsewhere.
 * Called once at bot startup. Safe to run multiple times (IF NOT EXISTS).
 */
const db = require('./db');

async function setupMissingTables() {
    const queries = [

        // ARIA conversation history — permanent memory
        `CREATE TABLE IF NOT EXISTS aria_conversations (
            id         BIGINT AUTO_INCREMENT PRIMARY KEY,
            player_id  VARCHAR(50) NOT NULL,
            role       ENUM('user','assistant') NOT NULL,
            content    TEXT NOT NULL,
            created_at DATETIME DEFAULT NOW(),
            INDEX idx_player_time (player_id, created_at)
        )`,

        // Buffs and debuffs — used by buffSystem.js
        `CREATE TABLE IF NOT EXISTS active_effects (
            id             INT AUTO_INCREMENT PRIMARY KEY,
            target_type    VARCHAR(20) NOT NULL,
            target_id      VARCHAR(50) NOT NULL,
            effect_name    VARCHAR(50) NOT NULL,
            effect_data    TEXT,
            remaining_turns INT DEFAULT 1,
            source_player  VARCHAR(50),
            created_at     DATETIME DEFAULT NOW(),
            INDEX idx_target (target_type, target_id)
        )`,

        // Dungeon spawn lock — prevents duplicate dungeon spawns
        `CREATE TABLE IF NOT EXISTS dungeon_spawn_lock (
            id         INT PRIMARY KEY DEFAULT 1,
            locked_at  DATETIME DEFAULT NOW()
        )`,

        // Shop stock — tracks item quantities in regular shop
        `CREATE TABLE IF NOT EXISTS shop_stock (
            item_name        VARCHAR(100) PRIMARY KEY,
            stock            INT DEFAULT 0,
            max_stock        INT DEFAULT 10,
            restocked_amount INT DEFAULT 5,
            last_restock     DATETIME DEFAULT NOW()
        )`,

        // Blocked users — ban list
        `CREATE TABLE IF NOT EXISTS blocked_users (
            player_id  VARCHAR(50) PRIMARY KEY,
            blocked_at DATETIME DEFAULT NOW()
        )`,

        // Core game tables (in case migration hasn't run)
        `CREATE TABLE IF NOT EXISTS players (
            id            VARCHAR(50) PRIMARY KEY,
            nickname      VARCHAR(50) UNIQUE,
            role          VARCHAR(20),
            \`rank\`        VARCHAR(5)  DEFAULT 'F',
            prestige_level INT DEFAULT 0,
            hp            INT DEFAULT 100,
            max_hp        INT DEFAULT 100,
            strength      INT DEFAULT 10,
            agility       INT DEFAULT 10,
            intelligence  INT DEFAULT 10,
            stamina       INT DEFAULT 10,
            fatigue       INT DEFAULT 0,
            mana          INT DEFAULT 100,
            max_mana      INT DEFAULT 100,
            sp            INT DEFAULT 0,
            pvp_wins      INT DEFAULT 0,
            pvp_losses    INT DEFAULT 0,
            title         VARCHAR(50),
            last_active   DATETIME DEFAULT NOW(),
            registered_at DATETIME DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS currency (
            player_id VARCHAR(50) PRIMARY KEY,
            gold      BIGINT DEFAULT 0
        )`,

        `CREATE TABLE IF NOT EXISTS xp (
            player_id VARCHAR(50) PRIMARY KEY,
            xp        BIGINT DEFAULT 0
        )`,

        `CREATE TABLE IF NOT EXISTS inventory (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            player_id    VARCHAR(50) NOT NULL,
            item_name    VARCHAR(100) NOT NULL,
            item_type    VARCHAR(30) DEFAULT 'misc',
            quantity     INT DEFAULT 1,
            equipped     TINYINT DEFAULT 0,
            durability   INT DEFAULT 100,
            max_durability INT DEFAULT 100,
            INDEX idx_player (player_id)
        )`,

        `CREATE TABLE IF NOT EXISTS dungeon (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            dungeon_rank  VARCHAR(5) NOT NULL,
            stage         INT DEFAULT 1,
            max_stage     INT DEFAULT 5,
            is_active     TINYINT DEFAULT 1,
            locked        TINYINT DEFAULT 0,
            stage_cleared TINYINT DEFAULT 0,
            created_at    DATETIME DEFAULT NOW()
        )`,

        `CREATE TABLE IF NOT EXISTS dungeon_players (
            player_id    VARCHAR(50) NOT NULL,
            dungeon_id   INT NOT NULL,
            is_alive     TINYINT DEFAULT 1,
            session_gold INT DEFAULT 0,
            session_xp   INT DEFAULT 0,
            PRIMARY KEY (player_id, dungeon_id)
        )`,

        `CREATE TABLE IF NOT EXISTS dungeon_enemies (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            dungeon_id INT NOT NULL,
            name       VARCHAR(100),
            current_hp INT DEFAULT 100,
            max_hp     INT DEFAULT 100,
            attack     INT DEFAULT 10,
            def        INT DEFAULT 5,
            \`rank\`     VARCHAR(5),
            INDEX idx_dungeon (dungeon_id)
        )`,

        `CREATE TABLE IF NOT EXISTS dungeon_entry_log (
            player_id  VARCHAR(50) NOT NULL,
            entry_date DATE NOT NULL,
            count      INT DEFAULT 0,
            PRIMARY KEY (player_id, entry_date)
        )`,

        `CREATE TABLE IF NOT EXISTS clan_members (
            clan_id   INT NOT NULL,
            player_id VARCHAR(50) NOT NULL,
            PRIMARY KEY (clan_id, player_id)
        )`,

        `CREATE TABLE IF NOT EXISTS wa_sessions (
            id         VARCHAR(50) NOT NULL,
            data_key   VARCHAR(255) NOT NULL,
            data_value LONGTEXT,
            PRIMARY KEY (id, data_key(100)),
            UNIQUE KEY unique_session_key (id, data_key(100))
        )`
    ];

    let created = 0;
    for (const sql of queries) {
        await db.execute(sql).catch(e => {
            console.error('[DB Setup] Error:', e.message.substring(0, 80));
        });
        created++;
    }

    // Safely add id column to inventory if it doesn't exist
    // Can't use IF NOT EXISTS for columns in older MySQL — check information_schema instead
    try {
        const [cols] = await db.execute(
            `SELECT COLUMN_NAME FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'inventory' AND COLUMN_NAME = 'id'`
        );
        if (!cols.length) {
            await db.execute(`ALTER TABLE inventory ADD COLUMN id INT AUTO_INCREMENT PRIMARY KEY FIRST`);
            console.log('[DB Setup] Added id column to inventory');
        }
    } catch (e) {
        console.error('[DB Setup] inventory id column:', e.message.substring(0, 80));
    }

    console.log(`[DB Setup] ✅ ${created} tables verified`);
}

module.exports = { setupMissingTables };