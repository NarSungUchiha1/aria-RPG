/**
 * THE HOLLOW SUN — prestige-tier bestiary (PF → PS).
 * Beyond the twilight, in the places where the sun's corpse still hangs,
 * the true umbra breed.
 *
 * BALANCE: hp/atk/def reduced 30% across all tiers (prestige dungeons were
 * too punishing). exp/gold rewards, phases and move multipliers unchanged.
 */
module.exports = {
    PF: {
        miniBosses: [
            { name: 'Gloam Hatchling',    hp: 7874,  atk: 168, def: 189, evasion: 14, exp: 520,  gold: 420,  moves: [{ name: 'Dusk Scratch',  damage: 1.3 }] },
            { name: 'Penumbra Shade',     hp: 8750,  atk: 189, def: 207, evasion: 18, exp: 620,  gold: 500,  moves: [{ name: 'Phase Strike',  damage: 1.4 }] },
            { name: 'Sunless Wraith',     hp: 8400,  atk: 175, def: 195, evasion: 20, exp: 570,  gold: 460,  moves: [{ name: 'Light Leech',   damage: 1.3 }] },
            { name: 'Umbra Spawn',        hp: 9625,  atk: 154, def: 220, evasion: 14, exp: 670,  gold: 540,  moves: [{ name: 'Gloom Pulse',   damage: 1.2 }] }
        ],
        boss: { name: 'The Dusk Sentinel', hp: 49000, atk: 251, def: 289, evasion: 8,  exp: 2500, gold: 3000, moves: [{ name: "Sentinel's Vigil", damage: 1.8 }] }
    },

    PE: {
        miniBosses: [
            { name: 'Umbral Crawler',     hp: 140000,  atk: 237, def: 264, evasion: 16, exp: 950,  gold: 760,  moves: [{ name: 'Night Bite',    damage: 1.5 }] },
            { name: 'Gloom Stalker',      hp: 157500,  atk: 266, def: 289, evasion: 18, exp: 1150, gold: 920,  moves: [{ name: 'Shadow Hunt',   damage: 1.6 }] },
            { name: 'Eclipse Knight',     hp: 148750,  atk: 244, def: 302, evasion: 16, exp: 1050, gold: 840,  moves: [{ name: 'Corona Slash',  damage: 1.6 }] },
            { name: 'Sunless Golem',      hp: 175000,  atk: 217, def: 327, evasion: 10, exp: 1250, gold: 1000, moves: [{ name: 'Stone Crush',   damage: 1.4 }] }
        ],
        boss: { name: 'The Penumbra Beast', hp: 96250, atk: 364, def: 403, evasion: 6,  exp: 5000, gold: 6500, moves: [{ name: 'Twilight Roar', damage: 2.0 }] }
    },

    PD: {
        miniBosses: [
            { name: 'Umbral Berserker',   hp: 227500, atk: 336, def: 390, evasion: 16, exp: 1600, gold: 1280, moves: [{ name: 'Rage of Dusk',   damage: 1.7 }] },
            { name: 'Gloom Hydra',        hp: 262500, atk: 308, def: 428, evasion: 20, exp: 1900, gold: 1520, moves: [{ name: 'Hydra Fang',     damage: 1.8 }] },
            { name: 'Sunless Dragon',     hp: 244999, atk: 357, def: 403, evasion: 18, exp: 1800, gold: 1440, moves: [{ name: 'Umbral Breath',  damage: 1.9 }] },
            { name: 'Eclipse Colossus',   hp: 297500, atk: 294, def: 478, evasion: 12, exp: 2100, gold: 1680, moves: [{ name: 'Colossal Slam',  damage: 1.7 }] }
        ],
        boss: { name: 'The Gloam Warlord', hp: 332500, atk: 475, def: 604, evasion: 6, exp: 9500, gold: 13000, moves: [{ name: "Warlord's Decree", damage: 2.3 }] }
    },

    PC: {
        miniBosses: [
            { name: 'Ancient Dusk Drake',  hp: 385000, atk: 448, def: 567,  evasion: 18, exp: 2700,  gold: 2160,  moves: [{ name: 'Drake Gloom',   damage: 1.9 }] },
            { name: 'Eclipse Titan',       hp: 472499, atk: 413, def: 630,  evasion: 14, exp: 3200,  gold: 2560,  moves: [{ name: 'Titan Quake',   damage: 2.0 }] },
            { name: 'Nightsea Leviathan',  hp: 420000, atk: 468, def: 598,  evasion: 20, exp: 2950,  gold: 2360,  moves: [{ name: 'Umbral Tide',   damage: 2.0 }] },
            { name: 'Fallen Daystar',      hp: 525000, atk: 392, def: 705, evasion: 16, exp: 3450,  gold: 2760,  moves: [{ name: 'Dying Light',   damage: 2.1 }] }
        ],
        boss: { name: 'The Umbra Monarch', hp: 455000, atk: 630, def: 882, evasion: 6, exp: 19000, gold: 27000, moves: [{ name: "Monarch's Edict", damage: 2.7 }] }
    },

    PB: {
        miniBosses: [
            { name: 'Gloamgod Spawn',      hp: 236249,  atk: 616, def: 806, evasion: 20, exp: 5000,  gold: 4000,  moves: [{ name: 'Godless Pulse',  damage: 2.1 }] },
            { name: 'Eclipse Seraph',      hp: 183750,  atk: 574, def: 932, evasion: 22, exp: 6000,  gold: 4800,  moves: [{ name: 'Fallen Grace',   damage: 2.2 }] },
            { name: 'Umbra Ancient',       hp: 241499,  atk: 651, def: 882, evasion: 18, exp: 5500,  gold: 4400,  moves: [{ name: 'Ancient Wrath',  damage: 2.2 }] },
            { name: 'Sunless Archangel',   hp: 336000,  atk: 539, def: 1058, evasion: 16, exp: 6500,  gold: 5200,  moves: [{ name: 'Dark Judgement', damage: 2.3 }] }
        ],
        boss: { name: 'The Eclipse God',   hp: 1137500, atk: 826, def: 1360, evasion: 6, exp: 37000, gold: 52000, moves: [{ name: 'Corona Shatter', damage: 3.2 }] }
    },

    PA: {
        miniBosses: [
            { name: 'Umbra Eternal',       hp: 332500, atk: 826, def: 1260, evasion: 22, exp: 8000,  gold: 6400,  moves: [{ name: 'Eternal Night',  damage: 2.4 }] },
            { name: 'Gloam Overlord',      hp: 306250, atk: 784, def: 1512, evasion: 20, exp: 9500,  gold: 7600,  moves: [{ name: 'Overlord Smash', damage: 2.6 }] },
            { name: 'Eclipse Destroyer',   hp: 346500, atk: 882, def: 1386, evasion: 24, exp: 8500,  gold: 6800,  moves: [{ name: 'Total Eclipse',  damage: 2.6 }] },
            { name: 'The Nameless Hour',   hp: 393750, atk: 742, def: 1638, evasion: 18, exp: 10000, gold: 8000,  moves: [{ name: 'Nameless Dread', damage: 2.4 }] }
        ],
        boss: { name: "The Hollow Herald", hp: 2450000, atk: 1092, def: 2015, evasion: 6, exp: 72000, gold: 105000, moves: [{ name: "Herald's Doom", damage: 3.8 }] }
    },

    PS: {
        miniBosses: [
            { name: "The Hollow General",  hp: 411250,  atk: 1092, def: 1889, evasion: 24, exp: 13000, gold: 10400, moves: [{ name: "General's Wrath",  damage: 2.8 }] },
            { name: 'Umbra Primordial',    hp: 437500,  atk: 1007, def: 2192, evasion: 26, exp: 16000, gold: 12800, moves: [{ name: 'Primordial Surge', damage: 3.0 }] },
            { name: 'The Second Sunset',   hp: 493499,  atk: 1176, def: 1990, evasion: 22, exp: 15000, gold: 12000, moves: [{ name: 'Second Judgement', damage: 3.1 }] },
            { name: 'Eclipse Absolute',    hp: 595000,  atk: 937, def: 2494, evasion: 20, exp: 18000, gold: 14400, moves: [{ name: 'Absolute Dark',    damage: 2.8 }] }
        ],
        boss: {
            name: 'The Hollow King',
            hp: 14000000,
            atk: 2940,
            def: 3150,
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
