/**
 * TERRITORY BONUS SYSTEM
 * Applies passive bonuses to clan members based on territories held.
 *
 * Bonuses:
 *   Assembly Hold    → +20% Gold from dungeon clears
 *   Wrathborne Hold  → +25% damage in dungeon combat
 *   Remnant Sanctum  → +30% XP from all sources
 */

const db = require('../database/db');
const { getClanTerritoryBonuses } = require('./voidTerritories');
const { getPlayerClan } = require('./clanSystem');

// Cache clan bonuses for 2 minutes to avoid DB spam
const bonusCache = new Map();
const CACHE_TTL = 2 * 60 * 1000;

async function getPlayerTerritoryBonuses(playerId) {
    const cached = bonusCache.get(playerId);
    if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.bonuses;

    try {
        const { getPlayerClan } = require('./clanSystem');
        const clan = await getPlayerClan(playerId);
        if (!clan) return [];

        const bonuses = await getClanTerritoryBonuses(clan.id);
        bonusCache.set(playerId, { bonuses, ts: Date.now() });
        return bonuses;
    } catch(e) {
        return [];
    }
}

function clearBonusCache(playerId) {
    bonusCache.delete(playerId);
}

// Apply gold bonus — call after dungeon clear gold reward
async function applyGoldBonus(playerId, baseGold) {
    const bonuses = await getPlayerTerritoryBonuses(playerId);
    const goldBonus = bonuses.find(b => b.type === 'gold_bonus');
    if (!goldBonus) return baseGold;
    const bonus = Math.floor(baseGold * goldBonus.value);
    if (bonus > 0) {
        await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [bonus, playerId]).catch(() => {});
    }
    return baseGold + bonus;
}

// Apply XP bonus — call after any XP award
async function applyXpBonus(playerId, baseXp) {
    const bonuses = await getPlayerTerritoryBonuses(playerId);
    const xpBonus = bonuses.find(b => b.type === 'xp_bonus');
    if (!xpBonus) return baseXp;
    const bonus = Math.floor(baseXp * xpBonus.value);
    if (bonus > 0) {
        await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [bonus, playerId]).catch(() => {});
    }
    return baseXp + bonus;
}

// Get damage multiplier for dungeon combat
async function getDamageBonusMultiplier(playerId) {
    const bonuses = await getPlayerTerritoryBonuses(playerId);
    const dmgBonus = bonuses.find(b => b.type === 'damage_bonus');
    return dmgBonus ? (1 + dmgBonus.value) : 1.0;
}

// Get bonus label for display (e.g. in !me or dungeon reply)
async function getBonusLabel(playerId) {
    const bonuses = await getPlayerTerritoryBonuses(playerId);
    if (!bonuses.length) return null;
    return bonuses.map(b => b.label + ': ' + b.description).join(' | ');
}

module.exports = {
    getPlayerTerritoryBonuses,
    clearBonusCache,
    applyGoldBonus,
    applyXpBonus,
    getDamageBonusMultiplier,
    getBonusLabel
};