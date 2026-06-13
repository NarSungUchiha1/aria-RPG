// Cooldown multiplier per rank (F rank = 1.0)
// Prestige players (PF-PS) are handled in setMoveCooldown — mapped to S (0.15)
// because prestige role moves already have rank-baked cooldowns via resolvePrestigeCooldown.
// Cooldown multipliers per rank.
// Reduction is gentler — high ranks get ~50% reduction max, not 85%.
// Combined with the 10s floor in setMoveCooldown, nothing is spammable.
const rankCooldownMultipliers = {
    F:  1.00,
    E:  0.95,
    D:  0.88,
    C:  0.70,
    B:  0.60,
    A:  0.40,
    S:  0.20,   // base 60s → 30s at S; meaningful reward without enabling spam
};

function getCooldownMultiplier(rank) {
    return rankCooldownMultipliers[rank] || 1.0;
}

module.exports = { getCooldownMultiplier };