/**
 * VOID TERRITORIES SYSTEM
 * Three territories left behind when Malachar fell.
 * Clans can claim, hold, and lose territories.
 * Holding a territory gives the entire clan a passive bonus.
 * Losing a territory to another clan triggers a Territory War.
 */

const db = require('../database/db');

// ── THE THREE TERRITORIES ─────────────────────────────────────────────────────
const TERRITORIES = {
    ASSEMBLY: {
        id: 'ASSEMBLY',
        name: 'The Assembly Hold',
        emoji: '🏛️',
        description: 'The old guild halls, now fractured and void-soaked. Cold corridors of power.',
        lore: 'They tried to regulate the void. The void regulated them instead.',
        bonus: {
            label: 'Tax of the Ancients',
            description: '+20% Gold from all dungeon clears',
            type: 'gold_bonus',
            value: 0.20
        },
        guardian: 'Grand Arbiter Vayne',
        stages: 4
    },
    WRATHBORNE: {
        id: 'WRATHBORNE',
        name: 'The Wrathborne Stronghold',
        emoji: '⚔️',
        description: 'A fortress built from rage and fracture energy. The air itself is aggressive.',
        lore: 'They took power from the void. The void took everything else.',
        bonus: {
            label: 'War Engine',
            description: '+25% damage in all dungeon combat',
            type: 'damage_bonus',
            value: 0.25
        },
        guardian: 'The Warlord Unbound',
        stages: 4
    },
    REMNANTS: {
        id: 'REMNANTS',
        name: 'The Remnant Sanctum',
        emoji: '🕯️',
        description: 'The deepest fracture. Where Malachar\'s original purpose still echoes.',
        lore: 'He was not evil. He was carrying something that was.',
        bonus: {
            label: 'Echo of the Fallen',
            description: '+30% XP from all sources and 15% chance to revive once per dungeon',
            type: 'xp_bonus',
            value: 0.30
        },
        guardian: "Malachar's Echo",
        stages: 5
    }
};

// ── TABLE SETUP ───────────────────────────────────────────────────────────────
async function ensureTerritoryTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS void_territories (
            territory_id  VARCHAR(30) PRIMARY KEY,
            clan_id       INT DEFAULT NULL,
            claimed_at    DATETIME DEFAULT NULL,
            last_attacked DATETIME DEFAULT NULL,
            defense_hp    INT DEFAULT 100,
            INDEX (clan_id)
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS territory_wars (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            territory_id    VARCHAR(30) NOT NULL,
            attacker_clan   INT NOT NULL,
            defender_clan   INT DEFAULT NULL,
            status          ENUM('pending','active','completed') DEFAULT 'pending',
            attacker_score  INT DEFAULT 0,
            defender_score  INT DEFAULT 0,
            winner_clan     INT DEFAULT NULL,
            started_at      DATETIME DEFAULT NOW(),
            ends_at         DATETIME DEFAULT NULL,
            INDEX (territory_id),
            INDEX (attacker_clan)
        )
    `).catch(() => {});

    // Seed territories if not seeded
    for (const tid of Object.keys(TERRITORIES)) {
        await db.execute(
            'INSERT IGNORE INTO void_territories (territory_id, clan_id, defense_hp) VALUES (?, NULL, 100)',
            [tid]
        ).catch(() => {});
    }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
async function getTerritoryStatus() {
    await ensureTerritoryTables();
    const [rows] = await db.execute(
        `SELECT vt.*, c.name as clan_name, c.leader_id
         FROM void_territories vt
         LEFT JOIN clans c ON c.id = vt.clan_id`
    );
    const result = {};
    for (const row of rows) {
        result[row.territory_id] = row;
    }
    return result;
}

async function getClanTerritories(clanId) {
    await ensureTerritoryTables();
    const [rows] = await db.execute(
        'SELECT territory_id FROM void_territories WHERE clan_id=?',
        [clanId]
    );
    return rows.map(r => r.territory_id);
}

async function getClanTerritoryBonuses(clanId) {
    const held = await getClanTerritories(clanId);
    const bonuses = [];
    for (const tid of held) {
        const t = TERRITORIES[tid];
        if (t) bonuses.push(t.bonus);
    }
    return bonuses;
}

async function isClanInTerritoryWar(clanId) {
    // Auto-expire wars older than 2 hours before checking
    await db.execute(
        "UPDATE territory_wars SET status='completed' WHERE status IN ('pending','active') AND started_at < DATE_SUB(NOW(), INTERVAL 2 HOUR)"
    ).catch(() => {});

    const [rows] = await db.execute(
        "SELECT id FROM territory_wars WHERE (attacker_clan=? OR defender_clan=?) AND status IN ('pending','active') LIMIT 1",
        [clanId, clanId]
    );
    return rows.length > 0;
}

async function claimTerritory(territoryId, clanId) {
    await db.execute(
        'UPDATE void_territories SET clan_id=?, claimed_at=NOW(), defense_hp=100 WHERE territory_id=?',
        [clanId, territoryId]
    );
}

async function stripTerritory(territoryId) {
    await db.execute(
        'UPDATE void_territories SET clan_id=NULL, claimed_at=NULL, defense_hp=100 WHERE territory_id=?',
        [territoryId]
    );
}

module.exports = {
    TERRITORIES,
    ensureTerritoryTables,
    getTerritoryStatus,
    getClanTerritories,
    getClanTerritoryBonuses,
    isClanInTerritoryWar,
    claimTerritory,
    stripTerritory
};