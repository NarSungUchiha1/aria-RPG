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
 *  PS tier (Malachar):  stat 7200 → mult 11.4 / 22.7 / 45.0
 */

module.exports = {

    // ══════════════════════════════════════════════════════════
    //  NORMAL WEAPONS
    // ══════════════════════════════════════════════════════════

    // ── F RANK ────────────────────────────────────────────────
    'Dagger': [
        { name: 'Quick Stab',      type: 'damage', stat: 'agility',  multiplier: 1.1, cooldown: 1, cost: 0 },
        { name: 'Dual Strike',     type: 'damage', stat: 'agility',  multiplier: 1.4, hits: 2,     cooldown: 3, cost: 5 },
        { name: 'Backstab',        type: 'damage', stat: 'agility',  multiplier: 2.2, ignore_defense: 0.3, cooldown: 5, cost: 8 }
    ],
    'Battle Axe': [
        { name: 'Cleave',          type: 'damage', stat: 'strength', multiplier: 1.2, cooldown: 1, cost: 0 },
        { name: 'Heavy Blow',      type: 'damage', stat: 'strength', multiplier: 1.8, def_reduction: 10, cooldown: 3, cost: 5 },
        { name: 'Axe Spin',        type: 'damage', stat: 'strength', multiplier: 1.5, aoe: true,   cooldown: 5, cost: 8 }
    ],
    'Rage Blade': [
        { name: 'Rending Slash',   type: 'damage', stat: 'strength', multiplier: 1.2, cooldown: 1, cost: 0 },
        { name: 'Overpower',       type: 'damage', stat: 'strength', multiplier: 1.9, cooldown: 3, cost: 5 },
        { name: 'Annihilate',      type: 'damage', stat: 'strength', multiplier: 3.0, cooldown: 5, cost: 10 }
    ],
    'Spell Book': [
        { name: 'Magic Bolt',      type: 'damage', stat: 'intelligence', multiplier: 1.1, cooldown: 1, cost: 5 },
        { name: 'Arcane Burst',    type: 'damage', stat: 'intelligence', multiplier: 1.7, cooldown: 3, cost: 8 },
        { name: 'Mana Overload',   type: 'damage', stat: 'intelligence', multiplier: 2.5, cooldown: 5, cost: 12 }
    ],
    'Shield': [
        { name: 'Shield Slam',     type: 'damage', stat: 'stamina',  multiplier: 1.1, cooldown: 1, cost: 0 },
        { name: 'Iron Resolve',    type: 'shield', value: 80,                          cooldown: 4, cost: 8 },
        { name: 'Fortress Stance', type: 'buff',   effect: 'defense', value: 15, duration: 3, cooldown: 5, cost: 6 }
    ],
    'Armor Plate': [
        { name: 'Body Slam',       type: 'damage', stat: 'stamina',  multiplier: 1.2, cooldown: 1, cost: 0 },
        { name: "Vanguard's Stand",type: 'buff',   effect: 'defense', value: 25, duration: 3, cooldown: 4, cost: 8 },
        { name: 'Iron Resolve',    type: 'shield', value: 80,                          cooldown: 5, cost: 10 }
    ],
    'Heavy Blade': [
        { name: 'Crush',           type: 'damage', stat: 'strength', multiplier: 1.2, cooldown: 1, cost: 0 },
        { name: 'Ground Slam',     type: 'damage', stat: 'strength', multiplier: 1.7, stun: true, cooldown: 3, cost: 8 },
        { name: 'Devastate',       type: 'damage', stat: 'strength', multiplier: 2.8, cooldown: 5, cost: 10 }
    ],
    'Healing Staff': [
        { name: 'Mend',            type: 'heal',   stat: 'intelligence', multiplier: 3.0, baseHeal: 25, cooldown: 2, cost: 8 },
        { name: 'Restoration',     type: 'heal',   stat: 'intelligence', multiplier: 5.0, baseHeal: 40, cooldown: 4, cost: 12 },
        { name: 'Staff Smack',     type: 'damage', stat: 'intelligence', multiplier: 1.2,              cooldown: 1, cost: 0 }
    ],

    // ── E RANK ────────────────────────────────────────────────
    'Shadow Dagger': [
        { name: 'Shadow Strike',   type: 'damage', stat: 'agility',  multiplier: 1.4, cooldown: 1, cost: 0 },
        { name: 'Shadow Flurry',   type: 'damage', stat: 'agility',  multiplier: 1.2, hits: 3,     cooldown: 3, cost: 8 },
        { name: 'Death Mark',      type: 'debuff', effect: 'defense', value: -15, duration: 3, cooldown: 5, cost: 10 }
    ],
    'Arcane Staff': [
        { name: 'Arcane Bolt',     type: 'damage', stat: 'intelligence', multiplier: 1.4, cooldown: 1, cost: 6 },
        { name: 'Mana Surge',      type: 'buff',   effect: 'intelligence', value: 20, duration: 3, cooldown: 4, cost: 10 },
        { name: 'Arcane Explosion',type: 'damage', stat: 'intelligence', multiplier: 2.2, aoe: true, cooldown: 5, cost: 14 }
    ],
    'Iron Greatsword': [
        { name: 'Iron Strike',     type: 'damage', stat: 'strength', multiplier: 1.5, cooldown: 1, cost: 0 },
        { name: 'Shatter Blow',    type: 'damage', stat: 'strength', multiplier: 2.0, def_reduction: 15, cooldown: 3, cost: 8 },
        { name: 'Titan Cleave',    type: 'damage', stat: 'strength', multiplier: 3.0, aoe: true,   cooldown: 5, cost: 12 }
    ],
    'Tower Shield': [
        { name: 'Shield Bash',     type: 'damage', stat: 'stamina',  multiplier: 1.4, cooldown: 1, cost: 0 },
        { name: 'Fortify',         type: 'buff',   effect: 'defense', value: 30, duration: 3, cooldown: 4, cost: 10 },
        { name: 'Grand Barrier',   type: 'shield', value: 150,                         cooldown: 5, cost: 12 }
    ],

    // ── D RANK ────────────────────────────────────────────────
    'Twin Fang Blades': [
        { name: 'Fang Slash',      type: 'damage', stat: 'agility',  multiplier: 1.6, cooldown: 1, cost: 0 },
        { name: 'Twin Fang',       type: 'damage', stat: 'agility',  multiplier: 1.4, hits: 2,     cooldown: 2, cost: 10 },
        { name: 'Venom Fang',      type: 'damage', stat: 'agility',  multiplier: 2.5, bleed: true, cooldown: 5, cost: 15 }
    ],
    'Frostbane Wand': [
        { name: 'Frost Bolt',      type: 'damage', stat: 'intelligence', multiplier: 1.6, cooldown: 1, cost: 8 },
        { name: 'Ice Lance',       type: 'damage', stat: 'intelligence', multiplier: 2.2, freeze: true, cooldown: 3, cost: 12 },
        { name: 'Blizzard',        type: 'damage', stat: 'intelligence', multiplier: 2.0, aoe: true,   cooldown: 5, cost: 16 }
    ],
    'Vanguard Helm': [
        { name: 'Helm Crush',      type: 'damage', stat: 'stamina',  multiplier: 1.5, cooldown: 1, cost: 0 },
        { name: "Vanguard's Stand",type: 'buff',   effect: 'defense', value: 35, duration: 3, cooldown: 4, cost: 10 },
        { name: 'Impervious',      type: 'shield', value: 200,                         cooldown: 5, cost: 14 }
    ],

    // ── C RANK ────────────────────────────────────────────────
    'Wind Katana': [
        { name: 'Wind Slash',      type: 'damage', stat: 'agility',  multiplier: 1.8, cooldown: 1, cost: 0 },
        { name: 'Gale Strike',     type: 'damage', stat: 'agility',  multiplier: 2.5, ignore_defense: 0.3, cooldown: 3, cost: 12 },
        { name: 'Storm Blade',     type: 'damage', stat: 'agility',  multiplier: 4.0, cooldown: 5, cost: 18 }
    ],
    'Nightshade Bow': [
        { name: 'Shadow Arrow',    type: 'damage', stat: 'agility',  multiplier: 1.8, cooldown: 1, cost: 0 },
        { name: 'Poison Arrow',    type: 'damage', stat: 'agility',  multiplier: 2.0, bleed: true, cooldown: 3, cost: 12 },
        { name: 'Rain of Arrows',  type: 'damage', stat: 'agility',  multiplier: 1.5, aoe: true, hits: 2, cooldown: 5, cost: 18 }
    ],
    'Void Scepter': [
        { name: 'Void Bolt',       type: 'damage', stat: 'intelligence', multiplier: 1.8, cooldown: 1, cost: 10 },
        { name: 'Arcane Surge',    type: 'damage', stat: 'intelligence', multiplier: 2.5, cooldown: 3, cost: 14 },
        { name: 'Celestial Wrath', type: 'damage', stat: 'intelligence', multiplier: 3.5, aoe: true,   cooldown: 5, cost: 20 }
    ],
    'Golemheart Gauntlets': [
        { name: 'Golem Punch',     type: 'damage', stat: 'stamina',  multiplier: 1.7, cooldown: 1, cost: 0 },
        { name: 'Stone Wall',      type: 'buff',   effect: 'defense', value: 50, duration: 3, cooldown: 4, cost: 12 },
        { name: 'Earthshatter',    type: 'damage', stat: 'stamina',  multiplier: 3.0, stun: true, cooldown: 5, cost: 16 }
    ],
    'Dragonbone Mace': [
        { name: 'Dragon Smash',    type: 'damage', stat: 'strength', multiplier: 1.8, cooldown: 1, cost: 0 },
        { name: 'Bone Crush',      type: 'damage', stat: 'strength', multiplier: 2.6, def_reduction: 20, cooldown: 3, cost: 14 },
        { name: 'Dragon Roar',     type: 'debuff', effect: 'attack', value: -25, duration: 3, cooldown: 5, cost: 16 }
    ],
    'Obsidian Cleaver': [
        { name: 'Obsidian Slash',  type: 'damage', stat: 'strength', multiplier: 2.0, cooldown: 1, cost: 0 },
        { name: 'Dark Cleave',     type: 'damage', stat: 'strength', multiplier: 3.0, cooldown: 3, cost: 14 },
        { name: 'Shadow Rend',     type: 'damage', stat: 'strength', multiplier: 4.5, ignore_defense: 0.4, cooldown: 5, cost: 20 }
    ],
    'Whisperblade': [
        { name: 'Silent Cut',      type: 'damage', stat: 'agility',  multiplier: 2.0, cooldown: 1, cost: 0 },
        { name: 'Whisper Strike',  type: 'damage', stat: 'agility',  multiplier: 3.0, ignore_defense: 0.5, cooldown: 3, cost: 14 },
        { name: 'Death Whisper',   type: 'damage', stat: 'agility',  multiplier: 5.0, cooldown: 5, cost: 22 }
    ],
    'Inferno Rod': [
        { name: 'Inferno Bolt',    type: 'damage', stat: 'intelligence', multiplier: 2.0, cooldown: 1, cost: 12 },
        { name: 'Flame Burst',     type: 'damage', stat: 'intelligence', multiplier: 2.8, aoe: true,   cooldown: 3, cost: 16 },
        { name: 'Inferno',         type: 'damage', stat: 'intelligence', multiplier: 4.5, cooldown: 5, cost: 22 }
    ],
    'Bulwark of Stone': [
        { name: 'Stone Slam',      type: 'damage', stat: 'stamina',  multiplier: 1.8, cooldown: 1, cost: 0 },
        { name: 'Granite Shield',  type: 'shield', value: 400,                         cooldown: 4, cost: 14 },
        { name: 'Mountain Crush',  type: 'damage', stat: 'stamina',  multiplier: 3.2, stun: true, cooldown: 5, cost: 18 }
    ],

    // ── B RANK ────────────────────────────────────────────────
    'Celestial Orb': [
        { name: 'Celestial Bolt',  type: 'damage', stat: 'intelligence', multiplier: 2.2, cooldown: 1, cost: 12 },
        { name: 'Arcane Surge',    type: 'damage', stat: 'intelligence', multiplier: 3.2, cooldown: 3, cost: 16 },
        { name: 'Star Fall',       type: 'damage', stat: 'intelligence', multiplier: 5.0, aoe: true,   cooldown: 5, cost: 22 }
    ],
    'Abyssal Greatsword': [
        { name: 'Abyss Slash',     type: 'damage', stat: 'strength', multiplier: 2.3, cooldown: 1, cost: 0 },
        { name: 'Abyssal Rend',    type: 'damage', stat: 'strength', multiplier: 3.5, def_reduction: 30, cooldown: 3, cost: 16 },
        { name: 'Void Cleave',     type: 'damage', stat: 'strength', multiplier: 5.5, cooldown: 5, cost: 22 }
    ],
    'Voidreaper Dagger': [
        { name: 'Reaper Slash',    type: 'damage', stat: 'agility',  multiplier: 2.3, cooldown: 1, cost: 0 },
        { name: "Reaper's Mark",   type: 'debuff', effect: 'defense', value: -35, duration: 3, cooldown: 3, cost: 16 },
        { name: 'Void Drain',      type: 'damage', stat: 'agility',  multiplier: 4.5, ignore_defense: 0.5, cooldown: 5, cost: 22 }
    ],
    'Staff of the Eternal': [
        { name: 'Eternal Bolt',    type: 'damage', stat: 'intelligence', multiplier: 2.2, cooldown: 1, cost: 12 },
        { name: 'Timeless Surge',  type: 'buff',   effect: 'intelligence', value: 60, duration: 3, cooldown: 4, cost: 18 },
        { name: 'Eternity Blast',  type: 'damage', stat: 'intelligence', multiplier: 5.5, cooldown: 5, cost: 24 }
    ],
    'Aegis of the Fallen': [
        { name: 'Fallen Strike',   type: 'damage', stat: 'stamina',  multiplier: 2.1, cooldown: 1, cost: 0 },
        { name: 'Aegis Guard',     type: 'shield', value: 600,                         cooldown: 4, cost: 16 },
        { name: 'Fallen Titan',    type: 'damage', stat: 'stamina',  multiplier: 4.0, stun: true, cooldown: 5, cost: 20 }
    ],
    // Healer B rank crafted
    'Splint Mace': [
        { name: 'Mace Strike',     type: 'damage', stat: 'intelligence', multiplier: 1.8, cooldown: 1, cost: 0 },
        { name: 'Splint Mend',     type: 'heal',   stat: 'intelligence', multiplier: 5.0, baseHeal: 50, cooldown: 3, cost: 14 },
        { name: 'Bone Mend',       type: 'heal',   stat: 'intelligence', multiplier: 8.0, baseHeal: 80, cooldown: 5, cost: 20 }
    ],
    'Ember Chalice': [
        { name: 'Chalice Strike',  type: 'damage', stat: 'intelligence', multiplier: 1.8, cooldown: 1, cost: 0 },
        { name: 'Ember Heal',      type: 'heal',   stat: 'intelligence', multiplier: 6.0, baseHeal: 60, cooldown: 2, cost: 14 },
        { name: 'Burning Mend',    type: 'heal',   stat: 'intelligence', multiplier: 9.0, aoe: true,   cooldown: 5, cost: 22 }
    ],
    'Soul Lantern': [
        { name: 'Lantern Strike',  type: 'damage', stat: 'intelligence', multiplier: 1.8, cooldown: 1, cost: 0 },
        { name: 'Soul Light',      type: 'heal',   stat: 'intelligence', multiplier: 7.0, baseHeal: 70, cooldown: 2, cost: 16 },
        { name: 'Lantern Glow',    type: 'heal',   stat: 'intelligence', multiplier: 10.0, cleanse: true, cooldown: 5, cost: 24 }
    ],
    'Cradle of Life': [
        { name: 'Life Strike',     type: 'damage', stat: 'intelligence', multiplier: 1.8, cooldown: 1, cost: 0 },
        { name: 'Cradle Heal',     type: 'heal',   stat: 'intelligence', multiplier: 8.0, baseHeal: 80, cooldown: 2, cost: 18 },
        { name: 'Cradle Strike',   type: 'damage', stat: 'intelligence', multiplier: 2.5,              cooldown: 3, cost: 18 }
    ],

    // ── A RANK ────────────────────────────────────────────────
    "Titan's Wrath": [
        { name: 'Titan Strike',    type: 'damage', stat: 'strength', multiplier: 2.8, cooldown: 1, cost: 0 },
        { name: 'Wrath Slam',      type: 'damage', stat: 'strength', multiplier: 4.2, stun: true, cooldown: 3, cost: 20 },
        { name: 'Titan Rampage',   type: 'damage', stat: 'strength', multiplier: 7.0, aoe: true,  cooldown: 5, cost: 28 }
    ],
    'Eclipse Edge': [
        { name: 'Eclipse Slash',   type: 'damage', stat: 'agility',  multiplier: 2.8, cooldown: 1, cost: 0 },
        { name: 'Shadow Eclipse',  type: 'damage', stat: 'agility',  multiplier: 4.5, ignore_defense: 0.5, cooldown: 3, cost: 22 },
        { name: 'Total Eclipse',   type: 'damage', stat: 'agility',  multiplier: 7.5, cooldown: 5, cost: 30 }
    ],
    'Celestial Codex': [
        { name: 'Codex Bolt',      type: 'damage', stat: 'intelligence', multiplier: 2.8, cooldown: 1, cost: 15 },
        { name: 'Celestial Wrath', type: 'damage', stat: 'intelligence', multiplier: 4.5, aoe: true,   cooldown: 3, cost: 22 },
        { name: 'Heavens Fall',    type: 'damage', stat: 'intelligence', multiplier: 7.5, cooldown: 5, cost: 30 }
    ],
    'Fortress Aegis': [
        { name: 'Aegis Slam',      type: 'damage', stat: 'stamina',  multiplier: 2.6, cooldown: 1, cost: 0 },
        { name: 'Fortress Wall',   type: 'buff',   effect: 'defense', value: 100, duration: 3, cooldown: 4, cost: 22 },
        { name: 'Aegis Crush',     type: 'damage', stat: 'stamina',  multiplier: 6.0, stun: true, cooldown: 5, cost: 28 }
    ],

    // ── S RANK ────────────────────────────────────────────────
    'Godslayer': [
        { name: 'God Strike',      type: 'damage', stat: 'strength', multiplier: 3.5, cooldown: 1, cost: 0 },
        { name: 'Slayer\'s Wrath', type: 'damage', stat: 'strength', multiplier: 5.5, ignore_defense: 0.5, cooldown: 3, cost: 25 },
        { name: 'Divine Execution',type: 'damage', stat: 'strength', multiplier: 10.0, cooldown: 5, cost: 35 }
    ],
    "Eternity's Edge": [
        { name: 'Eternity Slash',  type: 'damage', stat: 'agility',  multiplier: 3.5, cooldown: 1, cost: 0 },
        { name: 'Time Rend',       type: 'damage', stat: 'agility',  multiplier: 5.5, ignore_defense: 0.6, cooldown: 3, cost: 25 },
        { name: 'Eternal Void',    type: 'damage', stat: 'agility',  multiplier: 10.0, cooldown: 5, cost: 35 }
    ],
    'Omniscient Scepter': [
        { name: 'Omniscient Bolt', type: 'damage', stat: 'intelligence', multiplier: 3.5, cooldown: 1, cost: 20 },
        { name: 'All-Seeing Eye',  type: 'damage', stat: 'intelligence', multiplier: 5.5, aoe: true,   cooldown: 3, cost: 28 },
        { name: 'Omniscience',     type: 'damage', stat: 'intelligence', multiplier: 10.0, cooldown: 5, cost: 38 }
    ],
    'Aegis Immortal': [
        { name: 'Immortal Slam',   type: 'damage', stat: 'stamina',  multiplier: 3.2, cooldown: 1, cost: 0 },
        { name: 'Immortal Guard',  type: 'shield', value: 2000,                        cooldown: 3, cost: 22 },
        { name: 'Immortal Crush',  type: 'damage', stat: 'stamina',  multiplier: 8.0, stun: true, cooldown: 5, cost: 32 }
    ],


    // ── FORGED — COMMON ──────────────────────────────────────
    'Warhammer': [
        { name: 'Crushing Blow',   type: 'damage', stat: 'strength', multiplier: 1.5, def_reduction: 15, cooldown: 2, cost: 10 },
        { name: 'Seismic Slam',    type: 'damage', stat: 'strength', multiplier: 1.8, aoe: true, stun: true, cooldown: 4, cost: 16 },
        { name: 'Momentum',        type: 'buff',   effect: 'strength_up', value: 20, duration: 2, cooldown: 4, cost: 10 }
    ],
    'Bonecrusher': [
        { name: 'Bone Slam',       type: 'damage', stat: 'strength', multiplier: 1.6, cooldown: 2, cost: 10 },
        { name: 'Shatter',         type: 'damage', stat: 'strength', multiplier: 1.8, def_reduction: 15, cooldown: 3, cost: 12 },
        { name: 'Bludgeon',        type: 'damage', stat: 'strength', multiplier: 2.5, stun: true, cooldown: 5, cost: 16 }
    ],
    'Thorn Dagger': [
        { name: 'Thorn Stab',      type: 'damage', stat: 'agility', multiplier: 1.5, cooldown: 1, cost: 8 },
        { name: 'Bramble Flurry',  type: 'damage', stat: 'agility', multiplier: 1.2, hits: 3, cooldown: 3, cost: 12 },
        { name: 'Wilt',            type: 'debuff', effect: 'strength', value: -10, duration: 2, cooldown: 4, cost: 10 }
    ],
    'Iron Ward': [
        { name: 'Ward Bash',       type: 'damage', stat: 'stamina', multiplier: 1.3, cooldown: 2, cost: 8 },
        { name: 'Iron Cover',      type: 'buff',   effect: 'defense', value: 25, duration: 3, cooldown: 4, cost: 10 },
        { name: "Defender's Cry",  type: 'buff',   effect: 'stamina', value: 15, duration: 2, cooldown: 5, cost: 12 }
    ],
    'Bone Staff': [
        { name: 'Bone Bolt',       type: 'damage', stat: 'intelligence', multiplier: 1.5, cooldown: 1, cost: 8 },
        { name: 'Marrow Drain',    type: 'debuff', effect: 'intelligence', value: -10, duration: 3, cooldown: 3, cost: 10 },
        { name: 'Void Crackle',    type: 'damage', stat: 'intelligence', multiplier: 2.2, cooldown: 4, cost: 14 }
    ],

    // ── FORGED — UNCOMMON ─────────────────────────────────────
    'Shadow Fang': [
        { name: 'Fang Strike',     type: 'damage', stat: 'agility', multiplier: 2.0, cooldown: 2, cost: 12 },
        { name: 'Venom Coat',      type: 'debuff', effect: 'strength', value: -15, duration: 3, cooldown: 3, cost: 10 },
        { name: 'Shadowstep',      type: 'damage', stat: 'agility', multiplier: 2.8, cooldown: 4, cost: 18 }
    ],
    'Ember Greatsword': [
        { name: 'Ember Slash',     type: 'damage', stat: 'strength', multiplier: 1.8, cooldown: 2, cost: 12 },
        { name: 'Burn Through',    type: 'damage', stat: 'strength', multiplier: 2.2, ignore_defense: 0.3, cooldown: 3, cost: 14 },
        { name: 'Flame Charge',    type: 'damage', stat: 'strength', multiplier: 3.0, cooldown: 5, cost: 20 }
    ],
    'Frost Barrier': [
        { name: 'Ice Block',       type: 'buff',   effect: 'defense', value: 40, duration: 3, cooldown: 4, cost: 12 },
        { name: 'Cold Slam',       type: 'damage', stat: 'stamina', multiplier: 1.5, stun: true, cooldown: 3, cost: 10 },
        { name: 'Freeze Wall',     type: 'debuff', effect: 'agility', value: -20, duration: 2, cooldown: 5, cost: 14 }
    ],
    'Venom Codex': [
        { name: 'Toxic Verse',     type: 'damage', stat: 'intelligence', multiplier: 1.8, cooldown: 2, cost: 12 },
        { name: 'Plague Page',     type: 'debuff', effect: 'strength', value: -12, duration: 3, cooldown: 3, cost: 10 },
        { name: 'Pestilent Blast', type: 'damage', stat: 'intelligence', multiplier: 2.6, aoe: true, cooldown: 5, cost: 20 }
    ],

    // ── FORGED — RARE ─────────────────────────────────────────
    'Soulreaper': [
        { name: 'Soul Rend',       type: 'damage', stat: 'strength', multiplier: 2.5, cooldown: 2, cost: 18 },
        { name: 'Harvest',         type: 'damage', stat: 'strength', multiplier: 3.5, cooldown: 4, cost: 22 },
        { name: "Death's Embrace",  type: 'buff',   effect: 'strength', value: 40, duration: 3, cooldown: 6, cost: 20 }
    ],
    'Void Edge': [
        { name: 'Void Tear',       type: 'damage', stat: 'agility', multiplier: 2.8, cooldown: 2, cost: 18 },
        { name: 'Null Step',       type: 'buff',   effect: 'agility', value: 35, duration: 2, cooldown: 3, cost: 14 },
        { name: 'Erasure',         type: 'damage', stat: 'agility', multiplier: 4.0, ignore_defense: 0.5, cooldown: 5, cost: 25 }
    ],
    'Stormwall': [
        { name: 'Thunder Guard',   type: 'buff',   effect: 'defense', value: 55, duration: 3, cooldown: 4, cost: 15 },
        { name: 'Lightning Bash',  type: 'damage', stat: 'stamina', multiplier: 2.0, stun: true, cooldown: 3, cost: 16 },
        { name: 'Stormstrike',     type: 'damage', stat: 'stamina', multiplier: 3.0, cooldown: 5, cost: 22 }
    ],
    'Blood Grimoire': [
        { name: 'Blood Verse',     type: 'damage', stat: 'intelligence', multiplier: 2.5, cooldown: 2, cost: 18 },
        { name: 'Scarlet Nova',    type: 'damage', stat: 'intelligence', multiplier: 3.5, aoe: true, cooldown: 4, cost: 24 },
        { name: 'Crimson Pact',    type: 'buff',   effect: 'intelligence', value: 40, duration: 3, cooldown: 5, cost: 20 }
    ],

    // ── FORGED — LEGENDARY ────────────────────────────────────
    'Maw of the Abyss': [
        { name: 'Abyss Devour',    type: 'damage', stat: 'strength', multiplier: 3.8, cooldown: 3, cost: 30 },
        { name: 'Hungering Maw',   type: 'damage', stat: 'strength', multiplier: 3.0, hits: 2, cooldown: 5, cost: 28 },
        { name: 'Abyssal Roar',    type: 'debuff', effect: 'strength', value: -30, duration: 3, cooldown: 6, cost: 25 }
    ],
    'Wraithblade': [
        { name: 'Wraith Cut',      type: 'damage', stat: 'agility', multiplier: 4.2, cooldown: 2, cost: 28 },
        { name: 'Ghost Walk',      type: 'buff',   effect: 'agility', value: 60, duration: 2, cooldown: 4, cost: 24 },
        { name: 'Soul Cleave',     type: 'damage', stat: 'agility', multiplier: 5.0, ignore_defense: 0.7, cooldown: 6, cost: 35 }
    ],
    'Aegis of Eternity': [
        { name: 'Eternal Guard',   type: 'buff',   effect: 'defense', value: 80, duration: 3, cooldown: 4, cost: 20 },
        { name: 'Time Bastion',    type: 'shield', value: 300, cooldown: 6, cost: 28 },
        { name: 'Eternity Slam',   type: 'damage', stat: 'stamina', multiplier: 3.5, stun: true, cooldown: 5, cost: 30 }
    ],
    'The Last Word': [
        { name: 'Final Decree',    type: 'damage', stat: 'intelligence', multiplier: 4.5, cooldown: 3, cost: 30 },
        { name: 'Absolute End',    type: 'damage', stat: 'intelligence', multiplier: 3.8, aoe: true, cooldown: 5, cost: 28 },
        { name: 'Last Rite',       type: 'debuff', effect: 'intelligence', value: -40, duration: 3, cooldown: 6, cost: 25 }
    ],
    // ══════════════════════════════════════════════════════════
    //  PRESTIGE WEAPONS — PF TIER (stat ~650, mult 1.3/2.5/5.0)
    // ══════════════════════════════════════════════════════════

    // Berserker
    'Void Crusher': [
        { name: 'Void Smash',        type: 'damage', stat: 'strength', multiplier: 1.3, cooldown: 2, cost: 20 },
        { name: 'Bone Fracture',     type: 'damage', stat: 'strength', multiplier: 2.5, def_reduction: 30, cooldown: 3, cost: 22 },
        { name: "Berserker's Void",  type: 'buff',   effect: 'strength_up', value: 40, duration: 3, cooldown: 5, cost: 18 }
    ],
    // Assassin
    'Void Fang': [
        { name: 'Void Pierce',       type: 'damage', stat: 'agility', multiplier: 1.3, cooldown: 1, cost: 18 },
        { name: 'Fang Strike',       type: 'damage', stat: 'agility', multiplier: 2.5, bleed: true, cooldown: 3, cost: 20 },
        { name: 'Shadow of the Void',type: 'buff',   effect: 'agility_up', value: 40, duration: 3, cooldown: 5, cost: 16 }
    ],
    // Mage
    'Void Codex': [
        { name: 'Void Script',       type: 'damage', stat: 'intelligence', multiplier: 1.3, cooldown: 2, cost: 20 },
        { name: 'Codex Blast',       type: 'damage', stat: 'intelligence', multiplier: 2.5, aoe: true,   cooldown: 4, cost: 25 },
        { name: 'Mana Void',         type: 'damage', stat: 'intelligence', multiplier: 5.0,             cooldown: 6, cost: 30 }
    ],
    // Tank
    'Void Bulwark': [
        { name: 'Void Shield Wall',  type: 'buff',   effect: 'defense_up', value: 60, duration: 3, cooldown: 5, cost: 18 },
        { name: 'Bulwark Smash',     type: 'damage', stat: 'strength', multiplier: 2.5, def_reduction: 20, cooldown: 3, cost: 22 },
        { name: 'Void Absorption',   type: 'shield', value: 500,                        cooldown: 5, cost: 20 }
    ],
    // Healer
    'Void Mend': [
        { name: 'Void Heal',         type: 'heal',   stat: 'intelligence', multiplier: 2.0, cooldown: 2, cost: 20 },
        { name: 'Mend Wound',        type: 'heal',   stat: 'intelligence', multiplier: 4.0, cleanse: true, cooldown: 4, cost: 22 },
        { name: 'Void Pulse',        type: 'damage', stat: 'intelligence', multiplier: 2.5,               cooldown: 3, cost: 18 }
    ],
    // Tank damage
    'Void Earthbreaker': [
        { name: 'Seismic Slam',      type: 'damage', stat: 'stamina',   multiplier: 2.5, stun: true,    cooldown: 2, cost: 22 },
        { name: 'Void Quake',        type: 'damage', stat: 'stamina',   multiplier: 2.0, aoe: true,     cooldown: 3, cost: 28 },
        { name: 'Earthbreaker Blow', type: 'damage', stat: 'strength',  multiplier: 5.0, def_reduction: 40, cooldown: 5, cost: 30 }
    ],

    // ── PD TIER (stat ~1520, mult 2.7/5.3/10.5) ──────────────
    'Fracture Cleaver': [
        { name: 'Reality Rend',      type: 'damage', stat: 'strength', multiplier: 2.7, cooldown: 2, cost: 25 },
        { name: 'Fracture Wave',     type: 'damage', stat: 'strength', multiplier: 5.3, aoe: true,   cooldown: 4, cost: 28 },
        { name: 'Cleave the Void',   type: 'damage', stat: 'strength', multiplier: 10.5, ignore_defense: 0.5, cooldown: 6, cost: 35 }
    ],
    'Fracture Edge': [
        { name: 'Phase Slash',       type: 'damage', stat: 'agility', multiplier: 2.7, ignore_defense: 0.4, cooldown: 2, cost: 25 },
        { name: 'Fracture Cut',      type: 'damage', stat: 'agility', multiplier: 5.3, bleed: true, cooldown: 4, cost: 28 },
        { name: 'Phantom Edge',      type: 'damage', stat: 'agility', multiplier: 10.5,             cooldown: 6, cost: 35 }
    ],
    'Fracture Scepter': [
        { name: 'Scepter Beam',      type: 'damage', stat: 'intelligence', multiplier: 2.7, cooldown: 2, cost: 25 },
        { name: 'Fracture Pulse',    type: 'damage', stat: 'intelligence', multiplier: 5.3, aoe: true,   cooldown: 4, cost: 30 },
        { name: 'Reality Shatter',   type: 'damage', stat: 'intelligence', multiplier: 10.5, ignore_defense: 0.5, cooldown: 6, cost: 35 }
    ],
    'Fracture Rampart': [
        { name: 'Rampart Charge',    type: 'damage', stat: 'strength', multiplier: 2.7, stun: true, cooldown: 3, cost: 28 },
        { name: 'Fracture Guard',    type: 'buff',   effect: 'defense_up', value: 100, duration: 3, cooldown: 4, cost: 25 },
        { name: 'Phase Block',       type: 'shield', value: 1000,                       cooldown: 5, cost: 30 }
    ],
    'Fracture Chalice': [
        { name: 'Burning Heal',      type: 'heal',   stat: 'intelligence', multiplier: 3.5, cooldown: 2, cost: 25 },
        { name: 'Chalice Burst',     type: 'heal',   stat: 'intelligence', multiplier: 6.0, aoe: true,   cooldown: 4, cost: 30 },
        { name: 'Fracture Mend',     type: 'damage', stat: 'intelligence', multiplier: 2.7,             cooldown: 3, cost: 22 }
    ],
    'Fracture Colossus': [
        { name: 'Colossus Strike',   type: 'damage', stat: 'stamina',  multiplier: 4.0, cooldown: 2, cost: 30 },
        { name: 'Fracture Slam',     type: 'damage', stat: 'stamina',  multiplier: 7.0, stun: true, aoe: true, cooldown: 4, cost: 38 },
        { name: 'Titan Force',       type: 'buff',   effect: 'strength_up', value: 120, duration: 3, cooldown: 5, cost: 25 }
    ],

    // ── PB TIER (stat ~3080, mult 5.9/11.6/23.0) ─────────────
    'Abyss Annihilator': [
        { name: 'Annihilation',      type: 'damage', stat: 'strength', multiplier: 5.9, cooldown: 2, cost: 30 },
        { name: 'Void Crush',        type: 'damage', stat: 'strength', multiplier: 11.6, stun: true, cooldown: 4, cost: 35 },
        { name: 'Abyss Rampage',     type: 'damage', stat: 'strength', multiplier: 23.0,            cooldown: 6, cost: 45 }
    ],
    'Abyss Phantom': [
        { name: 'Phantom Kill',      type: 'damage', stat: 'agility', multiplier: 5.9, cooldown: 1, cost: 30 },
        { name: 'Invisible Strike',  type: 'damage', stat: 'agility', multiplier: 11.6, ignore_defense: 0.8, cooldown: 3, cost: 38 },
        { name: 'Void Blur',         type: 'damage', stat: 'agility', multiplier: 23.0,             cooldown: 6, cost: 48 }
    ],
    'Abyss Tome': [
        { name: 'Tome Incantation',  type: 'damage', stat: 'intelligence', multiplier: 5.9, cooldown: 2, cost: 30 },
        { name: 'Lost Spell',        type: 'damage', stat: 'intelligence', multiplier: 11.6,            cooldown: 4, cost: 35 },
        { name: 'Abyss Curse',       type: 'debuff', effect: 'intelligence', value: -80, duration: 3,  cooldown: 6, cost: 28 }
    ],
    'Abyss Fortress': [
        { name: 'Fortress Strike',   type: 'damage', stat: 'strength', multiplier: 5.0, def_reduction: 60, cooldown: 3, cost: 30 },
        { name: 'Ancient Ward',      type: 'buff',   effect: 'defense_up', value: 200, duration: 4,       cooldown: 4, cost: 28 },
        { name: 'Impenetrable',      type: 'shield', value: 2500,                                         cooldown: 5, cost: 38 }
    ],
    'Abyss Lantern': [
        { name: 'Ancient Light',     type: 'heal',   stat: 'intelligence', multiplier: 5.0, cooldown: 2, cost: 30 },
        { name: 'Lantern Glow',      type: 'heal',   stat: 'intelligence', multiplier: 9.0, cleanse: true, aoe: true, cooldown: 4, cost: 38 },
        { name: 'Lost World Heal',   type: 'heal',   stat: 'intelligence', multiplier: 14.0,             cooldown: 6, cost: 40 }
    ],

    // ── PS TIER (stat ~7200, mult 11.4/22.7/45.0) ────────────
    "Malachar's Fist": [
        { name: 'Fist of Malachar',  type: 'damage', stat: 'strength', multiplier: 11.4, cooldown: 2, cost: 40 },
        { name: 'World Breaker',     type: 'damage', stat: 'strength', multiplier: 22.7, aoe: true, stun: true, cooldown: 4, cost: 48 },
        { name: 'The First War',     type: 'damage', stat: 'strength', multiplier: 45.0, ignore_defense: 1.0, cooldown: 6, cost: 60 }
    ],
    "Malachar's Shadow": [
        { name: 'Shadow of Malachar',type: 'damage', stat: 'agility', multiplier: 11.4, cooldown: 1, cost: 40 },
        { name: 'The First Shadow',  type: 'damage', stat: 'agility', multiplier: 22.7, bleed: true, ignore_defense: 0.6, cooldown: 3, cost: 48 },
        { name: 'Eternal Dark',      type: 'damage', stat: 'agility', multiplier: 45.0,             cooldown: 6, cost: 60 }
    ],
    "Malachar's Gospel": [
        { name: 'Gospel of Ruin',    type: 'damage', stat: 'intelligence', multiplier: 11.4, cooldown: 2, cost: 40 },
        { name: 'Written in Void',   type: 'damage', stat: 'intelligence', multiplier: 22.7, ignore_defense: 0.8, cooldown: 4, cost: 48 },
        { name: 'The Last Word',     type: 'damage', stat: 'intelligence', multiplier: 45.0, aoe: true, cooldown: 6, cost: 60 }
    ],
    "Malachar's Seal": [
        { name: 'Seal Breaker',      type: 'damage', stat: 'strength', multiplier: 10.0, ignore_defense: 0.5, cooldown: 3, cost: 40 },
        { name: 'Original Seal',     type: 'buff',   effect: 'defense_up', value: 350, duration: 4,           cooldown: 4, cost: 35 },
        { name: 'Void Barrier',      type: 'shield', value: 6000,                                             cooldown: 5, cost: 48 }
    ],
    "Malachar's Grace": [
        { name: 'Grace of Malachar', type: 'heal',   stat: 'intelligence', multiplier: 12.0, cooldown: 2, cost: 40 },
        { name: "Healer's Last Stand",type: 'heal',  stat: 'intelligence', multiplier: 22.7, aoe: true,   cooldown: 4, cost: 48 },
        { name: 'Infinite Mercy',    type: 'heal',   stat: 'intelligence', multiplier: 38.0, cleanse: true, aoe: true, cooldown: 6, cost: 55 }
    ]
};