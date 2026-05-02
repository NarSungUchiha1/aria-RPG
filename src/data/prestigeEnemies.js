/**
 * PRESTIGE DUNGEON ENEMIES
 * These are post-Leviathan era enemies — void-corrupted, ancient, or born from the Fracture.
 * F prestige enemies start where S rank normal enemies end.
 * 
 * HP scaling:
 * PF: 1000-1400 HP mini, 4000 boss
 * PE: 1800-2400 HP mini, 7000 boss
 * PD: 3000-4000 HP mini, 12000 boss
 * PC: 5000-7000 HP mini, 20000 boss
 * PB: 8000-11000 HP mini, 35000 boss
 * PA: 14000-18000 HP mini, 60000 boss
 * PS: 25000-35000 HP mini, 100000 boss
 */

module.exports = {
    PF: {
        miniBosses: [
            { name: "Void Hatchling",      hp: 1000, atk: 180, def: 60,  exp: 500,  gold: 400,  moves: [{ name: "Void Scratch",    damage: 1.4 }] },
            { name: "Fracture Shade",       hp: 1200, atk: 200, def: 70,  exp: 600,  gold: 480,  moves: [{ name: "Phase Strike",    damage: 1.6 }] },
            { name: "Corrupted Wraith",     hp: 1100, atk: 190, def: 65,  exp: 550,  gold: 440,  moves: [{ name: "Soul Leech",      damage: 1.5 }] },
            { name: "Abyss Spawn",          hp: 1400, atk: 170, def: 80,  exp: 650,  gold: 520,  moves: [{ name: "Dark Pulse",      damage: 1.3 }] }
        ],
        boss: { name: "Void Sentinel",      hp: 4000, atk: 280, def: 100, exp: 2500, gold: 3000, moves: [{ name: "Sentinel's Wrath", damage: 2.0 }] }
    },
    PE: {
        miniBosses: [
            { name: "Abyssal Crawler",      hp: 1800, atk: 280, def: 90,  exp: 900,  gold: 720,  moves: [{ name: "Abyss Bite",      damage: 1.6 }] },
            { name: "Void Stalker",         hp: 2200, atk: 310, def: 105, exp: 1100, gold: 880,  moves: [{ name: "Shadow Hunt",     damage: 1.8 }] },
            { name: "Fracture Knight",      hp: 2000, atk: 295, def: 115, exp: 1000, gold: 800,  moves: [{ name: "Rift Slash",      damage: 1.7 }] },
            { name: "Corrupted Golem",      hp: 2400, atk: 260, def: 140, exp: 1200, gold: 960,  moves: [{ name: "Stone Crush",     damage: 1.5 }] }
        ],
        boss: { name: "Fracture Beast",     hp: 7000, atk: 420, def: 150, exp: 5000, gold: 6000, moves: [{ name: "Fracture Roar",   damage: 2.2 }] }
    },
    PD: {
        miniBosses: [
            { name: "Void Berserker",       hp: 3000, atk: 400, def: 130, exp: 1500, gold: 1200, moves: [{ name: "Rage Surge",      damage: 1.8 }] },
            { name: "Abyss Hydra",          hp: 3800, atk: 380, def: 160, exp: 1800, gold: 1440, moves: [{ name: "Hydra Fang",      damage: 2.0 }] },
            { name: "Corrupted Dragon",     hp: 3400, atk: 420, def: 145, exp: 1700, gold: 1360, moves: [{ name: "Void Breath",     damage: 2.1 }] },
            { name: "Fracture Colossus",    hp: 4000, atk: 360, def: 200, exp: 2000, gold: 1600, moves: [{ name: "Colossal Slam",   damage: 1.9 }] }
        ],
        boss: { name: "Void Warlord",       hp: 12000, atk: 580, def: 220, exp: 9000, gold: 12000, moves: [{ name: "Warlord's Decree", damage: 2.5 }] }
    },
    PC: {
        miniBosses: [
            { name: "Ancient Void Drake",   hp: 5000, atk: 560, def: 190, exp: 2500, gold: 2000, moves: [{ name: "Drake Fire",      damage: 2.0 }] },
            { name: "Fracture Titan",       hp: 6500, atk: 520, def: 250, exp: 3000, gold: 2400, moves: [{ name: "Titan Quake",     damage: 2.2 }] },
            { name: "Abyss Leviathan Pup",  hp: 5800, atk: 580, def: 210, exp: 2800, gold: 2240, moves: [{ name: "Void Tide",       damage: 2.1 }] },
            { name: "Corrupted Celestial",  hp: 7000, atk: 500, def: 280, exp: 3300, gold: 2640, moves: [{ name: "Fallen Light",    damage: 2.3 }] }
        ],
        boss: { name: "Abyss Monarch",      hp: 20000, atk: 780, def: 310, exp: 18000, gold: 25000, moves: [{ name: "Monarch's Edict", damage: 3.0 }] }
    },
    PB: {
        miniBosses: [
            { name: "Void God Spawn",       hp: 8000,  atk: 750, def: 280, exp: 4000, gold: 3200, moves: [{ name: "God Pulse",       damage: 2.2 }] },
            { name: "Fracture Seraph",      hp: 10000, atk: 720, def: 340, exp: 5000, gold: 4000, moves: [{ name: "Fallen Grace",    damage: 2.4 }] },
            { name: "Abyss Ancient",        hp: 9000,  atk: 800, def: 300, exp: 4500, gold: 3600, moves: [{ name: "Ancient Wrath",   damage: 2.3 }] },
            { name: "Corrupted Archangel",  hp: 11000, atk: 680, def: 400, exp: 5500, gold: 4400, moves: [{ name: "Dark Judgement",  damage: 2.5 }] }
        ],
        boss: { name: "The Fracture God",   hp: 35000, atk: 1000, def: 450, exp: 35000, gold: 50000, moves: [{ name: "Reality Shatter", damage: 3.5 }] }
    },
    PA: {
        miniBosses: [
            { name: "Void Eternal",         hp: 14000, atk: 1000, def: 400, exp: 7000,  gold: 5600,  moves: [{ name: "Eternal Void",    damage: 2.5 }] },
            { name: "Abyss Overlord",       hp: 17000, atk: 950,  def: 500, exp: 8500,  gold: 6800,  moves: [{ name: "Overlord Smash",  damage: 2.7 }] },
            { name: "Fracture Destroyer",   hp: 15000, atk: 1100, def: 420, exp: 7500,  gold: 6000,  moves: [{ name: "Total Fracture",  damage: 2.8 }] },
            { name: "The Nameless One",     hp: 18000, atk: 900,  def: 600, exp: 9000,  gold: 7200,  moves: [{ name: "Nameless Dread",  damage: 2.6 }] }
        ],
        boss: { name: "Malachar's Herald",  hp: 60000, atk: 1400, def: 650, exp: 70000, gold: 100000, moves: [{ name: "Herald's Doom",  damage: 4.0 }] }
    },
    PS: {
        miniBosses: [
            { name: "Malachar's General",   hp: 25000, atk: 1400, def: 600,  exp: 12000, gold: 9600,  moves: [{ name: "General's Wrath",  damage: 3.0 }] },
            { name: "Void Primordial",      hp: 32000, atk: 1300, def: 750,  exp: 15000, gold: 12000, moves: [{ name: "Primordial Surge",  damage: 3.2 }] },
            { name: "The Second Coming",    hp: 28000, atk: 1500, def: 650,  exp: 14000, gold: 11200, moves: [{ name: "Second Judgement",  damage: 3.4 }] },
            { name: "Fracture Absolute",    hp: 35000, atk: 1200, def: 900,  exp: 17000, gold: 13600, moves: [{ name: "Absolute Zero",     damage: 3.1 }] }
        ],
        boss: { name: "Malachar",           hp: 100000, atk: 2000, def: 1000, exp: 200000, gold: 500000, moves: [{ name: "Malachar's Reckoning", damage: 5.0 }] }
    }
};