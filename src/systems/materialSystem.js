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
    // ── COMMON TIER ──────────────────────────────────────────────────────────
    {
        name: "Bonecrusher", role: "Berserker", rarity: 'common',
        materials: { 'Iron Shard': 3, 'Bone Fragment': 2 },
        stats: { strength: 25, attack: 20 },
        durability: 60,
        description: "A brutal club fused from dungeon bones and iron scrap. Ugly. Effective."
    },
    {
        name: "Thorn Dagger", role: "Assassin", rarity: 'common',
        materials: { 'Thorn Splinter': 3, 'Iron Shard': 2 },
        stats: { agility: 25, attack: 22 },
        durability: 60,
        description: "Lightweight and vicious. Coated in dungeon thorns that never fully dull."
    },
    {
        name: "Iron Ward", role: "Tank", rarity: 'common',
        materials: { 'Iron Shard': 4, 'Bone Fragment': 2 },
        stats: { stamina: 25, defense: 28 },
        durability: 70,
        description: "A rough shield hammered from dungeon iron. Nothing fancy. Holds."
    },
    {
        name: "Bone Staff", role: "Mage", rarity: 'common',
        materials: { 'Bone Fragment': 3, 'Thorn Splinter': 2 },
        stats: { intelligence: 25, attack: 20 },
        durability: 60,
        description: "Carved from the spine of something that should not have existed."
    },
    {
        name: "Splint Mace", role: "Healer", rarity: 'common',
        materials: { 'Thorn Splinter': 2, 'Iron Shard': 2, 'Bone Fragment': 2 },
        stats: { intelligence: 22, stamina: 18 },
        durability: 60,
        description: "Crude. But in the right hands it keeps people alive."
    },

    // ── UNCOMMON TIER ────────────────────────────────────────────────────────
    {
        name: "Shadow Fang", role: "Assassin", rarity: 'uncommon',
        materials: { 'Shadow Essence': 2, 'Venom Crystal': 2, 'Iron Shard': 2 },
        stats: { agility: 55, attack: 50, strength: 15 },
        durability: 80,
        description: "Forged in darkness. Poisons on contact. The monster it came from had no name."
    },
    {
        name: "Ember Greatsword", role: "Berserker", rarity: 'uncommon',
        materials: { 'Ember Stone': 3, 'Iron Shard': 3 },
        stats: { strength: 55, attack: 48 },
        durability: 80,
        description: "Burns without fire. The blade stays hot long after the dungeon goes cold."
    },
    {
        name: "Frost Barrier", role: "Tank", rarity: 'uncommon',
        materials: { 'Frost Gem': 2, 'Iron Shard': 3, 'Bone Fragment': 2 },
        stats: { stamina: 55, defense: 60 },
        durability: 90,
        description: "Hits that land on it slow the attacker. Nobody knows why."
    },
    {
        name: "Venom Codex", role: "Mage", rarity: 'uncommon',
        materials: { 'Venom Crystal': 2, 'Shadow Essence': 2, 'Thorn Splinter': 2 },
        stats: { intelligence: 55, attack: 48 },
        durability: 80,
        description: "A tome written in a language that predates the Gates."
    },
    {
        name: "Ember Chalice", role: "Healer", rarity: 'uncommon',
        materials: { 'Ember Stone': 2, 'Frost Gem': 2, 'Bone Fragment': 2 },
        stats: { intelligence: 50, stamina: 38 },
        durability: 80,
        description: "Heals burn. Heals freeze. Nobody said recovery was comfortable."
    },

    // ── RARE TIER ────────────────────────────────────────────────────────────
    {
        name: "Soulreaper", role: "Berserker", rarity: 'rare',
        materials: { 'Soul Crystal': 2, 'Blood Opal': 2, 'Ember Stone': 2 },
        stats: { strength: 100, attack: 90, stamina: 25 },
        durability: 120,
        description: "Every kill feeds it. Every kill makes it hungrier."
    },
    {
        name: "Void Edge", role: "Assassin", rarity: 'rare',
        materials: { 'Void Fragment': 2, 'Shadow Essence': 3, 'Storm Shard': 1 },
        stats: { agility: 100, attack: 95 },
        durability: 120,
        description: "Cuts through things that should not be cuttable. The void recognises its own."
    },
    {
        name: "Stormwall", role: "Tank", rarity: 'rare',
        materials: { 'Storm Shard': 2, 'Soul Crystal': 1, 'Iron Shard': 4 },
        stats: { stamina: 100, defense: 110, strength: 25 },
        durability: 150,
        description: "Lightning absorbed on impact. Released on counterattack. It waits."
    },
    {
        name: "Blood Grimoire", role: "Mage", rarity: 'rare',
        materials: { 'Blood Opal': 2, 'Void Fragment': 1, 'Soul Crystal': 2 },
        stats: { intelligence: 100, attack: 90 },
        durability: 120,
        description: "Written in blood that is not human. The spells work anyway."
    },
    {
        name: "Soul Lantern", role: "Healer", rarity: 'rare',
        materials: { 'Soul Crystal': 2, 'Blood Opal': 1, 'Frost Gem': 2 },
        stats: { intelligence: 95, stamina: 60 },
        durability: 120,
        description: "It remembers every person it has healed. It carries them."
    },

    // ── LEGENDARY TIER ───────────────────────────────────────────────────────
    {
        name: "Maw of the Abyss", role: "Berserker", rarity: 'legendary',
        materials: { 'Abyssal Core': 1, 'Soul Crystal': 2, 'Blood Opal': 2, 'Void Fragment': 2 },
        stats: { strength: 220, attack: 200, stamina: 50 },
        durability: 200,
        description: "Forged from the core of something the System refused to classify."
    },
    {
        name: "Wraithblade", role: "Assassin", rarity: 'legendary',
        materials: { 'Void Heart': 1, 'Shadow Essence': 3, 'Void Fragment': 2 },
        stats: { agility: 220, attack: 210, strength: 30 },
        durability: 200,
        description: "It does not cast a shadow. The Hunter who wields it starts having trouble remembering what light looks like."
    },
    {
        name: "Aegis of Eternity", role: "Tank", rarity: 'legendary',
        materials: { 'Eternity Shard': 1, 'Abyssal Core': 1, 'Storm Shard': 3 },
        stats: { stamina: 220, defense: 240, strength: 40 },
        durability: 250,
        description: "It has no origin. No records. Hunters who hold it feel they have held it before. In another war."
    },
    {
        name: "The Last Word", role: "Mage", rarity: 'legendary',
        materials: { 'Void Heart': 1, 'Blood Opal': 2, 'Soul Crystal': 2, 'Abyssal Core': 1 },
        stats: { intelligence: 220, attack: 200 },
        durability: 200,
        description: "A spellbook with one page. The page is blank. But the right spell is always there."
    },
    {
        name: "Cradle of Life", role: "Healer", rarity: 'legendary',
        materials: { 'Eternity Shard': 1, 'Soul Crystal': 3, 'Frost Gem': 2, 'Ember Stone': 2 },
        stats: { intelligence: 200, stamina: 120 },
        durability: 200,
        description: "The researchers named it after the report that does not officially exist."
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

    const HIGH_RANKS = ['C', 'B', 'A', 'S'];
    const isHighRank = HIGH_RANKS.includes(dungeonRank);

    // Filter eligible materials for this dungeon rank
    const eligible = Object.entries(MATERIALS).filter(([, m]) =>
        m.dungeonRanks.includes(dungeonRank)
    );
    if (!eligible.length) return;

    // ✅ Boost rare/legendary weights for C-S rank dungeons
    // In high rank dungeons, rare/legendary materials get 10x weight
    const weightedEligible = eligible.map(([name, mat]) => {
        let weight = mat.dropWeight;
        if (isHighRank && (mat.rarity === 'rare' || mat.rarity === 'legendary')) {
            weight = mat.dropWeight * 10; // ~80% drop rate for rare+ in C-S
        } else if (isHighRank && mat.rarity === 'common') {
            weight = Math.floor(mat.dropWeight * 0.2); // common drops much less in high ranks
        }
        return [name, { ...mat, dropWeight: weight }];
    });

    const totalWeight = weightedEligible.reduce((sum, [, m]) => sum + m.dropWeight, 0);
    let roll = Math.random() * totalWeight;

    let dropped = null;
    for (const [name, mat] of weightedEligible) {
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
    held.forEach(r => { heldMap[r.material] = (heldMap[r.material] || 0) + r.quantity; });

    // Also check bag_contents
    try {
        const [bagItems] = await db.execute(
            "SELECT material, quantity FROM bag_contents WHERE player_id=?", [playerId]
        );
        bagItems.forEach(r => { heldMap[r.material] = (heldMap[r.material] || 0) + r.quantity; });
    } catch(e) {}

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