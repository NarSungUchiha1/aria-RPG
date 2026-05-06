/**
 * CLAN SYSTEM
 * Each clan has one Blessed Move chosen by the clan leader.
 * The blessing triggers automatically in dungeons when its condition is met.
 * All clan members share the same blessing.
 */

const db = require('../database/db');

// ── PRESET CLANS — fixed, cannot be renamed ──────────────────────────────────
const PRESET_CLANS = [
    { name: '🔥 MUGEN KANNAZUKI 🔥', blessing_id: 1 }, // Dragon's Breath
    { name: 'ASHEN',                  blessing_id: 5 }, // Soul Shatter
    { name: 'PHANTOM CREST',          blessing_id: 6 }  // Phantom Shift
];

// ── CLAN BLESSINGS ────────────────────────────────────────────────────────────
const CLAN_BLESSINGS = {
    1: {
        name: "Dragon's Breath",
        emoji: '🐉',
        condition: 'HP drops below 30%',
        effect: 'Unleashes a fire blast dealing 500% of your primary stat to ALL enemies. Ignores all defense.',
        trigger: 'hp_below_30',
        multiplier: 5.0,
        aoe: true,
        ignore_defense: true
    },
    2: {
        name: "Void Collapse",
        emoji: '🌑',
        condition: 'After killing an enemy',
        effect: 'The void implodes — deals 300% damage to all remaining enemies and reduces their DEF by 50% for 3 turns.',
        trigger: 'on_kill',
        multiplier: 3.0,
        aoe: true,
        def_reduction: 50
    },
    3: {
        name: "Reaper's Mark",
        emoji: '💀',
        condition: 'Enemy drops below 25% HP',
        effect: 'Instantly executes the enemy. Against bosses — deals 80% of their remaining HP instead.',
        trigger: 'enemy_below_25',
        execute: true,
        boss_multiplier: 0.8
    },
    4: {
        name: "Titan's Roar",
        emoji: '⚡',
        condition: 'You take 3 consecutive hits from enemies',
        effect: 'Become invincible for 2 turns and deal 400% damage on your next hit.',
        trigger: 'three_consecutive_hits',
        multiplier: 4.0,
        invincible_turns: 2
    },
    5: {
        name: "Soul Shatter",
        emoji: '💠',
        condition: 'First move of every stage',
        effect: 'Fractures all enemies — they take 50% extra damage from all sources for the entire stage.',
        trigger: 'stage_first_move',
        damage_amp: 0.5,
        duration: 'stage'
    },
    6: {
        name: "Phantom Shift",
        emoji: '👻',
        condition: 'When you would die from a hit',
        effect: 'Survive with 1 HP, instantly heal to 60% max HP and deal 600% damage to the attacker.',
        trigger: 'on_death',
        multiplier: 6.0,
        heal_percent: 0.6
    },
    7: {
        name: "Heaven's Fall",
        emoji: '☄️',
        condition: 'Every 5th skill used in a dungeon',
        effect: 'A celestial strike falls on ALL enemies dealing 450% intelligence damage. Ignores all defense.',
        trigger: 'every_5_skills',
        multiplier: 4.5,
        stat: 'intelligence',
        aoe: true,
        ignore_defense: true
    },
    8: {
        name: "Abyssal Hunger",
        emoji: '🕳️',
        condition: 'After a healer heals you in a dungeon',
        effect: 'Absorb the void — deal damage equal to 200% of the amount healed to a random enemy.',
        trigger: 'on_healed',
        heal_multiplier: 2.0
    },
    9: {
        name: "Eclipse",
        emoji: '🌒',
        condition: 'When dungeon reaches the final stage',
        effect: 'All enemies lose 40% of current HP instantly. Permanent +30% damage boost for rest of dungeon.',
        trigger: 'final_stage',
        hp_drain: 0.4,
        damage_boost: 0.3
    },
    10: {
        name: "Malachar's Will",
        emoji: '👁️',
        condition: 'Prestige only — all teammates below 50% HP',
        effect: 'Channel Malachar — next 3 attacks deal 1000% damage and cannot miss or be evaded.',
        trigger: 'all_allies_below_50',
        multiplier: 10.0,
        charges: 3,
        prestige_only: true
    }
};

// ── TABLE SETUP ───────────────────────────────────────────────────────────────
async function ensureClanTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS clans (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            name         VARCHAR(50) UNIQUE NOT NULL,
            leader_id    VARCHAR(50) NOT NULL,
            blessing_id  INT NOT NULL DEFAULT 1,
            created_at   DATETIME DEFAULT NOW(),
            member_count INT DEFAULT 1
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS clan_members (
            player_id  VARCHAR(50) PRIMARY KEY,
            clan_id    INT NOT NULL,
            joined_at  DATETIME DEFAULT NOW(),
            FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE CASCADE
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS clan_blessing_state (
            player_id      VARCHAR(50) NOT NULL,
            dungeon_id     INT NOT NULL,
            hit_count      INT DEFAULT 0,
            skill_count    INT DEFAULT 0,
            blessing_used  TINYINT DEFAULT 0,
            damage_boost   FLOAT DEFAULT 0,
            invincible     INT DEFAULT 0,
            last_triggered DATETIME DEFAULT NULL,
            PRIMARY KEY (player_id, dungeon_id)
        )
    `).catch(() => {});
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
async function getPlayerClan(playerId) {
    await ensureClanTables();
    const [rows] = await db.execute(
        `SELECT c.*, cm.player_id as member_id
         FROM clans c
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
        `SELECT p.id, p.nickname, p.role, p.rank
         FROM clan_members cm
         JOIN players p ON p.id = cm.player_id
         WHERE cm.clan_id = ?`,
        [clanId]
    );
    return rows;
}

async function getPlayerBlessingState(playerId, dungeonId) {
    await ensureClanTables();
    const [rows] = await db.execute(
        "SELECT * FROM clan_blessing_state WHERE player_id=? AND dungeon_id=?",
        [playerId, dungeonId]
    );
    if (rows.length) return rows[0];
    await db.execute(
        "INSERT IGNORE INTO clan_blessing_state (player_id, dungeon_id) VALUES (?, ?)",
        [playerId, dungeonId]
    );
    return { player_id: playerId, dungeon_id: dungeonId, hit_count: 0, skill_count: 0, blessing_used: 0, damage_boost: 0, invincible: 0 };
}

async function updateBlessingState(playerId, dungeonId, updates) {
    const sets  = Object.keys(updates).map(k => `${k}=?`).join(', ');
    const vals  = [...Object.values(updates), playerId, dungeonId];
    await db.execute(`UPDATE clan_blessing_state SET ${sets} WHERE player_id=? AND dungeon_id=?`, vals);
}

function getBlessingDisplay() {
    return Object.entries(CLAN_BLESSINGS).map(([id, b]) =>
        `┃◆ ${id}. ${b.emoji} *${b.name}*\n` +
        `┃◆    📌 ${b.condition}\n` +
        `┃◆    ⚡ ${b.effect}\n` +
        `┃◆────────────`
    ).join('\n');
}

module.exports = {
    PRESET_CLANS,
    CLAN_BLESSINGS,
    ensureClanTables,
    getPlayerClan,
    getClanById,
    getClanMembers,
    getPlayerBlessingState,
    updateBlessingState,
    getBlessingDisplay
};