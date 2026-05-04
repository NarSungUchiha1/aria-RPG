/**
 * PRESTIGE ENEMIES
 * Difficulty comes from HIGH DEF + EVASION, not massive HP pools.
 * Target: 4 basic hits to kill a mini, 2-3 strong hits, 1 ultimate.
 * Boss: 15-20 hits with strong moves.
 *
 * DEF is high so damage reduction is significant.
 * Evasion stat makes pure brute force less reliable.
 * This makes cooldown management and move selection matter.
 *
 * PF full run XP: ~7,100  → PE costs 36,000  → 5 runs
 * PE full run XP: ~13,400 → PD costs 110,000 → 8 runs
 * PD full run XP: ~30,000 → PC costs 380,000 → 12 runs
 * PC full run XP: ~52,800 → PB costs 1,006,000 → 18 runs
 * PB full run XP: ~111,000→ PA costs 3,025,000 → 25 runs
 * PA full run XP: ~198,000→ PS costs 7,560,000 → 35 runs
 */

module.exports = {
    // ── PF ─────────────────────────────────────────────────────────────────
    // Player stat ~650. 4 basic hits → mini HP ~2400. Strong hit → ~1200. Ult → ~600
    PF: {
        miniBosses: [
            { name: 'Void Hatchling',   hp: 2500,  atk: 220, def: 280, evasion: 15, exp: 520,  gold: 420,  moves: [{ name: 'Void Scratch', damage: 1.4 }] },
            { name: 'Fracture Shade',   hp: 2800,  atk: 240, def: 300, evasion: 20, exp: 620,  gold: 500,  moves: [{ name: 'Phase Strike', damage: 1.6 }] },
            { name: 'Corrupted Wraith', hp: 2600,  atk: 230, def: 290, evasion: 25, exp: 570,  gold: 460,  moves: [{ name: 'Soul Leech',   damage: 1.5 }] },
            { name: 'Abyss Spawn',      hp: 3000,  atk: 210, def: 320, evasion: 18, exp: 670,  gold: 540,  moves: [{ name: 'Dark Pulse',   damage: 1.3 }] }
        ],
        boss: { name: 'Void Sentinel',  hp: 18000, atk: 300, def: 450, evasion: 10, exp: 2500, gold: 3000, moves: [{ name: "Sentinel's Wrath", damage: 2.0 }] }
    },

    // ── PE ─────────────────────────────────────────────────────────────────
    // Player stat ~1050. Mini HP ~4500. Boss ~35k
    PE: {
        miniBosses: [
            { name: 'Abyssal Crawler',  hp: 4500,  atk: 330, def: 420, evasion: 18, exp: 950,  gold: 760,  moves: [{ name: 'Abyss Bite',  damage: 1.6 }] },
            { name: 'Void Stalker',     hp: 5000,  atk: 360, def: 460, evasion: 22, exp: 1150, gold: 920,  moves: [{ name: 'Shadow Hunt', damage: 1.8 }] },
            { name: 'Fracture Knight',  hp: 4800,  atk: 345, def: 480, evasion: 20, exp: 1050, gold: 840,  moves: [{ name: 'Rift Slash',  damage: 1.7 }] },
            { name: 'Corrupted Golem',  hp: 5500,  atk: 310, def: 520, evasion: 12, exp: 1250, gold: 1000, moves: [{ name: 'Stone Crush', damage: 1.5 }] }
        ],
        boss: { name: 'Fracture Beast', hp: 35000, atk: 480, def: 650, evasion: 8,  exp: 5000, gold: 6500, moves: [{ name: 'Fracture Roar', damage: 2.2 }] }
    },

    // ── PD ─────────────────────────────────────────────────────────────────
    // Player stat ~1520. Mini HP ~8000. Boss ~80k
    PD: {
        miniBosses: [
            { name: 'Void Berserker',    hp: 8000,  atk: 480, def: 620, evasion: 20, exp: 1600, gold: 1280, moves: [{ name: 'Rage Surge',    damage: 1.8 }] },
            { name: 'Abyss Hydra',       hp: 9000,  atk: 460, def: 680, evasion: 25, exp: 1900, gold: 1520, moves: [{ name: 'Hydra Fang',    damage: 2.0 }] },
            { name: 'Corrupted Dragon',  hp: 8500,  atk: 500, def: 640, evasion: 22, exp: 1800, gold: 1440, moves: [{ name: 'Void Breath',   damage: 2.1 }] },
            { name: 'Fracture Colossus', hp: 10000, atk: 440, def: 750, evasion: 15, exp: 2100, gold: 1680, moves: [{ name: 'Colossal Slam', damage: 1.9 }] }
        ],
        boss: { name: 'Void Warlord',    hp: 80000, atk: 680, def: 950, evasion: 8,  exp: 9500, gold: 13000, moves: [{ name: "Warlord's Decree", damage: 2.5 }] }
    },

    // ── PC ─────────────────────────────────────────────────────────────────
    // Player stat ~2440. Mini HP ~18000. Boss ~180k
    PC: {
        miniBosses: [
            { name: 'Ancient Void Drake',  hp: 16000, atk: 650, def: 900,  evasion: 22, exp: 2700,  gold: 2160,  moves: [{ name: 'Drake Fire',   damage: 2.0 }] },
            { name: 'Fracture Titan',      hp: 20000, atk: 620, def: 1000, evasion: 18, exp: 3200,  gold: 2560,  moves: [{ name: 'Titan Quake',  damage: 2.2 }] },
            { name: 'Abyss Leviathan Pup', hp: 18000, atk: 680, def: 950,  evasion: 25, exp: 2950,  gold: 2360,  moves: [{ name: 'Void Tide',    damage: 2.1 }] },
            { name: 'Corrupted Celestial', hp: 22000, atk: 600, def: 1100, evasion: 20, exp: 3450,  gold: 2760,  moves: [{ name: 'Fallen Light', damage: 2.3 }] }
        ],
        boss: { name: 'Abyss Monarch',    hp: 180000, atk: 900, def: 1400, evasion: 8, exp: 19000, gold: 27000, moves: [{ name: "Monarch's Edict", damage: 3.0 }] }
    },

    // ── PB ─────────────────────────────────────────────────────────────────
    // Player stat ~3080. Mini HP ~40000. Boss ~450k
    PB: {
        miniBosses: [
            { name: 'Void God Spawn',      hp: 38000, atk: 900,  def: 1300, evasion: 25, exp: 5000,  gold: 4000,  moves: [{ name: 'God Pulse',     damage: 2.2 }] },
            { name: 'Fracture Seraph',     hp: 45000, atk: 860,  def: 1500, evasion: 28, exp: 6000,  gold: 4800,  moves: [{ name: 'Fallen Grace',  damage: 2.4 }] },
            { name: 'Abyss Ancient',       hp: 42000, atk: 950,  def: 1400, evasion: 22, exp: 5500,  gold: 4400,  moves: [{ name: 'Ancient Wrath', damage: 2.3 }] },
            { name: 'Corrupted Archangel', hp: 50000, atk: 820,  def: 1700, evasion: 20, exp: 6500,  gold: 5200,  moves: [{ name: 'Dark Judgement',damage: 2.5 }] }
        ],
        boss: { name: 'The Fracture God',  hp: 450000, atk: 1200, def: 2200, evasion: 8, exp: 37000, gold: 52000, moves: [{ name: 'Reality Shatter', damage: 3.5 }] }
    },

    // ── PA ─────────────────────────────────────────────────────────────────
    // Player stat ~4600. Mini HP ~90000. Boss ~1M
    PA: {
        miniBosses: [
            { name: 'Void Eternal',        hp: 85000,  atk: 1200, def: 2000, evasion: 28, exp: 8000,  gold: 6400,  moves: [{ name: 'Eternal Void',  damage: 2.5 }] },
            { name: 'Abyss Overlord',      hp: 100000, atk: 1150, def: 2400, evasion: 25, exp: 9500,  gold: 7600,  moves: [{ name: 'Overlord Smash',damage: 2.7 }] },
            { name: 'Fracture Destroyer',  hp: 90000,  atk: 1300, def: 2200, evasion: 30, exp: 8500,  gold: 6800,  moves: [{ name: 'Total Fracture', damage: 2.8 }] },
            { name: 'The Nameless One',    hp: 110000, atk: 1100, def: 2600, evasion: 22, exp: 10000, gold: 8000,  moves: [{ name: 'Nameless Dread', damage: 2.6 }] }
        ],
        boss: { name: "Malachar's Herald", hp: 1000000, atk: 1600, def: 3200, evasion: 8, exp: 72000, gold: 105000, moves: [{ name: "Herald's Doom", damage: 4.0 }] }
    },

    // ── PS ─────────────────────────────────────────────────────────────────
    // Player stat ~7200. Mini HP ~200000. Boss ~3M
    PS: {
        miniBosses: [
            { name: "Malachar's General",  hp: 42000,  atk: 1600, def: 3000, evasion: 30, exp: 13000, gold: 10400, moves: [{ name: "General's Wrath",  damage: 3.0 }] },
            { name: 'Void Primordial',     hp: 50000,  atk: 1500, def: 3500, evasion: 32, exp: 16000, gold: 12800, moves: [{ name: 'Primordial Surge', damage: 3.2 }] },
            { name: 'The Second Coming',   hp: 46000,  atk: 1700, def: 3200, evasion: 28, exp: 15000, gold: 12000, moves: [{ name: 'Second Judgement', damage: 3.4 }] },
            { name: 'Fracture Absolute',   hp: 55000,  atk: 1400, def: 4000, evasion: 25, exp: 18000, gold: 14400, moves: [{ name: 'Absolute Zero',    damage: 3.1 }] }
        ],
        boss: { name: 'Malachar', hp: 3000000, atk: 2200, def: 5000, evasion: 10, exp: 210000, gold: 520000, moves: [{ name: "Malachar's Reckoning", damage: 5.0 }] }
    }
};