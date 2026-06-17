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
const { getTurnEffect, getTurnEffectByName, tickTurnEffect, getEffect, getEffectByName } = require('./potionEffects');
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
    // Prestige moves already have rank-baked cooldowns via resolvePrestigeCooldown.
    // For prestige players, treat as S-rank for normal move scaling (they've surpassed S).
    const effectiveRank = String(playerRank || '').startsWith('P') ? 'S' : playerRank;
    const multiplier = getCooldownMultiplier(effectiveRank);
    // Floor at 3s to prevent spam at high ranks
    const actualCooldown = Math.max(10, Math.floor(baseCooldownSeconds * multiplier));
    cooldowns.set(key, Date.now() + actualCooldown * 1000);
    return actualCooldown;
}

// Clear all cooldowns for a player — called when entering a new dungeon
function clearPlayerCooldowns(userId) {
    for (const key of cooldowns.keys()) {
        if (key.startsWith(userId + '_')) {
            cooldowns.delete(key);
        }
    }
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

function calculateMoveDamage(player, move, enemy, equippedItems, { noTick = false } = {}) {
    if (!player || !move || !enemy) return 0;
    if (move.type !== 'damage') return 0;

    let statUsed = 'strength';
    if (move.stat && typeof player[move.stat] === 'number') {
        statUsed = move.stat;
    }

    let buffMods = {
        strength: 0,
        agility: 0,
        intelligence: 0,
        stamina: 0,
        attack: 0,
        defense: 0
    };

    try {
        if (player.id) {
            const mods = getBuffModifiers('player', player.id);
            if (mods) buffMods = mods;
        }
    } catch (e) {}

    const baseStat  = typeof player[statUsed] === 'number' ? player[statUsed] : 5;
    const buffValue = typeof buffMods[statUsed] === 'number' ? buffMods[statUsed] : 0;

    let statValue = baseStat + buffValue;

    let totalBonus = 0;

    if (Array.isArray(equippedItems)) {
        equippedItems.forEach(item => {
            if (!item) return;

            totalBonus += Number(item.attack_bonus) || 0;

            if (statUsed === 'strength') {
                totalBonus += Number(item.strength_bonus) || 0;
            } else if (statUsed === 'agility') {
                totalBonus += Number(item.agility_bonus) || 0;
            } else if (statUsed === 'intelligence') {
                totalBonus += Number(item.intelligence_bonus) || 0;
            } else if (statUsed === 'stamina') {
                totalBonus += Number(item.stamina_bonus) || 0;
            }
        });
    }

    totalBonus += Number(buffMods.attack) || 0;

    // ── BASE DAMAGE ─────────────────────────────────────────────

    const staminaScale = (move.stat === 'stamina') ? 1.4 : 1.0;
    const totalAttack  = (statValue + totalBonus) * staminaScale;

    // ── ENEMY DEFENSE ───────────────────────────────────────────

    let actualEnemyDef = Number(enemy.def) || 0;

    try {
        if (enemy.id) {
            const enemyMods = getBuffModifiers('enemy', enemy.id);

            if (enemyMods) {
                const flatMod = Number(enemyMods.defense) || 0;
                const pctMod  = Number(enemyMods.defense_pct) || 0;

                actualEnemyDef = Math.max(
                    0,
                    Math.floor((actualEnemyDef + flatMod) * (1 + pctMod / 100))
                );
            }
        }
    } catch (e2) {}

    const defense          = actualEnemyDef;
    const damageReduction  = Math.floor(defense * 0.4);
    const multiplier       = move.multiplier || 1;

    let damage = Math.floor(Math.max(1, totalAttack) * multiplier) - damageReduction;

    // ── POTION EFFECTS ──────────────────────────────────────────

    try {
        const berserkFx = getTurnEffectByName(player.id, 'berserk');
        if (berserkFx) {
            damage = Math.floor(damage * (berserkFx.data.mult || 3.0));
        }

        const trueDmgFx = getTurnEffectByName(player.id, 'true_damage');
        if (trueDmgFx) {
            damage = Math.floor(Math.max(1, totalAttack) * multiplier);
        }

        const statBoostFx = getTurnEffectByName(player.id, 'stat_boost');
        if (statBoostFx) {
            damage = Math.floor(damage * (statBoostFx.data.mult || 1.25));
        }

        const chaosFx3 = getTurnEffectByName(player.id, 'chaos_mode');
        if (chaosFx3) {
            damage = Math.floor(damage * (1 + (chaosFx3.data.amp || 0.5)));
        }

        const permFx = getEffectByName(player.id, 'damage_boost', null);
        if (permFx) {
            damage = Math.floor(damage * (permFx.data.mult || 1.2));
        }

        const critFx = getTurnEffectByName(player.id, 'guaranteed_crit');
        if (critFx) {
            damage = Math.floor(damage * (critFx.data.mult || 2));
        }

        if (!noTick) {
            tickTurnEffect(player.id);
        }

    } catch (e) {
        console.log('Potion damage calc error:', e.message);
    }

    // Apply fatigue multiplier — same penalty as basic attacks
    try {
        const fatigueMultiplier = getFatigueMultiplier(player);
        damage = Math.floor(damage * fatigueMultiplier);
    } catch(e) {}

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
    setMoveCooldown,
    clearPlayerCooldowns
};