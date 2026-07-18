/**
 * TERRITORY BONUS SYSTEM
 * Applies passive bonuses to clan members based on territories held.
 *
 * Bonuses:
 *   Dawnwatch Bastion  → +20% Gold from dungeon clears
 *   Umbral Court       → +25% damage in dungeon combat
 *   Last Light Sanctum → +30% XP from all sources
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

// Last Light Sanctum perk: 15% chance to revive, once per dungeon. Rolls on each
// death until it procs once; a success is marked so it can't repeat.
const territoryRevives = new Set(); // `${dungeonId}_${playerId}` = revive used
async function tryTerritoryRevive(playerId, dungeonId) {
    try {
        const key = `${dungeonId}_${playerId}`;
        if (territoryRevives.has(key)) return false;
        const bonuses = await getPlayerTerritoryBonuses(playerId);
        if (!bonuses.find(b => b.type === 'xp_bonus')) return false; // Last Light hold only
        if (Math.random() >= 0.15) return false;
        territoryRevives.add(key);
        return true;
    } catch(e) { return false; }
}

module.exports = {
    getPlayerTerritoryBonuses,
    clearBonusCache,
    applyGoldBonus,
    applyXpBonus,
    getDamageBonusMultiplier,
    getBonusLabel,
    tryTerritoryRevive
};