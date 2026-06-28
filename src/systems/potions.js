/**
 * POTION DEFINITIONS
 * All 25 void concoctions with effects, ingredients and minimum prices.
 */

const POTIONS = {
    // ── COMBAT POTIONS ────────────────────────────────────────────────────────
    'Ichor of the Fallen': {
        effect: 'death_protect',
        desc: 'Die in a dungeon — keep all gold and XP instead of losing it. One use.',
        ingredients: { 'Life Essence': 2, 'Shadow Essence': 2, 'Void Crystal': 1 },
        minPrice: 3000,
        prestige: false,
        lore: 'Brewed from the last breath of something that should not have been killable.'
    },
    'Eclipse Draught': {
        effect: 'true_damage',
        turns: 5,
        desc: 'Next 5 attacks deal true damage — bypass ALL defense and shields.',
        ingredients: { 'Void Crystal': 2, 'Shadow Fragment': 2, 'Ancient Tome Fragment': 1 },
        minPrice: 4000,
        prestige: false,
        lore: 'The void looked at armour and laughed.'
    },
    'Bloodpact Serum': {
        effect: 'damage_link',
        desc: 'Link with a teammate — share all incoming damage 50/50 for entire dungeon.',
        ingredients: { 'Blood Root': 2, 'Life Essence': 2, 'Void Water': 1 },
        minPrice: 2500,
        prestige: false,
        lore: "Don't drink this with someone you don't trust with your life."
    },
    'Void Madness': {
        effect: 'berserk',
        turns: 5,
        stat_boost: 2.0,
        desc: '+200% damage for 5 turns but you cannot see your own HP.',
        ingredients: { 'Void Ink': 2, 'Blood Root': 2, 'Shadow Essence': 1 },
        minPrice: 3500,
        prestige: false,
        lore: 'Power has a price. You just agreed to it.'
    },
    'Soul Anchor': {
        effect: 'auto_revive',
        heal_percent: 0.5,
        desc: 'If you die this dungeon you resurrect once at 50% HP. No gold or XP loss.',
        ingredients: { 'Life Essence': 3, 'Void Crystal': 1, 'Ancient Herb': 2 },
        minPrice: 5000,
        prestige: false,
        lore: 'Something in the void decided you were not done yet.'
    },
    'Phantom Draught': {
        effect: 'double_strike',
        chance: 0.4,
        turns: 3,
        desc: '40% chance each attack hits twice for 3 turns.',
        ingredients: { 'Shadow Fragment': 3, 'Void Water': 1 },
        minPrice: 2000,
        prestige: false,
        lore: 'Your strikes exist between moments now.'
    },
    "Malachar's Hunger": {
        effect: 'hp_steal_first',
        steal_percent: 0.3,
        desc: 'Prestige only — steal 30% of every enemy current HP on your first hit each stage.',
        ingredients: { 'Malachar Fragment': 1, 'Void Crystal': 2, 'Blood Root': 2 },
        minPrice: 8000,
        prestige: true,
        lore: 'He learned to take before the world learned to give.'
    },
    'Void Resonance': {
        effect: 'clan_boost',
        stat_mult: 1.25,
        desc: 'All clan members in dungeon get +25% all stats for entire run.',
        ingredients: { 'Void Crystal': 3, 'Life Essence': 2 },
        minPrice: 6000,
        prestige: false,
        lore: 'The bloodline hears itself. It responds.'
    },
    'Shattered Time': {
        effect: 'no_cooldown',
        turns: 3,
        desc: 'Skip all cooldowns for 3 turns — every skill usable back to back.',
        ingredients: { 'Ancient Tome Fragment': 1, 'Void Ink': 2, 'Spell Component': 2 },
        minPrice: 5500,
        prestige: false,
        lore: 'Time disagreed. The brew won.'
    },
    'Blood Price': {
        effect: 'hp_to_damage',
        hp_cost: 0.4,
        desc: 'Sacrifice 40% current HP — deal that amount as bonus damage on next hit.',
        ingredients: { 'Blood Root': 3, 'Shadow Essence': 1 },
        minPrice: 2000,
        prestige: false,
        lore: 'You paid. The void delivers.'
    },
    'The Last Drink': {
        effect: 'last_stand',
        condition_hp: 0.1,
        desc: 'Full HP restore + invincible for 2 turns. Only usable below 10% HP.',
        ingredients: { 'Life Essence': 3, 'Ancient Herb': 2, 'Void Crystal': 2 },
        minPrice: 7000,
        prestige: false,
        lore: 'Reserved for those who have absolutely run out of options.'
    },
    'Abyss Sight': {
        effect: 'enemy_reveal',
        desc: 'See all enemy stats, moves, weaknesses and HP for entire dungeon.',
        ingredients: { 'Void Ink': 2, 'Spell Component': 2 },
        minPrice: 1500,
        prestige: false,
        lore: 'The void has no secrets from those willing to look properly.'
    },
    'Cursed Ichor': {
        effect: 'chaos_mode',
        damage_amp: 0.5,
        turns: 5,
        desc: 'Prestige only — you and all enemies take 50% more damage for 5 turns.',
        ingredients: { 'Malachar Fragment': 1, 'Blood Root': 2, 'Shadow Fragment': 2 },
        minPrice: 4500,
        prestige: true,
        lore: 'Chaos, bottled. Drink carefully.'
    },
    'Wraith Form': {
        effect: 'immunity',
        turns: 2,
        desc: 'All enemy attacks pass through you for 2 turns — complete immunity.',
        ingredients: { 'Shadow Fragment': 3, 'Void Water': 2 },
        minPrice: 6000,
        prestige: false,
        lore: 'You are not entirely here right now.'
    },
    'Echo Brew': {
        effect: 'echo_skill',
        power: 0.8,
        desc: 'Your last skill repeats automatically next turn at 80% power.',
        ingredients: { 'Void Ink': 1, 'Spell Component': 1, 'Ancient Herb': 1 },
        minPrice: 3000,
        prestige: false,
        lore: 'The void remembered what you did. It wanted to see it again.'
    },

    // ── 10 NEW ────────────────────────────────────────────────────────────────
    'Void Puppeteer': {
        effect: 'redirect_aggro',
        turns: 3,
        desc: 'Control which enemy attacks which teammate for 3 turns.',
        ingredients: { 'Void Ink': 2, 'Shadow Essence': 1, 'Spell Component': 1 },
        minPrice: 3500,
        prestige: false,
        lore: 'The void does not fight. It rearranges.'
    },
    'Grave Debt': {
        effect: 'wound_damage',
        desc: 'Deal damage equal to 500% of HP lost this dungeon in one strike.',
        ingredients: { 'Blood Root': 3, 'Life Essence': 1, 'Shadow Fragment': 2 },
        minPrice: 4000,
        prestige: false,
        lore: 'Everything you suffered becomes a weapon.'
    },
    'Mirror Toxin': {
        effect: 'death_reflect',
        desc: 'The next hit that would kill you instead kills the attacker at full damage.',
        ingredients: { 'Shadow Essence': 2, 'Void Crystal': 1, 'Ancient Herb': 1 },
        minPrice: 5000,
        prestige: false,
        lore: 'It came back. It brought what it was carrying.'
    },
    'Forgotten Name': {
        effect: 'invisibility',
        turns: 2,
        desc: 'Enemies ignore you completely for 2 turns.',
        ingredients: { 'Shadow Fragment': 2, 'Void Water': 2 },
        minPrice: 3000,
        prestige: false,
        lore: 'The void forgot you existed. You used it.'
    },
    'Crimson Tide': {
        effect: 'lifesteal',
        percent: 0.25,
        desc: 'Every hit you land heals you for 25% of damage dealt this stage.',
        ingredients: { 'Blood Root': 2, 'Life Essence': 2, 'Healing Moss': 2 },
        minPrice: 4000,
        prestige: false,
        lore: 'The blood was not yours to begin with.'
    },
    'The Unravelling': {
        effect: 'strip_all',
        desc: 'Strip ALL buffs and shields from every enemy in stage instantly.',
        ingredients: { 'Void Crystal': 2, 'Ancient Tome Fragment': 1, 'Spell Component': 2 },
        minPrice: 4500,
        prestige: false,
        lore: 'Nothing they built holds anymore.'
    },
    'Eternity Shard Brew': {
        effect: 'time_freeze',
        turns: 2,
        desc: 'Prestige only — freeze time for 2 turns, act freely while enemies are locked.',
        ingredients: { 'Malachar Fragment': 1, 'Ancient Tome Fragment': 1, 'Void Crystal': 3 },
        minPrice: 12000,
        prestige: true,
        lore: 'Malachar did this once. Only once.'
    },
    'Soul Harvest': {
        effect: 'kill_hp_gain',
        hp_percent: 0.1,
        desc: 'On each enemy kill gain 10% of their max HP permanently until run ends.',
        ingredients: { 'Life Essence': 2, 'Shadow Essence': 2, 'Blood Root': 1 },
        minPrice: 3500,
        prestige: false,
        lore: 'You keep taking. It keeps giving.'
    },
    'Fracture Bomb': {
        effect: 'def_shatter',
        def_reduction: 0.8,
        desc: 'Reduces target enemy DEF by 80% for entire dungeon.',
        ingredients: { 'Void Crystal': 1, 'Shadow Fragment': 2, 'Iron Root': 2 },
        minPrice: 3000,
        prestige: false,
        lore: "It doesn't destroy the armour. It disagrees with its existence."
    },
    'The Reckoning': {
        effect: 'death_stack',
        per_death_mult: 1.0,
        desc: 'Prestige only — every death in dungeon so far adds 100% to your next hit. Unlimited stack.',
        ingredients: { 'Malachar Fragment': 2, 'Blood Root': 3, 'Void Ink': 2 },
        minPrice: 15000,
        prestige: true,
        lore: 'The void counted. Now you collect.'
    }
};

// Minimum prices enforced at listing time
const MIN_PRICES = Object.fromEntries(
    Object.entries(POTIONS).map(([name, p]) => [name, p.minPrice])
);

module.exports = { POTIONS, MIN_PRICES };