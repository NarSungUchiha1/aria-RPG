const db = require('../database/db');

async function ensureTables() {
    await db.execute(`ALTER TABLE players ADD COLUMN IF NOT EXISTS prestige_level INT DEFAULT 0`).catch(() => {});
    await db.execute(`ALTER TABLE players ADD COLUMN IF NOT EXISTS last_active DATETIME DEFAULT NOW()`).catch(() => {});
}

// ── PRESTIGE BASE STATS ───────────────────────────────────────────────────────
// Tuned for PF content: enemies have 8k-11k HP, 180-240 ATK, 200-240 DEF
// 40% damage reduction from DEF, so players need real stats + prestige weapon to clear
// Tank gets more HP, Mage/Healer get mana, Assassin gets agility for evasion
const PRESTIGE_BASE_STATS = {
    Berserker: { strength: 300, agility: 120,  intelligence: 20,  stamina: 150,  hp: 1200, max_hp: 1200, mana: 100  },
    Assassin:  { strength: 120, agility: 300,  intelligence: 20,  stamina: 120,  hp: 1000, max_hp: 1000, mana: 100  },
    Mage:      { strength: 20,  agility: 120,  intelligence: 300, stamina: 120,  hp: 1000, max_hp: 1000, mana: 400  },
    Tank:      { strength: 150, agility: 60,   intelligence: 20,  stamina: 300,  hp: 2000, max_hp: 2000, mana: 100  },
    Healer:    { strength: 20,  agility: 100,  intelligence: 260, stamina: 180,  hp: 1200, max_hp: 1200, mana: 400  }
};

// ── PRESTIGE RANK STAT GAINS ──────────────────────────────────────────────────
// Each rank up gives meaningful stat increases — by PS players are truly void-tier
const PRESTIGE_STAT_GAINS = {
    PE: { stats: 40,  hp: 300,  mana: 80  },
    PD: { stats: 70,  hp: 500,  mana: 120 },
    PC: { stats: 110, hp: 800,  mana: 180 },
    PB: { stats: 160, hp: 1200, mana: 250 },
    PA: { stats: 220, hp: 1800, mana: 350 },
    PS: { stats: 300, hp: 2500, mana: 500 }
};

async function getPrestigeBadge(prestigeLevel) {
    if (!prestigeLevel || prestigeLevel <= 0) return '';
    return '⭐'.repeat(Math.min(prestigeLevel, 5));
}

async function canPrestige(playerId) {
    const [rows] = await db.execute("SELECT `rank`, prestige_level FROM players WHERE id=?", [playerId]);
    if (!rows.length) return { ok: false, reason: 'not_registered' };
    if (rows[0].rank !== 'S') return { ok: false, reason: 'not_s_rank', rank: rows[0].rank };
    return { ok: true, currentPrestige: rows[0].prestige_level || 0 };
}

async function doPrestige(playerId) {
    await ensureTables();
    const check = await canPrestige(playerId);
    if (!check.ok) return check;

    const newLevel = check.currentPrestige + 1;

    // Strip gold and XP
    await db.execute("UPDATE currency SET gold = 0 WHERE player_id=?", [playerId]);
    await db.execute("UPDATE xp SET xp = 0 WHERE player_id=?", [playerId]);

    // Reset rank to PF (prestige rank start)
    await db.execute("UPDATE players SET `rank`='PF', prestige_level=? WHERE id=?", [newLevel, playerId]);

    // Apply constant role-based prestige starting stats
    const [player] = await db.execute("SELECT role FROM players WHERE id=?", [playerId]);
    const role  = player[0]?.role;
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

module.exports = {
    ensureTables,
    getPrestigeBadge,
    canPrestige,
    doPrestige,
    updateLastActive,
    PRESTIGE_BASE_STATS,
    PRESTIGE_STAT_GAINS
};