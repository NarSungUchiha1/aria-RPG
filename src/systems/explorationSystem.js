/**
 * EXPLORATION SYSTEM
 * Mages and Healers only. Separate Exploration GC.
 * Enter a rift, wait 45 mins, return with materials.
 */

const db = require('../database/db');

const EXPLORATION_GC   = process.env.EXPLORATION_GC_JID || '';
const EXPLORE_DURATION = 45 * 60 * 1000; // 45 minutes
const EXPLORE_TIMEOUT  = 2 * 60 * 60 * 1000; // 2 hour max


// Survival chance per rank — higher ranks have better drops but higher risk
const SURVIVAL_RATES = {
    F: 0.95, E: 0.92, D: 0.88,
    C: 0.83, B: 0.77, A: 0.70, S: 0.62,
    PF: 0.55, PE: 0.50, PD: 0.44,
    PC: 0.38, PB: 0.32, PA: 0.25, PS: 0.18
};

const DEATH_NARRATIVES = [
    'The rift collapsed. You did not make it out.',
    'Something in the deep noticed you. You did not return.',
    'The void took more than your materials this time.',
    'You went too far. The rift sealed behind you.',
    'Whatever found you in there — you never saw it coming.',
    'The fracture was too unstable. You were inside when it closed.',
    'The void keeps what it catches. Today it caught you.'
];

const WOUNDED_NARRATIVES = [
    'You made it back. Something followed you to the edge.',
    'The rift tried to keep you. You fought your way out.',
    'You survived. The cost was your HP.',
    'Something touched you on the way back. You are still counting the damage.'
];

const ENTRY_COSTS = {
    F: 500, E: 500, D: 500,
    C: 1000, B: 1000,
    A: 2000, S: 2000,
    // Prestige
    PF: 5000, PE: 5000, PD: 5000, PC: 5000, PB: 5000, PA: 5000, PS: 5000
};

// Drop tables by role and rank
const DROPS = {
    Mage: {
        common:   ['Spell Component', 'Void Ink', 'Ancient Herb'],
        uncommon: ['Void Crystal', 'Ancient Tome Fragment', 'Shadow Fragment'],
        rare:     ['Void Ink', 'Ancient Tome Fragment'],
        legendary:['Malachar Fragment']
    },
    Healer: {
        common:   ['Healing Moss', 'Purified Water', 'Root Extract'],
        uncommon: ['Life Essence', 'Ancient Herb', 'Iron Root'],
        rare:     ['Blood Root', 'Shadow Essence'],
        legendary:['Malachar Fragment']
    }
};

const PRESTIGE_BONUS_DROPS = ['Void Crystal', 'Ancient Tome Fragment', 'Malachar Fragment'];

// Rank drop rates
const RANK_DROP_RATES = {
    F:  { common: 0.70, uncommon: 0.22, rare: 0.07, legendary: 0.01 },
    E:  { common: 0.65, uncommon: 0.25, rare: 0.08, legendary: 0.02 },
    D:  { common: 0.58, uncommon: 0.28, rare: 0.11, legendary: 0.03 },
    C:  { common: 0.50, uncommon: 0.30, rare: 0.15, legendary: 0.05 },
    B:  { common: 0.42, uncommon: 0.32, rare: 0.20, legendary: 0.06 },
    A:  { common: 0.35, uncommon: 0.33, rare: 0.24, legendary: 0.08 },
    S:  { common: 0.28, uncommon: 0.32, rare: 0.28, legendary: 0.12 },
    PF: { common: 0.30, uncommon: 0.35, rare: 0.25, legendary: 0.10 },
    PE: { common: 0.25, uncommon: 0.35, rare: 0.28, legendary: 0.12 },
    PD: { common: 0.20, uncommon: 0.33, rare: 0.32, legendary: 0.15 },
    PC: { common: 0.15, uncommon: 0.30, rare: 0.35, legendary: 0.20 },
    PB: { common: 0.12, uncommon: 0.28, rare: 0.38, legendary: 0.22 },
    PA: { common: 0.10, uncommon: 0.25, rare: 0.40, legendary: 0.25 },
    PS: { common: 0.08, uncommon: 0.22, rare: 0.42, legendary: 0.28 }
};

// Rift narratives by rank
const RIFT_ENTRY_NARRATIVES = [
    'The air shifts as you step through. Something old notices.',
    'The void here is quiet. That is worse than noise.',
    'You feel the rift close behind you. Not all the way.',
    'The deeper you go the more the silence has weight.',
    'Your footsteps echo in directions that do not exist.',
    'Something moved at the edge of your vision. You decide not to look.',
    'The void tastes like the moment before something breaks.',
    'You have been here before. You have never been here before.'
];

const RIFT_RETURN_NARRATIVES = [
    'You step back through. Something almost followed.',
    'The rift collapses behind you. You do not look back.',
    'You are not entirely sure you left everything in there.',
    'The materials feel heavier than they should.',
    'You made it back. The void files this away for later.'
];

async function ensureExplorationTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS explorations (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            player_id   VARCHAR(50) UNIQUE NOT NULL,
            entered_at  DATETIME DEFAULT NOW(),
            expires_at  DATETIME NOT NULL,
            `rank`      VARCHAR(10) NOT NULL,
            `role`      VARCHAR(20) NOT NULL,
            is_prestige TINYINT DEFAULT 0
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS exploration_materials (
            player_id   VARCHAR(50) NOT NULL,
            material    VARCHAR(100) NOT NULL,
            quantity    INT DEFAULT 0,
            PRIMARY KEY (player_id, material)
        )
    `).catch(() => {});
}

function rollDropRarity(rank) {
    const rates = RANK_DROP_RATES[rank] || RANK_DROP_RATES['F'];
    const roll  = Math.random();
    if (roll < rates.legendary) return 'legendary';
    if (roll < rates.legendary + rates.rare) return 'rare';
    if (roll < rates.legendary + rates.rare + rates.uncommon) return 'uncommon';
    return 'common';
}

function rollDrops(role, rank, isPrestige) {
    const table  = DROPS[role] || DROPS['Mage'];
    const found  = {};
    const count  = isPrestige ? Math.floor(Math.random() * 4) + 3 : Math.floor(Math.random() * 3) + 2;

    for (let i = 0; i < count; i++) {
        const rarity = rollDropRarity(rank);
        const pool   = table[rarity] || table.common;
        const item   = pool[Math.floor(Math.random() * pool.length)];
        found[item]  = (found[item] || 0) + 1;
    }

    // Prestige bonus drop chance
    if (isPrestige && Math.random() < 0.35) {
        const bonus = PRESTIGE_BONUS_DROPS[Math.floor(Math.random() * PRESTIGE_BONUS_DROPS.length)];
        found[bonus] = (found[bonus] || 0) + 1;
    }

    return found;
}

async function addMaterials(playerId, drops) {
    for (const [material, qty] of Object.entries(drops)) {
        await db.execute(`
            INSERT INTO exploration_materials (player_id, material, quantity)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE quantity = quantity + ?
        `, [playerId, material, qty, qty]);
    }
}

async function getMaterials(playerId) {
    const [rows] = await db.execute(
        "SELECT material, quantity FROM exploration_materials WHERE player_id=? AND quantity > 0 ORDER BY material",
        [playerId]
    );
    return rows;
}

async function consumeMaterials(playerId, required) {
    for (const [mat, qty] of Object.entries(required)) {
        const [rows] = await db.execute(
            "SELECT quantity FROM exploration_materials WHERE player_id=? AND material=?",
            [playerId, mat]
        );
        if (!rows.length || rows[0].quantity < qty) return false;
    }
    for (const [mat, qty] of Object.entries(required)) {
        await db.execute(
            "UPDATE exploration_materials SET quantity = quantity - ? WHERE player_id=? AND material=?",
            [qty, playerId, mat]
        );
    }
    return true;
}

async function isExploring(playerId) {
    await ensureExplorationTable();
    const [rows] = await db.execute(
        "SELECT * FROM explorations WHERE player_id=?",
        [playerId]
    );
    return rows[0] || null;
}

async function enterRift(playerId, rank, role, isPrestige) {
    await ensureExplorationTable();
    const cost = ENTRY_COSTS[rank] || 500;
    const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [playerId]);
    if ((gold[0]?.gold || 0) < cost) return { ok: false, reason: `Need ${cost.toLocaleString()}G to enter the rift.` };

    await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [cost, playerId]);

    const expiresAt = new Date(Date.now() + EXPLORE_TIMEOUT);
    await db.execute(
        "INSERT INTO explorations (player_id, entered_at, expires_at, rank, role, is_prestige) VALUES (?, NOW(), ?, ?, ?, ?) ON DUPLICATE KEY UPDATE entered_at=NOW(), expires_at=?, rank=?, role=?, is_prestige=?",
        [playerId, expiresAt, rank, role, isPrestige ? 1 : 0, expiresAt, rank, role, isPrestige ? 1 : 0]
    );

    const narrative = RIFT_ENTRY_NARRATIVES[Math.floor(Math.random() * RIFT_ENTRY_NARRATIVES.length)];
    return { ok: true, cost, narrative, readyIn: '45 minutes' };
}

async function returnFromRift(playerId) {
    await ensureExplorationTable();
    const [rows] = await db.execute("SELECT * FROM explorations WHERE player_id=?", [playerId]);
    if (!rows.length) return { ok: false, reason: 'You are not in a rift.' };

    const ex = rows[0];
    const elapsed = Date.now() - new Date(ex.entered_at).getTime();

    if (elapsed < EXPLORE_DURATION) {
        const remaining = Math.ceil((EXPLORE_DURATION - elapsed) / 60000);
        return { ok: false, reason: `Still exploring. Return in ${remaining} minute(s).` };
    }

    // Check timeout — came back empty
    const expired = Date.now() > new Date(ex.expires_at).getTime();
    await db.execute("DELETE FROM explorations WHERE player_id=?", [playerId]);

    if (expired) {
        return { ok: true, drops: {}, expired: true, narrative: 'You were gone too long. Whatever you found, the void took it back.' };
    }

    // Survival check
    const survivalRate = SURVIVAL_RATES[ex.rank] || 0.80;
    const survived     = Math.random() < survivalRate;
    const deathNarrative = DEATH_NARRATIVES[Math.floor(Math.random() * DEATH_NARRATIVES.length)];
    const woundedNarrative = WOUNDED_NARRATIVES[Math.floor(Math.random() * WOUNDED_NARRATIVES.length)];

    if (!survived) {
        // Dead — lose 50% HP, no drops, lose entry fee (already paid)
        await db.execute('UPDATE players SET hp = GREATEST(1, FLOOR(max_hp * 0.1)) WHERE id=?', [playerId]);
        return {
            ok: true, drops: {}, expired: false, survived: false,
            narrative: deathNarrative,
            survivalRate: Math.floor(survivalRate * 100)
        };
    }

    // Wounded — small chance, lose 30% HP but still get drops
    const wounded = Math.random() > 0.7;
    if (wounded) {
        await db.execute('UPDATE players SET hp = GREATEST(1, FLOOR(hp * 0.7)) WHERE id=?', [playerId]);
    }

    const drops = rollDrops(ex.role, ex.rank, ex.is_prestige === 1);
    await addMaterials(playerId, drops);

    const narrative = RIFT_RETURN_NARRATIVES[Math.floor(Math.random() * RIFT_RETURN_NARRATIVES.length)];
    return { ok: true, drops, expired: false, survived: true, wounded, narrative: wounded ? woundedNarrative : narrative, survivalRate: Math.floor(survivalRate * 100) };
}

module.exports = {
    EXPLORATION_GC,
    ensureExplorationTable,
    isExploring,
    enterRift,
    returnFromRift,
    getMaterials,
    consumeMaterials,
    addMaterials,
    ENTRY_COSTS
};