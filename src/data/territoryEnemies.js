/**
 * THE HOLLOW SUN — territory enemies.
 * Three territories, each with a faction flavour. Internal ids (ASSEMBLY /
 * WRATHBORNE / REMNANTS) are unchanged — only the world is new.
 * Stats identical to the previous era. Base enemy ATK ~2000, bosses higher.
 */

const TERRITORY_ENEMIES = {

    // ── THE DAWNWATCH BASTION (id: ASSEMBLY) ─────────────────────────────────
    ASSEMBLY: {
        boss: {
            name: 'Grand Warden Aurelius',
            hp: 850000, atk: 2400, def: 1800, exp: 15000, gold: 8000,
            evasion: 10,
            moves: [
                { name: 'Dawn Decree',       damage: 2.8 },
                { name: 'Warden\'s Strike',  damage: 1.6 },
                { name: 'First Light Mandate', damage: 3.5 }
            ]
        },
        miniBosses: [
            { name: 'Vigil Enforcer',     hp: 95000,  atk: 1900, def: 900,  exp: 3200, gold: 1800, evasion: 5,  moves: [{ name: 'Iron Mandate',    damage: 1.8 }, { name: 'Chain Bind',       damage: 1.2 }] },
            { name: 'Light Tithe Keeper', hp: 78000,  atk: 2000, def: 700,  exp: 2800, gold: 2200, evasion: 15, moves: [{ name: 'Drain Tithe',     damage: 1.1 }, { name: 'Lantern Levy',     damage: 1.5 }] },
            { name: 'Oathbound Guildsman',hp: 112000, atk: 1950, def: 1200, exp: 3600, gold: 1500, evasion: 0,  moves: [{ name: 'Guild Law',       damage: 1.6 }, { name: 'Ancient Protocol', damage: 1.3 }] },
            { name: 'Bastion Wraith',     hp: 65000,  atk: 2050, def: 400,  exp: 2400, gold: 1200, evasion: 25, moves: [{ name: 'Ghost Sanction',  damage: 1.6 }, { name: 'Null Edict',       damage: 1.9 }] },
            { name: 'Sealed Inquisitor',  hp: 130000, atk: 2000, def: 1500, exp: 4200, gold: 2000, evasion: 5,  moves: [{ name: 'Verdict Strike',  damage: 2.0 }, { name: 'Dusk Sentence',    damage: 2.0 }] },
        ]
    },

    // ── THE UMBRAL COURT (id: WRATHBORNE) ────────────────────────────────────
    WRATHBORNE: {
        boss: {
            name: 'The Umbral Regent',
            hp: 920000, atk: 2500, def: 1200, exp: 16000, gold: 9000,
            evasion: 20,
            moves: [
                { name: 'Night Conquest',  damage: 3.2 },
                { name: 'Throne Crusher',  damage: 2.4 },
                { name: 'Eclipse Cannon',  damage: 4.0 },
                { name: 'Bloodgloam',      damage: 1.5 }
            ]
        },
        miniBosses: [
            { name: 'Umbral Berserker',  hp: 105000, atk: 2100, def: 500,  exp: 3500, gold: 1600, evasion: 10, moves: [{ name: 'Reckless Charge', damage: 1.8 }, { name: 'Blood Frenzy',  damage: 2.0 }] },
            { name: 'Gloom Reaver',      hp: 88000,  atk: 2000, def: 300,  exp: 3000, gold: 1400, evasion: 20, moves: [{ name: 'Night Rend',      damage: 1.5 }, { name: 'Tear the Dark', damage: 2.2 }] },
            { name: 'Courtly Warlord',   hp: 140000, atk: 1950, def: 1000, exp: 4500, gold: 2200, evasion: 5,  moves: [{ name: 'Conquest Strike', damage: 1.5 }, { name: 'Domination',    damage: 1.8 }] },
            { name: 'Umbral Ravager',    hp: 72000,  atk: 2050, def: 200,  exp: 2600, gold: 1300, evasion: 30, moves: [{ name: 'Savage Tear',     damage: 2.5 }, { name: 'Chaos Slash',   damage: 2.6 }] },
            { name: 'Wrath Elemental',   hp: 118000, atk: 1950, def: 700,  exp: 3800, gold: 1900, evasion: 15, moves: [{ name: 'Rage Surge',      damage: 1.2 }, { name: 'Umbra Burst',   damage: 2.8 }] },
        ]
    },

    // ── THE LAST LIGHT SANCTUM (id: REMNANTS) ────────────────────────────────
    REMNANTS: {
        boss: {
            name: 'The First Sunshard',
            hp: 1100000, atk: 4600, def: 1600, exp: 20000, gold: 12000,
            evasion: 15,
            moves: [
                { name: 'Burning Memory',        damage: 2.5 },
                { name: 'Light That Remains',    damage: 3.8 },
                { name: 'The Sun Remembers',     damage: 4.5 },
                { name: 'Shard Storm',           damage: 2.0 }
            ]
        },
        miniBosses: [
            { name: 'Memory of Noon',      hp: 82000,  atk: 2000, def: 800,  exp: 3000, gold: 1600, evasion: 20, moves: [{ name: 'Shard Strike',    damage: 2.0 }, { name: 'Fragment Pulse', damage: 1.6 }] },
            { name: 'Gloamlit Shade',      hp: 60000,  atk: 4050, def: 600,  exp: 3400, gold: 1800, evasion: 25, moves: [{ name: 'Remnant Slash',   damage: 2.4 }, { name: 'Hollow Cry',     damage: 1.8 }] },
            { name: 'Keeper of the Flame', hp: 125000, atk: 3050, def: 1300, exp: 4000, gold: 2100, evasion: 5,  moves: [{ name: 'Faithful Strike', damage: 2.0 }, { name: 'Zealot Surge',   damage: 2.8 }] },
            { name: 'Twilight Phantom',    hp: 70000,  atk: 3000, def: 300,  exp: 2800, gold: 1400, evasion: 35, moves: [{ name: 'Phase Rend',      damage: 3.0 }, { name: 'Gloam Phase',    damage: 2.2 }] },
            { name: 'Ancient Duskwalker',  hp: 145000, atk: 4100, def: 1600, exp: 5000, gold: 2800, evasion: 10, moves: [{ name: 'Ancient Tread',   damage: 2.4 }, { name: 'Night March',    damage: 1.8 }, { name: 'Eclipse Step', damage: 3.2 }] },
        ]
    }
};

/**
 * Returns enemies for a given territory and stage.
 * Final stage returns the boss. Other stages return 2-3 mini-bosses.
 */
function getTerritoryEnemies(territoryId, stage) {
    const data = TERRITORY_ENEMIES[territoryId];
    if (!data) return [];

    // Determine max stages from voidTerritories TERRITORIES config
    const MAX_STAGES = { ASSEMBLY: 4, WRATHBORNE: 4, REMNANTS: 5 };
    const maxStage = MAX_STAGES[territoryId] || 4;
    const isBoss = stage >= maxStage;

    if (isBoss) {
        return [{ ...data.boss, isBoss: true }];
    }

    // 2-3 mini-bosses per stage, slightly scaling per stage
    const count = Math.random() < 0.5 ? 2 : 3;
    const scale = 1 + (stage - 1) * 0.10; // +10% per stage

    const enemies = [];
    for (let i = 0; i < count; i++) {
        const e = data.miniBosses[Math.floor(Math.random() * data.miniBosses.length)];
        enemies.push({
            ...e,
            hp:   Math.floor(e.hp   * scale),
            atk:  Math.floor(e.atk  * scale),
            def:  Math.floor(e.def  * scale),
            exp:  Math.floor(e.exp  * scale),
            gold: Math.floor(e.gold * scale),
        });
    }
    return enemies;
}

module.exports = { TERRITORY_ENEMIES, getTerritoryEnemies };
