/**
 * PRESTIGE ENEMIES — REBALANCED FOR FUN
 * ATK scaled so players don't get one-shot.
 * DEF reduced so attacks feel meaningful.
 * Evasion kept as main difficulty mechanic.
 * HP tuned for 3-5 basic hits per mini.
 */

module.exports = {
    // ── PF ────────────────────────────────────────────────────────────────────
    PF: {
        miniBosses: [
            { name: 'Void Hatchling',   hp: 2500,  atk: 80,  def: 100, evasion: 12, exp: 520,  gold: 420,  moves: [{ name: 'Void Scratch', damage: 1.2 }] },
            { name: 'Fracture Shade',   hp: 2800,  atk: 90,  def: 110, evasion: 15, exp: 620,  gold: 500,  moves: [{ name: 'Phase Strike', damage: 1.3 }] },
            { name: 'Corrupted Wraith', hp: 2600,  atk: 85,  def: 105, evasion: 18, exp: 570,  gold: 460,  moves: [{ name: 'Soul Leech',   damage: 1.2 }] },
            { name: 'Abyss Spawn',      hp: 3000,  atk: 75,  def: 120, evasion: 12, exp: 670,  gold: 540,  moves: [{ name: 'Dark Pulse',   damage: 1.1 }] }
        ],
        boss: { name: 'Void Sentinel',  hp: 15000, atk: 120, def: 160, evasion: 8,  exp: 2500, gold: 3000, moves: [{ name: "Sentinel's Wrath", damage: 1.6 }] }
    },

    // ── PE ────────────────────────────────────────────────────────────────────
    PE: {
        miniBosses: [
            { name: 'Abyssal Crawler',  hp: 4500,  atk: 120, def: 150, evasion: 14, exp: 950,  gold: 760,  moves: [{ name: 'Abyss Bite',  damage: 1.3 }] },
            { name: 'Void Stalker',     hp: 5000,  atk: 135, def: 165, evasion: 16, exp: 1150, gold: 920,  moves: [{ name: 'Shadow Hunt', damage: 1.4 }] },
            { name: 'Fracture Knight',  hp: 4800,  atk: 125, def: 175, evasion: 14, exp: 1050, gold: 840,  moves: [{ name: 'Rift Slash',  damage: 1.4 }] },
            { name: 'Corrupted Golem',  hp: 5500,  atk: 110, def: 190, evasion: 8,  exp: 1250, gold: 1000, moves: [{ name: 'Stone Crush', damage: 1.2 }] }
        ],
        boss: { name: 'Fracture Beast', hp: 28000, atk: 180, def: 230, evasion: 6,  exp: 5000, gold: 6500, moves: [{ name: 'Fracture Roar', damage: 1.8 }] }
    },

    // ── PD ────────────────────────────────────────────────────────────────────
    PD: {
        miniBosses: [
            { name: 'Void Berserker',    hp: 7000,  atk: 170, def: 220, evasion: 14, exp: 1600, gold: 1280, moves: [{ name: 'Rage Surge',    damage: 1.5 }] },
            { name: 'Abyss Hydra',       hp: 8000,  atk: 160, def: 240, evasion: 18, exp: 1900, gold: 1520, moves: [{ name: 'Hydra Fang',    damage: 1.6 }] },
            { name: 'Corrupted Dragon',  hp: 7500,  atk: 180, def: 230, evasion: 16, exp: 1800, gold: 1440, moves: [{ name: 'Void Breath',   damage: 1.7 }] },
            { name: 'Fracture Colossus', hp: 9000,  atk: 150, def: 270, evasion: 10, exp: 2100, gold: 1680, moves: [{ name: 'Colossal Slam', damage: 1.5 }] }
        ],
        boss: { name: 'Void Warlord',    hp: 60000, atk: 240, def: 340, evasion: 6,  exp: 9500, gold: 13000, moves: [{ name: "Warlord's Decree", damage: 2.0 }] }
    },

    // ── PC ────────────────────────────────────────────────────────────────────
    PC: {
        miniBosses: [
            { name: 'Ancient Void Drake',  hp: 12000, atk: 230, def: 320, evasion: 16, exp: 2700,  gold: 2160,  moves: [{ name: 'Drake Fire',   damage: 1.6 }] },
            { name: 'Fracture Titan',      hp: 15000, atk: 210, def: 360, evasion: 12, exp: 3200,  gold: 2560,  moves: [{ name: 'Titan Quake',  damage: 1.7 }] },
            { name: 'Abyss Leviathan Pup', hp: 13000, atk: 240, def: 340, evasion: 18, exp: 2950,  gold: 2360,  moves: [{ name: 'Void Tide',    damage: 1.7 }] },
            { name: 'Corrupted Celestial', hp: 16000, atk: 200, def: 400, evasion: 14, exp: 3450,  gold: 2760,  moves: [{ name: 'Fallen Light', damage: 1.8 }] }
        ],
        boss: { name: 'Abyss Monarch',    hp: 140000, atk: 320, def: 500, evasion: 6, exp: 19000, gold: 27000, moves: [{ name: "Monarch's Edict", damage: 2.4 }] }
    },

    // ── PB ────────────────────────────────────────────────────────────────────
    PB: {
        miniBosses: [
            { name: 'Void God Spawn',      hp: 30000, atk: 310, def: 460, evasion: 18, exp: 5000,  gold: 4000,  moves: [{ name: 'God Pulse',     damage: 1.8 }] },
            { name: 'Fracture Seraph',     hp: 36000, atk: 290, def: 530, evasion: 20, exp: 6000,  gold: 4800,  moves: [{ name: 'Fallen Grace',  damage: 1.9 }] },
            { name: 'Abyss Ancient',       hp: 32000, atk: 330, def: 500, evasion: 16, exp: 5500,  gold: 4400,  moves: [{ name: 'Ancient Wrath', damage: 1.9 }] },
            { name: 'Corrupted Archangel', hp: 40000, atk: 270, def: 600, evasion: 14, exp: 6500,  gold: 5200,  moves: [{ name: 'Dark Judgement',damage: 2.0 }] }
        ],
        boss: { name: 'The Fracture God',  hp: 350000, atk: 420, def: 780, evasion: 6, exp: 37000, gold: 52000, moves: [{ name: 'Reality Shatter', damage: 2.8 }] }
    },

    // ── PA ────────────────────────────────────────────────────────────────────
    PA: {
        miniBosses: [
            { name: 'Void Eternal',        hp: 60000,  atk: 420, def: 720, evasion: 20, exp: 8000,  gold: 6400,  moves: [{ name: 'Eternal Void',  damage: 2.0 }] },
            { name: 'Abyss Overlord',      hp: 75000,  atk: 400, def: 860, evasion: 18, exp: 9500,  gold: 7600,  moves: [{ name: 'Overlord Smash',damage: 2.2 }] },
            { name: 'Fracture Destroyer',  hp: 65000,  atk: 450, def: 790, evasion: 22, exp: 8500,  gold: 6800,  moves: [{ name: 'Total Fracture', damage: 2.2 }] },
            { name: 'The Nameless One',    hp: 80000,  atk: 380, def: 940, evasion: 16, exp: 10000, gold: 8000,  moves: [{ name: 'Nameless Dread', damage: 2.0 }] }
        ],
        boss: { name: "Malachar's Herald", hp: 800000, atk: 560, def: 1150, evasion: 6, exp: 72000, gold: 105000, moves: [{ name: "Herald's Doom", damage: 3.2 }] }
    },

    // ── PS ────────────────────────────────────────────────────────────────────
    PS: {
        miniBosses: [
            { name: "Malachar's General",  hp: 42000,  atk: 560, def: 1100, evasion: 22, exp: 13000, gold: 10400, moves: [{ name: "General's Wrath",  damage: 2.4 }] },
            { name: 'Void Primordial',     hp: 50000,  atk: 520, def: 1260, evasion: 24, exp: 16000, gold: 12800, moves: [{ name: 'Primordial Surge', damage: 2.5 }] },
            { name: 'The Second Coming',   hp: 46000,  atk: 600, def: 1150, evasion: 20, exp: 15000, gold: 12000, moves: [{ name: 'Second Judgement', damage: 2.6 }] },
            { name: 'Fracture Absolute',   hp: 55000,  atk: 480, def: 1440, evasion: 18, exp: 18000, gold: 14400, moves: [{ name: 'Absolute Zero',    damage: 2.3 }] }
        ],
        boss: { name: 'Malachar', hp: 3000000, atk: 800, def: 1800, evasion: 8, exp: 210000, gold: 520000, moves: [{ name: "Malachar's Reckoning", damage: 4.0 }] }
    }
};