/**
 * PRESTIGE ROLE MOVES
 * Buff/debuff/heal cooldowns are rank-scaled — starts at 150s at PF, decreases per rank.
 * This is handled by skillSystem.js which passes the player's rank to getActualCooldown().
 * Damage moves stay short (1-5s) regardless of rank.
 *
 * Cooldown schedule (applied by skillSystem):
 * PF:150  PE:130  PD:110  PC:90  PB:70  PA:50  PS:30
 */

// Sentinel values used by skillSystem to identify rank-scaled cooldowns
const CD_RANKED = 'RANKED'; // buff/debuff/heal — scales with rank
const CD_HEAL   = 'RANKED_HEAL'; // heal — slightly shorter than buff

module.exports = {
    Berserker: [
        { name: 'Void Strike',      type: 'damage', stat: 'strength', multiplier: 2.5, cooldown: 1,       cost: 0  },
        { name: 'Void Slash',       type: 'damage', stat: 'strength', multiplier: 3.2, cooldown: 2,       cost: 0  },
        { name: 'Void Bloodlust',   type: 'buff',   effect: 'strength_up', value: 80, duration: 3,  cooldown: CD_RANKED, cost: 15 },
        { name: 'Abyss Smash',      type: 'damage', stat: 'strength', multiplier: 3.8, stun: true,  cooldown: 4,       cost: 18 },
        { name: 'Fracture Frenzy',  type: 'damage', stat: 'strength', multiplier: 2.8, hits: 3,     cooldown: 5,       cost: 22 },
        { name: 'Void Intimidate',  type: 'debuff', effect: 'defense', value: -50, duration: 3,     cooldown: CD_RANKED, cost: 12 }
    ],
    Assassin: [
        { name: 'Void Strike',      type: 'damage', stat: 'strength', multiplier: 2.5, cooldown: 1,       cost: 0  },
        { name: 'Void Backstab',    type: 'damage', stat: 'agility',  multiplier: 3.5, cooldown: 2,       cost: 10 },
        { name: 'Phantom Step',     type: 'buff',   effect: 'agility_up', value: 80, duration: 3,  cooldown: CD_RANKED, cost: 12 },
        { name: 'Void Venom',       type: 'debuff', effect: 'strength', value: -35, duration: 3,   cooldown: CD_RANKED, cost: 10 },
        { name: 'Abyss Fatal',      type: 'damage', stat: 'agility',  multiplier: 4.0, ignore_defense: 0.5, cooldown: 5, cost: 20 },
        { name: 'Void Smoke',       type: 'debuff', effect: 'agility', value: -50, duration: 3,    cooldown: CD_RANKED, cost: 10 }
    ],
    Mage: [
        { name: 'Void Strike',      type: 'damage', stat: 'strength',      multiplier: 2.5, cooldown: 1,       cost: 0  },
        { name: 'Void Fireball',    type: 'damage', stat: 'intelligence',  multiplier: 3.2, cooldown: 1,       cost: 15 },
        { name: 'Fracture Blast',   type: 'damage', stat: 'intelligence',  multiplier: 2.8, aoe: true, cooldown: 3, cost: 20 },
        { name: 'Abyss Barrier',    type: 'shield', value: 500,                             cooldown: CD_RANKED, cost: 15 },
        { name: 'Void Nova',        type: 'damage', stat: 'intelligence',  multiplier: 2.5, freeze: true, aoe: true, cooldown: 4, cost: 18 },
        { name: 'Void Intellect',   type: 'buff',   effect: 'intelligence_up', value: 80, duration: 3, cooldown: CD_RANKED, cost: 18 }
    ],
    Tank: [
        { name: 'Void Strike',        type: 'damage', stat: 'strength', multiplier: 2.8,  cooldown: 1,         cost: 0  },
        { name: 'Fracture Bash',      type: 'damage', stat: 'stamina',  multiplier: 3.2,  def_reduction: 40,   cooldown: 2,         cost: 8  },
        { name: 'Void Fortress',      type: 'buff',   effect: 'defense', value: 100, duration: 3,              cooldown: CD_RANKED, cost: 12 },
        { name: 'Abyssal Taunt',      type: 'debuff', effect: 'attack',  value: -55, duration: 3,              cooldown: CD_RANKED, cost: 10 },
        { name: 'Void Regeneration',  type: 'heal',   stat: 'stamina',   multiplier: 6.0, baseHeal: 150,       cooldown: CD_HEAL,   cost: 15 },
        { name: 'Earth Void Shatter', type: 'damage', stat: 'strength',  multiplier: 3.8, stun: true,          cooldown: 4,         cost: 14 }
    ],
    Healer: [
        { name: 'Void Strike',      type: 'damage', stat: 'strength',      multiplier: 2.5, cooldown: 1,         cost: 0  },
        { name: 'Void Heal',        type: 'heal',   stat: 'intelligence',  multiplier: 7.0, baseHeal: 80,        cooldown: CD_HEAL,   cost: 12 },
        { name: 'Void Blessing',    type: 'buff',   effect: 'stamina_up',  value: 60, duration: 3,              cooldown: CD_RANKED, cost: 18 },
        { name: 'Void Cleanse',     type: 'cleanse',                                                             cooldown: CD_HEAL,   cost: 8  },
        { name: 'Abyss Light',      type: 'heal',   stat: 'intelligence',  multiplier: 9.0, baseHeal: 150,       cooldown: CD_HEAL,   cost: 22 },
        { name: 'Void Protection',  type: 'shield', value: 600,                              cooldown: CD_RANKED, cost: 15 }
    ]
};