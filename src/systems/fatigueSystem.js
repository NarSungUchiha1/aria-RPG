const db = require('../database/db');

const FATIGUE_MAX = 100;
const FATIGUE_MIN_MULTIPLIER = 0.02;  // ~1 damage at full fatigue
const FATIGUE_RECOVERY_PER_TICK = 2;

function clampFatigue(value = 0) {
    return Math.max(0, Math.min(FATIGUE_MAX, Number(value) || 0));
}

function getFatigueMultiplier(player = {}) {
    const fatigue = clampFatigue(player.fatigue);
    if (fatigue === 0) return 1.0;
    if (fatigue >= FATIGUE_MAX) return FATIGUE_MIN_MULTIPLIER;
    // Quadratic falloff — gentle early, steep near 100
    const normalized = fatigue / FATIGUE_MAX;               // 0 → 1
    const multiplier  = 1 - (normalized ** 2) * (1 - FATIGUE_MIN_MULTIPLIER);
    return Math.max(FATIGUE_MIN_MULTIPLIER, multiplier);
    // fatigue 25 → ~87%  |  50 → ~76%  |  75 → ~57%  |  90 → ~33%  |  100 → 2%
}

function formatFatigueBar(fatigue = 0) {
    const value = clampFatigue(fatigue);
    const bars = 6;
    const filled = Math.round((value / FATIGUE_MAX) * bars);
    const empty = bars - filled;
    return '🟦'.repeat(filled) + '▫️'.repeat(empty);
}

// ── ROLE-BASED FATIGUE RATE ────────────────────────────────────────────────
// Tanks are built to sustain. They gain fatigue dramatically slower than other roles.
// Every other role is 1.0 — Tanks generate only 22% of normal fatigue per hit.
const ROLE_FATIGUE_RATE = {
    Tank:      0.22,
    Berserker: 1.0,
    Assassin:  1.0,
    Mage:      1.0,
    Healer:    1.0
};

// ── STAMINA-BASED FATIGUE REDUCTION ────────────────────────────────────────
// High stamina reduces fatigue gain, but only above baseline for that role
// Max reduction: 30% (multiplier goes from 1.0 → 0.7)
function getStaminaFatigueReduction(player = {}) {
    const role = player.role || 'Berserker';
    const stamina = Number(player.stamina) || 5;
    
    // Baseline stamina per role (from register.js initial stats)
    const roleBaseline = {
        Tank: 10,
        Healer: 8,
        Berserker: 5,
        Assassin: 5,
        Mage: 5
    };
    
    const baseline = roleBaseline[role] || 5;
    const excessStamina = Math.max(0, stamina - baseline);
    
    // Each point of excess stamina reduces fatigue gain by 0.2% (capped at 30% reduction)
    const reductionPercent = Math.min(30, excessStamina * 0.2);
    return Math.max(0.7, 1 - reductionPercent / 100);
}

async function increasePlayerFatigue(playerId, amount = 1, player = null) {
    const points = Math.max(0, Number(amount) || 0);
    if (!playerId || points === 0) return;

    let adjustedPoints = points;
    if (player) {
        // Role multiplier first — Tanks barely tire
        const roleMult = ROLE_FATIGUE_RATE[player.role] ?? 1.0;
        // Then stamina reduction on top
        const staminaReduction = getStaminaFatigueReduction(player);
        adjustedPoints = Math.max(1, Math.ceil(points * roleMult * staminaReduction));
    }

    await db.execute(
        "UPDATE players SET fatigue = LEAST(100, GREATEST(0, COALESCE(fatigue, 0) + ?)) WHERE id=?",
        [adjustedPoints, playerId]
    );
}

async function recoverPlayerFatigue(playerId, amount = FATIGUE_RECOVERY_PER_TICK) {
    const points = Math.max(0, Number(amount) || 0);
    if (!playerId || points === 0) return;
    await db.execute(
        "UPDATE players SET fatigue = GREATEST(0, COALESCE(fatigue, 0) - ?) WHERE id=?",
        [points, playerId]
    );
}

async function ensureFatigueColumn() {
    try {
        await db.execute("ALTER TABLE players ADD COLUMN fatigue INT DEFAULT 0");
    } catch (e) {
        // Ignore if column already exists or table is managed externally.
    }
}

module.exports = {
    FATIGUE_MAX,
    FATIGUE_MIN_MULTIPLIER,
    FATIGUE_RECOVERY_PER_TICK,
    clampFatigue,
    getFatigueMultiplier,
    formatFatigueBar,
    getStaminaFatigueReduction,
    increasePlayerFatigue,
    recoverPlayerFatigue,
    ensureFatigueColumn
};