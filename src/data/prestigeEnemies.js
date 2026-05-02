/**
 * PRESTIGE DUNGEON ENEMIES
 * Massively increased HP and defense.
 * Even with prestige weapons, enemies take many hits to kill.
 * Weapon stats slightly reduced to prevent easy clears.
 */

module.exports = {
    PF: {
        miniBosses: [
            { name: "Void Hatchling",      hp: 8000,   atk: 180, def: 200,  exp: 500,   gold: 400,   moves: [{ name: "Void Scratch",       damage: 1.4 }] },
            { name: "Fracture Shade",      hp: 10000,  atk: 200, def: 220,  exp: 600,   gold: 480,   moves: [{ name: "Phase Strike",       damage: 1.6 }] },
            { name: "Corrupted Wraith",    hp: 9000,   atk: 190, def: 210,  exp: 550,   gold: 440,   moves: [{ name: "Soul Leech",         damage: 1.5 }] },
            { name: "Abyss Spawn",         hp: 11000,  atk: 170, def: 240,  exp: 650,   gold: 520,   moves: [{ name: "Dark Pulse",         damage: 1.3 }] }
        ],
        boss: { name: "Void Sentinel",     hp: 40000,  atk: 280, def: 350,  exp: 2500,  gold: 3000,  moves: [{ name: "Sentinel's Wrath",  damage: 2.0 }] }
    },
    PE: {
        miniBosses: [
            { name: "Abyssal Crawler",     hp: 18000,  atk: 280, def: 320,  exp: 900,   gold: 720,   moves: [{ name: "Abyss Bite",         damage: 1.6 }] },
            { name: "Void Stalker",        hp: 22000,  atk: 310, def: 360,  exp: 1100,  gold: 880,   moves: [{ name: "Shadow Hunt",        damage: 1.8 }] },
            { name: "Fracture Knight",     hp: 20000,  atk: 295, def: 380,  exp: 1000,  gold: 800,   moves: [{ name: "Rift Slash",         damage: 1.7 }] },
            { name: "Corrupted Golem",     hp: 25000,  atk: 260, def: 420,  exp: 1200,  gold: 960,   moves: [{ name: "Stone Crush",        damage: 1.5 }] }
        ],
        boss: { name: "Fracture Beast",    hp: 90000,  atk: 420, def: 500,  exp: 5000,  gold: 6000,  moves: [{ name: "Fracture Roar",     damage: 2.2 }] }
    },
    PD: {
        miniBosses: [
            { name: "Void Berserker",      hp: 40000,  atk: 400, def: 500,  exp: 1500,  gold: 1200,  moves: [{ name: "Rage Surge",         damage: 1.8 }] },
            { name: "Abyss Hydra",         hp: 50000,  atk: 380, def: 560,  exp: 1800,  gold: 1440,  moves: [{ name: "Hydra Fang",         damage: 2.0 }] },
            { name: "Corrupted Dragon",    hp: 45000,  atk: 420, def: 520,  exp: 1700,  gold: 1360,  moves: [{ name: "Void Breath",        damage: 2.1 }] },
            { name: "Fracture Colossus",   hp: 55000,  atk: 360, def: 620,  exp: 2000,  gold: 1600,  moves: [{ name: "Colossal Slam",      damage: 1.9 }] }
        ],
        boss: { name: "Void Warlord",      hp: 200000, atk: 580, def: 750,  exp: 9000,  gold: 12000, moves: [{ name: "Warlord's Decree",  damage: 2.5 }] }
    },
    PC: {
        miniBosses: [
            { name: "Ancient Void Drake",  hp: 80000,  atk: 560, def: 700,  exp: 2500,  gold: 2000,  moves: [{ name: "Drake Fire",         damage: 2.0 }] },
            { name: "Fracture Titan",      hp: 100000, atk: 520, def: 800,  exp: 3000,  gold: 2400,  moves: [{ name: "Titan Quake",        damage: 2.2 }] },
            { name: "Abyss Leviathan Pup", hp: 90000,  atk: 580, def: 740,  exp: 2800,  gold: 2240,  moves: [{ name: "Void Tide",          damage: 2.1 }] },
            { name: "Corrupted Celestial", hp: 110000, atk: 500, def: 880,  exp: 3300,  gold: 2640,  moves: [{ name: "Fallen Light",       damage: 2.3 }] }
        ],
        boss: { name: "Abyss Monarch",     hp: 400000, atk: 780, def: 1000, exp: 18000, gold: 25000, moves: [{ name: "Monarch's Edict",   damage: 3.0 }] }
    },
    PB: {
        miniBosses: [
            { name: "Void God Spawn",      hp: 180000, atk: 750, def: 1000, exp: 4000,  gold: 3200,  moves: [{ name: "God Pulse",          damage: 2.2 }] },
            { name: "Fracture Seraph",     hp: 220000, atk: 720, def: 1200, exp: 5000,  gold: 4000,  moves: [{ name: "Fallen Grace",       damage: 2.4 }] },
            { name: "Abyss Ancient",       hp: 200000, atk: 800, def: 1100, exp: 4500,  gold: 3600,  moves: [{ name: "Ancient Wrath",      damage: 2.3 }] },
            { name: "Corrupted Archangel", hp: 250000, atk: 680, def: 1400, exp: 5500,  gold: 4400,  moves: [{ name: "Dark Judgement",     damage: 2.5 }] }
        ],
        boss: { name: "The Fracture God",  hp: 900000, atk: 1000, def: 1800, exp: 35000, gold: 50000, moves: [{ name: "Reality Shatter", damage: 3.5 }] }
    },
    PA: {
        miniBosses: [
            { name: "Void Eternal",        hp: 400000,  atk: 1000, def: 1800, exp: 7000,  gold: 5600,  moves: [{ name: "Eternal Void",    damage: 2.5 }] },
            { name: "Abyss Overlord",      hp: 500000,  atk: 950,  def: 2000, exp: 8500,  gold: 6800,  moves: [{ name: "Overlord Smash",  damage: 2.7 }] },
            { name: "Fracture Destroyer",  hp: 450000,  atk: 1100, def: 1900, exp: 7500,  gold: 6000,  moves: [{ name: "Total Fracture",  damage: 2.8 }] },
            { name: "The Nameless One",    hp: 550000,  atk: 900,  def: 2200, exp: 9000,  gold: 7200,  moves: [{ name: "Nameless Dread",  damage: 2.6 }] }
        ],
        boss: { name: "Malachar's Herald", hp: 2000000, atk: 1400, def: 2800, exp: 70000, gold: 100000, moves: [{ name: "Herald's Doom", damage: 4.0 }] }
    },
    PS: {
        miniBosses: [
            { name: "Malachar's General",  hp: 800000,  atk: 1400, def: 2500, exp: 12000, gold: 9600,  moves: [{ name: "General's Wrath",   damage: 3.0 }] },
            { name: "Void Primordial",     hp: 1000000, atk: 1300, def: 3000, exp: 15000, gold: 12000, moves: [{ name: "Primordial Surge",  damage: 3.2 }] },
            { name: "The Second Coming",   hp: 900000,  atk: 1500, def: 2800, exp: 14000, gold: 11200, moves: [{ name: "Second Judgement",  damage: 3.4 }] },
            { name: "Fracture Absolute",   hp: 1200000, atk: 1200, def: 3500, exp: 17000, gold: 13600, moves: [{ name: "Absolute Zero",     damage: 3.1 }] }
        ],
        boss: { name: "Malachar",          hp: 5000000, atk: 2000, def: 4500, exp: 200000, gold: 500000, moves: [{ name: "Malachar's Reckoning", damage: 5.0 }] }
    }
};