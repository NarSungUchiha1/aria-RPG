// Cooldown multiplier per rank (F rank = 1.0)
const rankCooldownMultipliers = {
    F: 1.0,
    E: 0.8,
    D: 0.6,
    C: 0.4,
    B: 0.25,
    A: 0.18,
    S: 0.15   // base 100s → 15s at S
};

function getCooldownMultiplier(rank) {
    return rankCooldownMultipliers[rank] || 1.0;
}

module.exports = { getCooldownMultiplier };