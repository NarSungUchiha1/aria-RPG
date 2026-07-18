/**
 * PRESTIGE ROLE MOVES
 * Buff/debuff/heal cooldowns are rank-scaled — starts at 150s at PF, decreases per rank.
 * This is handled by skillSystem.js which passes the player's rank to getActualCooldown().
 * Damage moves stay short (1-5s) regardless of rank.
 *
 * Cooldown schedule (applied by skillSystem):
 * PF:150  PE:130  PD:110  PC:90  PB:70  PA:50  PS:30
 *
 * Buffs/debuffs use percent:true — value is treated as a % of the target stat.
 * e.g. value:30, percent:true on STR 2000 = +600 effective bonus.
 * This keeps buffs meaningful across all prestige tiers.
 */

const CD_RANKED = 'RANKED';      // buff/debuff/heal — scales with rank
const CD_HEAL   = 'RANKED_HEAL'; // heal — slightly shorter than buff

module.exports = {
    Berserker: [
        { name: 'Void Strike',      type: 'damage', stat: 'strength', multiplier: 2.5, cooldown: 1,         cost: 0  },
        { name: 'Void Slash',       type: 'damage', stat: 'strength', multiplier: 3.2, cooldown: 30,        cost: 0  },
        { name: 'Void Bloodlust',   type: 'buff',   effect: 'strength_up',  value: 35, percent: true, duration: 3, cooldown: CD_RANKED, cost: 15,
          desc: '+35% STR for 3 turns.' },
        { name: 'Abyss Smash',      type: 'damage', stat: 'strength', multiplier: 3.8, stun: true,  cooldown: 30,        cost: 18 },
        { name: 'Fracture Frenzy',  type: 'damage', stat: 'strength', multiplier: 2.8, hits: 3,     cooldown: 30,        cost: 22 },
        { name: 'Void Intimidate',  type: 'debuff', effect: 'defense',      value: -40, percent: true, duration: 3, cooldown: CD_RANKED, cost: 12,
          desc: '-40% enemy DEF for 3 turns.' }
    ],
    Assassin: [
        { name: 'Void Strike',      type: 'damage', stat: 'strength', multiplier: 2.5, cooldown: 1,         cost: 0  },
        { name: 'Void Backstab',    type: 'damage', stat: 'agility',  multiplier: 3.5, cooldown: 30,        cost: 10 },
        { name: 'Phantom Step',     type: 'buff',   effect: 'agility_up',   value: 35, percent: true, duration: 3, cooldown: CD_RANKED, cost: 12,
          desc: '+35% AGI for 3 turns.' },
        { name: 'Void Venom',       type: 'debuff', effect: 'strength',     value: -30, percent: true, duration: 3, cooldown: CD_RANKED, cost: 10,
          desc: '-30% enemy STR for 3 turns.' },
        { name: 'Abyss Fatal',      type: 'damage', stat: 'agility',  multiplier: 4.0, ignore_defense: 0.5, cooldown: 120, cost: 20 },
        { name: 'Void Smoke',       type: 'debuff', effect: 'agility',      value: -35, percent: true, duration: 3, cooldown: CD_RANKED, cost: 10,
          desc: '-35% enemy AGI for 3 turns.' }
    ],
    Mage: [
        { name: 'Void Strike',      type: 'damage', stat: 'strength',      multiplier: 2.5, cooldown: 1,         cost: 0  },
        { name: 'Void Fireball',    type: 'damage', stat: 'intelligence',  multiplier: 3.2, cooldown: 1,         cost: 15 },
        { name: 'Fracture Blast',   type: 'damage', stat: 'intelligence',  multiplier: 2.8, aoe: true, cooldown: 10, cost: 20 },
        { name: 'Abyss Barrier',    type: 'shield', value: 500,                              cooldown: CD_RANKED, cost: 15 },
        { name: 'Void Nova',        type: 'damage', stat: 'intelligence',  multiplier: 2.5, freeze: true, aoe: true, cooldown: 10, cost: 18 },
        { name: 'Void Intellect',   type: 'buff',   effect: 'intelligence_up', value: 35, percent: true, duration: 3, cooldown: CD_RANKED, cost: 18,
          desc: '+35% INT for 3 turns.' }
    ],
    Tank: [
        { name: 'Void Strike',        type: 'damage', stat: 'stamina',  multiplier: 2.8, cooldown: 1,         cost: 0  },
        { name: 'Fracture Bash',      type: 'damage', stat: 'stamina',  multiplier: 3.2, def_reduction: 40,   cooldown: 20,        cost: 8  },
        { name: 'Void Fortress',      type: 'buff',   effect: 'defense',    value: 40, percent: true, duration: 3, cooldown: CD_RANKED, cost: 12,
          desc: '+40% DEF for 3 turns.' },
        { name: 'Abyssal Taunt',      type: 'debuff', effect: 'attack',     value: -40, percent: true, duration: 3, cooldown: CD_RANKED, cost: 10,
          desc: '-40% enemy ATK for 3 turns.' },
        { name: 'Gloam Bulwark',       type: 'shield', value: 800,                           cooldown: CD_RANKED, cost: 15 },
        { name: 'Earth Void Shatter', type: 'damage', stat: 'strength',  multiplier: 3.8, stun: true,          cooldown: 120,       cost: 14 }
    ],
    Healer: [
        { name: 'Void Strike',      type: 'damage', stat: 'strength',      multiplier: 2.5, cooldown: 1,         cost: 0  },
        { name: 'Void Heal',        type: 'heal',   stat: 'intelligence',  multiplier: 7.0, baseHeal: 80,        cooldown: 120,       cost: 12 },
        { name: 'Void Blessing',    type: 'buff',   effect: 'stamina_up',  value: 35, percent: true, duration: 3, cooldown: CD_RANKED, cost: 18,
          desc: '+35% STA for 3 turns.' },
        { name: 'Void Cleanse',     type: 'cleanse',                                                              cooldown: CD_HEAL,   cost: 8  },
        { name: 'Abyss Light',      type: 'heal',   stat: 'intelligence',  multiplier: 9.0, baseHeal: 150,        cooldown: CD_HEAL,   cost: 22 },
    ],
    Explorer: [
        { name: 'Void Stride',      type: 'buff',   effect: 'agility_up',      value: 35, percent: true, duration: 3, cooldown: CD_RANKED, cost: 12,
          desc: '+35% AGI — move faster through unstable space.' },
        { name: 'Deep Rift Sense',  type: 'buff',   effect: 'intelligence_up', value: 30, percent: true, duration: 3, cooldown: CD_RANKED, cost: 14,
          desc: '+30% INT — read the void patterns.' },
        { name: 'Fracture Ward',    type: 'shield', value: 500,                              cooldown: CD_RANKED, cost: 15,
          desc: 'A brief ward of void energy.' },
        { name: 'Void Extraction',  type: 'buff',   effect: 'agility_up',      value: 50, percent: true, duration: 2, cooldown: CD_RANKED, cost: 18,
          desc: '+50% AGI — desperate escape through a micro-rift.' },
        { name: 'Malacars Path',    type: 'buff',   effect: 'intelligence_up', value: 55, percent: true, duration: 3, cooldown: CD_RANKED, cost: 20,
          desc: '+55% INT — walk the path the Hollow King walked.' }
    ]
};