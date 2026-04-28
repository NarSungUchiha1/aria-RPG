// 20+ weapons, each with 3 unique moves
module.exports = {
    // ======================== STRENGTH WEAPONS ========================
    "Iron Greatsword": [
        { name: "Heavy Slash", type: "damage", stat: "strength", multiplier: 1.6, cooldown: 2, cost: 10 },
        { name: "Earth Splitter", type: "damage", stat: "strength", multiplier: 1.9, stun: true, cooldown: 4, cost: 15 },
        { name: "Titan's Grip", type: "buff", effect: "strength_up", value: 15, duration: 3, cooldown: 5, cost: 12 }
    ],
    "Battle Axe": [
        { name: "Cleave", type: "damage", stat: "strength", multiplier: 1.5, cooldown: 3, cost: 10 },
        { name: "Whirlwind", type: "damage", stat: "strength", multiplier: 1.2, aoe: true, cooldown: 4, cost: 15 },
        { name: "Execute", type: "damage", stat: "strength", multiplier: 2.5, condition: "enemy_hp_below_30", cooldown: 5, cost: 20 }
    ],
    "Rage Blade": [
        { name: "Rending Slash", type: "damage", stat: "strength", multiplier: 1.6, bleed: true, cooldown: 3, cost: 12 },
        { name: "Overpower", type: "damage", stat: "strength", multiplier: 1.8, ignore_defense: 0.3, cooldown: 4, cost: 15 },
        { name: "Annihilate", type: "damage", stat: "strength", multiplier: 2.2, cooldown: 5, cost: 18 }
    ],
    "Warhammer": [
        { name: "Crushing Blow", type: "damage", stat: "strength", multiplier: 1.7, def_reduction: 10, cooldown: 3, cost: 12 },
        { name: "Seismic Slam", type: "damage", stat: "strength", multiplier: 1.4, aoe: true, stun: true, cooldown: 5, cost: 18 },
        { name: "Momentum", type: "buff", effect: "strength_up", value: 20, duration: 2, cooldown: 4, cost: 10 }
    ],
    "Dragonbone Mace": [
        { name: "Bone Breaker", type: "damage", stat: "strength", multiplier: 1.8, def_penetration: 0.4, cooldown: 3, cost: 14 },
        { name: "Inferno Strike", type: "damage", stat: "strength", multiplier: 1.5, fire_dot: 5, duration: 3, cooldown: 4, cost: 16 },
        { name: "Dragon's Roar", type: "buff", effect: "crit_up", value: 25, duration: 2, cooldown: 5, cost: 15 }
    ],

    // ======================== AGILITY WEAPONS ========================
    "Shadow Dagger": [
        { name: "Silent Cut", type: "damage", stat: "agility", multiplier: 1.7, cooldown: 2, cost: 8 },
        { name: "Bleed Strike", type: "dot", stat: "agility", multiplier: 0.5, duration: 3, cooldown: 3, cost: 10 },
        { name: "Vanish", type: "buff", effect: "invisible", duration: 1, cooldown: 5, cost: 12 }
    ],
    "Dagger": [
        { name: "Quick Stab", type: "damage", stat: "agility", multiplier: 1.4, cooldown: 1, cost: 5 },
        { name: "Poison Vial", type: "dot", stat: "agility", multiplier: 0.4, duration: 3, cooldown: 3, cost: 8 },
        { name: "Evasion", type: "buff", effect: "dodge_up", value: 40, duration: 2, cooldown: 4, cost: 10 }
    ],
    "Twin Fang Blades": [
        { name: "Dual Strike", type: "damage", stat: "agility", multiplier: 1.3, hits: 2, cooldown: 2, cost: 9 },
        { name: "Venomous Bite", type: "dot", stat: "agility", multiplier: 0.6, duration: 4, cooldown: 3, cost: 11 },
        { name: "Blade Dance", type: "buff", effect: "agility_up", value: 20, duration: 3, cooldown: 4, cost: 12 }
    ],
    "Wind Katana": [
        { name: "Gale Slash", type: "damage", stat: "agility", multiplier: 1.6, cooldown: 2, cost: 10 },
        { name: "Zephyr Step", type: "buff", effect: "haste", value: 30, duration: 2, cooldown: 3, cost: 8 },
        { name: "Tornado Edge", type: "damage", stat: "agility", multiplier: 1.8, aoe: true, cooldown: 5, cost: 16 }
    ],
    "Nightshade Bow": [
        { name: "Precise Shot", type: "damage", stat: "agility", multiplier: 1.5, cooldown: 1, cost: 6 },
        { name: "Poison Arrow", type: "dot", stat: "agility", multiplier: 0.5, duration: 3, cooldown: 3, cost: 9 },
        { name: "Multi-Shot", type: "damage", stat: "agility", multiplier: 1.1, hits: 3, cooldown: 4, cost: 14 }
    ],

    // ======================== INTELLIGENCE WEAPONS ========================
    "Arcane Staff": [
        { name: "Meteor", type: "damage", stat: "intelligence", multiplier: 2.0, cooldown: 5, cost: 18 },
        { name: "Mana Surge", type: "damage", stat: "intelligence", multiplier: 1.5, mana_restore: 10, cooldown: 3, cost: 12 },
        { name: "Spell Echo", type: "damage", stat: "intelligence", multiplier: 1.2, hits: 2, cooldown: 4, cost: 15 }
    ],
    "Spell Book": [
        { name: "Magic Missile", type: "damage", stat: "intelligence", multiplier: 1.3, cooldown: 1, cost: 6 },
        { name: "Fire Scroll", type: "damage", stat: "intelligence", multiplier: 1.6, cooldown: 3, cost: 10 },
        { name: "Arcane Intellect", type: "buff", effect: "int_up", value: 20, duration: 3, cooldown: 4, cost: 12 }
    ],
    "Frostbane Wand": [
        { name: "Ice Shard", type: "damage", stat: "intelligence", multiplier: 1.4, freeze_chance: 30, cooldown: 2, cost: 9 },
        { name: "Blizzard", type: "damage", stat: "intelligence", multiplier: 1.1, aoe: true, slow: true, cooldown: 4, cost: 15 },
        { name: "Absolute Zero", type: "debuff", effect: "freeze", duration: 1, cooldown: 6, cost: 18 }
    ],
    "Void Scepter": [
        { name: "Shadow Bolt", type: "damage", stat: "intelligence", multiplier: 1.7, cooldown: 2, cost: 11 },
        { name: "Void Rift", type: "damage", stat: "intelligence", multiplier: 2.1, ignore_defense: 0.5, cooldown: 5, cost: 20 },
        { name: "Abyssal Gaze", type: "debuff", effect: "fear", duration: 1, cooldown: 4, cost: 13 }
    ],
    "Celestial Orb": [
        { name: "Holy Light", type: "heal", stat: "intelligence", multiplier: 1.8, cooldown: 3, cost: 12 },
        { name: "Divine Smite", type: "damage", stat: "intelligence", multiplier: 1.6, cooldown: 3, cost: 14 },
        { name: "Blessing of Wisdom", type: "buff", effect: "int_up", value: 25, duration: 3, cooldown: 5, cost: 15 }
    ],

    // ======================== STAMINA WEAPONS ========================
    "Shield": [
        { name: "Shield Wall", type: "buff", effect: "defense", value: 50, duration: 2, cooldown: 4, cost: 10 },
        { name: "Bash", type: "damage", stat: "stamina", multiplier: 1.2, stun: true, cooldown: 3, cost: 8 },
        { name: "Guardian", type: "buff", effect: "taunt_all", duration: 2, cooldown: 5, cost: 12 }
    ],
    "Armor Plate": [
        { name: "Iron Skin", type: "buff", effect: "defense_up", value: 30, duration: 3, cooldown: 4, cost: 10 },
        { name: "Reflect", type: "buff", effect: "damage_reflect", value: 20, duration: 2, cooldown: 5, cost: 12 },
        { name: "Last Stand", type: "heal", stat: "stamina", multiplier: 1.0, condition: "hp_below_30", cooldown: 6, cost: 15 }
    ],
    "Tower Shield": [
        { name: "Bulwark", type: "buff", effect: "damage_reduction", value: 40, duration: 2, cooldown: 4, cost: 12 },
        { name: "Shield Charge", type: "damage", stat: "stamina", multiplier: 1.4, stun: true, cooldown: 3, cost: 10 },
        { name: "Unbreakable", type: "buff", effect: "immunity", duration: 1, cooldown: 7, cost: 20 }
    ],
    "Vanguard Helm": [
        { name: "Battle Cry", type: "buff", effect: "party_defense_up", value: 20, duration: 3, cooldown: 5, cost: 12 },
        { name: "Headbutt", type: "damage", stat: "stamina", multiplier: 1.3, stun_chance: 50, cooldown: 2, cost: 8 },
        { name: "Indomitable", type: "heal", stat: "stamina", multiplier: 0.8, cooldown: 4, cost: 10 }
    ],
    "Golemheart Gauntlets": [
        { name: "Stone Fist", type: "damage", stat: "stamina", multiplier: 1.5, cooldown: 2, cost: 9 },
        { name: "Earthen Grasp", type: "debuff", effect: "root", duration: 1, cooldown: 4, cost: 11 },
        { name: "Fortify", type: "buff", effect: "max_hp_up", value: 15, duration: 3, cooldown: 5, cost: 14 }
    ],

    // ======================== SPECIAL WEAPONS (Rank C+) ========================
    "Obsidian Cleaver": [
        { name: "Obsidian Edge", type: "damage", stat: "strength", multiplier: 2.0, cooldown: 3, cost: 15 },
        { name: "Earth Shatter", type: "damage", stat: "strength", multiplier: 1.8, aoe: true, cooldown: 4, cost: 18 },
        { name: "Dark Fortitude", type: "buff", effect: "strength", value: 20, duration: 3, cooldown: 5, cost: 12 }
    ],
    "Whisperblade": [
        { name: "Silent Edge", type: "damage", stat: "agility", multiplier: 2.2, cooldown: 2, cost: 12 },
        { name: "Shadow Meld", type: "buff", effect: "agility", value: 25, duration: 3, cooldown: 4, cost: 10 },
        { name: "Eviscerate", type: "damage", stat: "agility", multiplier: 2.5, bleed: true, cooldown: 4, cost: 16 }
    ],
    "Inferno Rod": [
        { name: "Inferno Blast", type: "damage", stat: "intelligence", multiplier: 4, cooldown: 60, cost: 18 },
        { name: "Scorching Ray", type: "damage", stat: "intelligence", multiplier: 1.6, aoe: true, cooldown: 25, cost: 15 },
        { name: "Flame Shield", type: "shield", value: 150, duration: 3, cooldown: 60, cost: 12 }
    ],
    "Bulwark of Stone": [
        { name: "Stone Guard", type: "buff", effect: "defense", value: 40, duration: 3, cooldown: 4, cost: 10 },
        { name: "Earthen Spikes", type: "damage", stat: "stamina", multiplier: 1.8, cooldown: 3, cost: 12 },
        { name: "Unbreakable", type: "shield", value: 100, duration: 2, cooldown: 5, cost: 15 }
    ],
    "Abyssal Greatsword": [
        { name: "Abyssal Cleave", type: "damage", stat: "strength", multiplier: 2.5, cooldown: 3, cost: 20 },
        { name: "Void Slash", type: "damage", stat: "strength", multiplier: 2.0, ignore_defense: 0.4, cooldown: 4, cost: 18 },
        { name: "Dark Pact", type: "buff", effect: "strength", value: 30, duration: 3, cooldown: 5, cost: 15 }
    ],
    "Voidreaper Dagger": [
        { name: "Void Strike", type: "damage", stat: "agility", multiplier: 2.6, cooldown: 2, cost: 15 },
        { name: "Reaper's Mark", type: "debuff", effect: "defense", value: -20, duration: 3, cooldown: 4, cost: 12 },
        { name: "Soul Siphon", type: "heal", stat: "agility", multiplier: 1.2, cooldown: 4, cost: 14 }
    ],
    "Staff of the Eternal": [
        { name: "Eternal Flames", type: "damage", stat: "intelligence", multiplier: 2.4, cooldown: 3, cost: 20 },
        { name: "Time Warp", type: "buff", effect: "intelligence", value: 35, duration: 3, cooldown: 5, cost: 15 },
        { name: "Chrono Shield", type: "shield", value: 120, duration: 2, cooldown: 5, cost: 18 }
    ],
    "Aegis of the Fallen": [
        { name: "Fallen Bulwark", type: "buff", effect: "defense", value: 50, duration: 3, cooldown: 4, cost: 12 },
        { name: "Retribution", type: "damage", stat: "stamina", multiplier: 2.0, reflect: true, cooldown: 4, cost: 16 },
        { name: "Guardian's Oath", type: "shield", value: 150, duration: 2, cooldown: 6, cost: 18 }
    ],
    "Titan's Wrath": [
        { name: "Titan's Smash", type: "damage", stat: "strength", multiplier: 4.0, cooldown: 15, cost: 25 },
        { name: "Seismic Roar", type: "debuff", effect: "attack", value: -100, duration: 3, cooldown: 120, cost: 18 },
        { name: "Colossal Might", type: "buff", effect: "strength", value: 60, duration: 3, cooldown: 60, cost: 20 }
    ],
    "Eclipse Edge": [
        { name: "Eclipse Slash", type: "damage", stat: "agility", multiplier: 2.8, cooldown: 3, cost: 20 },
        { name: "Umbral Step", type: "buff", effect: "agility", value: 35, duration: 3, cooldown: 4, cost: 15 },
        { name: "Shadow Clone", type: "damage", stat: "agility", multiplier: 1.8, hits: 2, cooldown: 4, cost: 18 }
    ],
    "Celestial Codex": [
        { name: "Celestial Nova", type: "damage", stat: "intelligence", multiplier: 3.6, aoe: true, cooldown: 4, cost: 25 },
        { name: "Divine Inspiration", type: "buff", effect: "intelligence", value: 60, duration: 3, cooldown: 5, cost: 20 },
        { name: "Heavenly Light", type: "heal", stat: "intelligence", multiplier: 2.2, cooldown: 4, cost: 18 }
    ],
    "Fortress Aegis": [
        { name: "Fortress Wall", type: "buff", effect: "defense", value: 60, duration: 3, cooldown: 4, cost: 15 },
        { name: "Shield Bash", type: "damage", stat: "stamina", multiplier: 2.2, stun: true, cooldown: 3, cost: 14 },
        { name: "Indestructible", type: "shield", value: 200, duration: 2, cooldown: 6, cost: 20 }
    ],
    "Godslayer": [
        { name: "Godslayer's Wrath", type: "damage", stat: "strength", multiplier: 3.5, cooldown: 4, cost: 30 },
        { name: "Divine Rupture", type: "damage", stat: "strength", multiplier: 2.5, ignore_defense: 0.5, cooldown: 5, cost: 25 },
        { name: "Ascension", type: "buff", effect: "strength", value: 50, duration: 3, cooldown: 6, cost: 25 }
    ],
    "Eternity's Edge": [
        { name: "Eternal Cut", type: "damage", stat: "agility", multiplier: 4.2, cooldown: 20, cost: 25 },
        { name: "Timeless", type: "buff", effect: "agility", value: 100, duration: 3, cooldown: 90, cost: 20 },
        { name: "Infinity Slash", type: "damage", stat: "agility", multiplier: 3.0, hits: 3, cooldown: 25, cost: 22 }
    ],
    "Omniscient Scepter": [
        { name: "Omniscient Beam", type: "damage", stat: "intelligence", multiplier: 3.0, cooldown: 25, cost: 28 },
        { name: "All-Knowing", type: "buff", effect: "intelligence", value: 50, duration: 3, cooldown: 5, cost: 25 },
        { name: "Reality Warp", type: "debuff", effect: "all", value: -100, duration: 2, cooldown: 120, cost: 22 }
    ],
    "Aegis Immortal": [
        { name: "Immortal Guard", type: "buff", effect: "defense", value: 150, duration: 3, cooldown: 60, cost: 18 },
        { name: "Eternal Retribution", type: "damage", stat: "stamina", multiplier: 2.5, reflect: 0.3, cooldown: 4, cost: 20 },
        { name: "Aegis of the Gods", type: "shield", value: 250, duration: 2, cooldown: 6, cost: 25 }
    ],

    // ======================== FORGED WEAPONS — COMMON ========================
    "Bonecrusher": [
        { name: "Bone Slam",     type: "damage", stat: "strength", multiplier: 1.8, cooldown: 2, cost: 10 },
        { name: "Shatter",       type: "damage", stat: "strength", multiplier: 1.5, def_reduction: 15, cooldown: 3, cost: 12 },
        { name: "Bludgeon",      type: "damage", stat: "strength", multiplier: 2.2, stun: true, cooldown: 5, cost: 16 }
    ],
    "Thorn Dagger": [
        { name: "Thorn Stab",    type: "damage", stat: "agility", multiplier: 1.7, cooldown: 1, cost: 8 },
        { name: "Bramble Flurry",type: "damage", stat: "agility", multiplier: 1.2, hits: 3, cooldown: 3, cost: 12 },
        { name: "Wilt",          type: "debuff", effect: "strength", value: -10, duration: 2, cooldown: 4, cost: 10 }
    ],
    "Iron Ward": [
        { name: "Ward Bash",     type: "damage", stat: "stamina", multiplier: 1.3, cooldown: 2, cost: 8 },
        { name: "Iron Cover",    type: "buff",   effect: "defense", value: 25, duration: 3, cooldown: 4, cost: 10 },
        { name: "Defender's Cry",type: "buff",   effect: "stamina", value: 15, duration: 2, cooldown: 5, cost: 12 }
    ],
    "Bone Staff": [
        { name: "Bone Bolt",     type: "damage", stat: "intelligence", multiplier: 1.7, cooldown: 1, cost: 8 },
        { name: "Marrow Drain",  type: "debuff", effect: "intelligence", value: -10, duration: 3, cooldown: 3, cost: 10 },
        { name: "Void Crackle",  type: "damage", stat: "intelligence", multiplier: 2.0, cooldown: 4, cost: 14 }
    ],
    "Splint Mace": [
        { name: "Mend",          type: "heal",   stat: "intelligence", multiplier: 3.0, baseHeal: 25, cooldown: 2, cost: 8 },
        { name: "Splint Strike", type: "damage", stat: "strength", multiplier: 1.3, cooldown: 2, cost: 6 },
        { name: "Patch Up",      type: "heal",   stat: "intelligence", multiplier: 4.5, baseHeal: 40, cooldown: 5, cost: 14 }
    ],

    // ======================== FORGED WEAPONS — UNCOMMON ========================
    "Shadow Fang": [
        { name: "Fang Strike",   type: "damage", stat: "agility", multiplier: 2.2, cooldown: 2, cost: 12 },
        { name: "Venom Coat",    type: "debuff", effect: "strength", value: -15, duration: 3, cooldown: 3, cost: 10 },
        { name: "Shadowstep",    type: "damage", stat: "agility", multiplier: 2.8, cooldown: 4, cost: 18 }
    ],
    "Ember Greatsword": [
        { name: "Ember Slash",   type: "damage", stat: "strength", multiplier: 2.0, cooldown: 2, cost: 12 },
        { name: "Burn Through",  type: "damage", stat: "strength", multiplier: 1.6, def_penetration: 0.3, cooldown: 3, cost: 14 },
        { name: "Flame Charge",  type: "damage", stat: "strength", multiplier: 2.5, cooldown: 5, cost: 20 }
    ],
    "Frost Barrier": [
        { name: "Ice Block",     type: "buff",   effect: "defense", value: 40, duration: 3, cooldown: 4, cost: 12 },
        { name: "Cold Slam",     type: "damage", stat: "stamina", multiplier: 1.5, stun: true, cooldown: 3, cost: 10 },
        { name: "Freeze Wall",   type: "debuff", effect: "agility", value: -20, duration: 2, cooldown: 5, cost: 14 }
    ],
    "Venom Codex": [
        { name: "Toxic Verse",   type: "damage", stat: "intelligence", multiplier: 2.0, cooldown: 2, cost: 12 },
        { name: "Plague Page",   type: "debuff", effect: "strength", value: -12, duration: 3, cooldown: 3, cost: 10 },
        { name: "Pestilent Blast",type: "damage", stat: "intelligence", multiplier: 2.6, aoe: true, cooldown: 5, cost: 20 }
    ],
    "Ember Chalice": [
        { name: "Ember Heal",    type: "heal",   stat: "intelligence", multiplier: 4.5, baseHeal: 45, cooldown: 2, cost: 10 },
        { name: "Frost Mend",    type: "heal",   stat: "intelligence", multiplier: 6.0, baseHeal: 70, cooldown: 4, cost: 16 },
        { name: "Chalice Smite", type: "damage", stat: "intelligence", multiplier: 1.8, cooldown: 3, cost: 12 }
    ],

    // ======================== FORGED WEAPONS — RARE ========================
    "Soulreaper": [
        { name: "Soul Rend",     type: "damage", stat: "strength", multiplier: 2.8, cooldown: 2, cost: 18 },
        { name: "Harvest",       type: "damage", stat: "strength", multiplier: 3.2, cooldown: 4, cost: 22 },
        { name: "Death's Embrace",type: "buff",  effect: "strength", value: 40, duration: 3, cooldown: 6, cost: 20 }
    ],
    "Void Edge": [
        { name: "Void Tear",     type: "damage", stat: "agility", multiplier: 3.0, cooldown: 2, cost: 18 },
        { name: "Null Step",     type: "buff",   effect: "agility", value: 35, duration: 2, cooldown: 3, cost: 14 },
        { name: "Erasure",       type: "damage", stat: "agility", multiplier: 3.8, ignore_defense: 0.5, cooldown: 5, cost: 25 }
    ],
    "Stormwall": [
        { name: "Thunder Guard", type: "buff",   effect: "defense", value: 55, duration: 3, cooldown: 4, cost: 15 },
        { name: "Lightning Bash",type: "damage", stat: "stamina", multiplier: 2.2, stun: true, cooldown: 3, cost: 16 },
        { name: "Stormstrike",   type: "damage", stat: "stamina", multiplier: 2.8, cooldown: 5, cost: 22 }
    ],
    "Blood Grimoire": [
        { name: "Blood Verse",   type: "damage", stat: "intelligence", multiplier: 2.8, cooldown: 2, cost: 18 },
        { name: "Scarlet Nova",  type: "damage", stat: "intelligence", multiplier: 3.2, aoe: true, cooldown: 4, cost: 24 },
        { name: "Crimson Pact",  type: "buff",   effect: "intelligence", value: 40, duration: 3, cooldown: 5, cost: 20 }
    ],
    "Soul Lantern": [
        { name: "Soul Mend",     type: "heal",   stat: "intelligence", multiplier: 5.5, baseHeal: 60, cooldown: 2, cost: 14 },
        { name: "Lantern's Grace",type: "heal",  stat: "intelligence", multiplier: 7.5, baseHeal: 100, cooldown: 4, cost: 22 },
        { name: "Spirit Strike", type: "damage", stat: "intelligence", multiplier: 2.0, cooldown: 3, cost: 14 }
    ],

    // ======================== FORGED WEAPONS — LEGENDARY ========================
    "Maw of the Abyss": [
        { name: "Abyss Devour",  type: "damage", stat: "strength", multiplier: 4.5, cooldown: 3, cost: 30 },
        { name: "Hungering Maw", type: "damage", stat: "strength", multiplier: 3.5, hits: 2, cooldown: 5, cost: 28 },
        { name: "Abyssal Roar",  type: "debuff", effect: "strength", value: -30, duration: 3, cooldown: 6, cost: 25 }
    ],
    "Wraithblade": [
        { name: "Wraith Cut",    type: "damage", stat: "agility", multiplier: 4.8, cooldown: 2, cost: 28 },
        { name: "Ghost Walk",    type: "buff",   effect: "agility", value: 60, duration: 2, cooldown: 4, cost: 24 },
        { name: "Soul Cleave",   type: "damage", stat: "agility", multiplier: 5.5, ignore_defense: 0.7, cooldown: 6, cost: 35 }
    ],
    "Aegis of Eternity": [
        { name: "Eternal Guard",  type: "buff",  effect: "defense", value: 80, duration: 3, cooldown: 4, cost: 20 },
        { name: "Time Bastion",   type: "shield",value: 300, duration: 2, cooldown: 6, cost: 28 },
        { name: "Eternity Slam",  type: "damage",stat: "stamina", multiplier: 3.5, stun: true, cooldown: 5, cost: 30 }
    ],
    "The Last Word": [
        { name: "Final Decree",  type: "damage", stat: "intelligence", multiplier: 5.0, cooldown: 3, cost: 30 },
        { name: "Absolute End",  type: "damage", stat: "intelligence", multiplier: 4.0, aoe: true, cooldown: 5, cost: 28 },
        { name: "Last Rite",     type: "debuff", effect: "intelligence", value: -40, duration: 3, cooldown: 6, cost: 25 }
    ],
    "Cradle of Life": [
        { name: "Life's Embrace", type: "heal",  stat: "intelligence", multiplier: 8.0, baseHeal: 120, cooldown: 2, cost: 20 },
        { name: "Rebirth",        type: "heal",  stat: "intelligence", multiplier: 10.0, baseHeal: 180, cooldown: 5, cost: 35 },
        { name: "Cradle Strike",  type: "damage",stat: "intelligence", multiplier: 2.5, cooldown: 3, cost: 18 }
    ]
};
