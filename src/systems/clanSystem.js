const db = require('../database/db');

// ── PRESET CLAN BLESSINGS ─────────────────────────────────────────────────────
const CLAN_BLESSINGS = {
    1:  { name: "Dragon's Breath",  emoji: '🐉', condition: 'HP drops below 30%',                           effect: 'Fire blast — 500% primary stat to ALL enemies. Ignores defense.',            trigger: 'hp_below_30',             multiplier: 5.0,  aoe: true, ignore_defense: true },
    2:  { name: "Void Collapse",    emoji: '🌑', condition: 'After killing an enemy',                       effect: 'Void implodes — 300% to all remaining enemies. DEF -50% for 3 turns.',     trigger: 'on_kill',                 multiplier: 3.0,  aoe: true, def_reduction: 50 },
    3:  { name: "Reaper's Mark",    emoji: '💀', condition: 'Enemy drops below 25% HP',                     effect: 'Execute the enemy. Bosses take 80% remaining HP instead.',                  trigger: 'enemy_below_25',          execute: true,    boss_multiplier: 0.8 },
    4:  { name: "Titan's Roar",     emoji: '⚡', condition: 'You take 3 consecutive hits',                  effect: 'Invincible 2 turns. Next hit 400% damage.',                                 trigger: 'three_consecutive_hits',  multiplier: 4.0,  invincible_turns: 2 },
    5:  { name: "Soul Shatter",     emoji: '💠', condition: 'First move of every stage',                    effect: 'All enemies take 50% extra damage for the entire stage.',                   trigger: 'stage_first_move',        damage_amp: 0.5,  duration: 'stage' },
    6:  { name: "Phantom Shift",    emoji: '👻', condition: 'When you would die from a hit',                effect: 'Survive at 1 HP, heal to 60%, all stats +600% for 3 turns, 600% retaliation.', trigger: 'on_death',             multiplier: 6.0,  heal_percent: 0.6, stat_boost_percent: 6.0, stat_boost_duration: 3 },
    7:  { name: "Heaven's Fall",    emoji: '☄️', condition: 'Every 5th skill used',                         effect: 'Celestial strike — 450% INT damage to ALL enemies. Ignores defense.',        trigger: 'every_5_skills',          multiplier: 4.5,  stat: 'intelligence', aoe: true, ignore_defense: true },
    8:  { name: "Abyssal Hunger",   emoji: '🕳️', condition: 'After a healer heals you in a dungeon',        effect: '200% of healing dealt as damage to a random enemy.',                        trigger: 'on_healed',               heal_multiplier: 2.0 },
    9:  { name: "Eclipse",          emoji: '🌒', condition: 'When dungeon reaches the final stage',          effect: 'All enemies lose 40% HP instantly. +30% damage for rest of dungeon.',       trigger: 'final_stage',             hp_drain: 0.4,    damage_boost: 0.3 },
    10: { name: "Malachar's Will",  emoji: '👁️', condition: 'Prestige only — all teammates below 50% HP',   effect: 'Next 3 attacks deal 1000% damage. Cannot miss or be evaded.',               trigger: 'all_allies_below_50',     multiplier: 10.0, charges: 3, prestige_only: true },
};

// ── CLAN CREATION REQUIREMENTS ────────────────────────────────────────────────
const CREATION_REQUIREMENTS = {
    minRank:        'A',    // Must be at least Rank A
    minPrestige:    1,      // Must be Prestige
    minDungeons:    50,     // At least 50 dungeon clears
    minGold:        25000,  // 25k gold cost
    minPsDungeons:  1,      // Must have cleared at least 1 PS dungeon
};

// ── TABLE SETUP ───────────────────────────────────────────────────────────────
async function ensureClanTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS clans (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            name         VARCHAR(60) UNIQUE NOT NULL,
            leader_id    VARCHAR(60) NOT NULL,
            blessing_id  INT NOT NULL DEFAULT 1,
            member_count INT NOT NULL DEFAULT 1,
            created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS clan_members (
            player_id VARCHAR(60) NOT NULL,
            clan_id   INT NOT NULL,
            role      VARCHAR(30) NOT NULL DEFAULT 'member',
            joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (player_id),
            FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS clan_quests (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            clan_id     INT NOT NULL,
            assigned_to VARCHAR(60) NOT NULL,
            assigned_by VARCHAR(60) NOT NULL,
            title       VARCHAR(120) NOT NULL,
            description TEXT NOT NULL,
            objective   VARCHAR(60) NOT NULL,
            target      INT NOT NULL DEFAULT 1,
            progress    INT NOT NULL DEFAULT 0,
            reward_gold INT NOT NULL DEFAULT 0,
            reward_xp   INT NOT NULL DEFAULT 0,
            status      ENUM('active','completed','failed') DEFAULT 'active',
            created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX (clan_id),
            INDEX (assigned_to)
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS malachar_kills (
            player_id  VARCHAR(60) PRIMARY KEY,
            killed_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(() => {});

    // FIX: this table never existed — every clan blessing trigger was crashing
    // silently because getPlayerBlessingState returned null and code tried to
    // read .blessing_used / .skill_count / .hit_count off of null.
    await db.execute(`
        CREATE TABLE IF NOT EXISTS clan_blessing_state (
            player_id      VARCHAR(60) NOT NULL,
            dungeon_id     INT NOT NULL,
            blessing_used  TINYINT NOT NULL DEFAULT 0,
            skill_count    INT NOT NULL DEFAULT 0,
            hit_count      INT NOT NULL DEFAULT 0,
            invincible     INT NOT NULL DEFAULT 0,
            damage_boost   DECIMAL(5,3) NOT NULL DEFAULT 0,
            next_hit_mult  DECIMAL(6,3) NOT NULL DEFAULT 0,
            charges        INT NOT NULL DEFAULT 0,
            last_triggered DATETIME DEFAULT NULL,
            PRIMARY KEY (player_id, dungeon_id)
        )
    `).catch(() => {});

    await db.execute('ALTER TABLE clan_members ADD COLUMN IF NOT EXISTS role VARCHAR(30) NOT NULL DEFAULT "member"').catch(() => {});
    await db.execute('ALTER TABLE clans ADD COLUMN IF NOT EXISTS member_count INT NOT NULL DEFAULT 1').catch(() => {});
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
async function getPlayerClan(playerId) {
    const [rows] = await db.execute(
        `SELECT c.* FROM clans c
         JOIN clan_members cm ON cm.clan_id = c.id
         WHERE cm.player_id = ?`,
        [playerId]
    );
    return rows[0] || null;
}

async function getClanById(clanId) {
    const [rows] = await db.execute("SELECT * FROM clans WHERE id=?", [clanId]);
    return rows[0] || null;
}

async function getClanMembers(clanId) {
    const [rows] = await db.execute(
        `SELECT p.id, p.nickname, p.role, p.rank, p.prestige_level, cm.role as clan_role
         FROM players p JOIN clan_members cm ON p.id = cm.player_id
         WHERE cm.clan_id = ?`,
        [clanId]
    );
    return rows;
}

async function getClanMemberRole(playerId, clanId) {
    const [rows] = await db.execute(
        "SELECT role FROM clan_members WHERE player_id=? AND clan_id=?",
        [playerId, clanId]
    );
    return rows[0]?.role || null;
}

// ── CREATION REQUIREMENTS CHECK ───────────────────────────────────────────────
async function checkCreationRequirements(playerId) {
    const RANK_ORDER = ['F','E','D','C','B','A','S','PF','PE','PD','PC','PB','PA','PS'];
    const fails = [];

    const [player] = await db.execute(
        "SELECT nickname, `rank`, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
        [playerId]
    );
    if (!player.length) return { pass: false, fails: ['Not registered'] };
    const p = player[0];

    // 1. Must be Prestige
    if ((p.prestige_level || 0) < CREATION_REQUIREMENTS.minPrestige) {
        fails.push('❌ Must be a Prestige hunter');
    }

    // 2. Must be Rank A or higher
    const rankIdx    = RANK_ORDER.indexOf(p.rank);
    const minRankIdx = RANK_ORDER.indexOf(CREATION_REQUIREMENTS.minRank);
    if (rankIdx < minRankIdx && !String(p.rank).startsWith('P')) {
        fails.push(`❌ Must be Rank ${CREATION_REQUIREMENTS.minRank}+ (you are ${p.rank})`);
    }

    // 3. Must have 50+ dungeon clears (tracked via quest progress)
    const [clears] = await db.execute(
        `SELECT COALESCE(SUM(pq.progress), 0) as cnt
         FROM player_quests pq
         JOIN quests q ON q.id = pq.quest_id
         WHERE pq.player_id=? AND q.objective_type='dungeon_clear'`,
        [playerId]
    ).catch(() => [[{ cnt: 0 }]]);
    const clearCount = Number(clears[0]?.cnt || 0);
    if (clearCount < CREATION_REQUIREMENTS.minDungeons) {
        fails.push(`❌ Need ${CREATION_REQUIREMENTS.minDungeons} dungeon clears (you have ${clearCount})`);
    }

    // 4. Must have cleared at least 1 PS dungeon
    // Check quest progress first, fall back to dungeon history
    const [psRow] = await db.execute(
        `SELECT COALESCE(SUM(pq.progress), 0) as cnt
         FROM player_quests pq
         JOIN quests q ON q.id = pq.quest_id
         WHERE pq.player_id=? AND q.objective_type='prestige_clear' AND pq.progress > 0`,
        [playerId]
    ).catch(() => [[{ cnt: 0 }]]);

    // Fallback: check dungeon completion history directly
    const [psHistory] = await db.execute(
        `SELECT COUNT(*) as cnt FROM dungeon d
         JOIN dungeon_players dp ON dp.dungeon_id = d.id
         WHERE dp.player_id=? AND d.dungeon_rank='PS' AND d.is_active=0`,
        [playerId]
    ).catch(() => [[{ cnt: 0 }]]);

    // Also check ps_dungeon_clears table if it exists
    const [psDirect] = await db.execute(
        `SELECT COALESCE(clears, 0) as cnt FROM ps_dungeon_clears WHERE player_id=?`,
        [playerId]
    ).catch(() => [[{ cnt: 0 }]]);

    const psClears = Math.max(
        Number(psRow[0]?.cnt || 0),
        Number(psHistory[0]?.cnt || 0),
        Number(psDirect[0]?.cnt || 0)
    );

    if (psClears < CREATION_REQUIREMENTS.minPsDungeons) {
        fails.push(`❌ Must have cleared at least 1 PS dungeon (you have ${psClears})`);
    }

    // 5. Must have enough gold
    const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [playerId]);
    const playerGold = Number(gold[0]?.gold || 0);
    if (playerGold < CREATION_REQUIREMENTS.minGold) {
        fails.push(`❌ Need ${CREATION_REQUIREMENTS.minGold.toLocaleString()} Gold (you have ${playerGold.toLocaleString()})`);
    }

    return { pass: fails.length === 0, fails, playerGold, clearCount, psClears, p };
}

// ── BLESSING STATE ────────────────────────────────────────────────────────────
// FIX: returns safe zeroed defaults instead of null when no row exists yet —
// every player's FIRST blessing check in a fresh dungeon had no row, so the
// caller's state.blessing_used / state.skill_count crashed on null and the
// whole trigger silently died inside the try/catch.
async function getPlayerBlessingState(playerId, dungeonId) {
    const [rows] = await db.execute(
        'SELECT * FROM clan_blessing_state WHERE player_id=? AND dungeon_id=?',
        [playerId, dungeonId]
    );
    if (rows[0]) return rows[0];
    return {
        player_id: playerId, dungeon_id: dungeonId,
        blessing_used: 0, skill_count: 0, hit_count: 0,
        invincible: 0, damage_boost: 0, charges: 0, last_triggered: null
    };
}

// FIX: was a plain UPDATE which silently affected 0 rows when no state row
// existed yet (true for every player's first trigger in a dungeon). Now
// upserts — inserts the row on first write, updates it on every write after.
async function updateBlessingState(playerId, dungeonId, fields) {
    if (!fields || !Object.keys(fields).length) return;
    const cols = Object.keys(fields);
    const vals = Object.values(fields);
    const insertCols = ['player_id', 'dungeon_id', ...cols].join(', ');
    const insertPlaceholders = ['?', '?', ...cols.map(() => '?')].join(', ');
    const updateClause = cols.map(k => `${k}=?`).join(', ');
    await db.execute(
        `INSERT INTO clan_blessing_state (${insertCols}) VALUES (${insertPlaceholders})
         ON DUPLICATE KEY UPDATE ${updateClause}`,
        [playerId, dungeonId, ...vals, ...vals]
    );
}

// Returns true if player is an officer or master of their clan
async function isOfficer(playerId, clanId) {
    const role = await getClanMemberRole(playerId, clanId);
    return role === 'officer' || role === 'master';
}

module.exports = {
    CLAN_BLESSINGS,
    CREATION_REQUIREMENTS,
    ensureClanTables,
    getPlayerClan,
    getClanById,
    getClanMembers,
    getClanMemberRole,
    isOfficer,
    checkCreationRequirements,
    getPlayerBlessingState,
    updateBlessingState,
};