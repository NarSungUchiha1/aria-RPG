/**
 * PRESTIGE ENEMIES
 * Calibrated so a full dungeon run gives ~5x the XP needed to rank up / 5 runs.
 * Gold scales with XP at roughly 0.8x ratio.
 *
 * PF full run XP: ~7,100  → PE costs 35,000  → 5 runs
 * PE full run XP: ~13,400 → PD costs 65,000  → 5 runs
 * PD full run XP: ~30,000 → PC costs 150,000 → 5 runs
 * PC full run XP: ~52,800 → PB costs 260,000 → 5 runs
 * PB full run XP: ~111,000→ PA costs 550,000 → 5 runs
 * PA full run XP: ~198,000→ PS costs 980,000 → 5 runs
 */

module.exports = {
    // ── PF ────────────────────────────────────────────────────────────────────
    PF: {
        miniBosses: [
            { name: 'Void Hatchling',    hp: 8000,   atk: 180, def: 200, exp: 520,  gold: 420,  moves: [{ name: 'Void Scratch',  damage: 1.4 }] },
            { name: 'Fracture Shade',    hp: 10000,  atk: 200, def: 220, exp: 620,  gold: 500,  moves: [{ name: 'Phase Strike',  damage: 1.6 }] },
            { name: 'Corrupted Wraith',  hp: 9000,   atk: 190, def: 210, exp: 570,  gold: 460,  moves: [{ name: 'Soul Leech',    damage: 1.5 }] },
            { name: 'Abyss Spawn',       hp: 11000,  atk: 170, def: 240, exp: 670,  gold: 540,  moves: [{ name: 'Dark Pulse',    damage: 1.3 }] }
        ],
        boss: { name: 'Void Sentinel',   hp: 40000,  atk: 280, def: 350, exp: 2500, gold: 3000, moves: [{ name: "Sentinel's Wrath", damage: 2.0 }] }
    },

    // ── PE ────────────────────────────────────────────────────────────────────
    PE: {
        miniBosses: [
            { name: 'Abyssal Crawler',   hp: 18000,  atk: 280, def: 320, exp: 950,  gold: 760,  moves: [{ name: 'Abyss Bite',    damage: 1.6 }] },
            { name: 'Void Stalker',      hp: 22000,  atk: 310, def: 360, exp: 1150, gold: 920,  moves: [{ name: 'Shadow Hunt',   damage: 1.8 }] },
            { name: 'Fracture Knight',   hp: 20000,  atk: 295, def: 380, exp: 1050, gold: 840,  moves: [{ name: 'Rift Slash',    damage: 1.7 }] },
            { name: 'Corrupted Golem',   hp: 25000,  atk: 260, def: 420, exp: 1250, gold: 1000, moves: [{ name: 'Stone Crush',   damage: 1.5 }] }
        ],
        boss: { name: 'Fracture Beast',  hp: 90000,  atk: 420, def: 500, exp: 5000, gold: 6500, moves: [{ name: 'Fracture Roar',  damage: 2.2 }] }
    },

    // ── PD ────────────────────────────────────────────────────────────────────
    PD: {
        miniBosses: [
            { name: 'Void Berserker',    hp: 40000,  atk: 400, def: 500, exp: 1600, gold: 1280, moves: [{ name: 'Rage Surge',    damage: 1.8 }] },
            { name: 'Abyss Hydra',       hp: 50000,  atk: 380, def: 560, exp: 1900, gold: 1520, moves: [{ name: 'Hydra Fang',    damage: 2.0 }] },
            { name: 'Corrupted Dragon',  hp: 45000,  atk: 420, def: 520, exp: 1800, gold: 1440, moves: [{ name: 'Void Breath',   damage: 2.1 }] },
            { name: 'Fracture Colossus', hp: 55000,  atk: 360, def: 620, exp: 2100, gold: 1680, moves: [{ name: 'Colossal Slam', damage: 1.9 }] }
        ],
        boss: { name: 'Void Warlord',    hp: 200000, atk: 580, def: 750, exp: 9500, gold: 13000, moves: [{ name: "Warlord's Decree", damage: 2.5 }] }
    },

    // ── PC ────────────────────────────────────────────────────────────────────
    PC: {
        miniBosses: [
            { name: 'Ancient Void Drake',   hp: 80000,  atk: 560, def: 700,  exp: 2700,  gold: 2160,  moves: [{ name: 'Drake Fire',     damage: 2.0 }] },
            { name: 'Fracture Titan',       hp: 100000, atk: 520, def: 800,  exp: 3200,  gold: 2560,  moves: [{ name: 'Titan Quake',    damage: 2.2 }] },
            { name: 'Abyss Leviathan Pup',  hp: 90000,  atk: 580, def: 740,  exp: 2950,  gold: 2360,  moves: [{ name: 'Void Tide',      damage: 2.1 }] },
            { name: 'Corrupted Celestial',  hp: 110000, atk: 500, def: 880,  exp: 3450,  gold: 2760,  moves: [{ name: 'Fallen Light',   damage: 2.3 }] }
        ],
        boss: { name: 'Abyss Monarch',    hp: 400000,  atk: 780, def: 1000, exp: 19000, gold: 27000, moves: [{ name: "Monarch's Edict", damage: 3.0 }] }
    },

    // ── PB ────────────────────────────────────────────────────────────────────
    PB: {
        miniBosses: [
            { name: 'Void God Spawn',     hp: 180000,  atk: 750,  def: 1000, exp: 5000,  gold: 4000,  moves: [{ name: 'God Pulse',      damage: 2.2 }] },
            { name: 'Fracture Seraph',    hp: 220000,  atk: 720,  def: 1200, exp: 6000,  gold: 4800,  moves: [{ name: 'Fallen Grace',   damage: 2.4 }] },
            { name: 'Abyss Ancient',      hp: 200000,  atk: 800,  def: 1100, exp: 5500,  gold: 4400,  moves: [{ name: 'Ancient Wrath',  damage: 2.3 }] },
            { name: 'Corrupted Archangel',hp: 250000,  atk: 680,  def: 1400, exp: 6500,  gold: 5200,  moves: [{ name: 'Dark Judgement', damage: 2.5 }] }
        ],
        boss: { name: 'The Fracture God', hp: 900000,  atk: 1000, def: 1800, exp: 37000, gold: 52000, moves: [{ name: 'Reality Shatter', damage: 3.5 }] }
    },

    // ── PA ────────────────────────────────────────────────────────────────────
    PA: {
        miniBosses: [
            { name: 'Void Eternal',       hp: 400000,  atk: 1000, def: 1800, exp: 8000,  gold: 6400,  moves: [{ name: 'Eternal Void',   damage: 2.5 }] },
            { name: 'Abyss Overlord',     hp: 500000,  atk: 950,  def: 2000, exp: 9500,  gold: 7600,  moves: [{ name: 'Overlord Smash', damage: 2.7 }] },
            { name: 'Fracture Destroyer', hp: 450000,  atk: 1100, def: 1900, exp: 8500,  gold: 6800,  moves: [{ name: 'Total Fracture', damage: 2.8 }] },
            { name: 'The Nameless One',   hp: 550000,  atk: 900,  def: 2200, exp: 10000, gold: 8000,  moves: [{ name: 'Nameless Dread', damage: 2.6 }] }
        ],
        boss: { name: "Malachar's Herald", hp: 2000000, atk: 1400, def: 2800, exp: 72000, gold: 105000, moves: [{ name: "Herald's Doom", damage: 4.0 }] }
    },

    // ── PS ────────────────────────────────────────────────────────────────────
    PS: {
        miniBosses: [
            { name: "Malachar's General",  hp: 800000,  atk: 1400, def: 2500, exp: 13000, gold: 10400, moves: [{ name: "General's Wrath",   damage: 3.0 }] },
            { name: 'Void Primordial',     hp: 1000000, atk: 1300, def: 3000, exp: 16000, gold: 12800, moves: [{ name: 'Primordial Surge',  damage: 3.2 }] },
            { name: 'The Second Coming',   hp: 900000,  atk: 1500, def: 2800, exp: 15000, gold: 12000, moves: [{ name: 'Second Judgement',  damage: 3.4 }] },
            { name: 'Fracture Absolute',   hp: 1200000, atk: 1200, def: 3500, exp: 18000, gold: 14400, moves: [{ name: 'Absolute Zero',     damage: 3.1 }] }
        ],
        boss: { name: 'Malachar', hp: 5000000, atk: 2000, def: 4500, exp: 210000, gold: 520000, moves: [{ name: "Malachar's Reckoning", damage: 5.0 }] }
    }
};