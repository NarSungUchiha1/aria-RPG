const db = require('../database/db');

async function ensureTables() {
    await db.execute(`ALTER TABLE players ADD COLUMN IF NOT EXISTS prestige_level INT DEFAULT 0`).catch(() => {});
    await db.execute(`ALTER TABLE players ADD COLUMN IF NOT EXISTS last_active DATETIME DEFAULT NOW()`).catch(() => {});
}

async function getPrestigeBadge(prestigeLevel) {
    if (!prestigeLevel || prestigeLevel <= 0) return '';
    return '⭐'.repeat(Math.min(prestigeLevel, 5));
}

async function getRankDisplay(player) {
    const badge = await getPrestigeBadge(player.prestige_level);
    if (badge) return `${badge}${player.rank}`;
    return player.rank;
}

async function canPrestige(playerId) {
    const [rows] = await db.execute("SELECT `rank`, prestige_level FROM players WHERE id=?", [playerId]);
    if (!rows.length) return { ok: false, reason: 'not_registered' };
    if (rows[0].rank !== 'S') return { ok: false, reason: 'not_s_rank', rank: rows[0].rank };
    return { ok: true, currentPrestige: rows[0].prestige_level || 0 };
}

// ── PRESTIGE STARTING STATS ──────────────────────────────────────────────────
// These are the constant role-based stats every player starts with on prestige.
// Calibrated for PF dungeon content — meaningful but requiring prestige gear.
// Every subsequent prestige resets to the same values (no stat inflation).
const PRESTIGE_BASE_STATS = {
    Berserker: {
        strength: 250, agility: 100, intelligence: 20, stamina: 120,
        hp: 900,  max_hp: 900,  mana: 50
    },
    Assassin: {
        strength: 100, agility: 250, intelligence: 20, stamina: 100,
        hp: 800,  max_hp: 800,  mana: 50
    },
    Mage: {
        strength: 20,  agility: 100, intelligence: 250, stamina: 100,
        hp: 800,  max_hp: 800,  mana: 200
    },
    Tank: {
        strength: 120, agility: 50,  intelligence: 20,  stamina: 250,
        hp: 1500, max_hp: 1500, mana: 50
    },
    Healer: {
        strength: 20,  agility: 80,  intelligence: 220, stamina: 150,
        hp: 1000, max_hp: 1000, mana: 200
    }
};
// ─────────────────────────────────────────────────────────────────────────────

async function doPrestige(playerId) {
    await ensureTables();
    const check = await canPrestige(playerId);
    if (!check.ok) return check;

    const newLevel = check.currentPrestige + 1;

    // Strip gold and XP on every prestige
    await db.execute("UPDATE currency SET gold = 0 WHERE player_id=?", [playerId]);
    await db.execute("UPDATE xp SET xp = 0 WHERE player_id=?", [playerId]);

    // Reset rank to F, update prestige level
    await db.execute(
        "UPDATE players SET `rank`='F', prestige_level=? WHERE id=?",
        [newLevel, playerId]
    );

    // Apply constant role-based prestige starting stats
    const [player] = await db.execute("SELECT role FROM players WHERE id=?", [playerId]);
    const role = player[0]?.role;
    const stats = PRESTIGE_BASE_STATS[role] || PRESTIGE_BASE_STATS['Berserker'];

    await db.execute(
        `UPDATE players SET
            strength=?, agility=?, intelligence=?, stamina=?,
            hp=?, max_hp=?, mana=?
         WHERE id=?`,
        [stats.strength, stats.agility, stats.intelligence, stats.stamina,
         stats.hp, stats.max_hp, stats.mana, playerId]
    );

    return { ok: true, newLevel, stats, role };
}

async function updateLastActive(playerId) {
    await db.execute("UPDATE players SET last_active=NOW() WHERE id=?", [playerId]).catch(() => {});
}

async function clearInactivePlayers() {
    await db.execute(
        `DELETE dp FROM dungeon_players dp
         JOIN players p ON p.id = dp.player_id
         WHERE p.last_active < DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND dp.dungeon_id IN (SELECT id FROM dungeon WHERE is_active=0)`
    ).catch(() => {});
    console.log('🧹 Cleared inactive dungeon players');
}

module.exports = {
    ensureTables,
    getPrestigeBadge,
    getRankDisplay,
    canPrestige,
    doPrestige,
    updateLastActive,
    clearInactivePlayers,
    PRESTIGE_BASE_STATS
};