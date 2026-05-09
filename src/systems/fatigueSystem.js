const db = require('../database/db');

const FATIGUE_MAX = 100;
const FATIGUE_MIN_MULTIPLIER = 0.6;
const FATIGUE_PER_POINT = 0.003;
const FATIGUE_RECOVERY_PER_TICK = 2;

function clampFatigue(value = 0) {
    return Math.max(0, Math.min(FATIGUE_MAX, Number(value) || 0));
}

function getFatigueMultiplier(player = {}) {
    const fatigue = clampFatigue(player.fatigue);
    if (fatigue >= FATIGUE_MAX) return FATIGUE_MIN_MULTIPLIER;
    return Math.max(FATIGUE_MIN_MULTIPLIER, 1 - fatigue * FATIGUE_PER_POINT);
}

function formatFatigueBar(fatigue = 0) {
    const value = clampFatigue(fatigue);
    const bars = 6;
    const filled = Math.round((value / FATIGUE_MAX) * bars);
    const empty = bars - filled;
    return '🟦'.repeat(filled) + '▫️'.repeat(empty);
}

async function increasePlayerFatigue(playerId, amount = 1) {
    const points = Math.max(0, Number(amount) || 0);
    if (!playerId || points === 0) return;
    await db.execute(
        "UPDATE players SET fatigue = LEAST(100, GREATEST(0, COALESCE(fatigue, 0) + ?)) WHERE id=?",
        [points, playerId]
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
    FATIGUE_PER_POINT,
    FATIGUE_RECOVERY_PER_TICK,
    clampFatigue,
    getFatigueMultiplier,
    formatFatigueBar,
    increasePlayerFatigue,
    recoverPlayerFatigue,
    ensureFatigueColumn
};
