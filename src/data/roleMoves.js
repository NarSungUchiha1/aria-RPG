const Explorer = [
    { name: 'Gloam Sense',    type: 'buff',   effect: 'agility_up', value: 30, duration: 3, cooldown: 4, cost: 5,  desc: 'Sharpen your senses in the void.' },
    { name: 'Gloam Step',     type: 'buff',   effect: 'agility_up', value: 50, duration: 2, cooldown: 6, cost: 8,  desc: 'Move faster through unstable space.' },
    { name: 'Gloam Reading',  type: 'buff',   effect: 'intelligence_up', value: 40, duration: 3, cooldown: 5, cost: 7, desc: 'Read the void patterns.' },
    { name: 'Wraith Ward',     type: 'shield', value: 80, cooldown: 6, cost: 10, desc: 'A brief ward of void energy.' },
    { name: 'Gloam Escape',   type: 'buff',   effect: 'agility_up', value: 80, duration: 2, cooldown: 10, cost: 12, desc: 'Desperate escape through a micro-rift.' }
];

module.exports = {
    Explorer,
    Tank: [
        { name: "Duskstrike",        type: "damage", stat: "stamina",  multiplier: 1.2, cooldown: 1,   cost: 0  },
        { name: "Gloamshield Bash",   type: "damage", stat: "stamina",  multiplier: 1.6, cooldown: 2,   cost: 5  },
        { name: "Vigil Ward",       type: "buff",   effect: "defense", value: 25, duration: 3, cooldown: 4,   cost: 8  },
        { name: "Dusk Taunt",         type: "debuff", effect: "attack",  value: -15, duration: 3, cooldown: 3,   cost: 6  },
        { name: "Duskiron Wall",     type: "shield", value: 150, cooldown: 4, cost: 10 },
        { name: "Gloamquake", type: "damage", stat: "strength", multiplier: 1.8, stun: true, cooldown: 4, cost: 10  }
    ],
    Assassin: [
        { name: "Duskstrike",        type: "damage", stat: "strength", multiplier: 1.0, cooldown: 1,   cost: 0  },
        { name: "Umbral Backstab",      type: "damage", stat: "agility",  multiplier: 1.8, cooldown: 2,   cost: 6  },
        { name: "Umbral Step",   type: "buff",   effect: "agility", value: 30, duration: 2, cooldown: 150, cost: 8  },
        { name: "Venom Dagger", type: "debuff", effect: "strength", value: -8, duration: 3, cooldown: 3, cost: 7 },
        { name: "Fatal Dusk",  type: "damage", stat: "agility",  multiplier: 2.0, cooldown: 5,   cost: 12 },
        { name: "Gloam Bomb",    type: "debuff", effect: "agility", value: -15, duration: 2, cooldown: 150, cost: 5 }
    ],
    Mage: [
        { name: "Duskstrike",           type: "damage", stat: "strength",     multiplier: 1.0, cooldown: 1,   cost: 0  },
        { name: "Cinderburst",         type: "damage", stat: "intelligence", multiplier: 1.6, cooldown: 1,   cost: 8  },
        { name: "Gloamlit Blast",     type: "damage", stat: "intelligence", multiplier: 1.4, aoe: true, cooldown: 3, cost: 12 },
        { name: "Vesper Shield",      type: "shield", value: 40, duration: 3, cooldown: 5,   cost: 10 },
        { name: "Gloamfrost Nova",       type: "damage", stat: "intelligence", multiplier: 1.2, freeze: true, cooldown: 4, cost: 9 },
        { name: "Gloamlit Insight", type: "buff",   effect: "intelligence", value: 25, duration: 3, cooldown: 150, cost: 12 }
    ],
    Healer: [
        { name: "Duskstrike",            type: "damage",  stat: "strength",     multiplier: 1.0, cooldown: 1,   cost: 0  },
        { name: "Embermend",              type: "heal",    stat: "intelligence", multiplier: 4.0, baseHeal: 20,  cooldown: 20,   cost: 8  },
        { name: "Dawn Blessing",          type: "buff",    effect: "stamina",    value: 15, duration: 3, cooldown: 150, cost: 12 },
        { name: "Gloam Cleanse",           type: "cleanse", cooldown: 3, cost: 5 },
        { name: "Dawn Light",        type: "heal",    stat: "intelligence", multiplier: 4.0, baseHeal: 30,  cooldown: 60,   cost: 14 },
        { name: "Dawn Protection", type: "shield",  value: 60, duration: 2, cooldown: 150, cost: 10 }
    ],
    Berserker: [
        { name: "Duskstrike",      type: "damage", stat: "strength", multiplier: 1.0, cooldown: 1,   cost: 0  },
        { name: "Duskrage Slash",  type: "damage", stat: "strength", multiplier: 1.8, cooldown: 10,   cost: 0  },
        { name: "Duskblood Lust",   type: "buff",   effect: "strength", value: 30, duration: 3, cooldown: 150, cost: 10 },
        { name: "Gloamsmash",       type: "damage", stat: "strength", multiplier: 2.0, stun: true, cooldown: 10, cost: 12 },
        { name: "Duskfrenzy",      type: "damage", stat: "strength", multiplier: 1.4, hits: 3, cooldown: 10, cost: 15 },
        { name: "Gloam Dread",  type: "debuff", effect: "defense", value: -15, duration: 2, cooldown: 150, cost: 8 }
    ]
};