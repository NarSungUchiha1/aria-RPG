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
const db = require('../database/db');

const cooldowns = new Map();

// ── ASCENDANT SIGNATURE MOVES ─────────────────────────────────────────────────
// The 5 moves a player defines in the resonance ritual (stored as {name,desc} in
// resonance_profiles.moves) become REAL, powerful combat moves. Cached because
// they're immutable once set. Scaling stat is chosen at build time from the
// player's CURRENT best offensive stat so it keeps up as they grow.
const signatureMovesCache = new Map(); // playerId -> enriched [{name,desc,type,power}] or null
const signatureLevelCache = new Map(); // playerId -> { moveName: level }  (filled by leveling system)
const signatureWeaponCache = new Map(); // playerId -> { name, moves:[{name,desc,type,power}] } or null

// Per power-tier magnitudes. AI assigns each move a type + power tier at ritual
// time; we own the actual numbers so moves stay balanced. Level scales them up.
const POWER_TIER = { weak: 0, medium: 1, strong: 2, ultimate: 3 };
const DMG_MULT   = [1.8, 2.4, 3.0, 4.0];
const HEAL_MULT  = [3.0, 4.0, 5.0, 6.5];
const HEAL_BASE  = [20, 30, 45, 65];
const SHIELD_VAL = [90, 150, 240, 380];
const BUFF_VAL   = [20, 30, 45, 65];
const DEBUFF_VAL = [10, 16, 24, 34];
const TIER_CD    = [2, 3, 5, 8];
const TIER_COST  = [8, 12, 18, 26];
const LEVEL_STEP = 0.08; // +8% power per level

// Usage-based leveling: a signature move earns 1 XP each time it's used; it
// levels every USES_PER_LEVEL uses up to MAX_SIG_LEVEL, getting stronger.
const USES_PER_LEVEL = 8;
const MAX_SIG_LEVEL  = 10;
function levelFromXp(xp) { return Math.min(MAX_SIG_LEVEL, 1 + Math.floor((Number(xp) || 0) / USES_PER_LEVEL)); }

let progressTableReady = false;
async function ensureProgressTable() {
    if (progressTableReady) return;
    try {
        await db.execute(`CREATE TABLE IF NOT EXISTS resonance_move_progress (
            player_id VARCHAR(50) NOT NULL,
            move_name VARCHAR(80) NOT NULL,
            xp INT DEFAULT 0,
            PRIMARY KEY (player_id, move_name)
        )`);
        progressTableReady = true;
    } catch {}
}

// Called (fire-and-forget) when a signature move is used. Increments XP and
// refreshes the level cache so the move scales up as it's used.
async function recordSignatureUse(playerId, moveName) {
    try {
        await ensureProgressTable();
        await db.execute(
            'INSERT INTO resonance_move_progress (player_id, move_name, xp) VALUES (?,?,1) ON DUPLICATE KEY UPDATE xp = xp + 1',
            [playerId, moveName]
        );
        const [rows] = await db.execute('SELECT xp FROM resonance_move_progress WHERE player_id=? AND move_name=?', [playerId, moveName]);
        const level = levelFromXp(rows[0]?.xp || 1);
        const levels = signatureLevelCache.get(playerId) || {};
        levels[moveName] = level;
        signatureLevelCache.set(playerId, levels);
    } catch {}
}

async function ensureSignatureMoves(playerId) {
    if (!playerId || signatureMovesCache.has(playerId)) return;
    try {
        const [rows] = await db.execute('SELECT moves, weapon_name, weapon_moves FROM resonance_profiles WHERE player_id=? LIMIT 1', [playerId]);
        if (!rows.length) { signatureMovesCache.set(playerId, null); signatureWeaponCache.set(playerId, null); return; }
        let moves = [];
        try { moves = JSON.parse(rows[0].moves || '[]'); } catch { moves = []; }
        signatureMovesCache.set(playerId, Array.isArray(moves) && moves.length ? moves : null);

        // Unique Ascendant weapon (forged at rebirth).
        let wMoves = [];
        try { wMoves = JSON.parse(rows[0].weapon_moves || '[]'); } catch { wMoves = []; }
        signatureWeaponCache.set(playerId,
            (rows[0].weapon_name && Array.isArray(wMoves) && wMoves.length) ? { name: rows[0].weapon_name, moves: wMoves } : null);

        // Load per-move levels from usage progress.
        await ensureProgressTable();
        const [prog] = await db.execute('SELECT move_name, xp FROM resonance_move_progress WHERE player_id=?', [playerId]);
        const levels = {};
        prog.forEach(p => { levels[p.move_name] = levelFromXp(p.xp); });
        signatureLevelCache.set(playerId, levels);
    } catch {
        signatureMovesCache.set(playerId, null);
        signatureWeaponCache.set(playerId, null);
    }
}

// Populate/refresh the cache directly (called right after the ritual completes).
function setSignatureMoves(playerId, moves) {
    if (!playerId) return;
    signatureMovesCache.set(playerId, Array.isArray(moves) && moves.length ? moves : null);
}

function setAscendantWeapon(playerId, name, moves) {
    if (!playerId) return;
    signatureWeaponCache.set(playerId,
        (name && Array.isArray(moves) && moves.length) ? { name, moves } : null);
}

function bestOffensiveStat(player) {
    const s = {
        strength:     Number(player.strength)     || 0,
        agility:      Number(player.agility)      || 0,
        intelligence: Number(player.intelligence) || 0
    };
    return Object.entries(s).sort((a, b) => b[1] - a[1])[0][0];
}

function tierOf(power) { return POWER_TIER[String(power || 'medium').toLowerCase()] ?? 1; }

function buildSignatureMoveObjects(player, resMoves, levels = {}, opts = {}) {
    if (!Array.isArray(resMoves) || !resMoves.length) return [];
    const source = opts.source || 'signature';
    const stat = bestOffensiveStat(player);
    return resMoves.slice(0, 5).map(m => {
        const t     = tierOf(m.power);
        const level = Math.max(1, Number(levels[m.name]) || 1);
        const s     = 1 + (level - 1) * LEVEL_STEP; // level scaling
        const base  = {
            name: m.name, desc: m.desc || '', source, signature: true,
            level, cooldown: TIER_CD[t], cost: TIER_COST[t],
            ...(opts.weapon ? { weapon: opts.weapon } : {})
        };
        switch (m.type) {
            case 'heal':
                return { ...base, type: 'heal', stat: 'intelligence',
                         multiplier: +(HEAL_MULT[t] * s).toFixed(2), baseHeal: Math.round(HEAL_BASE[t] * s) };
            case 'shield':
            case 'evasion':
                return { ...base, type: 'shield', value: Math.round(SHIELD_VAL[t] * s),
                         duration: 2, evasion: m.type === 'evasion' };
            case 'buff':
                return { ...base, type: 'buff', effect: stat, value: Math.round(BUFF_VAL[t] * s), duration: 3 };
            case 'debuff':
                return { ...base, type: 'debuff', effect: 'attack', value: -Math.round(DEBUFF_VAL[t] * s), duration: 3 };
            default:
                return { ...base, type: 'damage', stat, multiplier: +(DMG_MULT[t] * s).toFixed(2) };
        }
    });
}

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

    // If this was a signature move, earn XP toward leveling (non-blocking).
    const sig = signatureMovesCache.get(userId);
    if (sig && sig.some(m => m.name === moveName)) {
        recordSignatureUse(userId, moveName).catch(() => {});
    }

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
    // ── ASCENDANT: reborn. Kit is ONLY their 5 signature moves + the 3 moves of
    // their unique weapon. No role moves, no equipped/void weapon moves — those
    // were stripped at rebirth. (Cache primed via ensureSignatureMoves.)
    const sig = signatureMovesCache.get(player.id);
    if (sig) {
        const moves  = [];
        const levels = signatureLevelCache.get(player.id) || {};
        buildSignatureMoveObjects(player, sig, levels).forEach(m => moves.push(m));
        const weapon = signatureWeaponCache.get(player.id);
        if (weapon && Array.isArray(weapon.moves)) {
            buildSignatureMoveObjects(player, weapon.moves, {}, { source: 'weapon', weapon: weapon.name })
                .forEach(m => moves.push(m));
        }
        return moves;
    }

    // ── Normal players: role moves + equipped-weapon moves.
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
    clearPlayerCooldowns,
    ensureSignatureMoves,
    setSignatureMoves,
    setAscendantWeapon
};