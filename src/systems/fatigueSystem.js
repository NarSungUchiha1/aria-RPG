const db = require('../database/db');

const FATIGUE_MAX = 100;
const FATIGUE_MIN_MULTIPLIER = 0.35;  // FIX: was 0.02 (1 damage at full fatigue) — now 35% min
                                       // 2% was way too punishing, players dealt 1 damage at 100 fatigue
const FATIGUE_RECOVERY_PER_TICK = 2;

function clampFatigue(value = 0) {
    return Math.max(0, Math.min(FATIGUE_MAX, Number(value) || 0));
}

function getFatigueMultiplier(player = {}) {
    const fatigue = clampFatigue(player.fatigue);
    if (fatigue === 0) return 1.0;
    if (fatigue >= FATIGUE_MAX) return FATIGUE_MIN_MULTIPLIER;
    // FIX: Linear falloff instead of quadratic
    // Quadratic was too steep — at fatigue 50 players were already at ~76% damage
    // Linear: fatigue 25 → 91%  |  50 → 82%  |  75 → 74%  |  100 → 35%
    const normalized = fatigue / FATIGUE_MAX;  // 0 → 1
    const multiplier = 1 - normalized * (1 - FATIGUE_MIN_MULTIPLIER);
    return Math.max(FATIGUE_MIN_MULTIPLIER, multiplier);
}

function formatFatigueBar(fatigue = 0) {
    const value = clampFatigue(fatigue);
    const bars = 6;
    const filled = Math.round((value / FATIGUE_MAX) * bars);
    const empty = bars - filled;
    return '🟦'.repeat(filled) + '▫️'.repeat(empty);
}

// ── ROLE-BASED FATIGUE RATE ────────────────────────────────────────────────
const ROLE_FATIGUE_RATE = {
    Tank:      0.22,
    Berserker: 1.0,
    Assassin:  1.0,
    Mage:      1.0,
    Healer:    1.0,
    Explorer:  1.0
};

// ── STAMINA-BASED FATIGUE REDUCTION ────────────────────────────────────────
function getStaminaFatigueReduction(player = {}) {
    const role = player.role || 'Berserker';
    const stamina = Number(player.stamina) || 5;

    const roleBaseline = {
        Tank: 10, Healer: 8, Berserker: 5, Assassin: 5, Mage: 5, Explorer: 5
    };

    const baseline = roleBaseline[role] || 5;
    const excessStamina = Math.max(0, stamina - baseline);

    // Each point of excess stamina reduces fatigue gain by 0.2% (capped at 30%)
    const reductionPercent = Math.min(30, excessStamina * 0.2);
    return Math.max(0.7, 1 - reductionPercent / 100);
}

// ── FATIGUE GAIN PER ATTACK ───────────────────────────────────────────────
// FIX: Old formula was Math.min(4, Math.max(1, Math.ceil(damage / 120)))
// This ALWAYS gave 1-4 fatigue per hit regardless of player level.
// At S-rank doing 2000+ damage, ceil(2000/120) = 17 → capped at 4 every hit.
// At F-rank doing 20 damage, ceil(20/120) = 1 every hit.
// Result: fatigue always hit 100 within 25-100 hits regardless of rank.
//
// FIX: Base gain is flat 1 per attack. Spam protection handles the escalation separately.
// Role + stamina modifiers still apply via increasePlayerFatigue.
function calculateFatigueGain() {
    return 1; // flat 1 point per attack, before role/stamina modifiers
}

async function increasePlayerFatigue(playerId, amount = 1, player = null) {
    const points = Math.max(0, Number(amount) || 0);
    if (!playerId || points === 0) return;

    let adjustedPoints = points;
    if (player) {
        const roleMult = ROLE_FATIGUE_RATE[player.role] ?? 1.0;
        const staminaReduction = getStaminaFatigueReduction(player);
        // FIX: use Math.round instead of Math.ceil so low-stamina roles don't
        // always get bumped to 1 even when roleMult * staminaReduction < 0.5
        adjustedPoints = Math.round(points * roleMult * staminaReduction);
        // Tank with 0.22 rate: 1 * 0.22 = 0.22 → rounds to 0 (no fatigue per hit)
        // Only accumulates on spam or explicit boosts
        if (adjustedPoints < 0) adjustedPoints = 0;
    }

    if (adjustedPoints === 0) return;

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
    } catch (e) {}
}

module.exports = {
    FATIGUE_MAX,
    FATIGUE_MIN_MULTIPLIER,
    FATIGUE_RECOVERY_PER_TICK,
    clampFatigue,
    getFatigueMultiplier,
    formatFatigueBar,
    getStaminaFatigueReduction,
    calculateFatigueGain,
    increasePlayerFatigue,
    recoverPlayerFatigue,
    ensureFatigueColumn
};