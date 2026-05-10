const roleMoves = require('../data/roleMoves');

// Prestige rank-scaled cooldowns for buff/debuff/heal moves
const PRESTIGE_RANK_CD = {
    PF: 150, PE: 130, PD: 110, PC: 90, PB: 70, PA: 50, PS: 30
};
function resolvePrestigeCooldown(cooldown, rank, type) {
    if (cooldown === 'RANKED')      return PRESTIGE_RANK_CD[rank] || 150;
    if (cooldown === 'RANKED_HEAL') return Math.floor((PRESTIGE_RANK_CD[rank] || 150) * 0.7);
    return cooldown;
}
const prestigeRoleMoves = require('../data/prestigeRoleMoves');
const weaponMoves = require('../data/weaponMoves');
const { getBuffModifiers } = require('./activeBuffs');
const { getCooldownMultiplier } = require('../data/rankMultipliers');
const { getFatigueMultiplier } = require('./fatigueSystem');

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
    roleMoveList.forEach(m => {
        const cd = resolvePrestigeCooldown(m.cooldown, player.rank, m.type);
        moves.push({ ...m, cooldown: cd, source: 'role' });
    });

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

    let buffMods = { strength: 0, agility: 0, intelligence: 0, stamina: 0, attack: 0, defense: 0,
                     strength_pct: 0, agility_pct: 0, intelligence_pct: 0, stamina_pct: 0, attack_pct: 0, defense_pct: 0 };
    try {
        if (player.id) {
            const mods = getBuffModifiers('player', player.id);
            if (mods) buffMods = mods;
        }
    } catch (e) {}

    const baseStat  = typeof player[statUsed] === 'number' ? player[statUsed] : 5;
    const buffFlat  = typeof buffMods[statUsed] === 'number' ? buffMods[statUsed] : 0;
    const buffPct   = typeof buffMods[statUsed + '_pct'] === 'number' ? buffMods[statUsed + '_pct'] : 0;
    // Apply percent buff first, then flat
    let statValue   = Math.floor(baseStat * (1 + buffPct / 100)) + buffFlat;

    let totalBonus = 0;
    if (Array.isArray(equippedItems)) {
        equippedItems.forEach(item => {
            if (!item) return;
            totalBonus += Number(item.attack_bonus) || 0;
            if (statUsed === 'strength')     totalBonus += Number(item.strength_bonus) || 0;
            else if (statUsed === 'agility') totalBonus += Number(item.agility_bonus) || 0;
            else if (statUsed === 'intelligence') totalBonus += Number(item.intelligence_bonus) || 0;
            else if (statUsed === 'stamina') totalBonus += Number(item.stamina_bonus) || 0;
        });
    }

    totalBonus += Number(buffMods.attack) || 0;
    // Apply attack_pct bonus to weapon bonus too
    const attackPct = Number(buffMods.attack_pct) || 0;
    if (attackPct > 0) totalBonus = Math.floor(totalBonus * (1 + attackPct / 100));

    // ── ENEMY DEFENSE (with debuffs applied) ──────────────────────────────
    let enemyDefMods = { defense: 0, defense_pct: 0 };
    try {
        if (enemy.id) {
            const eMods = getBuffModifiers('enemy', enemy.id);
            if (eMods) enemyDefMods = eMods;
        }
    } catch (e) {}
    const rawDef    = Number(enemy.def) || 0;
    // Apply flat debuff first, then percent reduction
    const defAfterFlat = rawDef + (Number(enemyDefMods.defense) || 0);
    const defPct       = Number(enemyDefMods.defense_pct) || 0;
    const actualDef    = Math.max(0, Math.floor(defAfterFlat * (1 + defPct / 100)));

    // ── DAMAGE FORMULA ────────────────────────────────────────────────────
    const staminaScale = (move.stat === 'stamina') ? 1.4 : 1.0;
    const totalAttack  = (statValue + totalBonus) * staminaScale;
    const damageReduction = Math.floor(actualDef * 0.4);
    const multiplier      = move.multiplier || 1;

    let damage = Math.floor(Math.max(1, totalAttack) * multiplier) - damageReduction;
    damage = Math.max(1, damage);
    const fatigueMultiplier = getFatigueMultiplier(player);
    return Math.max(1, Math.floor(damage * fatigueMultiplier));
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
    const baseHeal   = move.baseHeal   || 0;
    return Math.floor(statValue * multiplier + baseHeal);
}

module.exports = {
    getAllMoves,
    calculateMoveDamage,
    calculateHeal,
    getMoveCooldown,
    setMoveCooldown
};