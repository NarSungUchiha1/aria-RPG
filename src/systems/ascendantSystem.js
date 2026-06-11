/**
 * ASCENDANT RANK SYSTEM
 *
 * Any player can accumulate void resonance IF they meet the requirements.
 * Requirements (similar weight to clan creation):
 *   - Prestige player (prestige_level >= 1)
 *   - Rank PC or higher (PC, PB, PA, PS, or ASCENDANT)
 *   - At least 1 PS dungeon cleared
 *   - At least 200 total dungeon clears
 *
 * Resonance builds from:
 *   +5  per prestige dungeon clear
 *   +3  per PS boss kill
 *   +15 per territory war win
 *   +20 per Remnant Sanctum clear
 *   +25 for killing Malachar's Echo
 *
 * At 100 resonance → Ascendant triggers automatically.
 */

const db = require('../database/db');

const ASCENDANT_THRESHOLD  = 100;
const ASCENDANT_RANK       = 'ASCENDANT';
const PRESTIGE_RANK_ORDER  = ['PF','PE','PD','PC','PB','PA','PS'];

const VOID_RESONANCE_GAINS = {
    prestige_dungeon_clear: 5,
    territory_war_win:      15,
    ps_boss_kill:           3,
    remnant_sanctum_clear:  20,
    malachar_echo_kill:     25
};

async function ensureAscendantTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS void_resonance (
            player_id    VARCHAR(60) PRIMARY KEY,
            resonance    INT DEFAULT 0,
            last_updated DATETIME DEFAULT NOW(),
            ascendant_at DATETIME DEFAULT NULL
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS ps_dungeon_clears (
            player_id  VARCHAR(60) PRIMARY KEY,
            clears     INT DEFAULT 0
        )
    `).catch(() => {});

    await db.execute(
        'ALTER TABLE players MODIFY COLUMN `rank` VARCHAR(20)'
    ).catch(() => {});
}

// ── ELIGIBILITY CHECK ─────────────────────────────────────────────────────────
async function checkResonanceEligibility(playerId) {
    await ensureAscendantTables();

    const fails = [];

    const [player] = await db.execute(
        'SELECT `rank`, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?',
        [playerId]
    );
    if (!player.length) return { eligible: false, fails: ['Not registered'] };
    const p = player[0];

    // Prestige check
    if (p.prestige_level < 1) {
        fails.push('❌ Must be a Prestige hunter');
    }

    // Rank PS required
    const rankIdx = PRESTIGE_RANK_ORDER.indexOf(p.rank);
    if (rankIdx < PRESTIGE_RANK_ORDER.indexOf('PS') && p.rank !== ASCENDANT_RANK) {
        fails.push('❌ Must be Rank PS (you are ' + p.rank + ')');
    }

    // At least 1 PS dungeon cleared
    const [psClears] = await db.execute(
        `SELECT COALESCE(SUM(pq.progress), 0) as clears
         FROM player_quests pq
         JOIN quests q ON q.id = pq.quest_id
         WHERE pq.player_id=? AND q.objective_type='prestige_clear'`,
        [playerId]
    ).catch(() => [[{ clears: 0 }]]);
    if ((psClears[0]?.clears || 0) < 1) {
        fails.push('❌ Must have cleared at least one PS dungeon');
    }

    // 200 total dungeon clears
    const [totalClears] = await db.execute(
        `SELECT COALESCE(SUM(pq.progress), 0) as cnt
         FROM player_quests pq
         JOIN quests q ON q.id = pq.quest_id
         WHERE pq.player_id=? AND q.objective_type='dungeon_clear'`,
        [playerId]
    ).catch(() => [[{ cnt: 0 }]]);
    const clearCount = Number(totalClears[0]?.cnt || 0);
    if (clearCount < 200) {
        fails.push('❌ Need 200 dungeon clears (' + clearCount + ' done)');
    }

    return {
        eligible: fails.length === 0,
        fails,
        rank: p.rank,
        prestige: p.prestige_level,
        psClears: psClears[0]?.clears || 0,
        totalClears: clearCount
    };
}

async function addVoidResonance(playerId, eventType, client = null) {
    await ensureAscendantTables();

    // Check eligibility
    const check = await checkResonanceEligibility(playerId);
    if (!check.eligible) return;

    const gain = VOID_RESONANCE_GAINS[eventType] || 0;
    if (!gain) return;

    await db.execute(
        'INSERT INTO void_resonance (player_id, resonance) VALUES (?, ?) ON DUPLICATE KEY UPDATE resonance = LEAST(resonance + ?, 200), last_updated = NOW()',
        [playerId, gain, gain]
    );

    const [resRow] = await db.execute(
        'SELECT resonance FROM void_resonance WHERE player_id=?', [playerId]
    );
    const newRes = resRow[0]?.resonance || 0;

    // Threshold crossed — trigger breakthrough
    if (newRes >= ASCENDANT_THRESHOLD) {
        const [alreadyAscendant] = await db.execute(
            'SELECT `rank` FROM players WHERE id=? AND `rank`=?',
            [playerId, ASCENDANT_RANK]
        );
        if (!alreadyAscendant.length) {
            await triggerAscendant(playerId, client);
        }
        return;
    }

    // Milestone nudges at 25, 50, 75
    if (client) {
        const oldRes = newRes - gain;
        const milestones = [25, 50, 75];
        const hit = milestones.some(m => oldRes < m && newRes >= m);
        if (hit) {
            const bar = '🟣'.repeat(Math.floor(newRes / 10)) + '⬛'.repeat(10 - Math.floor(newRes / 10));
            client.sendMessage(playerId + '@s.whatsapp.net', {
                text:
                    '══〘 👁️ VOID RESONANCE 〙══╮\n' +
                    '┃★ Something stirs inside you.\n' +
                    '┃★\n' +
                    '┃★ ' + bar + '\n' +
                    '┃★ ' + newRes + ' / ' + ASCENDANT_THRESHOLD + '\n' +
                    '┃★\n' +
                    '┃★ You are getting closer to\n' +
                    '┃★ something that has no name yet.\n' +
                    '╰═══════════════════════╯'
            }).catch(() => {});
        }
    }
}

// Track PS dungeon clears separately so eligibility check works
async function recordPsDungeonClear(playerId) {
    await ensureAscendantTables();
    await db.execute(
        'INSERT INTO ps_dungeon_clears (player_id, clears) VALUES (?, 1) ON DUPLICATE KEY UPDATE clears = clears + 1',
        [playerId]
    ).catch(() => {});
}

async function getVoidResonance(playerId) {
    await ensureAscendantTables();
    const [rows] = await db.execute(
        'SELECT resonance FROM void_resonance WHERE player_id=?', [playerId]
    );
    return rows[0]?.resonance || 0;
}

async function getVoidResonanceStatus(playerId) {
    await ensureAscendantTables();
    const check = await checkResonanceEligibility(playerId);

    const [rows] = await db.execute(
        'SELECT resonance, ascendant_at FROM void_resonance WHERE player_id=?', [playerId]
    ).catch(() => [[]]);

    return {
        resonance:   rows[0]?.resonance || 0,
        isAscendant: !!rows[0]?.ascendant_at,
        eligible:    check.eligible,
        fails:       check.fails,
        threshold:   ASCENDANT_THRESHOLD,
        psClears:    check.psClears || 0,
        totalClears: check.totalClears || 0,
        rank:        check.rank
    };
}

async function triggerAscendant(playerId, client = null) {
    const [player] = await db.execute(
        'SELECT nickname, role FROM players WHERE id=?', [playerId]
    );
    if (!player.length) return;
    const p = player[0];

    await db.execute('UPDATE players SET `rank`=? WHERE id=?', [ASCENDANT_RANK, playerId]);

    const ASCENDANT_STAT_BOOST = {
        Berserker: { strength: 800,  agility: 350,  intelligence: 50,   stamina: 400,  hp: 12000, max_hp: 12000 },
        Assassin:  { strength: 400,  agility: 900,  intelligence: 50,   stamina: 350,  hp: 10000, max_hp: 10000 },
        Mage:      { strength: 50,   agility: 350,  intelligence: 900,  stamina: 350,  hp: 10000, max_hp: 10000 },
        Tank:      { strength: 450,  agility: 200,  intelligence: 50,   stamina: 900,  hp: 18000, max_hp: 18000 },
        Healer:    { strength: 50,   agility: 300,  intelligence: 800,  stamina: 500,  hp: 12000, max_hp: 12000 }
    };

    const stats = ASCENDANT_STAT_BOOST[p.role] || ASCENDANT_STAT_BOOST['Berserker'];
    await db.execute(
        'UPDATE players SET strength=?, agility=?, intelligence=?, stamina=?, hp=?, max_hp=? WHERE id=?',
        [stats.strength, stats.agility, stats.intelligence, stats.stamina, stats.hp, stats.max_hp, playerId]
    );

    await db.execute(
        'UPDATE void_resonance SET ascendant_at=NOW() WHERE player_id=?', [playerId]
    );

    const getRaidGroup = () => global.overrideRaidGroup || (global.overrideRaidGroup || process.env.RAID_GROUP_JID) || (global.overrideRaidGroup || '120363213735662100@g.us');

    if (client) {
        try {
            await client.sendMessage(playerId + '@s.whatsapp.net', {
                text:
                    '╔══════════════════════════════════════╗\n' +
                    '┃★\n' +
                    '┃★   It doesn\'t feel like a ranking.\n' +
                    '┃★\n' +
                    '┃★   It feels like something inside\n' +
                    '┃★   you finally stopped pretending\n' +
                    '┃★   to be contained.\n' +
                    '┃★\n' +
                    '┃★   The system tried to classify it.\n' +
                    '┃★   It couldn\'t.\n' +
                    '┃★\n' +
                    '┃★      A S C E N D A N T\n' +
                    '┃★\n' +
                    '┃★   You don\'t rank up from here.\n' +
                    '┃★   There is nothing above this.\n' +
                    '┃★   There is only what you do with it.\n' +
                    '┃★\n' +
                    '╚══════════════════════════════════════╝'
            });
        } catch(e) {}

        try {
            await client.sendMessage(getRaidGroup(), {
                text:
                    '╔══════════════════════════════════════╗\n' +
                    '┃★\n' +
                    '┃★   The system registered something\n' +
                    '┃★   it has never registered before.\n' +
                    '┃★\n' +
                    '┃★      A S C E N D A N T\n' +
                    '┃★\n' +
                    '┃★   *' + p.nickname + '*\n' +
                    '┃★   has broken through.\n' +
                    '┃★\n' +
                    '┃★   Whatever Malachar left behind\n' +
                    '┃★   — they carry it now.\n' +
                    '┃★   And it has made them something\n' +
                    '┃★   the void itself will fear.\n' +
                    '┃★\n' +
                    '╚══════════════════════════════════════╝',
                mentions: [playerId + '@s.whatsapp.net']
            });
        } catch(e) {}
    }
}

module.exports = {
    ASCENDANT_THRESHOLD,
    ASCENDANT_RANK,
    VOID_RESONANCE_GAINS,
    ensureAscendantTables,
    checkResonanceEligibility,
    addVoidResonance,
    recordPsDungeonClear,
    getVoidResonance,
    getVoidResonanceStatus,
    triggerAscendant
};