const roleMoves = require('../data/roleMoves');
const prestigeRoleMoves = require('../data/prestigeRoleMoves');
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
    const isPrestige = (player.prestige_level || 0) > 0;
    const roleMoveSource = isPrestige ? prestigeRoleMoves : roleMoves;
    const roleMoveList = roleMoveSource[player.role] || [];
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
            totalBonus += Number(item.attack_bonus) || 0;
            if (statUsed === 'strength') totalBonus += Number(item.strength_bonus) || 0;
            else if (statUsed === 'agility') totalBonus += Number(item.agility_bonus) || 0;
            else if (statUsed === 'intelligence') totalBonus += Number(item.intelligence_bonus) || 0;
            else if (statUsed === 'stamina') totalBonus += Number(item.stamina_bonus) || 0;
        });
    }

    totalBonus += Number(buffMods.attack) || 0;

    // ── DAMAGE FORMULA ──────────────────────────────────────────────────────
    // Calibrated targets (base / with weapon / with buffs):
    // F:  15-20 / 25-30 / 35-45
    // E:  25-35 / 40-50 / 55-70
    // D:  45-60 / 70-85 / 90-115
    // C:  75-100 / 110-140 / 150-185
    // B:  120-160 / 180-220 / 240-290
    // A:  200-260 / 290-350 / 380-450
    // S:  320-400 / 450-550 / 600-750

    const totalAttack = statValue + totalBonus;
    const defense = Number(enemy.def) || 0;
    const damageReduction = Math.floor(defense * 0.4);
    const multiplier = move.multiplier || 1;

    let damage = Math.floor(Math.max(1, totalAttack) * multiplier) - damageReduction;
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
    return Math.floor(statValue * multiplier);
}

module.exports = {
    getAllMoves,
    calculateMoveDamage,
    calculateHeal,
    getMoveCooldown,
    setMoveCooldown
};