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

    // PRESTIGE MATERIALS
    'Void Dust':         { rarity: 'common',    dropWeight: 40, dungeonRanks: ['PF','PE','PD','PC','PB','PA','PS'], emoji: '💨' },
    'Fracture Shard':    { rarity: 'common',    dropWeight: 35, dungeonRanks: ['PF','PE','PD','PC','PB','PA','PS'], emoji: '🔷' },
    'Abyss Sliver':      { rarity: 'common',    dropWeight: 30, dungeonRanks: ['PF','PE','PD','PC','PB','PA','PS'], emoji: '🌑' },
    'Void Crystal':      { rarity: 'uncommon',  dropWeight: 20, dungeonRanks: ['PE','PD','PC','PB','PA','PS'],     emoji: '💎' },
    'Fracture Core':     { rarity: 'uncommon',  dropWeight: 18, dungeonRanks: ['PE','PD','PC','PB','PA','PS'],     emoji: '🔹' },
    'Abyss Essence':     { rarity: 'uncommon',  dropWeight: 15, dungeonRanks: ['PD','PC','PB','PA','PS'],         emoji: '🌀' },
    'Void Marrow':       { rarity: 'uncommon',  dropWeight: 12, dungeonRanks: ['PD','PC','PB','PA','PS'],         emoji: '🦴' },
    'Fracture Heart':    { rarity: 'rare',      dropWeight: 8,  dungeonRanks: ['PC','PB','PA','PS'],             emoji: '❤️' },
    'Void Soul':         { rarity: 'rare',      dropWeight: 7,  dungeonRanks: ['PC','PB','PA','PS'],             emoji: '👻' },
    'Abyss Tear':        { rarity: 'rare',      dropWeight: 6,  dungeonRanks: ['PB','PA','PS'],                  emoji: '💧' },
    'Fracture Rune':     { rarity: 'rare',      dropWeight: 5,  dungeonRanks: ['PB','PA','PS'],                  emoji: '🔮' },
    'Void Genesis':      { rarity: 'legendary', dropWeight: 2,  dungeonRanks: ['PA','PS'],                      emoji: '⚡' },
    'Malachars Tear':    { rarity: 'legendary', dropWeight: 1,  dungeonRanks: ['PA','PS'],                      emoji: '👁️' },
    'Fracture Absolute': { rarity: 'legendary', dropWeight: 1,  dungeonRanks: ['PS'],                           emoji: '🌌' },
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
        name: "Soulreaper", role: "Berserker", rarity: 'legendary',
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
        name: "Maw of the Abyss", role: "Berserker", rarity: 'rare',
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
    },

    // BERSERKER PRESTIGE
    { name: 'Void Ravager', role: 'Berserker', rarity: 'rare', prestige: true,
      materials: { 'Void Crystal': 3, 'Fracture Shard': 5, 'Abyss Sliver': 4 },
      stats: { strength: 500, attack: 480 }, durability: 260,
      description: 'Born from the screaming edges of collapsed space.' },
    { name: 'Fracture Titan Blade', role: 'Berserker', rarity: 'legendary', prestige: true,
      materials: { 'Fracture Heart': 2, 'Void Soul': 2, 'Abyss Essence': 5, 'Void Crystal': 4 },
      stats: { strength: 950, attack: 900, stamina: 150 }, durability: 320,
      description: 'The weight of fractured realities forged into a single edge.' },
    { name: 'Malachars Replica', role: 'Berserker', rarity: 'legendary', prestige: true,
      materials: { 'Void Genesis': 1, 'Fracture Heart': 3, 'Abyss Tear': 2 },
      stats: { strength: 1800, attack: 1700, stamina: 200 }, durability: 400,
      description: 'A pale imitation. Still enough to end worlds.' },
    // ASSASSIN PRESTIGE
    { name: 'Void Phantom Blade', role: 'Assassin', rarity: 'rare', prestige: true,
      materials: { 'Void Crystal': 3, 'Abyss Sliver': 5, 'Fracture Shard': 4 },
      stats: { agility: 500, attack: 490 }, durability: 250,
      description: 'Phases through armour. Has no interest in being seen.' },
    { name: 'Fracture Reaper', role: 'Assassin', rarity: 'legendary', prestige: true,
      materials: { 'Void Soul': 2, 'Fracture Heart': 2, 'Abyss Essence': 5, 'Fracture Core': 4 },
      stats: { agility: 950, attack: 940, strength: 100 }, durability: 300,
      description: 'Carries the weight of every kill made in the void.' },
    { name: 'Malachars Shadow Replica', role: 'Assassin', rarity: 'legendary', prestige: true,
      materials: { 'Void Genesis': 1, 'Void Soul': 3, 'Abyss Tear': 2 },
      stats: { agility: 1800, attack: 1750, strength: 150 }, durability: 380,
      description: 'The shadow does not belong to the blade. It belongs to you.' },
    // MAGE PRESTIGE
    { name: 'Void Grimoire', role: 'Mage', rarity: 'rare', prestige: true,
      materials: { 'Void Crystal': 3, 'Fracture Core': 4, 'Abyss Sliver': 5 },
      stats: { intelligence: 500, attack: 475 }, durability: 240,
      description: 'The pages write themselves. You just read them.' },
    { name: 'Fracture Codex Supreme', role: 'Mage', rarity: 'legendary', prestige: true,
      materials: { 'Fracture Rune': 2, 'Void Soul': 2, 'Abyss Essence': 5, 'Void Crystal': 4 },
      stats: { intelligence: 950, attack: 920, stamina: 100 }, durability: 290,
      description: 'Contains the last spells of a dead civilisation.' },
    { name: 'Malachars Gospel Replica', role: 'Mage', rarity: 'legendary', prestige: true,
      materials: { 'Malachars Tear': 1, 'Fracture Rune': 2, 'Void Genesis': 1 },
      stats: { intelligence: 1800, attack: 1700, stamina: 150 }, durability: 370,
      description: 'Not the original. Still terrifying.' },
    // TANK PRESTIGE
    { name: 'Void Aegis', role: 'Tank', rarity: 'rare', prestige: true,
      materials: { 'Void Crystal': 3, 'Fracture Shard': 5, 'Void Dust': 6 },
      stats: { stamina: 500, defense: 560 }, durability: 320,
      description: 'The void itself refuses to pass through it.' },
    { name: 'Fracture Fortress Shield', role: 'Tank', rarity: 'legendary', prestige: true,
      materials: { 'Fracture Heart': 2, 'Void Marrow': 3, 'Abyss Essence': 5, 'Void Crystal': 4 },
      stats: { stamina: 950, defense: 1100, strength: 150 }, durability: 420,
      description: 'Has survived things that should not have been survivable.' },
    { name: 'Void Colossus Gauntlet', role: 'Tank', rarity: 'legendary', prestige: true,
      materials: { 'Void Genesis': 1, 'Fracture Heart': 2, 'Abyss Tear': 2, 'Void Marrow': 3 },
      stats: { stamina: 1500, strength: 800, attack: 700, defense: 600 }, durability: 450,
      description: 'Offense and defense in equal measure. The void provides both.' },
    // HEALER PRESTIGE
    { name: 'Void Sanctuary Staff', role: 'Healer', rarity: 'rare', prestige: true,
      materials: { 'Void Crystal': 3, 'Abyss Sliver': 5, 'Fracture Core': 3 },
      stats: { intelligence: 480, stamina: 350 }, durability: 240,
      description: 'Heals wounds before they fully open.' },
    { name: 'Fracture Life Chalice', role: 'Healer', rarity: 'legendary', prestige: true,
      materials: { 'Void Soul': 2, 'Fracture Heart': 2, 'Abyss Essence': 4, 'Void Crystal': 4 },
      stats: { intelligence: 950, stamina: 700 }, durability: 300,
      description: 'The liquid inside is not water. It does not matter what it is.' },
    { name: 'Malachars Grace Replica', role: 'Healer', rarity: 'legendary', prestige: true,
      materials: { 'Malachars Tear': 1, 'Void Soul': 2, 'Void Genesis': 1 },
      stats: { intelligence: 1800, stamina: 1200 }, durability: 380,
      description: 'The last healer who carried this never needed to use it twice.' },
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