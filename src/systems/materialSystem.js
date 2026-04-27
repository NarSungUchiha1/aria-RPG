const db = require('../database/db');

const BLACKSMITH_GC = '120363426728151625@g.us';

// ── Material Rarity Tiers ─────────────────────────────────────────────────────
const MATERIALS = {
    // Common — F/E dungeons
    'Iron Shard':       { rarity: 'common',    dropWeight: 40, dungeonRanks: ['F','E','D','C','B','A','S'] },
    'Bone Fragment':    { rarity: 'common',    dropWeight: 35, dungeonRanks: ['F','E','D','C','B','A','S'] },
    'Thorn Splinter':   { rarity: 'common',    dropWeight: 30, dungeonRanks: ['F','E','D','C','B','A','S'] },

    // Uncommon — D/C dungeons
    'Shadow Essence':   { rarity: 'uncommon',  dropWeight: 20, dungeonRanks: ['D','C','B','A','S'] },
    'Venom Crystal':    { rarity: 'uncommon',  dropWeight: 18, dungeonRanks: ['D','C','B','A','S'] },
    'Ember Stone':      { rarity: 'uncommon',  dropWeight: 15, dungeonRanks: ['D','C','B','A','S'] },
    'Frost Gem':        { rarity: 'uncommon',  dropWeight: 15, dungeonRanks: ['D','C','B','A','S'] },

    // Rare — B/A dungeons
    'Void Fragment':    { rarity: 'rare',      dropWeight: 8,  dungeonRanks: ['B','A','S'] },
    'Soul Crystal':     { rarity: 'rare',      dropWeight: 7,  dungeonRanks: ['B','A','S'] },
    'Blood Opal':       { rarity: 'rare',      dropWeight: 6,  dungeonRanks: ['B','A','S'] },
    'Storm Shard':      { rarity: 'rare',      dropWeight: 6,  dungeonRanks: ['B','A','S'] },

    // Legendary — S dungeons only
    'Abyssal Core':     { rarity: 'legendary', dropWeight: 2,  dungeonRanks: ['S'] },
    'Void Heart':       { rarity: 'legendary', dropWeight: 1,  dungeonRanks: ['S'] },
    'Eternity Shard':   { rarity: 'legendary', dropWeight: 1,  dungeonRanks: ['S'] },
};

const RARITY_EMOJI = {
    common:    '⚪',
    uncommon:  '🟢',
    rare:      '🔵',
    legendary: '🟣'
};

// ── Forge Recipes ─────────────────────────────────────────────────────────────
// Power scales with rarity of ingredients
const RECIPES = [
    // ── COMMON TIER WEAPONS ───────────────────────────────────────────────────
    {
        name: "Bonecrusher",
        role: "Berserker",
        materials: { 'Iron Shard': 3, 'Bone Fragment': 2 },
        stats: { strength: 8, attack: 6 },
        description: "A brutal club fused from dungeon bones and iron scrap. Ugly. Effective.",
        rarity: 'common'
    },
    {
        name: "Thorn Dagger",
        role: "Assassin",
        materials: { 'Thorn Splinter': 3, 'Iron Shard': 2 },
        stats: { agility: 8, attack: 7 },
        description: "Lightweight and vicious. Coated in dungeon thorns that never fully dull.",
        rarity: 'common'
    },
    {
        name: "Iron Ward",
        role: "Tank",
        materials: { 'Iron Shard': 4, 'Bone Fragment': 2 },
        stats: { stamina: 8, defense: 9 },
        description: "A rough shield hammered from dungeon iron. Nothing fancy. Holds.",
        rarity: 'common'
    },
    {
        name: "Bone Staff",
        role: "Mage",
        materials: { 'Bone Fragment': 3, 'Thorn Splinter': 2 },
        stats: { intelligence: 8, attack: 6 },
        description: "Carved from the spine of something that should not have existed. Channels void energy well.",
        rarity: 'common'
    },
    {
        name: "Splint Mace",
        role: "Healer",
        materials: { 'Thorn Splinter': 2, 'Iron Shard': 2, 'Bone Fragment': 2 },
        stats: { intelligence: 7, stamina: 5 },
        description: "Crude. But in the right hands it keeps people alive.",
        rarity: 'common'
    },

    // ── UNCOMMON TIER WEAPONS ─────────────────────────────────────────────────
    {
        name: "Shadow Fang",
        role: "Assassin",
        materials: { 'Shadow Essence': 2, 'Venom Crystal': 2, 'Iron Shard': 2 },
        stats: { agility: 18, attack: 16, strength: 5 },
        description: "Forged in darkness. Poisons on contact. The monster it came from had no name in the records.",
        rarity: 'uncommon'
    },
    {
        name: "Ember Greatsword",
        role: "Berserker",
        materials: { 'Ember Stone': 3, 'Iron Shard': 3 },
        stats: { strength: 18, attack: 15 },
        description: "Burns without fire. The blade stays hot long after the dungeon goes cold.",
        rarity: 'uncommon'
    },
    {
        name: "Frost Barrier",
        role: "Tank",
        materials: { 'Frost Gem': 2, 'Iron Shard': 3, 'Bone Fragment': 2 },
        stats: { stamina: 18, defense: 20 },
        description: "Hits that land on it slow the attacker. Nobody knows why. Nobody is complaining.",
        rarity: 'uncommon'
    },
    {
        name: "Venom Codex",
        role: "Mage",
        materials: { 'Venom Crystal': 2, 'Shadow Essence': 2, 'Thorn Splinter': 2 },
        stats: { intelligence: 18, attack: 15 },
        description: "A tome written in a language that predates the Gates. Reading it hurts. Using it is worse.",
        rarity: 'uncommon'
    },
    {
        name: "Ember Chalice",
        role: "Healer",
        materials: { 'Ember Stone': 2, 'Frost Gem': 2, 'Bone Fragment': 2 },
        stats: { intelligence: 16, stamina: 12 },
        description: "Heals burn. Heals freeze. Nobody said recovery was comfortable.",
        rarity: 'uncommon'
    },

    // ── RARE TIER WEAPONS ─────────────────────────────────────────────────────
    {
        name: "Soulreaper",
        role: "Berserker",
        materials: { 'Soul Crystal': 2, 'Blood Opal': 2, 'Ember Stone': 2 },
        stats: { strength: 30, attack: 26, stamina: 8 },
        description: "Every kill feeds it. Every kill makes it hungrier. The Hunter who forged the first one disappeared three days later. The weapon did not.",
        rarity: 'rare'
    },
    {
        name: "Void Edge",
        role: "Assassin",
        materials: { 'Void Fragment': 2, 'Shadow Essence': 3, 'Storm Shard': 1 },
        stats: { agility: 30, attack: 28 },
        description: "Cuts through things that should not be cuttable. The void recognises its own.",
        rarity: 'rare'
    },
    {
        name: "Stormwall",
        role: "Tank",
        materials: { 'Storm Shard': 2, 'Soul Crystal': 1, 'Iron Shard': 4 },
        stats: { stamina: 30, defense: 32, strength: 8 },
        description: "Lightning absorbed on impact. Released on counterattack. It does not defend. It waits.",
        rarity: 'rare'
    },
    {
        name: "Blood Grimoire",
        role: "Mage",
        materials: { 'Blood Opal': 2, 'Void Fragment': 1, 'Soul Crystal': 2 },
        stats: { intelligence: 30, attack: 26 },
        description: "Written in blood that is not human. The spells inside are not in any known magical system. They work anyway.",
        rarity: 'rare'
    },
    {
        name: "Soul Lantern",
        role: "Healer",
        materials: { 'Soul Crystal': 2, 'Blood Opal': 1, 'Frost Gem': 2 },
        stats: { intelligence: 28, stamina: 18 },
        description: "It remembers every person it has healed. It carries them. Sometimes at night it glows without being touched.",
        rarity: 'rare'
    },

    // ── LEGENDARY TIER WEAPONS ────────────────────────────────────────────────
    {
        name: "Maw of the Abyss",
        role: "Berserker",
        materials: { 'Abyssal Core': 1, 'Soul Crystal': 2, 'Blood Opal': 2, 'Void Fragment': 2 },
        stats: { strength: 50, attack: 45, stamina: 15 },
        description: "Forged from the core of something the System refused to classify. It should not exist. Neither should the things it has killed.",
        rarity: 'legendary'
    },
    {
        name: "Wraithblade",
        role: "Assassin",
        materials: { 'Void Heart': 1, 'Shadow Essence': 3, 'Void Fragment': 2 },
        stats: { agility: 50, attack: 48, strength: 10 },
        description: "It does not cast a shadow. The Hunter who wields it starts having trouble remembering what light looks like. They do not mind.",
        rarity: 'legendary'
    },
    {
        name: "Aegis of Eternity",
        role: "Tank",
        materials: { 'Eternity Shard': 1, 'Abyssal Core': 1, 'Storm Shard': 3 },
        stats: { stamina: 50, defense: 55, strength: 12 },
        description: "It has no origin. No records. Hunters who have held it report feeling like they have held it before. In another life. In another war.",
        rarity: 'legendary'
    },
    {
        name: "The Last Word",
        role: "Mage",
        materials: { 'Void Heart': 1, 'Blood Opal': 2, 'Soul Crystal': 2, 'Abyssal Core': 1 },
        stats: { intelligence: 50, attack: 45 },
        description: "A spellbook with one page. The page is blank. But when a Mage opens it in combat the right spell is always there. Always exactly what is needed. Never what the Mage expected.",
        rarity: 'legendary'
    },
    {
        name: "Cradle of Life",
        role: "Healer",
        materials: { 'Eternity Shard': 1, 'Soul Crystal': 3, 'Frost Gem': 2, 'Ember Stone': 2 },
        stats: { intelligence: 45, stamina: 30 },
        description: "The researchers named it after the report that does not officially exist. Make of that what you will.",
        rarity: 'legendary'
    }
];

// ── Material Drop Logic ───────────────────────────────────────────────────────
async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS player_materials (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            player_id   VARCHAR(50) NOT NULL,
            material    VARCHAR(100) NOT NULL,
            quantity    INT DEFAULT 1,
            UNIQUE KEY unique_player_material (player_id, material)
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS forged_weapons (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            player_id   VARCHAR(50) NOT NULL,
            weapon_name VARCHAR(100) NOT NULL,
            rarity      VARCHAR(20) NOT NULL,
            equipped    TINYINT DEFAULT 0,
            durability  INT DEFAULT 100,
            max_durability INT DEFAULT 100,
            stats       TEXT NOT NULL,
            created_at  DATETIME DEFAULT NOW()
        )
    `).catch(() => {});
}

async function rollMaterialDrop(dungeonRank, playerId, client, RAID_GROUP) {
    await ensureTables();

    // Filter eligible materials for this dungeon rank
    const eligible = Object.entries(MATERIALS).filter(([, m]) =>
        m.dungeonRanks.includes(dungeonRank)
    );
    if (!eligible.length) return;

    // Per-stage drop — always triggers (called once per stage clear per player)
    if (Math.random() > 1.0) return; // placeholder — always drops

    const totalWeight = eligible.reduce((sum, [, m]) => sum + m.dropWeight, 0);
    let roll = Math.random() * totalWeight;

    let dropped = null;
    for (const [name, mat] of eligible) {
        roll -= mat.dropWeight;
        if (roll <= 0) { dropped = { name, ...mat }; break; }
    }
    if (!dropped) return;

    // Give material to player
    await db.execute(
        `INSERT INTO player_materials (player_id, material, quantity)
         VALUES (?, ?, 1)
         ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
        [playerId, dropped.name]
    );

    const [row] = await db.execute(
        "SELECT quantity FROM player_materials WHERE player_id=? AND material=?",
        [playerId, dropped.name]
    );

    return { material: dropped.name, rarity: dropped.rarity, quantity: row[0]?.quantity || 1 };
}

async function getPlayerMaterials(playerId) {
    await ensureTables();
    const [rows] = await db.execute(
        "SELECT material, quantity FROM player_materials WHERE player_id=? ORDER BY material",
        [playerId]
    );
    return rows;
}

async function hasMaterials(playerId, required) {
    const held = await getPlayerMaterials(playerId);
    const heldMap = {};
    held.forEach(r => { heldMap[r.material] = r.quantity; });
    for (const [mat, qty] of Object.entries(required)) {
        if ((heldMap[mat] || 0) < qty) return { ok: false, missing: mat, have: heldMap[mat] || 0, need: qty };
    }
    return { ok: true };
}

async function consumeMaterials(playerId, required) {
    for (const [mat, qty] of Object.entries(required)) {
        await db.execute(
            "UPDATE player_materials SET quantity = quantity - ? WHERE player_id=? AND material=?",
            [qty, playerId, mat]
        );
        await db.execute(
            "DELETE FROM player_materials WHERE player_id=? AND material=? AND quantity <= 0",
            [playerId, mat]
        );
    }
}

module.exports = {
    BLACKSMITH_GC,
    MATERIALS,
    RECIPES,
    RARITY_EMOJI,
    ensureTables,
    rollMaterialDrop,
    getPlayerMaterials,
    hasMaterials,
    consumeMaterials
};