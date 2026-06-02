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
const { getTurnEffect, tickTurnEffect, getEffect } = require('./potionEffects');
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

    // Apply fatigue multiplier to all skill damage
    const { getFatigueMultiplier } = require('./fatigueSystem');
    const fatigueMultiplier = getFatigueMultiplier(player);

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
        const turnFx = getTurnEffect(player.id);
        // FIX: getEffect(id, null) only matches effects with dungeonId=null.
        // Permanent potion effects are stored with a dungeonId, so we need to
        // check the activeEffects map directly for ANY effect for this player.
        const { activeEffects } = require('./potionEffects');
        const permFx = activeEffects.get(player.id) || null;

        // Berserk
        if (turnFx?.effect === 'berserk') {
            damage = Math.floor(damage * (turnFx.data.mult || 3.0));
        }

        // True Damage
        if (turnFx?.effect === 'true_damage') {
            damage = Math.floor(Math.max(1, totalAttack) * multiplier);
        }

        // Void Resonance
        if (turnFx?.effect === 'stat_boost') {
            damage = Math.floor(damage * (turnFx.data.mult || 1.25));
        }

        // Chaos Mode
        if (turnFx?.effect === 'chaos_mode') {
            damage = Math.floor(damage * (1 + (turnFx.data.amp || 0.5)));
        }

        // Permanent potion boosts
        if (permFx?.effect === 'damage_boost') {
            damage = Math.floor(damage * (permFx.data.mult || 1.2));
        }

        // Critical potion effect
        if (turnFx?.effect === 'guaranteed_crit') {
            damage = Math.floor(damage * (turnFx.data.mult || 2));
        }

        if (!noTick) {
            tickTurnEffect(player.id);
        }

    } catch (e) {
        console.log('Potion damage calc error:', e.message);
    }

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