/**
 * PRESTIGE STARTER PACK
 * Claimed once via !me after first prestige.
 * Gives a role-specific Void Initiate weapon + starting gold + XP.
 * Weapon is weaker than shop weapons but gets you started in PF dungeons.
 */

const db = require('../database/db');

// Starter weapon per role — weaker than Void Crusher but better than S rank gear
const STARTER_WEAPONS = {
    Berserker: {
        name: 'Void Initiate Blade',
        stats: { strength: 180, attack: 160 },
        durability: 200,
        desc: 'The void left its mark on this blade the moment you crossed over.'
    },
    Assassin: {
        name: 'Void Initiate Fang',
        stats: { agility: 180, attack: 170 },
        durability: 200,
        desc: 'Lighter than it looks. Sharper than anything you have held before.'
    },
    Mage: {
        name: 'Void Initiate Tome',
        stats: { intelligence: 180, attack: 160 },
        durability: 200,
        desc: 'The first page was already written when you received it.'
    },
    Tank: {
        name: 'Void Initiate Shield',
        stats: { stamina: 180, defense: 220 },
        durability: 260,
        desc: 'The void does not break against this. It simply waits.'
    },
    Healer: {
        name: 'Void Initiate Lantern',
        stats: { intelligence: 180, stamina: 140 },
        durability: 200,
        desc: 'It lit itself. You just carry it.'
    }
};

const STARTER_GOLD = 15000;
const STARTER_XP   = 5000;

async function ensureStarterTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS prestige_starter_claimed (
            player_id VARCHAR(50) PRIMARY KEY,
            prestige_level INT DEFAULT 1,
            claimed_at DATETIME DEFAULT NOW()
        )
    `).catch(() => {});
}

async function hasClaimedStarter(playerId, prestigeLevel) {
    await ensureStarterTable();
    const [rows] = await db.execute(
        "SELECT * FROM prestige_starter_claimed WHERE player_id=? AND prestige_level=?",
        [playerId, prestigeLevel]
    );
    return rows.length > 0;
}

async function claimStarterPack(playerId, role, prestigeLevel) {
    await ensureStarterTable();
    const already = await hasClaimedStarter(playerId, prestigeLevel);
    if (already) return { ok: false };

    const weapon = STARTER_WEAPONS[role] || STARTER_WEAPONS['Berserker'];

    // Grant gold and XP
    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [STARTER_GOLD, playerId]);
    await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [STARTER_XP, playerId]);

    // Grant weapon
    await db.execute(
        `INSERT INTO inventory (player_id, item_name, item_type, quantity, grade,
         strength_bonus, agility_bonus, intelligence_bonus, stamina_bonus,
         attack_bonus, defense_bonus, durability, max_durability, equipped)
         VALUES (?, ?, 'weapon', 1, 'P', ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
        [playerId, weapon.name,
         weapon.stats.strength || 0, weapon.stats.agility || 0,
         weapon.stats.intelligence || 0, weapon.stats.stamina || 0,
         weapon.stats.attack || 0, weapon.stats.defense || 0,
         weapon.durability, weapon.durability]
    );

    // Mark as claimed — ignore if already exists (race condition guard)
    await db.execute(
        "INSERT IGNORE INTO prestige_starter_claimed (player_id, prestige_level) VALUES (?, ?)",
        [playerId, prestigeLevel]
    );

    return { ok: true, weapon, gold: STARTER_GOLD, xp: STARTER_XP };
}

module.exports = { hasClaimedStarter, claimStarterPack, STARTER_WEAPONS };