/**
 * 300 quests — daily, achievement, party
 * Used to seed the quests table on first run
 */
module.exports = {
  daily: [
    // Combat
    ['Into the Void',          'Enter any dungeon.',                         'dungeon_enter',   1,   500,  300],
    ['Stage Clearer',          'Clear 2 dungeon stages.',                    'stage_clear',     2,   800,  500],
    ['Blood & Gold',           'Clear any dungeon.',                         'dungeon_clear',   1,   700,  600],
    ['Repeat Raider',          'Clear 3 stages total.',                      'stage_clear',     3,  1000,  700],
    ['Stage Grinder',          'Clear 5 stages.',                            'stage_clear',     5,  1500, 1000],
    ['Dungeon Victor',         'Clear a dungeon without dying.',              'dungeon_survive', 1,  1200,  800],
    ['Void Walker',            'Enter 2 different dungeons.',                'dungeon_enter',   2,   900,  600],
    ['Relentless',             'Clear 4 stages in one day.',                 'stage_clear',     4,  1100,  800],
    ['Boss Slayer',            'Kill an enemy with 5000+ HP.',               'kill_enemies',    1,  1000,  700],
    ['Rampage',                'Deal 10000 total damage.',                   'damage_dealt',    1,   800,  500],
    ['Survivor',               'Survive any dungeon.',                       'dungeon_survive', 1,   600,  400],
    // PvP
    ['PvP Challenger',         'Win a duel.',                                'pvp_win',         1,   600,  400],
    ['Brawler',                'Win 2 duels in one day.',                    'pvp_win',         2,  1200,  800],
    ['Fearless',               'Challenge someone higher ranked.',           'pvp_win',         1,   700,  500],
    ['Duel Master',            'Win 3 duels.',                               'pvp_win',         3,  1500, 1000],
    // Economy
    ['Trader',                 'Send gold to another player.',               'pay_gold',        1,   400,  300],
    ['Market Day',             'Buy something from the shop.',               'shop_buy',        1,   500,  300],
    ['Potion Hoarder',         'Buy a potion.',                              'buy_potion',      1,   400,  250],
    // Progression
    ['Skill Seeker',           'Use 5 skills in one dungeon.',               'skill_use',       5,   600,  400],
    ['Power Surge',            'Upgrade a stat.',                            'upgrade_stat',    1,   500,  350],
    // Exploration (Explorer)
    ['Rift Runner',            'Complete a void rift.',                      'rift_complete',   1,   700,  500],
    ['Deep Diver',             'Complete a B-rank rift or higher.',          'rift_complete',   1,   900,  600],
    // Healer/Support
    ['Life Bringer',           'Heal 1000 HP total.',                        'healing_done',    1,   600,  400],
    ['Shield Bearer',          'Apply a shield in combat.',                  'shield_apply',    1,   500,  350],
    // Misc
    ['Daily Devotion',         'Claim your daily reward.',                   'daily_claim',     1,   300,  200],
    ['Boss Hunter',            'Kill a dungeon boss.',                       'boss_kill',       1,  1000,  700],
    ['Void Touched',           'Complete 2 dungeons.',                       'dungeon_clear',   2,  1400,  900],
    ['Chain Clearer',          'Clear 2 dungeons without dying.',            'dungeon_survive', 2,  1600, 1100],
    ['Gold Hungry',            'Earn 500 gold from dungeons.',               'gold_earned',     1,   400,  300],
    ['XP Grind',               'Earn 500 XP.',                              'xp_earned',       1,   400,  300],
    // Prestige-flavor
    ['Void Champion',          'Clear a prestige dungeon stage.',            'prestige_stage',  1,  2000, 1200],
    ['Prestige Warrior',       'Clear a full prestige dungeon.',             'prestige_clear',  1,  2500, 1500],
    ['Void Massacre',          'Kill 3 enemies in a prestige dungeon.',      'prestige_kills',  3,  1800, 1200],
    // Clan
    ['Clan Loyal',             'Complete a clan quest.',                     'clan_quest',      1,   800,  500],
    ['Team Player',            'Join a party duel.',                         'party_duel',      1,   600,  400],
    // Extra variety
    ['Bloodthirsty',           'Kill 5 enemies in total.',                   'kill_enemies',    5,   700,  500],
    ['Void Strider',           'Clear 6 stages.',                            'stage_clear',     6,  1700, 1100],
    ['Dungeon Baron',          'Enter 3 dungeons.',                          'dungeon_enter',   3,  1000,  700],
    ['Iron Will',              'Survive 3 encounters.',                      'dungeon_survive', 3,  1400,  900],
    ['Slaughter',              'Kill 10 enemies.',                           'kill_enemies',   10,  1200,  800],
    ['Territory Raider',       'Participate in a territory assault.',        'territory_enter', 1,  1500, 1000],
    ['War Ready',              'Win a territory battle.',                    'territory_win',   1,  3000, 2000],
  ],

  achievements: [
    ['First Blood',            'Win your first PvP duel.',                   'pvp_win',         1,   2000,  1500, 10, 'Duelist'],
    ['Veteran Duelist',        'Win 10 PvP duels.',                          'pvp_win',         10,  8000,  5000, 30, 'Gladiator'],
    ['Void Conqueror',         'Clear 10 dungeons.',                         'dungeon_clear',   10,  5000,  4000, 20, 'Dungeon Breaker'],
    ['Unkillable',             'Survive 5 full dungeons without dying.',     'dungeon_survive', 5,   6000,  4500, 25, 'Iron Will'],
    ['Stage Hunter',           'Clear 25 total stages.',                     'stage_clear',     25,  7000,  5000, 30, 'Stage Slayer'],
    ['S-Rank Slayer',          'Clear an S-rank dungeon.',                   'srank_clear',     1,   4000,  3000, 20, 'S-Rank Hunter'],
    ['Champion',               'Win 25 PvP duels.',                          'pvp_win',         25, 15000, 10000, 50, 'Champion'],
    ['Void Lord',              'Clear 25 dungeons.',                         'dungeon_clear',   25, 12000,  8000, 40, 'Void Lord'],
    ['Unstoppable',            'Win 50 PvP duels.',                          'pvp_win',         50, 25000, 15000, 75, 'War God'],
    ['Prestige Pioneer',       'Complete your first prestige dungeon.',      'prestige_clear',  1,  10000,  7000, 35, 'Void Hunter'],
    ['Prestige Veteran',       'Clear 10 prestige dungeons.',                'prestige_clear',  10, 20000, 12000, 60, 'Void Veteran'],
    ['Mass Slayer',            'Kill 100 enemies total.',                    'kill_enemies',    100, 8000,  5000, 25, 'Executioner'],
    ['Boss Destroyer',         'Kill 10 dungeon bosses.',                    'boss_kill',       10, 10000,  7000, 35, 'Boss Breaker'],
    ['Territory Holder',       'Hold a territory for 3 days.',               'territory_hold',  3,  15000, 10000, 50, 'Warlord'],
    ['Clan Legend',            'Complete 10 clan quests.',                   'clan_quest',      10,  8000,  5000, 30, 'Clan Champion'],
    ['Void Ascendant',         'Reach 50 void resonance.',                   'void_resonance',  50, 20000, 15000, 60, 'Void Ascendant'],
    ['Healer Supreme',         'Heal 50000 HP total.',                       'healing_done',    1,   8000,  5000, 25, 'Life Weaver'],
    ['Tank Legend',            'Block 30000 damage total.',                  'damage_blocked',  1,   8000,  5000, 25, 'Iron Bastion'],
    ['Explorer Elite',         'Complete 20 void rifts.',                    'rift_complete',   20,  8000,  5000, 25, 'Rift Master'],
    ['Wealthy',                'Accumulate 100000 gold.',                    'gold_total',      1,   5000,  3000, 20, 'Merchant Prince'],
  ],

  party: [
    ['Party Raid',             'Clear a dungeon with a full team.',          'dungeon_clear',   1,  3000,  2000, 15],
    ['Team Surge',             'Clear 10 stages as a group this week.',      'stage_clear',     10, 5000,  3500, 20],
    ['Void Tide',              'Clear 3 dungeons together this week.',       'dungeon_clear',   3,  7000,  5000, 30],
    ['Clan Strike',            'Win a clan war.',                            'clan_war_win',    1,  8000,  6000, 35],
    ['Group Heist',            'Clear 5 stages in a single session.',        'stage_clear',     5,  4000,  3000, 20],
    ['Alliance',               'Enter a dungeon with 3+ clan members.',      'dungeon_enter',   1,  2500,  1500, 10],
    ['War Party',              'Win a territory battle as a team.',          'territory_win',   1, 10000,  7000, 40],
    ['Dungeon Marathon',       'Clear 5 dungeons this week as a team.',      'dungeon_clear',   5,  9000,  6000, 35],
    ['Legendary Run',          'Clear a PS dungeon as a team.',              'prestige_clear',  1, 12000,  8000, 45],
    ['Void Pact',              'Win 5 duels as a team.',                     'pvp_win',         5,  6000,  4000, 25],
  ]
};