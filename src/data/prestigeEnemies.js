module.exports = {
    PF: {
        miniBosses: [
            { name: 'Void Hatchling',   hp: 11250,  atk: 240, def: 270, evasion: 14, exp: 520,  gold: 420,  moves: [{ name: 'Void Scratch', damage: 1.3 }] },
            { name: 'Fracture Shade',   hp: 12500,  atk: 270, def: 297, evasion: 18, exp: 620,  gold: 500,  moves: [{ name: 'Phase Strike', damage: 1.4 }] },
            { name: 'Corrupted Wraith', hp: 12000,  atk: 250, def: 279, evasion: 20, exp: 570,  gold: 460,  moves: [{ name: 'Soul Leech',   damage: 1.3 }] },
            { name: 'Abyss Spawn',      hp: 13750,  atk: 220, def: 315, evasion: 14, exp: 670,  gold: 540,  moves: [{ name: 'Dark Pulse',   damage: 1.2 }] }
        ],
        boss: { name: 'Void Sentinel',  hp: 70000, atk: 360, def: 414, evasion: 8,  exp: 2500, gold: 3000, moves: [{ name: "Sentinel's Wrath", damage: 1.8 }] }
    },

    PE: {
        miniBosses: [
            { name: 'Abyssal Crawler',  hp: 200000,  atk: 340, def: 378, evasion: 16, exp: 950,  gold: 760,  moves: [{ name: 'Abyss Bite',  damage: 1.5 }] },
            { name: 'Void Stalker',     hp: 225000,  atk: 380, def: 414, evasion: 18, exp: 1150, gold: 920,  moves: [{ name: 'Shadow Hunt', damage: 1.6 }] },
            { name: 'Fracture Knight',  hp: 212500,  atk: 350, def: 432, evasion: 16, exp: 1050, gold: 840,  moves: [{ name: 'Rift Slash',  damage: 1.6 }] },
            { name: 'Corrupted Golem',  hp: 250000, atk: 310, def: 468, evasion: 10, exp: 1250, gold: 1000, moves: [{ name: 'Stone Crush', damage: 1.4 }] }
        ],
        boss: { name: 'Fracture Beast', hp: 137500, atk: 520, def: 576, evasion: 6,  exp: 5000, gold: 6500, moves: [{ name: 'Fracture Roar', damage: 2.0 }] }
    },

    PD: {
        miniBosses: [
            { name: 'Void Berserker',    hp: 325000, atk: 480, def: 558, evasion: 16, exp: 1600, gold: 1280, moves: [{ name: 'Rage Surge',    damage: 1.7 }] },
            { name: 'Abyss Hydra',       hp: 375000, atk: 440, def: 612, evasion: 20, exp: 1900, gold: 1520, moves: [{ name: 'Hydra Fang',    damage: 1.8 }] },
            { name: 'Corrupted Dragon',  hp: 350000, atk: 510, def: 576, evasion: 18, exp: 1800, gold: 1440, moves: [{ name: 'Void Breath',   damage: 1.9 }] },
            { name: 'Fracture Colossus', hp: 425000, atk: 420, def: 684, evasion: 12, exp: 2100, gold: 1680, moves: [{ name: 'Colossal Slam', damage: 1.7 }] }
        ],
        boss: { name: 'Void Warlord',    hp: 475000, atk: 680, def: 864, evasion: 6, exp: 9500, gold: 13000, moves: [{ name: "Warlord's Decree", damage: 2.3 }] }
    },

    PC: {
        miniBosses: [
            { name: 'Ancient Void Drake',  hp: 55000, atk: 640, def: 810, evasion: 18, exp: 2700,  gold: 2160,  moves: [{ name: 'Drake Fire',   damage: 1.9 }] },
            { name: 'Fracture Titan',      hp: 67500, atk: 590, def: 900, evasion: 14, exp: 3200,  gold: 2560,  moves: [{ name: 'Titan Quake',  damage: 2.0 }] },
            { name: 'Abyss Leviathan Pup', hp: 60000, atk: 670, def: 855, evasion: 20, exp: 2950,  gold: 2360,  moves: [{ name: 'Void Tide',    damage: 2.0 }] },
            { name: 'Corrupted Celestial', hp: 75000, atk: 560, def: 1008, evasion: 16, exp: 3450,  gold: 2760,  moves: [{ name: 'Fallen Light', damage: 2.1 }] }
        ],
        boss: { name: 'Abyss Monarch',    hp: 650000, atk: 900, def: 1260, evasion: 6, exp: 19000, gold: 27000, moves: [{ name: "Monarch's Edict", damage: 2.7 }] }
    },

    PB: {
        miniBosses: [
            { name: 'Void God Spawn',      hp: 337500,  atk: 880, def: 1152, evasion: 20, exp: 5000,  gold: 4000,  moves: [{ name: 'God Pulse',     damage: 2.1 }] },
            { name: 'Fracture Seraph',     hp: 262500,  atk: 820, def: 1332, evasion: 22, exp: 6000,  gold: 4800,  moves: [{ name: 'Fallen Grace',  damage: 2.2 }] },
            { name: 'Abyss Ancient',       hp: 345000,  atk: 930, def: 1260, evasion: 18, exp: 5500,  gold: 4400,  moves: [{ name: 'Ancient Wrath', damage: 2.2 }] },
            { name: 'Corrupted Archangel', hp: 480000,  atk: 770, def: 1512, evasion: 16, exp: 6500,  gold: 5200,  moves: [{ name: 'Dark Judgement',damage: 2.3 }] }
        ],
        boss: { name: 'The Fracture God',  hp: 1625000, atk: 1180, def: 1944, evasion: 6, exp: 37000, gold: 52000, moves: [{ name: 'Reality Shatter', damage: 3.2 }] }
    },

    PA: {
        miniBosses: [
            { name: 'Void Eternal',        hp: 475000, atk: 1180, def: 1800, evasion: 22, exp: 8000,  gold: 6400,  moves: [{ name: 'Eternal Void',  damage: 2.4 }] },
            { name: 'Abyss Overlord',      hp: 437500, atk: 1120, def: 2160, evasion: 20, exp: 9500,  gold: 7600,  moves: [{ name: 'Overlord Smash',damage: 2.6 }] },
            { name: 'Fracture Destroyer',  hp: 495000, atk: 1260, def: 1980, evasion: 24, exp: 8500,  gold: 6800,  moves: [{ name: 'Total Fracture', damage: 2.6 }] },
            { name: 'The Nameless One',    hp: 562500, atk: 1060, def: 2340, evasion: 18, exp: 10000, gold: 8000,  moves: [{ name: 'Nameless Dread', damage: 2.4 }] }
        ],
        boss: { name: "Malachar's Herald", hp: 3500000, atk: 1560, def: 2880, evasion: 6, exp: 72000, gold: 105000, moves: [{ name: "Herald's Doom", damage: 3.8 }] }
    },

    PS: {
        miniBosses: [
            { name: "Malachar's General",  hp: 587500,  atk: 1560, def: 2700, evasion: 24, exp: 13000, gold: 10400, moves: [{ name: "General's Wrath",  damage: 2.8 }] },
            { name: 'Void Primordial',     hp: 625000,  atk: 1440, def: 3132, evasion: 26, exp: 16000, gold: 12800, moves: [{ name: 'Primordial Surge', damage: 3.0 }] },
            { name: 'The Second Coming',   hp: 705000,  atk: 1680, def: 2844, evasion: 22, exp: 15000, gold: 12000, moves: [{ name: 'Second Judgement', damage: 3.1 }] },
            { name: 'Fracture Absolute',   hp: 850000, atk: 1340, def: 3564, evasion: 20, exp: 18000, gold: 14400, moves: [{ name: 'Absolute Zero',    damage: 2.8 }] }
        ],
        boss: {
            name: 'Malachar',
            hp: 20000000,
            atk: 4200,
            def: 4500,
            evasion: 8,
            exp: 500000,
            gold: 1000000,
            moves: [
                { name: "Void Reckoning",   damage: 5.0 },
                { name: "Reality Shatter",  damage: 4.0 },
                { name: "Eternal Fracture", damage: 6.0 }
            ],
            phases: [
                { threshold: 0.75, atkMult: 1.0, announcement: '〝He watches. Not yet committed.〞' },
                { threshold: 0.50, atkMult: 1.5, announcement: '〝He sees you now. He is deciding.〞' },
                { threshold: 0.25, atkMult: 2.2, announcement: '〝He has made his decision. You are not enough.〞' },
                { threshold: 0.05, atkMult: 3.5, announcement: '〝This is what he was holding back.〞' }
            ]
        }
    }
};