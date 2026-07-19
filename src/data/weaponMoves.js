/**
 * WEAPON MOVES
 * Multipliers calibrated so:
 *  - Basic moves (CD 1-2s): kills mini in ~12 hits
 *  - Strong moves (CD 3-4s): kills mini in ~6 hits
 *  - Ultimate moves (CD 5-6s): kills mini in ~3 hits
 *
 * Prestige weapon tiers:
 *  PF tier (Void):      stat 650  → mult 1.3 / 2.5 / 5.0
 *  PD tier (Fracture):  stat 1520 → mult 2.7 / 5.3 / 10.5
 *  PB tier (Abyss):     stat 3080 → mult 5.9 / 11.6 / 23.0
 *  PS tier (the Hollow King):  stat 7200 → mult 11.4 / 22.7 / 45.0
 */

module.exports = {

    // ══════════════════════════════════════════════════════════
    //  NORMAL WEAPONS
    // ══════════════════════════════════════════════════════════

    // ── F RANK ────────────────────────────────────────────────
    'Duskfang Dagger': [
        { name: 'Dusk Jab',      type: 'damage', stat: 'agility',  multiplier: 1.1, cooldown: 1, cost: 0 },
        { name: 'Twin Dusk',     type: 'damage', stat: 'agility',  multiplier: 1.4, hits: 2,     cooldown: 3, cost: 5 },
        { name: 'Umbral Backstab',        type: 'damage', stat: 'agility',  multiplier: 2.2, ignore_defense: 0.3, cooldown: 5, cost: 8 }
    ],
    'Gloam Axe': [
        { name: 'Duskcleave',          type: 'damage', stat: 'strength', multiplier: 1.2, cooldown: 1, cost: 0 },
        { name: 'Duskfall Blow',      type: 'damage', stat: 'strength', multiplier: 1.8, def_reduction: 10, cooldown: 3, cost: 5 },
        { name: 'Dusk Cyclone',        type: 'damage', stat: 'strength', multiplier: 1.5, aoe: true,   cooldown: 5, cost: 8 }
    ],
    'Duskrend Blade': [
        { name: 'Rending Dusk',   type: 'damage', stat: 'strength', multiplier: 1.2, cooldown: 1, cost: 0 },
        { name: 'Gloam Overpower',       type: 'damage', stat: 'strength', multiplier: 1.9, cooldown: 3, cost: 5 },
        { name: 'Unmake',      type: 'damage', stat: 'strength', multiplier: 3.0, cooldown: 5, cost: 10 }
    ],
    'Gloam Primer': [
        { name: 'Dusk Bolt',      type: 'damage', stat: 'intelligence', multiplier: 1.1, cooldown: 1, cost: 5 },
        { name: 'Gloamlit Burst',    type: 'damage', stat: 'intelligence', multiplier: 1.7, cooldown: 3, cost: 8 },
        { name: 'Vesper Overload',   type: 'damage', stat: 'intelligence', multiplier: 2.5, cooldown: 5, cost: 12 }
    ],
    'Duskward Shield': [
        { name: 'Gloamshield Slam',     type: 'damage', stat: 'stamina',  multiplier: 1.1, cooldown: 1, cost: 0 },
        { name: 'Vigil Resolve',    type: 'shield', value: 80,                          cooldown: 4, cost: 8 },
        { name: 'Bastion Stance', type: 'buff',   effect: 'defense', value: 15, duration: 3, cooldown: 5, cost: 6 }
    ],
    'Vigil Plating': [
        { name: 'Gloam Body Slam',       type: 'damage', stat: 'stamina',  multiplier: 1.2, cooldown: 1, cost: 0 },
        { name: "Vanguard's Stand",type: 'buff',   effect: 'defense', value: 25, duration: 3, cooldown: 4, cost: 8 },
        { name: 'Vigil Resolve',    type: 'shield', value: 80,                          cooldown: 5, cost: 10 }
    ],
    'Duskheavy Blade': [
        { name: 'Duskcrush',           type: 'damage', stat: 'strength', multiplier: 1.2, cooldown: 1, cost: 0 },
        { name: 'Gloam Slam',     type: 'damage', stat: 'strength', multiplier: 1.7, stun: true, cooldown: 3, cost: 8 },
        { name: 'Ruinous Dusk',       type: 'damage', stat: 'strength', multiplier: 2.8, cooldown: 5, cost: 10 }
    ],
    'Ember Staff': [] /* Healer weapon — stat bonuses only, no active moves */,

    // ── E RANK ────────────────────────────────────────────────
    'Umbral Fang': [
        { name: 'Umbral Strike',   type: 'damage', stat: 'agility',  multiplier: 1.4, cooldown: 1, cost: 0 },
        { name: 'Umbral Flurry',   type: 'damage', stat: 'agility',  multiplier: 1.2, hits: 3,     cooldown: 3, cost: 8 },
        { name: 'Gloam Mark',      type: 'debuff', effect: 'defense', value: -15, duration: 3, cooldown: 5, cost: 10 }
    ],
    'Gloamlight Staff': [
        { name: 'Gloamlit Bolt',     type: 'damage', stat: 'intelligence', multiplier: 1.4, cooldown: 1, cost: 6 },
        { name: 'Vesper Surge',      type: 'buff',   effect: 'intelligence', value: 20, duration: 3, cooldown: 4, cost: 10 },
        { name: 'Gloamlit Rupture',type: 'damage', stat: 'intelligence', multiplier: 2.2, aoe: true, cooldown: 5, cost: 14 }
    ],
    'Duskiron Greatsword': [
        { name: 'Duskiron Strike',     type: 'damage', stat: 'strength', multiplier: 1.5, cooldown: 1, cost: 0 },
        { name: 'Duskshatter Blow',    type: 'damage', stat: 'strength', multiplier: 2.0, def_reduction: 15, cooldown: 3, cost: 8 },
        { name: 'Umbra Titan Cleave',    type: 'damage', stat: 'strength', multiplier: 3.0, aoe: true,   cooldown: 5, cost: 12 }
    ],
    'Duskwatch Tower': [
        { name: 'Gloamshield Bash',     type: 'damage', stat: 'stamina',  multiplier: 1.4, cooldown: 1, cost: 0 },
        { name: 'Vigil Ward',         type: 'buff',   effect: 'defense', value: 30, duration: 3, cooldown: 4, cost: 10 },
        { name: 'Grand Gloambarrier',   type: 'shield', value: 150,                         cooldown: 5, cost: 12 }
    ],

    // ── D RANK ────────────────────────────────────────────────
    'Twin Gloamfangs': [
        { name: 'Gloamfang Slash',      type: 'damage', stat: 'agility',  multiplier: 1.6, cooldown: 1, cost: 0 },
        { name: 'Twin Gloamfang',       type: 'damage', stat: 'agility',  multiplier: 1.4, hits: 2,     cooldown: 2, cost: 10 },
        { name: 'Venomfang',      type: 'damage', stat: 'agility',  multiplier: 2.5, bleed: true, cooldown: 5, cost: 15 }
    ],
    'Gloamfrost Wand': [
        { name: 'Gloamfrost Bolt',      type: 'damage', stat: 'intelligence', multiplier: 1.6, cooldown: 1, cost: 8 },
        { name: 'Gloamfrost Lance',       type: 'damage', stat: 'intelligence', multiplier: 2.2, freeze: true, cooldown: 3, cost: 12 },
        { name: 'Gloamstorm',        type: 'damage', stat: 'intelligence', multiplier: 2.0, aoe: true,   cooldown: 5, cost: 16 }
    ],
    'Vigil Helm': [
        { name: 'Vigilhelm Crush',      type: 'damage', stat: 'stamina',  multiplier: 1.5, cooldown: 1, cost: 0 },
        { name: "Vanguard's Stand",type: 'buff',   effect: 'defense', value: 35, duration: 3, cooldown: 4, cost: 10 },
        { name: 'Unyielding',      type: 'shield', value: 200,                         cooldown: 5, cost: 14 }
    ],

    // ── C RANK ────────────────────────────────────────────────
    'Duskwind Katana': [
        { name: 'Nightwind Slash',      type: 'damage', stat: 'agility',  multiplier: 1.8, cooldown: 1, cost: 0 },
        { name: 'Nightgale Strike',     type: 'damage', stat: 'agility',  multiplier: 2.5, ignore_defense: 0.3, cooldown: 3, cost: 12 },
        { name: 'Nightstorm Blade',     type: 'damage', stat: 'agility',  multiplier: 4.0, cooldown: 5, cost: 18 }
    ],
    'Nightgloam Bow': [
        { name: 'Umbral Arrow',    type: 'damage', stat: 'agility',  multiplier: 1.8, cooldown: 1, cost: 0 },
        { name: 'Venom Arrow',    type: 'damage', stat: 'agility',  multiplier: 2.0, bleed: true, cooldown: 3, cost: 12 },
        { name: 'Rain of Gloom',  type: 'damage', stat: 'agility',  multiplier: 1.5, aoe: true, hits: 2, cooldown: 5, cost: 18 }
    ],
    'Umbral Scepter': [
        { name: 'Gloam Bolt',       type: 'damage', stat: 'intelligence', multiplier: 1.8, cooldown: 1, cost: 10 },
        { name: 'Gloamlit Surge',    type: 'damage', stat: 'intelligence', multiplier: 2.5, cooldown: 3, cost: 14 },
        { name: 'Dawnfall Wrath', type: 'damage', stat: 'intelligence', multiplier: 3.5, aoe: true,   cooldown: 5, cost: 20 }
    ],
    'Duskstone Gauntlets': [
        { name: 'Duskstone Punch',     type: 'damage', stat: 'stamina',  multiplier: 1.7, cooldown: 1, cost: 0 },
        { name: 'Duskstone Wall',      type: 'buff',   effect: 'defense', value: 50, duration: 3, cooldown: 4, cost: 12 },
        { name: 'Gloamquake',    type: 'damage', stat: 'stamina',  multiplier: 3.0, stun: true, cooldown: 5, cost: 16 }
    ],
    'Duskbone Mace': [
        { name: 'Wyrm Smash',    type: 'damage', stat: 'strength', multiplier: 1.8, cooldown: 1, cost: 0 },
        { name: 'Gravebone Crush',      type: 'damage', stat: 'strength', multiplier: 2.6, def_reduction: 20, cooldown: 3, cost: 14 },
        { name: 'Wyrm Roar',     type: 'debuff', effect: 'attack', value: -25, duration: 3, cooldown: 5, cost: 16 }
    ],
    'Nightglass Cleaver': [
        { name: 'Nightglass Slash',  type: 'damage', stat: 'strength', multiplier: 2.0, cooldown: 1, cost: 0 },
        { name: 'Umbral Cleave',     type: 'damage', stat: 'strength', multiplier: 3.0, cooldown: 3, cost: 14 },
        { name: 'Umbra Rend',     type: 'damage', stat: 'strength', multiplier: 4.5, ignore_defense: 0.4, cooldown: 5, cost: 20 }
    ],
    'Gloamwhisper': [
        { name: 'Silent Dusk',      type: 'damage', stat: 'agility',  multiplier: 2.0, cooldown: 1, cost: 0 },
        { name: 'Umbral Whisper',  type: 'damage', stat: 'agility',  multiplier: 3.0, ignore_defense: 0.5, cooldown: 3, cost: 14 },
        { name: 'Gloam Whisper',   type: 'damage', stat: 'agility',  multiplier: 5.0, cooldown: 5, cost: 22 }
    ],
    'Cinderrod': [
        { name: 'Cinder Bolt',    type: 'damage', stat: 'intelligence', multiplier: 2.0, cooldown: 1, cost: 12 },
        { name: 'Cinder Burst',     type: 'damage', stat: 'intelligence', multiplier: 2.8, aoe: true,   cooldown: 3, cost: 16 },
        { name: 'Cinderstorm',         type: 'damage', stat: 'intelligence', multiplier: 4.5, cooldown: 5, cost: 22 }
    ],
    'Bulwark of Dusk': [
        { name: 'Duskstone Slam',      type: 'damage', stat: 'stamina',  multiplier: 1.8, cooldown: 15, cost: 0 },
        { name: 'Duskstone Shield',  type: 'shield', value: 400,                         cooldown: 120, cost: 14 },
        { name: 'Duskpeak Crush',  type: 'damage', stat: 'stamina',  multiplier: 3.2, stun: true, cooldown: 150, cost: 18 }
    ],

    // ── B RANK ────────────────────────────────────────────────
    'Eclipse Orb': [
        { name: 'Dawnfall Bolt',  type: 'damage', stat: 'intelligence', multiplier: 2.2, cooldown: 1, cost: 12 },
        { name: 'Gloamlit Surge',    type: 'damage', stat: 'intelligence', multiplier: 3.2, cooldown: 3, cost: 16 },
        { name: 'Sunshard Fall',       type: 'damage', stat: 'intelligence', multiplier: 5.0, aoe: true,   cooldown: 5, cost: 22 }
    ],
    'Umbral Greatsword': [
        { name: 'Umbra Slash',     type: 'damage', stat: 'strength', multiplier: 2.3, cooldown: 15, cost: 0 },
        { name: 'Umbral Rend',    type: 'damage', stat: 'strength', multiplier: 3.5, def_reduction: 30, cooldown: 60, cost: 16 },
        { name: 'Gloam Cleave',     type: 'damage', stat: 'strength', multiplier: 5.5, cooldown: 120, cost: 22 }
    ],
    'Gloamreaper Dagger': [
        { name: 'Gloamreaper Slash',    type: 'damage', stat: 'agility',  multiplier: 2.3, cooldown: 15, cost: 0 },
        { name: "Reaper's Mark",   type: 'debuff', effect: 'defense', value: -35, duration: 3, cooldown: 60, cost: 16 },
        { name: 'Gloam Drain',      type: 'damage', stat: 'agility',  multiplier: 4.5, ignore_defense: 0.5, cooldown: 120, cost: 22 }
    ],
    'Staff of the Long Dusk': [
        { name: 'Everdark Bolt',    type: 'damage', stat: 'intelligence', multiplier: 2.2, cooldown: 1, cost: 12 },
        { name: 'Timeless Surge',  type: 'buff',   effect: 'intelligence', value: 60, duration: 3, cooldown: 4, cost: 18 },
        { name: 'Everdusk Blast',  type: 'damage', stat: 'intelligence', multiplier: 5.5, cooldown: 5, cost: 24 }
    ],
    'Aegis of the Hollow': [
        { name: 'Sunfallen Strike',   type: 'damage', stat: 'stamina',  multiplier: 2.1, cooldown: 1, cost: 0 },
        { name: 'Duskaegis Guard',     type: 'shield', value: 600,                         cooldown: 4, cost: 16 },
        { name: 'Sunfallen Titan',    type: 'damage', stat: 'stamina',  multiplier: 4.0, stun: true, cooldown: 5, cost: 20 }
    ],
    // Healer B rank crafted
    'Gloam Mace': [] /* Healer weapon — stat bonuses only, no active moves */,
    'Cinder Chalice': [] /* Healer weapon — stat bonuses only, no active moves */,
    'Wraith Lantern': [] /* Healer weapon — stat bonuses only, no active moves */,
    'Cradle of Dawn': [] /* Healer weapon — stat bonuses only, no active moves */,

    // ── A RANK ────────────────────────────────────────────────
    "Umbra Titan's Wrath": [
        { name: 'Umbra Titan Strike',    type: 'damage', stat: 'strength', multiplier: 2.8, cooldown: 1, cost: 0 },
        { name: 'Umbral Wrath',      type: 'damage', stat: 'strength', multiplier: 4.2, stun: true, cooldown: 3, cost: 20 },
        { name: 'Umbra Titan Rampage',   type: 'damage', stat: 'strength', multiplier: 7.0, aoe: true,  cooldown: 5, cost: 28 }
    ],
    'Eclipse Edge': [
        { name: 'Eclipse Slash',   type: 'damage', stat: 'agility',  multiplier: 2.8, cooldown: 1, cost: 0 },
        { name: 'Umbral Eclipse',  type: 'damage', stat: 'agility',  multiplier: 4.5, ignore_defense: 0.5, cooldown: 3, cost: 22 },
        { name: 'Total Eclipse',   type: 'damage', stat: 'agility',  multiplier: 7.5, cooldown: 5, cost: 30 }
    ],
    'Twilight Codex': [
        { name: 'Gloamcodex Bolt',      type: 'damage', stat: 'intelligence', multiplier: 2.8, cooldown: 1, cost: 15 },
        { name: 'Dawnfall Wrath', type: 'damage', stat: 'intelligence', multiplier: 4.5, aoe: true,   cooldown: 3, cost: 22 },
        { name: 'Hollowsky Fall',    type: 'damage', stat: 'intelligence', multiplier: 7.5, cooldown: 5, cost: 30 }
    ],
    'Duskwall Aegis': [
        { name: 'Duskaegis Slam',      type: 'damage', stat: 'stamina',  multiplier: 2.6, cooldown: 1, cost: 0 },
        { name: 'Bastion Wall',   type: 'buff',   effect: 'defense', value: 100, duration: 3, cooldown: 4, cost: 22 },
        { name: 'Duskaegis Crush',     type: 'damage', stat: 'stamina',  multiplier: 6.0, stun: true, cooldown: 5, cost: 28 }
    ],

    // ── S RANK ────────────────────────────────────────────────
    'Sunslayer': [
        { name: 'Hollow Strike',      type: 'damage', stat: 'strength', multiplier: 3.5, cooldown: 1, cost: 0 },
        { name: 'Sunslayer\'s Wrath', type: 'damage', stat: 'strength', multiplier: 5.5, ignore_defense: 0.5, cooldown: 3, cost: 25 },
        { name: 'Dawn Execution',type: 'damage', stat: 'strength', multiplier: 10.0, cooldown: 5, cost: 35 }
    ],
    "Last Hour's Edge": [
        { name: 'Everdusk Slash',  type: 'damage', stat: 'agility',  multiplier: 3.5, cooldown: 1, cost: 0 },
        { name: 'Time Rend',       type: 'damage', stat: 'agility',  multiplier: 5.5, ignore_defense: 0.6, cooldown: 3, cost: 25 },
        { name: 'Everdark Gloam',    type: 'damage', stat: 'agility',  multiplier: 10.0, cooldown: 5, cost: 35 }
    ],
    'Umbral Oracle Scepter': [
        { name: 'All-Seeing Bolt', type: 'damage', stat: 'intelligence', multiplier: 3.5, cooldown: 1, cost: 20 },
        { name: 'All-Seeing Gloam',  type: 'damage', stat: 'intelligence', multiplier: 5.5, aoe: true,   cooldown: 3, cost: 28 },
        { name: 'All-Gloaming',     type: 'damage', stat: 'intelligence', multiplier: 10.0, cooldown: 5, cost: 38 }
    ],
    'Aegis Everdark': [
        { name: 'Undying Slam',   type: 'damage', stat: 'stamina',  multiplier: 3.2, cooldown: 1, cost: 0 },
        { name: 'Undying Guard',  type: 'shield', value: 2000,                        cooldown: 3, cost: 22 },
        { name: 'Undying Crush',  type: 'damage', stat: 'stamina',  multiplier: 8.0, stun: true, cooldown: 5, cost: 32 }
    ],


    // ── FORGED — COMMON ──────────────────────────────────────
    'Gloamhammer': [
        { name: 'Dusk Crushing Blow',   type: 'damage', stat: 'strength', multiplier: 1.5, def_reduction: 15, cooldown: 2, cost: 10 },
        { name: 'Gloamquake Slam',    type: 'damage', stat: 'strength', multiplier: 1.8, aoe: true, stun: true, cooldown: 4, cost: 16 },
        { name: 'Duskmomentum',        type: 'buff',   effect: 'strength_up', value: 20, duration: 2, cooldown: 4, cost: 10 }
    ],
    'Gravebone Crusher': [
        { name: 'Gravebone Slam',       type: 'damage', stat: 'strength', multiplier: 1.6, cooldown: 2, cost: 10 },
        { name: 'Duskshatter',         type: 'damage', stat: 'strength', multiplier: 1.8, def_reduction: 15, cooldown: 3, cost: 12 },
        { name: 'Duskbludgeon',        type: 'damage', stat: 'strength', multiplier: 2.5, stun: true, cooldown: 5, cost: 16 }
    ],
    'Duskthorn Dagger': [
        { name: 'Duskthorn Stab',      type: 'damage', stat: 'agility', multiplier: 1.5, cooldown: 1, cost: 8 },
        { name: 'Duskthorn Flurry',  type: 'damage', stat: 'agility', multiplier: 1.2, hits: 3, cooldown: 3, cost: 12 },
        { name: 'Wilt',            type: 'debuff', effect: 'strength', value: -10, duration: 2, cooldown: 4, cost: 10 }
    ],
    'Duskiron Ward': [
        { name: 'Duskward Bash',       type: 'damage', stat: 'stamina', multiplier: 1.3, cooldown: 2, cost: 8 },
        { name: 'Vigil Cover',      type: 'buff',   effect: 'defense', value: 25, duration: 3, cooldown: 4, cost: 10 },
        { name: "Defender's Cry",  type: 'buff',   effect: 'stamina', value: 15, duration: 2, cooldown: 5, cost: 12 }
    ],
    'Gravebone Staff': [
        { name: 'Gravebone Bolt',       type: 'damage', stat: 'intelligence', multiplier: 1.5, cooldown: 1, cost: 8 },
        { name: 'Marrow Drain',    type: 'debuff', effect: 'intelligence', value: -10, duration: 3, cooldown: 3, cost: 10 },
        { name: 'Gloam Crackle',    type: 'damage', stat: 'intelligence', multiplier: 2.2, cooldown: 4, cost: 14 }
    ],

    // ── FORGED — UNCOMMON ─────────────────────────────────────
    'Umbra Fang': [
        { name: 'Gloamfang Strike',     type: 'damage', stat: 'agility', multiplier: 2.0, cooldown: 2, cost: 12 },
        { name: 'Venom Coat',      type: 'debuff', effect: 'strength', value: -15, duration: 3, cooldown: 3, cost: 10 },
        { name: 'Umbralstep',      type: 'damage', stat: 'agility', multiplier: 2.8, cooldown: 4, cost: 18 }
    ],
    'Cinder Greatsword': [
        { name: 'Cinder Slash',     type: 'damage', stat: 'strength', multiplier: 1.8, cooldown: 2, cost: 12 },
        { name: 'Cinder Through',    type: 'damage', stat: 'strength', multiplier: 2.2, ignore_defense: 0.3, cooldown: 3, cost: 14 },
        { name: 'Cinder Charge',    type: 'damage', stat: 'strength', multiplier: 3.0, cooldown: 5, cost: 20 }
    ],
    'Gloamfrost Barrier': [
        { name: 'Gloamfrost Block',       type: 'buff',   effect: 'defense', value: 40, duration: 3, cooldown: 4, cost: 12 },
        { name: 'Gloamfrost Slam',       type: 'damage', stat: 'stamina', multiplier: 1.5, stun: true, cooldown: 3, cost: 10 },
        { name: 'Gloamfrost Wall',     type: 'debuff', effect: 'agility', value: -20, duration: 2, cooldown: 5, cost: 14 }
    ],
    'Venom Codex': [
        { name: 'Toxic Verse',     type: 'damage', stat: 'intelligence', multiplier: 1.8, cooldown: 2, cost: 12 },
        { name: 'Plague Page',     type: 'debuff', effect: 'strength', value: -12, duration: 3, cooldown: 3, cost: 10 },
        { name: 'Pestilent Blast', type: 'damage', stat: 'intelligence', multiplier: 2.6, aoe: true, cooldown: 5, cost: 20 }
    ],

    // ── FORGED — RARE ─────────────────────────────────────────
    'Wraithreaper': [
        { name: 'Wraith Rend',       type: 'damage', stat: 'strength', multiplier: 2.5, cooldown: 2, cost: 18 },
        { name: 'Gloam Harvest',         type: 'damage', stat: 'strength', multiplier: 3.5, cooldown: 4, cost: 22 },
        { name: "Death's Embrace",  type: 'buff',   effect: 'strength', value: 40, duration: 3, cooldown: 6, cost: 20 }
    ],
    'Gloam Edge': [
        { name: 'Gloam Tear',       type: 'damage', stat: 'agility', multiplier: 2.8, cooldown: 2, cost: 18 },
        { name: 'Umbra Null Step',       type: 'buff',   effect: 'agility', value: 35, duration: 2, cooldown: 3, cost: 14 },
        { name: 'Unwriting',         type: 'damage', stat: 'agility', multiplier: 4.0, ignore_defense: 0.5, cooldown: 5, cost: 25 }
    ],
    'Nightwall': [
        { name: 'Nightfall Guard',   type: 'buff',   effect: 'defense', value: 55, duration: 3, cooldown: 4, cost: 15 },
        { name: 'Nightfall Bash',  type: 'damage', stat: 'stamina', multiplier: 2.0, stun: true, cooldown: 3, cost: 16 },
        { name: 'Nightstorm Strike',     type: 'damage', stat: 'stamina', multiplier: 3.0, cooldown: 5, cost: 22 }
    ],
    'Duskblood Grimoire': [
        { name: 'Duskblood Verse',     type: 'damage', stat: 'intelligence', multiplier: 2.5, cooldown: 2, cost: 18 },
        { name: 'Duskblood Nova',    type: 'damage', stat: 'intelligence', multiplier: 3.5, aoe: true, cooldown: 4, cost: 24 },
        { name: 'Duskblood Pact',    type: 'buff',   effect: 'intelligence', value: 40, duration: 3, cooldown: 5, cost: 20 }
    ],

    // ── FORGED — LEGENDARY ────────────────────────────────────
    'Maw of Umbra': [
        { name: 'Umbra Devour',    type: 'damage', stat: 'strength', multiplier: 3.8, cooldown: 15, cost: 30 },
        { name: 'Hungering Umbra',   type: 'damage', stat: 'strength', multiplier: 3.0, hits: 2, cooldown: 60, cost: 28 },
        { name: 'Umbral Roar',    type: 'debuff', effect: 'strength', value: -30, duration: 3, cooldown: 120, cost: 25 }
    ],
    'Umbral Reckoning': [
        { name: 'Umbra Devour',    type: 'damage', stat: 'strength', multiplier: 3.8, cooldown: 3, cost: 30 },
        { name: 'Hungering Umbra',   type: 'damage', stat: 'strength', multiplier: 3.0, hits: 2, cooldown: 5, cost: 28 },
        { name: 'Umbral Roar',    type: 'debuff', effect: 'strength', value: -30, duration: 3, cooldown: 6, cost: 25 }
    ],
    'Wraithblade': [
        { name: 'Wraith Cut',      type: 'damage', stat: 'agility', multiplier: 4.2, cooldown: 2, cost: 28 },
        { name: 'Wraith Walk',      type: 'buff',   effect: 'agility', value: 60, duration: 2, cooldown: 4, cost: 24 },
        { name: 'Wraith Cleave',     type: 'damage', stat: 'agility', multiplier: 5.0, ignore_defense: 0.7, cooldown: 6, cost: 35 }
    ],
    'Aegis of Everdark': [
        { name: 'Everdark Guard',   type: 'buff',   effect: 'defense', value: 80, duration: 3, cooldown: 4, cost: 20 },
        { name: 'Time Bastion',    type: 'shield', value: 300, cooldown: 6, cost: 28 },
        { name: 'Everdusk Slam',   type: 'damage', stat: 'stamina', multiplier: 3.5, stun: true, cooldown: 5, cost: 30 }
    ],
    'The Last Word': [
        { name: 'Hollow Decree',    type: 'damage', stat: 'intelligence', multiplier: 4.5, cooldown: 3, cost: 30 },
        { name: 'Absolute Dusk',    type: 'damage', stat: 'intelligence', multiplier: 3.8, aoe: true, cooldown: 5, cost: 28 },
        { name: 'Last Rite',       type: 'debuff', effect: 'intelligence', value: -40, duration: 3, cooldown: 6, cost: 25 }
    ],

    // ── PRESTIGE STARTER WEAPONS (weaker than Void tier, ~stat 180) ──
    'Duskling Blade': [
        { name: 'Duskling Slash',  type: 'damage', stat: 'strength', multiplier: 0.8, cooldown: 1, cost: 0 },
        { name: 'Gloam Cut',        type: 'damage', stat: 'strength', multiplier: 1.5, cooldown: 3, cost: 15 },
        { name: 'First Eclipse',  type: 'damage', stat: 'strength', multiplier: 2.5, cooldown: 5, cost: 20 }
    ],
    'Duskling Fang': [
        { name: 'Duskling Pierce', type: 'damage', stat: 'agility',  multiplier: 0.8, cooldown: 1, cost: 0 },
        { name: 'Gloam Sting',      type: 'damage', stat: 'agility',  multiplier: 1.5, bleed: true, cooldown: 3, cost: 15 },
        { name: 'First Umbra',    type: 'damage', stat: 'agility',  multiplier: 2.5, cooldown: 5, cost: 20 }
    ],
    'Duskling Tome': [
        { name: 'Duskling Bolt',   type: 'damage', stat: 'intelligence', multiplier: 0.8, cooldown: 1, cost: 8 },
        { name: 'Gloam Page',       type: 'damage', stat: 'intelligence', multiplier: 1.5, cooldown: 3, cost: 15 },
        { name: 'First Dirge',     type: 'damage', stat: 'intelligence', multiplier: 2.5, cooldown: 5, cost: 20 }
    ],
    'Duskling Shield': [
        { name: 'Duskling Bash',   type: 'damage', stat: 'stamina', multiplier: 0.8, cooldown: 1, cost: 0 },
        { name: 'Gloam Ward',       type: 'buff',   effect: 'defense_up', value: 40, duration: 3, cooldown: 4, cost: 12 },
        { name: 'First Vigil',     type: 'shield', value: 300, cooldown: 5, cost: 18 }
    ],
    'Duskling Lantern': [] /* Healer weapon — stat bonuses only, no active moves */,
    // ══════════════════════════════════════════════════════════
    //  PRESTIGE WEAPONS — PF TIER (stat ~650, mult 1.3/2.5/5.0)
    // ══════════════════════════════════════════════════════════

    // Berserker
    'Gloam Crusher': [
        { name: 'Gloam Smash',        type: 'damage', stat: 'strength', multiplier: 1.3, cooldown: 15, cost: 20 },
        { name: 'Gravebone Shatter',     type: 'damage', stat: 'strength', multiplier: 2.5, def_reduction: 30, cooldown: 60, cost: 22 },
        { name: "Berserker's Void",  type: 'buff',   effect: 'strength_up', value: 40, duration: 3, cooldown: 120, cost: 18 }
    ],
    // Assassin
    'Gloamfang': [
        { name: 'Gloam Pierce',       type: 'damage', stat: 'agility', multiplier: 1.3, cooldown: 15, cost: 18 },
        { name: 'Gloamfang Strike',       type: 'damage', stat: 'agility', multiplier: 2.5, bleed: true, cooldown: 60, cost: 20 },
        { name: 'Umbra of the Hollow',type: 'buff',   effect: 'agility_up', value: 40, duration: 3, cooldown: 120, cost: 16 }
    ],
    // Mage
    'Gloam Codex': [
        { name: 'Gloam Script',       type: 'damage', stat: 'intelligence', multiplier: 1.3, cooldown: 15, cost: 20 },
        { name: 'Gloamcodex Blast',       type: 'damage', stat: 'intelligence', multiplier: 2.5, aoe: true,   cooldown: 60, cost: 25 },
        { name: 'Vesper Drain',         type: 'damage', stat: 'intelligence', multiplier: 5.0,             cooldown: 120, cost: 30 }
    ],
    // Tank
    'Gloam Bulwark': [
        { name: 'Gloam Shield Wall',  type: 'buff',   effect: 'defense_up', value: 60, duration: 3, cooldown: 15, cost: 18 },
        { name: 'Gloambulwark Smash',     type: 'damage', stat: 'strength', multiplier: 2.5, def_reduction: 20, cooldown: 60, cost: 22 },
        { name: 'Gloam Absorption',   type: 'shield', value: 500,                        cooldown: 120, cost: 20 }
    ],
    // Healer
    'Gloam Mend': [] /* Healer weapon — stat bonuses only, no active moves */,
    // Tank damage
    'Gloam Earthbreaker': [
        { name: 'Gloamquake Slam',      type: 'damage', stat: 'stamina',   multiplier: 2.5, stun: true,    cooldown: 15, cost: 22 },
        { name: 'Gloam Tremor',        type: 'damage', stat: 'stamina',   multiplier: 2.0, aoe: true,     cooldown: 60, cost: 28 },
        { name: 'Gloambreaker Blow', type: 'damage', stat: 'strength',  multiplier: 5.0, def_reduction: 40, cooldown: 120, cost: 30 }
    ],

    // ── PD TIER (stat ~1520, mult 2.7/5.3/10.5) ──────────────
    'Eclipse Cleaver': [
        { name: 'Sky Rend',      type: 'damage', stat: 'strength', multiplier: 2.7, cooldown: 10, cost: 25 },
        { name: 'Eclipse Wave',     type: 'damage', stat: 'strength', multiplier: 5.3, aoe: true,   cooldown: 60, cost: 28 },
        { name: 'Cleave the Gloam',   type: 'damage', stat: 'strength', multiplier: 7.5, ignore_defense: 0.5, cooldown: 120, cost: 35 }
    ],
    'Eclipse Edge': [
        { name: 'Gloam Phase Slash',       type: 'damage', stat: 'agility', multiplier: 2.7, ignore_defense: 0.4, cooldown: 10, cost: 25 },
        { name: 'Eclipse Cut',      type: 'damage', stat: 'agility', multiplier: 5.3, bleed: true, cooldown: 60, cost: 28 },
        { name: 'Wraith Edge',      type: 'damage', stat: 'agility', multiplier: 5.5,             cooldown: 120, cost: 35 }
    ],
    'Eclipse Scepter': [
        { name: 'Gloam Beam',      type: 'damage', stat: 'intelligence', multiplier: 2.7, cooldown: 15, cost: 25 },
        { name: 'Eclipse Pulse',    type: 'damage', stat: 'intelligence', multiplier: 5.3, aoe: true,   cooldown: 60, cost: 30 },
        { name: 'Sky Shatter',   type: 'damage', stat: 'intelligence', multiplier: 10.5, ignore_defense: 0.5, cooldown: 120, cost: 35 }
    ],
    'Eclipse Rampart': [
        { name: 'Bastion Charge',    type: 'damage', stat: 'strength', multiplier: 2.7, stun: true, cooldown: 15, cost: 28 },
        { name: 'Eclipse Guard',    type: 'buff',   effect: 'defense_up', value: 100, duration: 3, cooldown: 60, cost: 25 },
        { name: 'Gloam Phase Block',       type: 'shield', value: 1000,                       cooldown: 120, cost: 30 }
    ],
    'Eclipse Chalice': [] /* Healer weapon — stat bonuses only, no active moves */,
    'Eclipse Juggernaut': [
        { name: 'Umbra Colossus Strike',   type: 'damage', stat: 'stamina',  multiplier: 4.0, cooldown: 30, cost: 30 },
        { name: 'Eclipse Slam',     type: 'damage', stat: 'stamina',  multiplier: 7.0, stun: true, aoe: true, cooldown: 60, cost: 38 },
        { name: 'Umbra Titan Force',       type: 'buff',   effect: 'strength_up', value: 120, duration: 3, cooldown: 120, cost: 25 }
    ],

    // ── PB TIER (stat ~3080, mult 5.9/11.6/23.0) ─────────────
    'Umbra Annihilator': [
        { name: 'The Unmaking',      type: 'damage', stat: 'strength', multiplier: 5.9, cooldown: 10, cost: 30 },
        { name: 'Gloam Crush',        type: 'damage', stat: 'strength', multiplier: 11.6, stun: true, cooldown: 60, cost: 35 },
        { name: 'Umbra Rampage',     type: 'damage', stat: 'strength', multiplier: 23.0,            cooldown: 120, cost: 45 }
    ],
    'Umbra Phantom': [
        { name: 'Wraith Kill',      type: 'damage', stat: 'agility', multiplier: 5.9, cooldown: 15, cost: 30 },
        { name: 'Unseen Strike',  type: 'damage', stat: 'agility', multiplier: 11.6, ignore_defense: 0.8, cooldown: 30, cost: 38 },
        { name: 'Gloam Blur',         type: 'damage', stat: 'agility', multiplier: 23.0,             cooldown: 120, cost: 48 }
    ],
    'Umbra Tome': [
        { name: 'Gloam Incantation',  type: 'damage', stat: 'intelligence', multiplier: 5.9, cooldown: 15, cost: 30 },
        { name: 'Lost Dirge',        type: 'damage', stat: 'intelligence', multiplier: 11.6,            cooldown: 30, cost: 35 },
        { name: 'Umbra Curse',       type: 'debuff', effect: 'intelligence', value: -80, duration: 3,  cooldown: 120, cost: 28 }
    ],
    'Umbra Fortress': [
        { name: 'Bastion Strike',   type: 'damage', stat: 'strength', multiplier: 5.0, def_reduction: 60, cooldown: 15, cost: 30 },
        { name: 'Ancient Gloamward',      type: 'buff',   effect: 'defense_up', value: 200, duration: 4,       cooldown: 60, cost: 28 },
        { name: 'Unbreaking',      type: 'shield', value: 2500,                                         cooldown: 120, cost: 38 }
    ],
    'Umbra Lantern': [] /* Healer weapon — stat bonuses only, no active moves */,

    // ── PS TIER (stat ~7200, mult 11.4/22.7/45.0) ────────────
    "The Hollow King's Fist": [
        { name: 'Fist of the Hollow King',  type: 'damage', stat: 'strength', multiplier: 11.4, cooldown: 15, cost: 40 },
        { name: 'Sky Breaker',     type: 'damage', stat: 'strength', multiplier: 22.7, aoe: true, stun: true, cooldown: 60, cost: 48 },
        { name: 'The First War',     type: 'damage', stat: 'strength', multiplier: 45.0, ignore_defense: 1.0, cooldown: 120, cost: 60 }
    ],
    "The Hollow King's Shadow": [
        { name: 'Shadow of the Hollow King',type: 'damage', stat: 'agility', multiplier: 11.4, cooldown: 15, cost: 40 },
        { name: 'The First Umbra',  type: 'damage', stat: 'agility', multiplier: 22.7, bleed: true, ignore_defense: 0.6, cooldown: 60, cost: 48 },
        { name: 'Everdark',      type: 'damage', stat: 'agility', multiplier: 45.0,             cooldown: 120, cost: 60 }
    ],
    "The Hollow King's Gospel": [
        { name: 'Gospel of Ruin',    type: 'damage', stat: 'intelligence', multiplier: 11.4, cooldown: 15, cost: 40 },
        { name: 'Written in Gloam',   type: 'damage', stat: 'intelligence', multiplier: 22.7, ignore_defense: 0.8, cooldown: 60, cost: 48 },
        { name: 'The Last Word',     type: 'damage', stat: 'intelligence', multiplier: 45.0, aoe: true, cooldown: 120, cost: 60 }
    ],
    "The Hollow King's Seal": [
        { name: 'Hollow Seal Breaker',      type: 'damage', stat: 'strength', multiplier: 10.0, ignore_defense: 0.5, cooldown: 15, cost: 40 },
        { name: 'First Seal',     type: 'buff',   effect: 'defense_up', value: 350, duration: 4,           cooldown: 60, cost: 35 },
        { name: 'Gloam Barrier',      type: 'shield', value: 6000,                                             cooldown: 120, cost: 48 }
    ],
    "The Hollow King's Grace": [
        { name: 'Grace of the Hollow King', type: 'heal',   stat: 'intelligence', multiplier: 12.0, cooldown: 15, cost: 40 },
        { name: "Healer's Last Stand",type: 'heal',  stat: 'intelligence', multiplier: 22.7, aoe: true,   cooldown: 60, cost: 48 },
        { name: 'Endless Mercy',    type: 'heal',   stat: 'intelligence', multiplier: 38.0, cleanse: true, aoe: true, cooldown: 120, cost: 55 }
    ],

    // ══════════════════════════════════════════════════════════
    //  PRESTIGE FORGED WEAPONS
    // ══════════════════════════════════════════════════════════

    // ── BERSERKER PRESTIGE FORGED ──────────────────────────────
    'Gloamrend Ravager': [
        { name: 'Gloam Ravage',       type: 'damage', stat: 'strength', multiplier: 3.8, cooldown: 15, cost: 20 },
        { name: 'Rend the Sky',      type: 'damage', stat: 'strength', multiplier: 11.2, def_reduction: 25, cooldown: 120, cost: 25 },
        { name: 'Gloam Rampage',      type: 'damage', stat: 'strength', multiplier: 8.5, aoe: true,  cooldown: 60, cost: 32 }
    ],
    'Eclipse Titan Blade': [
        { name: 'Umbra Titan Cleave',      type: 'damage', stat: 'strength', multiplier: 3.5, cooldown: 15, cost: 28 },
        { name: 'Eclipse Rend',    type: 'damage', stat: 'strength', multiplier: 6.0, ignore_defense: 0.5, cooldown: 60, cost: 32 },
        { name: 'Sky Breaker',     type: 'damage', stat: 'strength', multiplier: 11.0, stun: true, cooldown: 120, cost: 45 }
    ],
    'Hollow Kings Replica': [
        { name: 'Replica Strike',    type: 'damage', stat: 'strength', multiplier: 8.0, cooldown: 15, cost: 40 },
        { name: 'Echoing Dusk',      type: 'damage', stat: 'strength', multiplier: 15.0, def_reduction: 50, cooldown: 60, cost: 48 },
        { name: 'The Replica War',   type: 'damage', stat: 'strength', multiplier: 28.0, aoe: true,  cooldown: 120, cost: 55 }
    ],

    // ── ASSASSIN PRESTIGE FORGED ──────────────────────────────
    'Gloam Phantom Blade': [
        { name: 'Wraith Slash',     type: 'damage', stat: 'agility', multiplier: 1.8, cooldown: 15, cost: 20 },
        { name: 'Gloam Phase Rend',        type: 'damage', stat: 'agility', multiplier: 3.2, ignore_defense: 0.4, cooldown: 60, cost: 25 },
        { name: 'Gloam Teleport',     type: 'damage', stat: 'agility', multiplier: 5.5, bleed: true, cooldown: 120, cost: 32 }
    ],
    'Penumbra Reaper': [
        { name: 'Gloamreaper Strike',     type: 'damage', stat: 'agility', multiplier: 3.5, cooldown: 15, cost: 28 },
        { name: 'Eclipse Sever',    type: 'damage', stat: 'agility', multiplier: 6.2, ignore_defense: 0.6, cooldown: 60, cost: 32 },
        { name: 'Gloam Reaping',      type: 'damage', stat: 'agility', multiplier: 11.5, cooldown: 120, cost: 45 }
    ],
    'Hollow Kings Shadow Replica': [
        { name: 'Umbral Strike',     type: 'damage', stat: 'agility', multiplier: 8.0, cooldown: 15, cost: 40 },
        { name: 'Gloam Echo',         type: 'damage', stat: 'agility', multiplier: 15.5, bleed: true, cooldown: 60, cost: 48 },
        { name: 'The Replica Shadow',type: 'damage', stat: 'agility', multiplier: 29.0, ignore_defense: 0.8, cooldown: 120, cost: 55 }
    ],

    // ── MAGE PRESTIGE FORGED ────────────────────────────────────
    'Umbral Grimoire': [
        { name: 'Gloam Script',       type: 'damage', stat: 'intelligence', multiplier: 1.8, cooldown: 2, cost: 20 },
        { name: 'Gloamlit Tear',       type: 'damage', stat: 'intelligence', multiplier: 3.2, aoe: true,   cooldown: 4, cost: 25 },
        { name: 'Gloam Page',         type: 'damage', stat: 'intelligence', multiplier: 5.5, ignore_defense: 0.3, cooldown: 6, cost: 32 }
    ],
    'Eclipse Codex Supreme': [
        { name: 'Supreme Dirge',     type: 'damage', stat: 'intelligence', multiplier: 3.5, cooldown: 3, cost: 28 },
        { name: 'Eclipse Verse',    type: 'damage', stat: 'intelligence', multiplier: 6.0, aoe: true,   cooldown: 5, cost: 32 },
        { name: 'Ultimate Gloamcodex',    type: 'damage', stat: 'intelligence', multiplier: 11.0, cooldown: 7, cost: 45 }
    ],
    'Hollow Kings Gospel Replica': [
        { name: 'Hollow Gospel',     type: 'damage', stat: 'intelligence', multiplier: 8.0, cooldown: 3, cost: 40 },
        { name: 'Gloam Sermon',       type: 'damage', stat: 'intelligence', multiplier: 15.0, aoe: true,   cooldown: 5, cost: 48 },
        { name: 'The Replica Gospel',type: 'damage', stat: 'intelligence', multiplier: 27.5, ignore_defense: 0.7, cooldown: 8, cost: 55 }
    ],

    // ── TANK PRESTIGE FORGED ────────────────────────────────────
    'Umbral Aegis': [
        { name: 'Gloam Guard',        type: 'buff',   effect: 'defense_up', value: 70, duration: 3, cooldown: 45, cost: 20 },
        { name: 'Gloam Bash',         type: 'damage', stat: 'stamina', multiplier: 1.8, stun: true, cooldown: 60, cost: 22 },
        { name: 'Gloam Wall',         type: 'shield', value: 700,                        cooldown: 120, cost: 28 }
    ],
    'Eclipse Fortress Shield': [
        { name: 'Bastion Strike',   type: 'damage', stat: 'stamina', multiplier: 3.5, stun: true, cooldown: 15, cost: 28 },
        { name: 'Eclipse Guard',    type: 'buff',   effect: 'defense_up', value: 120, duration: 3, cooldown: 60, cost: 30 },
        { name: 'Bastion Collapse', type: 'shield', value: 1500,                      cooldown: 120, cost: 38 }
    ],
    'Umbral Colossus Gauntlet': [
        { name: 'Umbra Colossus Punch',    type: 'damage', stat: 'strength', multiplier: 7.5, stun: true, cooldown: 15, cost: 40 },
        { name: 'Gloam Bulwark',      type: 'buff',   effect: 'defense_up', value: 180, duration: 4, cooldown: 60, cost: 35 },
        { name: 'Umbra Colossus Slam',     type: 'shield', value: 3000, aoe: true,           cooldown: 120, cost: 48 }
    ],

    // ── HEALER PRESTIGE FORGED ──────────────────────────────────
    'Gloamlight Sanctuary Staff': [] /* Healer weapon — stat bonuses only, no active moves */,
    'Eclipse Life Chalice': [] /* Healer weapon — stat bonuses only, no active moves */,
    'Hollow Kings Grace Replica': [] /* Healer weapon — stat bonuses only, no active moves */,

};