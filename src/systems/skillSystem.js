const roleMoves = require('../data/roleMoves');
const weaponMoves = require('../data/weaponMoves');
const { getBuffModifiers } = require('./activeBuffs');
const { getCooldownMultiplier } = require('../data/rankMultipliers');

const cooldowns = new Map();

function getMoveCooldown(userId, moveName) {
    const key = `${userId}_${moveName}`;
    const lastUsed = cooldowns.get(key) || 0;
    return Math.max(0, lastUsed - Date.now());
}

function setMoveCooldown(userId, moveName, baseCooldownSeconds, playerRank) {
    const key = `${userId}_${moveName}`;
    const multiplier = getCooldownMultiplier(playerRank);
    const actualCooldown = Math.floor(baseCooldownSeconds * multiplier);
    cooldowns.set(key, Date.now() + actualCooldown * 1000);
    return actualCooldown;
}

function getAllMoves(player, equippedItems) {
    const moves = [];
    const roleMoveList = roleMoves[player.role] || [];
    roleMoveList.forEach(m => moves.push({ ...m, source: 'role' }));

    if (Array.isArray(equippedItems)) {
        equippedItems.forEach(item => {
            const weaponMoveList = weaponMoves[item.item_name] || [];
            weaponMoveList.forEach(m => moves.push({ ...m, source: 'weapon', weapon: item.item_name }));
        });
    }
    return moves;
}

function calculateMoveDamage(player, move, enemy, equippedItems) {
    if (!player || !move || !enemy) return 0;
    if (move.type !== 'damage') return 0;

    let statUsed = 'strength';
    if (move.stat && typeof player[move.stat] === 'number') {
        statUsed = move.stat;
    }

    let buffMods = { strength: 0, agility: 0, intelligence: 0, stamina: 0, attack: 0, defense: 0 };
    try {
        if (player.id) {
            const mods = getBuffModifiers('player', player.id);
            if (mods) buffMods = mods;
        }
    } catch (e) {}

    const baseStat = typeof player[statUsed] === 'number' ? player[statUsed] : 5;
    const buffValue = typeof buffMods[statUsed] === 'number' ? buffMods[statUsed] : 0;
    let statValue = baseStat + buffValue;

    let totalBonus = 0;
    if (Array.isArray(equippedItems)) {
        equippedItems.forEach(item => {
            if (!item) return;
            // ✅ Durability affects stat bonuses — lower durability = weaker bonuses
            const maxDur = item.max_durability || 100;
            const curDur = item.durability !== null && item.durability !== undefined ? item.durability : maxDur;
            const durRatio = maxDur > 0 ? Math.max(0, curDur / maxDur) : 1;

            const scale = (val) => Math.floor((Number(val) || 0) * durRatio);

            totalBonus += scale(item.attack_bonus);
            if (statUsed === 'strength') totalBonus += scale(item.strength_bonus);
            else if (statUsed === 'agility') totalBonus += scale(item.agility_bonus);
            else if (statUsed === 'intelligence') totalBonus += scale(item.intelligence_bonus);
            else if (statUsed === 'stamina') totalBonus += scale(item.stamina_bonus);
        });
    }

    totalBonus += Number(buffMods.attack) || 0;

    const totalAttack = statValue + totalBonus;
    const defense = Number(enemy.def) || 0;
    const damageReduction = Math.floor(defense / 3); // ✅ reduced defense penalty
    const multiplier = move.multiplier || 1;

    // ✅ Rank multiplier — higher rank = more base damage
    const rankMult = { F:1.0, E:1.3, D:1.7, C:2.2, B:2.8, A:3.5, S:4.5 };
    const rMult = rankMult[player.rank] || 1.0;

    // ✅ Void Corruption applied externally — pass as param if needed
    // (corruption mult handled in skill.js before calling this)
    let damage = Math.floor(totalAttack * multiplier * rMult) - damageReduction;
    return Math.max(1, damage);
}

function calculateHeal(player, move) {
    if (!player || !move) return 0;
    if (move.type !== 'heal') return 0;

    let buffMods = { strength: 0, agility: 0, intelligence: 0, stamina: 0 };
    try {
        if (player.id) {
            const mods = getBuffModifiers('player', player.id);
            if (mods) buffMods = mods;
        }
    } catch (e) {}

    const statUsed = move.stat && typeof player[move.stat] === 'number' ? move.stat : 'intelligence';
    const baseStat = typeof player[statUsed] === 'number' ? player[statUsed] : 5;
    const buffValue = typeof buffMods[statUsed] === 'number' ? buffMods[statUsed] : 0;
    const statValue = baseStat + buffValue;
    const multiplier = move.multiplier || 1;
    const raw = Math.floor(Math.max(0, statValue) * multiplier) + (move.baseHeal || 0);
    return Math.max(move.baseHeal || 10, raw);
}

module.exports = {
    getAllMoves,
    calculateMoveDamage,
    calculateHeal,
    getMoveCooldown,
    setMoveCooldown
};