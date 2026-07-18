/**
 * THE HOLLOW SUN — prestige-tier bestiary (PF → PS).
 * Beyond the twilight, in the places where the sun's corpse still hangs,
 * the true umbra breed. Stats identical to the previous era.
 */
module.exports = {
    PF: {
        miniBosses: [
            { name: 'Gloam Hatchling',    hp: 11250,  atk: 240, def: 270, evasion: 14, exp: 520,  gold: 420,  moves: [{ name: 'Dusk Scratch',  damage: 1.3 }] },
            { name: 'Penumbra Shade',     hp: 12500,  atk: 270, def: 297, evasion: 18, exp: 620,  gold: 500,  moves: [{ name: 'Phase Strike',  damage: 1.4 }] },
            { name: 'Sunless Wraith',     hp: 12000,  atk: 250, def: 279, evasion: 20, exp: 570,  gold: 460,  moves: [{ name: 'Light Leech',   damage: 1.3 }] },
            { name: 'Umbra Spawn',        hp: 13750,  atk: 220, def: 315, evasion: 14, exp: 670,  gold: 540,  moves: [{ name: 'Gloom Pulse',   damage: 1.2 }] }
        ],
        boss: { name: 'The Dusk Sentinel', hp: 70000, atk: 360, def: 414, evasion: 8,  exp: 2500, gold: 3000, moves: [{ name: "Sentinel's Vigil", damage: 1.8 }] }
    },

    PE: {
        miniBosses: [
            { name: 'Umbral Crawler',     hp: 200000,  atk: 340, def: 378, evasion: 16, exp: 950,  gold: 760,  moves: [{ name: 'Night Bite',    damage: 1.5 }] },
            { name: 'Gloom Stalker',      hp: 225000,  atk: 380, def: 414, evasion: 18, exp: 1150, gold: 920,  moves: [{ name: 'Shadow Hunt',   damage: 1.6 }] },
            { name: 'Eclipse Knight',     hp: 212500,  atk: 350, def: 432, evasion: 16, exp: 1050, gold: 840,  moves: [{ name: 'Corona Slash',  damage: 1.6 }] },
            { name: 'Sunless Golem',      hp: 250000,  atk: 310, def: 468, evasion: 10, exp: 1250, gold: 1000, moves: [{ name: 'Stone Crush',   damage: 1.4 }] }
        ],
        boss: { name: 'The Penumbra Beast', hp: 137500, atk: 520, def: 576, evasion: 6,  exp: 5000, gold: 6500, moves: [{ name: 'Twilight Roar', damage: 2.0 }] }
    },

    PD: {
        miniBosses: [
            { name: 'Umbral Berserker',   hp: 325000, atk: 480, def: 558, evasion: 16, exp: 1600, gold: 1280, moves: [{ name: 'Rage of Dusk',   damage: 1.7 }] },
            { name: 'Gloom Hydra',        hp: 375000, atk: 440, def: 612, evasion: 20, exp: 1900, gold: 1520, moves: [{ name: 'Hydra Fang',     damage: 1.8 }] },
            { name: 'Sunless Dragon',     hp: 350000, atk: 510, def: 576, evasion: 18, exp: 1800, gold: 1440, moves: [{ name: 'Umbral Breath',  damage: 1.9 }] },
            { name: 'Eclipse Colossus',   hp: 425000, atk: 420, def: 684, evasion: 12, exp: 2100, gold: 1680, moves: [{ name: 'Colossal Slam',  damage: 1.7 }] }
        ],
        boss: { name: 'The Gloam Warlord', hp: 475000, atk: 680, def: 864, evasion: 6, exp: 9500, gold: 13000, moves: [{ name: "Warlord's Decree", damage: 2.3 }] }
    },

    PC: {
        miniBosses: [
            { name: 'Ancient Dusk Drake',  hp: 550000, atk: 640, def: 810,  evasion: 18, exp: 2700,  gold: 2160,  moves: [{ name: 'Drake Gloom',   damage: 1.9 }] },
            { name: 'Eclipse Titan',       hp: 675000, atk: 590, def: 900,  evasion: 14, exp: 3200,  gold: 2560,  moves: [{ name: 'Titan Quake',   damage: 2.0 }] },
            { name: 'Nightsea Leviathan',  hp: 600000, atk: 670, def: 855,  evasion: 20, exp: 2950,  gold: 2360,  moves: [{ name: 'Umbral Tide',   damage: 2.0 }] },
            { name: 'Fallen Daystar',      hp: 750000, atk: 560, def: 1008, evasion: 16, exp: 3450,  gold: 2760,  moves: [{ name: 'Dying Light',   damage: 2.1 }] }
        ],
        boss: { name: 'The Umbra Monarch', hp: 650000, atk: 900, def: 1260, evasion: 6, exp: 19000, gold: 27000, moves: [{ name: "Monarch's Edict", damage: 2.7 }] }
    },

    PB: {
        miniBosses: [
            { name: 'Gloamgod Spawn',      hp: 337500,  atk: 880, def: 1152, evasion: 20, exp: 5000,  gold: 4000,  moves: [{ name: 'Godless Pulse',  damage: 2.1 }] },
            { name: 'Eclipse Seraph',      hp: 262500,  atk: 820, def: 1332, evasion: 22, exp: 6000,  gold: 4800,  moves: [{ name: 'Fallen Grace',   damage: 2.2 }] },
            { name: 'Umbra Ancient',       hp: 345000,  atk: 930, def: 1260, evasion: 18, exp: 5500,  gold: 4400,  moves: [{ name: 'Ancient Wrath',  damage: 2.2 }] },
            { name: 'Sunless Archangel',   hp: 480000,  atk: 770, def: 1512, evasion: 16, exp: 6500,  gold: 5200,  moves: [{ name: 'Dark Judgement', damage: 2.3 }] }
        ],
        boss: { name: 'The Eclipse God',   hp: 1625000, atk: 1180, def: 1944, evasion: 6, exp: 37000, gold: 52000, moves: [{ name: 'Corona Shatter', damage: 3.2 }] }
    },

    PA: {
        miniBosses: [
            { name: 'Umbra Eternal',       hp: 475000, atk: 1180, def: 1800, evasion: 22, exp: 8000,  gold: 6400,  moves: [{ name: 'Eternal Night',  damage: 2.4 }] },
            { name: 'Gloam Overlord',      hp: 437500, atk: 1120, def: 2160, evasion: 20, exp: 9500,  gold: 7600,  moves: [{ name: 'Overlord Smash', damage: 2.6 }] },
            { name: 'Eclipse Destroyer',   hp: 495000, atk: 1260, def: 1980, evasion: 24, exp: 8500,  gold: 6800,  moves: [{ name: 'Total Eclipse',  damage: 2.6 }] },
            { name: 'The Nameless Hour',   hp: 562500, atk: 1060, def: 2340, evasion: 18, exp: 10000, gold: 8000,  moves: [{ name: 'Nameless Dread', damage: 2.4 }] }
        ],
        boss: { name: "The Hollow Herald", hp: 3500000, atk: 1560, def: 2880, evasion: 6, exp: 72000, gold: 105000, moves: [{ name: "Herald's Doom", damage: 3.8 }] }
    },

    PS: {
        miniBosses: [
            { name: "The Hollow General",  hp: 587500,  atk: 1560, def: 2700, evasion: 24, exp: 13000, gold: 10400, moves: [{ name: "General's Wrath",  damage: 2.8 }] },
            { name: 'Umbra Primordial',    hp: 625000,  atk: 1440, def: 3132, evasion: 26, exp: 16000, gold: 12800, moves: [{ name: 'Primordial Surge', damage: 3.0 }] },
            { name: 'The Second Sunset',   hp: 705000,  atk: 1680, def: 2844, evasion: 22, exp: 15000, gold: 12000, moves: [{ name: 'Second Judgement', damage: 3.1 }] },
            { name: 'Eclipse Absolute',    hp: 850000,  atk: 1340, def: 3564, evasion: 20, exp: 18000, gold: 14400, moves: [{ name: 'Absolute Dark',    damage: 2.8 }] }
        ],
        boss: {
            name: 'The Hollow King',
            hp: 20000000,
            atk: 4200,
            def: 4500,
            evasion: 8,
            exp: 500000,
            gold: 1000000,
            moves: [
                { name: "Total Eclipse",   damage: 5.0 },
                { name: "Corona Shatter",  damage: 4.0 },
                { name: "The Last Sunset", damage: 6.0 }
            ],
            phases: [
                { threshold: 0.75, atkMult: 1.0, announcement: '〝He wears the sun\'s corpse like a crown. He has not yet looked at you.〞' },
                { threshold: 0.50, atkMult: 1.5, announcement: '〝He looks at you now. The last light bends toward him.〞' },
                { threshold: 0.25, atkMult: 2.2, announcement: '〝He has decided. You will not see another dawn.〞' },
                { threshold: 0.05, atkMult: 3.5, announcement: '〝This is the dark the sun died to hold back.〞' }
            ]
        }
    }
};
