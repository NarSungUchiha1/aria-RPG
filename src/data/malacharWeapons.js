/**
 * MALACHAR WEAPONS — The Three Who Stood
 * Unique weapons bound to the three hunters who killed Malachar.
 * Cannot be traded, dropped, crafted, or duplicated.
 * Each weapon carries the memory of what happened in that dungeon.
 *
 * Hajun    (79960060522562)  — Berserker
 * VORTEX   (53635887153297)  — Berserker
 * Sekiro   (200957459742874) — Tank
 */

const MALACHAR_WEAPONS = {

    // ── HAJUN ─────────────────────────────────────────────────────────────────
    'Ruin': {
        owner_id:    '79960060522562',
        owner_name:  'Hajun',
        role:        'Berserker',
        item_type:   'weapon',
        unique:      true,
        bound:       true,
        lore:        'It doesn\'t have a story. It doesn\'t need one. Hajun picked it up and everything it touched came apart.',
        stat_bonus:  { strength: 1200, agility: 400 },
        moves: [
            {
                name:        'Void Cleave',
                type:        'damage',
                stat:        'strength',
                multiplier:  18.0,
                cooldown:    1,
                cost:        0,
                desc:        'A raw slash that tears through void energy. Fast. Relentless.'
            },
            {
                name:        'Fracture Strike',
                type:        'damage',
                stat:        'strength',
                multiplier:  35.0,
                hits:        2,
                ignore_defense: 0.6,
                cooldown:    3,
                cost:        0,
                desc:        'Two strikes that bypass 60% of all defense. The fracture remembers.'
            },
            {
                name:        'The Last Rage',
                type:        'damage',
                stat:        'strength',
                multiplier:  80.0,
                aoe:         true,
                ignore_defense: 1.0,
                drain_self:  0.15,
                cooldown:    6,
                cost:        0,
                desc:        'Channels every void remnant in the blade. Hits ALL enemies. Ignores all defense. Costs 15% of current HP.'
            }
        ]
    },

    // ── VORTEX ────────────────────────────────────────────────────────────────
    'Stillpoint': {
        owner_id:    '53635887153297',
        owner_name:  'VORTEX',
        role:        'Berserker',
        item_type:   'weapon',
        unique:      true,
        bound:       true,
        lore:        'In the eye of everything — the chaos, the void, Malachar\'s last breath — there was a single moment of complete calm. VØƦTEX found it. This is what he brought back.',
        stat_bonus:  { strength: 1000, agility: 600 },
        moves: [
            {
                name:        'Void Fang',
                type:        'damage',
                stat:        'strength',
                multiplier:  16.0,
                cooldown:    1,
                cost:        0,
                desc:        'A precise cut that finds gaps in armor.'
            },
            {
                name:        'Tear Reality',
                type:        'damage',
                stat:        'strength',
                multiplier:  30.0,
                def_reduction: 60,
                cooldown:    3,
                cost:        0,
                desc:        'Reduces the target\'s defense by 60 permanently until stage ends.'
            },
            {
                name:        'The Vortex',
                type:        'damage',
                stat:        'strength',
                multiplier:  65.0,
                hits:        3,
                ignore_defense: 0.8,
                cooldown:    6,
                cost:        0,
                desc:        'Three rapid strikes at 65× strength each. 80% defense bypass. Named after its wielder.'
            }
        ]
    },

    // ── SEKIRO ────────────────────────────────────────────────────────────────
    // He blamed everything. The system. The weapon. His teammates.
    // Then Malachar nearly killed him and something changed.
    // The shield he carries now is the version of himself that stopped making excuses.
    'No More Words': {
        owner_id:    '200957459742874',
        owner_name:  'Sekiro',
        role:        'Tank',
        item_type:   'weapon',
        unique:      true,
        bound:       true,
        lore:        'He used to have a lot to say. About the system. About his weapon. About his team. Malachar didn\'t care. Neither does this.',
        stat_bonus:  { stamina: 1500, strength: 500 },
        moves: [
            {
                name:        'Stand Firm',
                type:        'shield',
                value:       8000,
                cooldown:    1,
                cost:        0,
                desc:        'No more dodging. A shield that absorbs 8000 damage before breaking.'
            },
            {
                name:        'No Excuses',
                type:        'damage',
                stat:        'stamina',
                multiplier:  28.0,
                taunt:       true,
                cooldown:    3,
                cost:        0,
                desc:        'A slam that forces all enemies to target Sekiro for 2 turns. Deals 28× stamina damage. He takes it. He always takes it now.'
            },
            {
                name:        'The Weight of It',
                type:        'damage',
                stat:        'stamina',
                multiplier:  60.0,
                aoe:         true,
                self_heal:   0.40,
                ignore_defense: 0.5,
                cooldown:    6,
                cost:        0,
                desc:        'Everything he blamed others for — he turns it into force. AOE. 60× stamina. Heals 40% of damage dealt. Ignores 50% defense.'
            }
        ]
    }
};

// Easy lookup by owner ID
const WEAPON_BY_OWNER = {};
for (const [weaponName, data] of Object.entries(MALACHAR_WEAPONS)) {
    WEAPON_BY_OWNER[data.owner_id] = { ...data, name: weaponName };
}

module.exports = { MALACHAR_WEAPONS, WEAPON_BY_OWNER };