module.exports = {
    Tank: [
        { name: "Strike", type: "damage", stat: "strength", multiplier: 1.0, cooldown: 1, cost: 0 },
        { name: "Shield Bash", type: "damage", stat: "stamina", multiplier: 1.2, cooldown: 2, cost: 5 },
        { name: "Fortify", type: "buff", effect: "defense", value: 20, duration: 3, cooldown: 150, cost: 8 },
        { name: "Taunt", type: "debuff", effect: "attack", value: -10, duration: 2, cooldown: 150, cost: 6 },
        { name: "Iron Will", type: "heal", stat: "stamina", multiplier: 0.8, cooldown: 4, cost: 10 },
        { name: "Earth Shatter", type: "damage", stat: "strength", multiplier: 1.5, cooldown: 3, cost: 7 }
    ],
    Assassin: [
        { name: "Strike", type: "damage", stat: "strength", multiplier: 1.0, cooldown: 1, cost: 0 },
        { name: "Backstab", type: "damage", stat: "agility", multiplier: 1.8, cooldown: 2, cost: 6 },
        { name: "Shadow Step", type: "buff", effect: "agility", value: 30, duration: 2, cooldown: 150, cost: 8 },
        { name: "Poison Dagger", type: "debuff", effect: "strength", value: -8, duration: 3, cooldown: 3, cost: 7 },
        { name: "Fatal Strike", type: "damage", stat: "agility", multiplier: 2.0, cooldown: 5, cost: 12 },
        { name: "Smoke Bomb", type: "debuff", effect: "agility", value: -15, duration: 2, cooldown: 150, cost: 5 }
    ],
    Mage: [
        { name: "Strike", type: "damage", stat: "strength", multiplier: 1.0, cooldown: 1, cost: 0 },
        { name: "Fireball", type: "damage", stat: "intelligence", multiplier: 1.6, cooldown: 1, cost: 8 },
        { name: "Arcane Blast", type: "damage", stat: "intelligence", multiplier: 1.4, aoe: true, cooldown: 3, cost: 12 },
        { name: "Mana Shield", type: "shield", value: 40, duration: 3, cooldown: 5, cost: 10 },
        { name: "Frost Nova", type: "damage", stat: "intelligence", multiplier: 1.2, freeze: true, cooldown: 4, cost: 9 },
        { name: "Arcane Intellect", type: "buff", effect: "intelligence", value: 25, duration: 3, cooldown: 150, cost: 12 }
    ],
    Healer: [
        { name: "Strike", type: "damage", stat: "strength", multiplier: 1.0, cooldown: 1, cost: 0 },
        { name: "Heal", type: "heal", stat: "intelligence", multiplier: 1.5, cooldown: 2, cost: 8 },
        { name: "Blessing", type: "buff", effect: "stamina", value: 15, duration: 3, cooldown: 150, cost: 12 },
        { name: "Cleanse", type: "cleanse", cooldown: 3, cost: 5 },
        { name: "Holy Light", type: "heal", stat: "intelligence", multiplier: 2.0, cooldown: 4, cost: 14 },
        { name: "Divine Protection", type: "shield", value: 60, duration: 2, cooldown: 150, cost: 10 }
    ],
    Berserker: [
        { name: "Strike", type: "damage", stat: "strength", multiplier: 1.0, cooldown: 1, cost: 0 },
        { name: "Rage Slash", type: "damage", stat: "strength", multiplier: 1.8, cooldown: 2, cost: 0 },
        { name: "Bloodlust", type: "buff", effect: "strength", value: 30, duration: 3, cooldown: 150, cost: 10 },
        { name: "Smash", type: "damage", stat: "strength", multiplier: 2.0, stun: true, cooldown: 4, cost: 12 },
        { name: "Frenzy", type: "damage", stat: "strength", multiplier: 1.4, hits: 3, cooldown: 3, cost: 15 },
        { name: "Intimidate", type: "debuff", effect: "defense", value: -15, duration: 2, cooldown: 150, cost: 8 }
    ]
};