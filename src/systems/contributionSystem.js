/**
 * Contribution-based loot system.
 * Tracks damage dealt, heals given, buffs applied, debuffs applied per stage.
 * After stage clear, ranks players and assigns drops — best contributors get rarest loot.
 * Minimum threshold required to receive any drop.
 */

// In-memory stage contribution tracker
// Key: dungeonId, Value: Map<playerId, { damage, heals, buffs, debuffs, nickname }>
const stageContributions = new Map();

const CONTRIBUTION_WEIGHTS = {
    damage:  1.0,
    heal:    2.0,
    buff:    50,
    debuff:  50,
    shield:  80,   // tanks: per shield applied
    taunt:   120   // tanks: per taunt applied
};

// Minimum contribution score to receive any loot — set low so anyone who participates qualifies
const MIN_CONTRIBUTION = 100;

function initStage(dungeonId) {
    stageContributions.set(dungeonId, new Map());
}

function trackContribution(dungeonId, playerId, nickname, type, value = 1) {
    if (!stageContributions.has(dungeonId)) initStage(dungeonId);
    const map = stageContributions.get(dungeonId);
    if (!map.has(playerId)) {
        map.set(playerId, { damage: 0, heals: 0, buffs: 0, debuffs: 0, shields: 0, taunts: 0, nickname });
    }
    const p = map.get(playerId);
    p.nickname = nickname; // keep fresh
    switch (type) {
        case 'damage':  p.damage  += value; break;
        case 'heal':    p.heals   += value; break;
        case 'buff':    p.buffs   += value; break;
        case 'debuff':  p.debuffs += value; break;
        case 'shield':  p.shields += value; break;
        case 'taunt':   p.taunts  += value; break;
    }
}

function getContributionScore(entry) {
    return Math.floor(
        entry.damage  * CONTRIBUTION_WEIGHTS.damage  +
        entry.heals   * CONTRIBUTION_WEIGHTS.heal    +
        entry.buffs   * CONTRIBUTION_WEIGHTS.buff    +
        entry.debuffs * CONTRIBUTION_WEIGHTS.debuff  +
        (entry.shields || 0) * CONTRIBUTION_WEIGHTS.shield +
        (entry.taunts  || 0) * CONTRIBUTION_WEIGHTS.taunt
    );
}

/**
 * Returns ranked contributors for this stage.
 * Filters out those below MIN_CONTRIBUTION threshold.
 * Returns array sorted by score descending: [{ playerId, nickname, score }]
 */
function getRankedContributors(dungeonId) {
    const map = stageContributions.get(dungeonId);
    if (!map) return [];

    const all = [];
    for (const [playerId, entry] of map.entries()) {
        const score = getContributionScore(entry);
        all.push({ playerId, nickname: entry.nickname, score, ...entry });
    }

    // ✅ If nobody meets MIN_CONTRIBUTION (tracker may have missed some actions),
    // fall back to giving everyone with ANY score a drop
    const qualified = all.filter(p => p.score >= MIN_CONTRIBUTION);
    const ranked = (qualified.length > 0 ? qualified : all.filter(p => p.score > 0));

    ranked.sort((a, b) => b.score - a.score);
    return ranked;
}

/**
 * Assign drops to contributors.
 * Top contributor gets pick of rarest drop.
 * Second gets next rarest, etc.
 * Those below threshold get nothing.
 */
function assignDropsToContributors(dungeonId, drops) {
    const ranked = getRankedContributors(dungeonId);
    if (!ranked.length || !drops.length) return [];

    // Sort drops by rarity — legendary first, then rare, uncommon, common
    const rarityOrder = { legendary: 0, rare: 1, uncommon: 2, common: 3 };
    const sortedDrops = [...drops].sort((a, b) =>
        (rarityOrder[a.rarity] || 3) - (rarityOrder[b.rarity] || 3)
    );

    const assignments = [];
    for (let i = 0; i < ranked.length && i < sortedDrops.length; i++) {
        assignments.push({
            player: ranked[i],
            drop:   sortedDrops[i],
            rank:   i + 1
        });
    }

    return assignments;
}

function clearStage(dungeonId) {
    stageContributions.delete(dungeonId);
}

function getContributionScore(dungeonId, playerId) {
    const map = stageContributions.get(dungeonId);
    if (!map) return 0;
    const entry = map.get(playerId);
    if (!entry) return 0;
    return Math.floor(
        entry.damage  * CONTRIBUTION_WEIGHTS.damage  +
        entry.heals   * CONTRIBUTION_WEIGHTS.heal    +
        entry.buffs   * CONTRIBUTION_WEIGHTS.buff    +
        entry.debuffs * CONTRIBUTION_WEIGHTS.debuff  +
        (entry.shields || 0) * CONTRIBUTION_WEIGHTS.shield +
        (entry.taunts  || 0) * CONTRIBUTION_WEIGHTS.taunt
    );
}

module.exports = {
    getContributionScore,
    initStage,
    trackContribution,
    getRankedContributors,
    assignDropsToContributors,
    clearStage,
    MIN_CONTRIBUTION
};

// ── Pending assignments — player must !pickup within 90s ─────────────────────
const pendingAssignments = new Map();

function setPendingAssignment(playerId, drop, rank) {
    pendingAssignments.set(playerId, { drop, rank, expiresAt: Date.now() + 90000 });
    setTimeout(() => {
        const p = pendingAssignments.get(playerId);
        if (p && p.drop.material === drop.material) pendingAssignments.delete(playerId);
    }, 90000);
}

function getPendingAssignment(playerId) {
    const p = pendingAssignments.get(playerId);
    if (!p) return null;
    if (Date.now() > p.expiresAt) { pendingAssignments.delete(playerId); return null; }
    return p;
}

function clearPendingAssignment(playerId) {
    pendingAssignments.delete(playerId);
}

module.exports.setPendingAssignment  = setPendingAssignment;
module.exports.getPendingAssignment  = getPendingAssignment;
module.exports.clearPendingAssignment = clearPendingAssignment;

// ── Stage Drop Pool — shared by all players ───────────────────────────────────
const stagePools = new Map();

// qualifiedPlayerIds: snapshot of who contributed, taken BEFORE clearStage wipes the tracker
function setStagePool(dungeonId, drops, qualifiedPlayerIds = []) {
    stagePools.set(dungeonId, { drops, qualifiedPlayerIds });
    setTimeout(() => stagePools.delete(dungeonId), 90000);
}

function getStagePool(dungeonId) {
    const entry = stagePools.get(dungeonId);
    if (!entry) return [];
    return Array.isArray(entry) ? entry : (entry.drops || []);
}

function getStageQualified(dungeonId) {
    const entry = stagePools.get(dungeonId);
    if (!entry || Array.isArray(entry)) return [];
    return entry.qualifiedPlayerIds || [];
}

module.exports.setStagePool = setStagePool;
module.exports.getStagePool = getStagePool;
module.exports.getStageQualified = getStageQualified;