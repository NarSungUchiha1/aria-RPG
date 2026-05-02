/**
 * PRESTIGE ROLE MOVES
 * Replaces normal role moves for prestige players.
 * Void/Abyss themed — significantly stronger than base moves.
 * Each role retains its identity but with prestige-tier power.
 */

module.exports = {
    Tank: [
        { name: 'Void Strike',        type: 'damage', stat: 'strength',  multiplier: 2.0, cooldown: 1,   cost: 0  },
        { name: 'Fracture Bash',      type: 'damage', stat: 'stamina',   multiplier: 2.5, def_reduction: 25, cooldown: 2, cost: 8  },
        { name: 'Void Fortress',      type: 'buff',   effect: 'defense', value: 60,  duration: 3, cooldown: 150, cost: 12 },
        { name: 'Abyssal Taunt',      type: 'debuff', effect: 'attack',  value: -30, duration: 3, cooldown: 150, cost: 10 },
        { name: 'Void Regeneration',  type: 'heal',   stat: 'stamina',   multiplier: 5.0, baseHeal: 80,  cooldown: 4,   cost: 15 },
        { name: 'Earth Void Shatter', type: 'damage', stat: 'strength',  multiplier: 2.8, stun: true,    cooldown: 4,   cost: 14 }
    ],
    Assassin: [
        { name: 'Void Strike',        type: 'damage', stat: 'strength',  multiplier: 2.0, cooldown: 1,   cost: 0  },
        { name: 'Void Backstab',      type: 'damage', stat: 'agility',   multiplier: 3.0, cooldown: 2,   cost: 10 },
        { name: 'Phantom Step',       type: 'buff',   effect: 'agility', value: 60,  duration: 3, cooldown: 150, cost: 12 },
        { name: 'Void Venom',         type: 'debuff', effect: 'strength', value: -25, duration: 3, cooldown: 3, cost: 10 },
        { name: 'Abyss Fatal',        type: 'damage', stat: 'agility',   multiplier: 3.5, ignore_defense: 0.4, cooldown: 5, cost: 18 },
        { name: 'Void Smoke',         type: 'debuff', effect: 'agility', value: -40, duration: 3, cooldown: 150, cost: 10 }
    ],
    Mage: [
        { name: 'Void Strike',        type: 'damage', stat: 'strength',      multiplier: 2.0, cooldown: 1,   cost: 0  },
        { name: 'Void Fireball',      type: 'damage', stat: 'intelligence',  multiplier: 2.8, cooldown: 1,   cost: 12 },
        { name: 'Fracture Blast',     type: 'damage', stat: 'intelligence',  multiplier: 2.5, aoe: true, cooldown: 3, cost: 18 },
        { name: 'Abyss Barrier',      type: 'shield', value: 300, duration: 3, cooldown: 5,   cost: 15 },
        { name: 'Void Nova',          type: 'damage', stat: 'intelligence',  multiplier: 2.2, freeze: true, aoe: true, cooldown: 4, cost: 14 },
        { name: 'Void Intellect',     type: 'buff',   effect: 'intelligence', value: 60, duration: 3, cooldown: 150, cost: 18 }
    ],
    Healer: [
        { name: 'Void Strike',        type: 'damage', stat: 'strength',      multiplier: 2.0, cooldown: 1,   cost: 0  },
        { name: 'Void Heal',          type: 'heal',   stat: 'intelligence',  multiplier: 6.0, baseHeal: 60,  cooldown: 2,   cost: 12 },
        { name: 'Void Blessing',      type: 'buff',   effect: 'stamina',     value: 50,  duration: 3, cooldown: 150, cost: 18 },
        { name: 'Void Cleanse',       type: 'cleanse', cooldown: 2, cost: 8 },
        { name: 'Abyss Light',        type: 'heal',   stat: 'intelligence',  multiplier: 8.0, baseHeal: 100, cooldown: 4,   cost: 20 },
        { name: 'Void Protection',    type: 'shield', value: 400, duration: 3, cooldown: 150, cost: 15 }
    ],
    Berserker: [
        { name: 'Void Strike',        type: 'damage', stat: 'strength', multiplier: 2.0, cooldown: 1,   cost: 0  },
        { name: 'Void Slash',         type: 'damage', stat: 'strength', multiplier: 3.0, cooldown: 2,   cost: 0  },
        { name: 'Void Bloodlust',     type: 'buff',   effect: 'strength', value: 70, duration: 3, cooldown: 150, cost: 15 },
        { name: 'Abyss Smash',        type: 'damage', stat: 'strength', multiplier: 3.5, stun: true,    cooldown: 4,   cost: 18 },
        { name: 'Fracture Frenzy',    type: 'damage', stat: 'strength', multiplier: 2.5, hits: 3,       cooldown: 5,   cost: 22 },
        { name: 'Void Intimidate',    type: 'debuff', effect: 'defense', value: -40, duration: 3, cooldown: 150, cost: 12 }
    ]
};