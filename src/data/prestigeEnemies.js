module.exports = {
    PF: {
        miniBosses: [
            { name: 'Void Hatchling',   hp: 4500,  atk: 120, def: 150, evasion: 14, exp: 520,  gold: 420,  moves: [{ name: 'Void Scratch', damage: 1.3 }] },
            { name: 'Fracture Shade',   hp: 5000,  atk: 135, def: 165, evasion: 18, exp: 620,  gold: 500,  moves: [{ name: 'Phase Strike', damage: 1.4 }] },
            { name: 'Corrupted Wraith', hp: 4800,  atk: 125, def: 155, evasion: 20, exp: 570,  gold: 460,  moves: [{ name: 'Soul Leech',   damage: 1.3 }] },
            { name: 'Abyss Spawn',      hp: 5500,  atk: 110, def: 175, evasion: 14, exp: 670,  gold: 540,  moves: [{ name: 'Dark Pulse',   damage: 1.2 }] }
        ],
        boss: { name: 'Void Sentinel',  hp: 28000, atk: 180, def: 230, evasion: 8,  exp: 2500, gold: 3000, moves: [{ name: "Sentinel's Wrath", damage: 1.8 }] }
    },

    PE: {
        miniBosses: [
            { name: 'Abyssal Crawler',  hp: 8000,  atk: 170, def: 210, evasion: 16, exp: 950,  gold: 760,  moves: [{ name: 'Abyss Bite',  damage: 1.5 }] },
            { name: 'Void Stalker',     hp: 9000,  atk: 190, def: 230, evasion: 18, exp: 1150, gold: 920,  moves: [{ name: 'Shadow Hunt', damage: 1.6 }] },
            { name: 'Fracture Knight',  hp: 8500,  atk: 175, def: 240, evasion: 16, exp: 1050, gold: 840,  moves: [{ name: 'Rift Slash',  damage: 1.6 }] },
            { name: 'Corrupted Golem',  hp: 10000, atk: 155, def: 260, evasion: 10, exp: 1250, gold: 1000, moves: [{ name: 'Stone Crush', damage: 1.4 }] }
        ],
        boss: { name: 'Fracture Beast', hp: 55000, atk: 260, def: 320, evasion: 6,  exp: 5000, gold: 6500, moves: [{ name: 'Fracture Roar', damage: 2.0 }] }
    },

    PD: {
        miniBosses: [
            { name: 'Void Berserker',    hp: 13000, atk: 240, def: 310, evasion: 16, exp: 1600, gold: 1280, moves: [{ name: 'Rage Surge',    damage: 1.7 }] },
            { name: 'Abyss Hydra',       hp: 15000, atk: 220, def: 340, evasion: 20, exp: 1900, gold: 1520, moves: [{ name: 'Hydra Fang',    damage: 1.8 }] },
            { name: 'Corrupted Dragon',  hp: 14000, atk: 255, def: 320, evasion: 18, exp: 1800, gold: 1440, moves: [{ name: 'Void Breath',   damage: 1.9 }] },
            { name: 'Fracture Colossus', hp: 17000, atk: 210, def: 380, evasion: 12, exp: 2100, gold: 1680, moves: [{ name: 'Colossal Slam', damage: 1.7 }] }
        ],
        boss: { name: 'Void Warlord',    hp: 110000, atk: 340, def: 480, evasion: 6, exp: 9500, gold: 13000, moves: [{ name: "Warlord's Decree", damage: 2.3 }] }
    },

    PC: {
        miniBosses: [
            { name: 'Ancient Void Drake',  hp: 22000, atk: 320, def: 450, evasion: 18, exp: 2700,  gold: 2160,  moves: [{ name: 'Drake Fire',   damage: 1.9 }] },
            { name: 'Fracture Titan',      hp: 27000, atk: 295, def: 500, evasion: 14, exp: 3200,  gold: 2560,  moves: [{ name: 'Titan Quake',  damage: 2.0 }] },
            { name: 'Abyss Leviathan Pup', hp: 24000, atk: 335, def: 475, evasion: 20, exp: 2950,  gold: 2360,  moves: [{ name: 'Void Tide',    damage: 2.0 }] },
            { name: 'Corrupted Celestial', hp: 30000, atk: 280, def: 560, evasion: 16, exp: 3450,  gold: 2760,  moves: [{ name: 'Fallen Light', damage: 2.1 }] }
        ],
        boss: { name: 'Abyss Monarch',    hp: 260000, atk: 450, def: 700, evasion: 6, exp: 19000, gold: 27000, moves: [{ name: "Monarch's Edict", damage: 2.7 }] }
    },

    PB: {
        miniBosses: [
            { name: 'Void God Spawn',      hp: 55000,  atk: 440, def: 640, evasion: 20, exp: 5000,  gold: 4000,  moves: [{ name: 'God Pulse',     damage: 2.1 }] },
            { name: 'Fracture Seraph',     hp: 65000,  atk: 410, def: 740, evasion: 22, exp: 6000,  gold: 4800,  moves: [{ name: 'Fallen Grace',  damage: 2.2 }] },
            { name: 'Abyss Ancient',       hp: 58000,  atk: 465, def: 700, evasion: 18, exp: 5500,  gold: 4400,  moves: [{ name: 'Ancient Wrath', damage: 2.2 }] },
            { name: 'Corrupted Archangel', hp: 72000,  atk: 385, def: 840, evasion: 16, exp: 6500,  gold: 5200,  moves: [{ name: 'Dark Judgement',damage: 2.3 }] }
        ],
        boss: { name: 'The Fracture God',  hp: 650000, atk: 590, def: 1080, evasion: 6, exp: 37000, gold: 52000, moves: [{ name: 'Reality Shatter', damage: 3.2 }] }
    },

    PA: {
        miniBosses: [
            { name: 'Void Eternal',        hp: 110000, atk: 590, def: 1000, evasion: 22, exp: 8000,  gold: 6400,  moves: [{ name: 'Eternal Void',  damage: 2.4 }] },
            { name: 'Abyss Overlord',      hp: 135000, atk: 560, def: 1200, evasion: 20, exp: 9500,  gold: 7600,  moves: [{ name: 'Overlord Smash',damage: 2.6 }] },
            { name: 'Fracture Destroyer',  hp: 118000, atk: 630, def: 1100, evasion: 24, exp: 8500,  gold: 6800,  moves: [{ name: 'Total Fracture', damage: 2.6 }] },
            { name: 'The Nameless One',    hp: 145000, atk: 530, def: 1300, evasion: 18, exp: 10000, gold: 8000,  moves: [{ name: 'Nameless Dread', damage: 2.4 }] }
        ],
        boss: { name: "Malachar's Herald", hp: 1400000, atk: 780, def: 1600, evasion: 6, exp: 72000, gold: 105000, moves: [{ name: "Herald's Doom", damage: 3.8 }] }
    },

    PS: {
        miniBosses: [
            { name: "Malachar's General",  hp: 75000,  atk: 780, def: 1500, evasion: 24, exp: 13000, gold: 10400, moves: [{ name: "General's Wrath",  damage: 2.8 }] },
            { name: 'Void Primordial',     hp: 90000,  atk: 720, def: 1740, evasion: 26, exp: 16000, gold: 12800, moves: [{ name: 'Primordial Surge', damage: 3.0 }] },
            { name: 'The Second Coming',   hp: 82000,  atk: 840, def: 1580, evasion: 22, exp: 15000, gold: 12000, moves: [{ name: 'Second Judgement', damage: 3.1 }] },
            { name: 'Fracture Absolute',   hp: 100000, atk: 670, def: 1980, evasion: 20, exp: 18000, gold: 14400, moves: [{ name: 'Absolute Zero',    damage: 2.8 }] }
        ],
        boss: { name: 'Malachar', hp: 5000000, atk: 1100, def: 2500, evasion: 8, exp: 210000, gold: 520000, moves: [{ name: "Malachar's Reckoning", damage: 5.0 }] }
    }
};