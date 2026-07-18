/**
 * THE HOLLOW SUN — bestiary.
 * Something hollowed out the sun. In the eternal twilight that followed, the
 * dark grew teeth. Stats are identical to the previous era (balance preserved);
 * only the world changed.
 *
 * NOTE: the 'HOLLOWKING' key is an INTERNAL rank id used across the engine —
 * players only ever see boss/mob names. The world boss of this era is
 * The Hollow King.
 */
module.exports = {
    // ══ STORY-MODE CHAPTER BOSSES (admin-staged raids; killing one advances the story) ══
    VESPERION: {   // Chapter 1 finale — a D–C group's first great hunt
        miniBosses: [
            { name: 'Duskspawn Alpha',     hp: 1400, atk: 70,  def: 26, evasion: 12, exp: 150, gold: 130, moves: [{ name: 'Pack Howl',     damage: 1.6 }] },
            { name: 'Vesper Acolyte',      hp: 1600, atk: 78,  def: 30, evasion: 10, exp: 170, gold: 150, moves: [{ name: 'Dusk Chant',    damage: 1.7 }] },
            { name: 'Firstborn Whelp',     hp: 1900, atk: 85,  def: 34, evasion: 14, exp: 200, gold: 170, moves: [{ name: 'Newborn Fang',  damage: 1.8 }] }
        ],
        boss: { name: 'Vesperion, the Firstborn Dusk', hp: 25000, atk: 95, def: 40, evasion: 12, exp: 3000, gold: 3000,
                moves: [{ name: 'First Night',  damage: 2.6 }, { name: 'Womb of Gloom', damage: 2.0 }, { name: 'Teething',  damage: 3.2 }] }
    },
    CINDERMAW: {   // Chapter 2 finale — the beast that swallowed a Sunshard
        miniBosses: [
            { name: 'Cinder Whelp',        hp: 3200, atk: 130, def: 48, evasion: 12, exp: 300, gold: 250, moves: [{ name: 'Spark Bite',    damage: 2.0 }] },
            { name: 'Ashen Zealot',        hp: 3600, atk: 140, def: 55, evasion: 10, exp: 340, gold: 280, moves: [{ name: 'Ember Prayer',  damage: 2.1 }] },
            { name: 'Molten Husk',         hp: 4200, atk: 150, def: 64, evasion: 8,  exp: 380, gold: 320, moves: [{ name: 'Slag Fist',     damage: 2.2 }] }
        ],
        boss: { name: 'Cindermaw, the Swallowed Star', hp: 60000, atk: 170, def: 70, evasion: 10, exp: 8000, gold: 8000,
                moves: [{ name: 'Starlight Belch', damage: 3.0 }, { name: 'Molten Core',  damage: 2.4 }, { name: 'Swallow Whole', damage: 3.8 }] }
    },
    UMBRYSS: {     // Chapter 3 finale — the lord who commands the Umbral Tide
        miniBosses: [
            { name: 'Tidebound Knight',    hp: 6500, atk: 210, def: 85,  evasion: 14, exp: 500, gold: 420, moves: [{ name: 'Undertow Cut',  damage: 2.6 }] },
            { name: 'Herald of High Dark', hp: 7200, atk: 225, def: 95,  evasion: 12, exp: 560, gold: 460, moves: [{ name: 'Rising Gloom',  damage: 2.8 }] },
            { name: 'Drowned Lantern',     hp: 8000, atk: 240, def: 105, evasion: 16, exp: 620, gold: 520, moves: [{ name: 'Snuffed Light', damage: 3.0 }] }
        ],
        boss: { name: 'Umbryss, Lord of the Tide', hp: 150000, atk: 260, def: 110, evasion: 14, exp: 20000, gold: 20000,
                moves: [{ name: 'High Tide',   damage: 3.4 }, { name: 'The Long Pull', damage: 2.8 }, { name: 'Drown the Dawn', damage: 4.2 }] }
    },

    HOLLOWKING: {
        miniBosses: [
            { name: "Hollowed Shade",    hp: 8000,  atk: 180, def: 60,  evasion: 14, exp: 800,  gold: 600,  moves: [{ name: 'Gloom Pulse',        damage: 1.8 }] },
            { name: "Sunless Warden",    hp: 10000, atk: 200, def: 80,  evasion: 12, exp: 1000, gold: 800,  moves: [{ name: 'Umbral Binding',     damage: 2.0 }] },
            { name: "Eclipse Knight",    hp: 9000,  atk: 190, def: 70,  evasion: 16, exp: 900,  gold: 700,  moves: [{ name: 'Corona Slash',       damage: 1.9 }] },
            { name: "Herald of the Hollow", hp: 15000, atk: 240, def: 100, evasion: 20, exp: 1500, gold: 1200, moves: [{ name: "Herald's Last Light", damage: 2.5 }] },
            { name: "Umbral Colossus",   hp: 20000, atk: 260, def: 120, evasion: 10, exp: 2000, gold: 1500, moves: [{ name: 'Nightfall Smash',    damage: 2.8 }] }
        ],
        boss: {
            name: 'The Hollow King',
            hp: 1000000000,
            atk: 1100,
            def: 2500,
            evasion: 8,
            exp: 500000,
            gold: 1000000,
            moves: [
                { name: "Total Eclipse",   damage: 5.0 },
                { name: "Corona Shatter",  damage: 4.0 },
                { name: "The Last Sunset", damage: 6.0 }
            ]
        }
    },

    F: {
        miniBosses: [
            { name: "Duskling",        hp: 140,  atk: 18,  def: 5,  exp: 20,  gold: 15,  moves: [{ name: "Nip",          damage: 1.0 }] },
            { name: "Gloom Moth",      hp: 160,  atk: 20,  def: 6,  exp: 25,  gold: 20,  moves: [{ name: "Dust Wing",    damage: 1.2 }] },
            { name: "Ashen Crawler",   hp: 120,  atk: 15,  def: 4,  exp: 18,  gold: 12,  moves: [{ name: "Scuttle Claw", damage: 0.9 }] }
        ],
        boss: { name: "The Lantern Thief", hp: 500, atk: 28, def: 10, exp: 100, gold: 150, moves: [{ name: "Snuff Out", damage: 1.5 }] }
    },
    E: {
        miniBosses: [
            { name: "Umbral Spider",   hp: 280,  atk: 32,  def: 11, exp: 40,  gold: 35,  moves: [{ name: "Shadowsilk",  stun: true }] },
            { name: "Twilight Bandit", hp: 340,  atk: 38,  def: 14, exp: 50,  gold: 45,  moves: [{ name: "Dirk Swing",  damage: 1.5 }] },
            { name: "Shale Basilisk",  hp: 310,  atk: 30,  def: 16, exp: 45,  gold: 40,  moves: [{ name: "Stone Gaze",  damage: 1.3 }] }
        ],
        boss: { name: "The Mothking", hp: 1100, atk: 58, def: 20, exp: 250, gold: 300, moves: [{ name: "Wing Eclipse", damage: 2.0 }] }
    },
    D: {
        miniBosses: [
            { name: "Hollow Hound",    hp: 560,  atk: 55,  def: 18, exp: 70,  gold: 60,  moves: [{ name: "Gloom Bite",   damage: 1.7 }] },
            { name: "Grave Cantor",    hp: 660,  atk: 65,  def: 24, exp: 90,  gold: 75,  moves: [{ name: "Dirge",        damage: 1.8 }] },
            { name: "Sootwing Imp",    hp: 500,  atk: 50,  def: 16, exp: 65,  gold: 55,  moves: [{ name: "Cinder Bolt",  damage: 1.6 }] }
        ],
        boss: { name: "The Unlit Beast", hp: 1800, atk: 85, def: 30, exp: 400, gold: 500, moves: [{ name: "Lightless Howl", damage: 2.2 }] }
    },
    C: {
        miniBosses: [
            { name: "Wick Wraith",     hp: 900,  atk: 85,  def: 28, exp: 110, gold: 90,  moves: [{ name: "Wax Scald",     damage: 2.1 }] },
            { name: "Vesper Golem",    hp: 1100, atk: 95,  def: 40, exp: 130, gold: 110, moves: [{ name: "Dusk Punch",    damage: 2.3 }] },
            { name: "Cindershade",     hp: 820,  atk: 80,  def: 25, exp: 100, gold: 85,  moves: [{ name: "Ember Slash",   damage: 2.0 }] }
        ],
        boss: { name: "The Candle Warden", hp: 3800, atk: 120, def: 50, exp: 600, gold: 700, moves: [{ name: "Last Flame", damage: 2.8 }] }
    },
    B: {
        miniBosses: [
            { name: "Gloamfrost Wraith", hp: 1450, atk: 115, def: 42, exp: 160, gold: 130, moves: [{ name: "Cold Vigil",   damage: 2.5 }] },
            { name: "Eclipse Golem",     hp: 1700, atk: 108, def: 65, exp: 190, gold: 160, moves: [{ name: "Umbral Slam",  damage: 2.7 }] },
            { name: "Nightgale",         hp: 1300, atk: 122, def: 34, exp: 155, gold: 125, moves: [{ name: "Screaming Dive", damage: 2.6 }] }
        ],
        boss: { name: "The Penumbra Hydra", hp: 6500, atk: 158, def: 62, exp: 1000, gold: 1200, moves: [{ name: "Sevenfold Shadow", damage: 3.2 }] }
    },
    A: {
        miniBosses: [
            { name: "Umbral Reaper",   hp: 2200, atk: 160, def: 55, exp: 230, gold: 190, moves: [{ name: "Harvest of Dusk", damage: 3.1 }] },
            { name: "Dawnless Guard",  hp: 2600, atk: 148, def: 80, exp: 260, gold: 220, moves: [{ name: "Oathbreak Smite", damage: 2.9 }] },
            { name: "Midnight Knight", hp: 2000, atk: 168, def: 50, exp: 240, gold: 200, moves: [{ name: "Zenith Cut",      damage: 3.2 }] }
        ],
        boss: { name: "The Noon Wraith", hp: 11000, atk: 210, def: 85, exp: 1800, gold: 2500, moves: [{ name: "Where the Sun Was", damage: 4.0 }] }
    },
    S: {
        miniBosses: [
            { name: "Horror of the Last Hour", hp: 3600, atk: 218, def: 74, exp: 350, gold: 280, moves: [{ name: "Hour Hand",        damage: 3.6 }] },
            { name: "Elder Gloamlich",         hp: 4200, atk: 205, def: 96, exp: 400, gold: 320, moves: [{ name: "Candlesnuff",      damage: 4.2 }] },
            { name: "Umbra Titan",             hp: 3900, atk: 232, def: 85, exp: 380, gold: 300, moves: [{ name: "Weight of Night",  damage: 3.9 }] }
        ],
        boss: { name: "The Umbral Shepherd", hp: 18000, atk: 290, def: 125, exp: 3500, gold: 5000, moves: [{ name: "Flock of Shadows", damage: 5.0 }] }
    }
};
