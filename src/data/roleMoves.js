// ROLE DEFAULT MOVES — each role a distinct identity (Hollow Sun).
// Mechanics unchanged; names/descs give every class its own voice.
const Explorer = [
    { name: 'Nightsight',   type: 'buff',   effect: 'agility_up', value: 30, duration: 3, cooldown: 4, cost: 5,  desc: 'See the seams in the dark.' },
    { name: 'Fadestep',     type: 'buff',   effect: 'agility_up', value: 50, duration: 2, cooldown: 6, cost: 8,  desc: 'Slip between the shadows.' },
    { name: 'Omenread',     type: 'buff',   effect: 'intelligence_up', value: 40, duration: 3, cooldown: 5, cost: 7, desc: 'Read what the gloom remembers.' },
    { name: 'Wisp Ward',    type: 'shield', value: 80, cooldown: 6, cost: 10, desc: 'A flicker of borrowed light.' },
    { name: 'Vanish',       type: 'buff',   effect: 'agility_up', value: 80, duration: 2, cooldown: 10, cost: 12, desc: 'Gone before the dark can close.' }
];

module.exports = {
    Explorer,
    Tank: [
        { name: "Bulwark Blow",   type: "damage", stat: "stamina",  multiplier: 1.2, cooldown: 1,   cost: 0  },
        { name: "Shieldbreak",    type: "damage", stat: "stamina",  multiplier: 1.6, cooldown: 2,   cost: 5  },
        { name: "Stand Fast",     type: "buff",   effect: "defense", value: 25, duration: 3, cooldown: 4,   cost: 8  },
        { name: "Draw Their Ire", type: "debuff", effect: "attack",  value: -15, duration: 3, cooldown: 3,   cost: 6  },
        { name: "Ironhold",       type: "shield", value: 150, cooldown: 4, cost: 10 },
        { name: "Sunder the Ground", type: "damage", stat: "strength", multiplier: 1.8, stun: true, cooldown: 4, cost: 10  }
    ],
    Assassin: [
        { name: "Nickblade",   type: "damage", stat: "strength", multiplier: 1.0, cooldown: 1,   cost: 0  },
        { name: "Spinecut",    type: "damage", stat: "agility",  multiplier: 1.8, cooldown: 2,   cost: 6  },
        { name: "Shadowmeld",  type: "buff",   effect: "agility", value: 30, duration: 2, cooldown: 150, cost: 8  },
        { name: "Venomkiss",   type: "debuff", effect: "strength", value: -8, duration: 3, cooldown: 3, cost: 7 },
        { name: "Throatcut",   type: "damage", stat: "agility",  multiplier: 2.0, cooldown: 5,   cost: 12 },
        { name: "Blindpowder", type: "debuff", effect: "agility", value: -15, duration: 2, cooldown: 150, cost: 5 }
    ],
    Mage: [
        { name: "Staffstrike",  type: "damage", stat: "strength",     multiplier: 1.0, cooldown: 1,   cost: 0  },
        { name: "Emberflare",   type: "damage", stat: "intelligence", multiplier: 1.6, cooldown: 1,   cost: 8  },
        { name: "Starfall",     type: "damage", stat: "intelligence", multiplier: 1.4, aoe: true, cooldown: 3, cost: 12 },
        { name: "Wardlight",    type: "shield", value: 40, duration: 3, cooldown: 5,   cost: 10 },
        { name: "Killing Frost", type: "damage", stat: "intelligence", multiplier: 1.2, freeze: true, cooldown: 4, cost: 9 },
        { name: "Third Eye",    type: "buff",   effect: "intelligence", value: 25, duration: 3, cooldown: 150, cost: 12 }
    ],
    Healer: [
        { name: "Rebuke",        type: "damage",  stat: "strength",     multiplier: 1.0, cooldown: 1,   cost: 0  },
        { name: "Kindle",        type: "heal",    stat: "intelligence", multiplier: 4.0, baseHeal: 20,  cooldown: 20,   cost: 8  },
        { name: "Warding Prayer", type: "buff",   effect: "stamina",    value: 15, duration: 3, cooldown: 150, cost: 12 },
        { name: "Purify",        type: "cleanse", cooldown: 3, cost: 5 },
        { name: "Rekindle",      type: "heal",    stat: "intelligence", multiplier: 4.0, baseHeal: 30,  cooldown: 60,   cost: 14 },
        { name: "Candleguard",   type: "shield",  value: 60, duration: 2, cooldown: 150, cost: 10 }
    ],
    Berserker: [
        { name: "Hack",         type: "damage", stat: "strength", multiplier: 1.0, cooldown: 1,   cost: 0  },
        { name: "Cleaver",      type: "damage", stat: "strength", multiplier: 1.8, cooldown: 10,   cost: 0  },
        { name: "Bloodwrath",   type: "buff",   effect: "strength", value: 30, duration: 3, cooldown: 150, cost: 10 },
        { name: "Skullsplit",   type: "damage", stat: "strength", multiplier: 2.0, stun: true, cooldown: 10, cost: 12 },
        { name: "Flurry of Ruin", type: "damage", stat: "strength", multiplier: 1.4, hits: 3, cooldown: 10, cost: 15 },
        { name: "Warcry",       type: "debuff", effect: "defense", value: -15, duration: 2, cooldown: 150, cost: 8 }
    ]
};
