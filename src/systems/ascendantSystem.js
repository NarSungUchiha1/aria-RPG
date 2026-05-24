/**
 * ASCENDANT RANK SYSTEM
 *
 * Only hunters present when Malachar fell can attempt Ascendant.
 * It is not earned through normal ranking — it is triggered.
 * When the void inside them reaches a threshold, they break through.
 *
 * The threshold: void_resonance >= 100
 * void_resonance accumulates by:
 *   - Clearing prestige dungeons (+5 per clear)
 *   - Winning territory wars (+15)
 *   - Killing bosses in PS rank (+3 per boss)
 *   - Clearing The Remnant Sanctum territory (+20)
 */

const db = require('../database/db');

const ASCENDANT_THRESHOLD    = 100;
const ASCENDANT_RANK         = 'ASCENDANT';

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
            player_id         VARCHAR(60) PRIMARY KEY,
            resonance         INT DEFAULT 0,
            last_updated      DATETIME DEFAULT NOW(),
            ascendant_at      DATETIME DEFAULT NULL
        )
    `).catch(() => {});

    await db.execute(
        'ALTER TABLE players MODIFY COLUMN \`rank\` VARCHAR(20)'
    ).catch(() => {});
}

async function getVoidResonance(playerId) {
    await ensureAscendantTables();
    const [rows] = await db.execute(
        'SELECT resonance FROM void_resonance WHERE player_id=?',
        [playerId]
    );
    return rows[0]?.resonance || 0;
}

async function addVoidResonance(playerId, eventType, client = null) {
    await ensureAscendantTables();

    // Only Malachar-killers can accumulate void resonance
    const [killed] = await db.execute(
        'SELECT player_id FROM malachar_kills WHERE player_id=?',
        [playerId]
    ).catch(() => [[]]);
    if (!killed.length) return;

    const gain = VOID_RESONANCE_GAINS[eventType] || 0;
    if (!gain) return;

    await db.execute(
        'INSERT INTO void_resonance (player_id, resonance) VALUES (?, ?) ON DUPLICATE KEY UPDATE resonance = LEAST(resonance + ?, 200), last_updated = NOW()',
        [playerId, gain, gain]
    );

    const newRes = await getVoidResonance(playerId);

    // Threshold crossed — trigger breakthrough
    if (newRes >= ASCENDANT_THRESHOLD) {
        const [alreadyAscendant] = await db.execute(
            'SELECT \`rank\` FROM players WHERE id=? AND \`rank\`=?',
            [playerId, ASCENDANT_RANK]
        );
        if (!alreadyAscendant.length) {
            await triggerAscendant(playerId, client);
        }
    } else if (client) {
        // Nudge at 50 and 75
        if ((newRes >= 50 && newRes - gain < 50) || (newRes >= 75 && newRes - gain < 75)) {
            try {
                await client.sendMessage(playerId + '@s.whatsapp.net', {
                    text:
                        '══〘 👁️ VOID RESONANCE 〙══╮\n' +
                        '┃★ Something stirs inside you.\n' +
                        '┃★\n' +
                        '┃★ Resonance: ' + newRes + ' / ' + ASCENDANT_THRESHOLD + '\n' +
                        '┃★ ' + '🟣'.repeat(Math.floor(newRes / 10)) + '⬛'.repeat(10 - Math.floor(newRes / 10)) + '\n' +
                        '┃★\n' +
                        '┃★ You are getting closer to\n' +
                        '┃★ something that has no name yet.\n' +
                        '╰═══════════════════════╯'
                });
            } catch(e) {}
        }
    }
}

async function triggerAscendant(playerId, client = null) {
    const [player] = await db.execute(
        'SELECT nickname, role, rank FROM players WHERE id=?',
        [playerId]
    );
    if (!player.length) return;
    const p = player[0];

    // Set rank to ASCENDANT — do NOT strip gold/xp
    await db.execute(
        'UPDATE players SET \`rank\`=? WHERE id=?',
        [ASCENDANT_RANK, playerId]
    );

    // Massive stat boost — Ascendants are beyond PS
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
        'UPDATE void_resonance SET ascendant_at=NOW() WHERE player_id=?',
        [playerId]
    );

    // Notify player
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
                    '┃★   *' + p.nickname + '* has broken through.\n' +
                    '┃★\n' +
                    '┃★   You don\'t rank up from here.\n' +
                    '┃★   There is nothing above this.\n' +
                    '┃★   There is only what you do with it.\n' +
                    '┃★\n' +
                    '╚══════════════════════════════════════╝'
            });
        } catch(e) {}
    }

    // Announce to RAID_GROUP
    if (client) {
        const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
        try {
            await client.sendMessage(RAID_GROUP, {
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
                    '┃★   — they are carrying it now.\n' +
                    '┃★   And it has made them something\n' +
                    '┃★   the void itself will fear.\n' +
                    '┃★\n' +
                    '╚══════════════════════════════════════╝',
                mentions: [playerId + '@s.whatsapp.net']
            });
        } catch(e) {}
    }
}

async function getVoidResonanceStatus(playerId) {
    await ensureAscendantTables();
    const [rows] = await db.execute(
        'SELECT resonance, ascendant_at FROM void_resonance WHERE player_id=?',
        [playerId]
    );
    if (!rows.length) return { resonance: 0, isAscendant: false, eligible: false };

    const [killed] = await db.execute(
        'SELECT player_id FROM malachar_kills WHERE player_id=?', [playerId]
    ).catch(() => [[]]);

    return {
        resonance:   rows[0].resonance || 0,
        isAscendant: !!rows[0].ascendant_at,
        eligible:    killed.length > 0,
        threshold:   ASCENDANT_THRESHOLD
    };
}

module.exports = {
    ASCENDANT_THRESHOLD,
    ASCENDANT_RANK,
    VOID_RESONANCE_GAINS,
    ensureAscendantTables,
    addVoidResonance,
    getVoidResonance,
    getVoidResonanceStatus,
    triggerAscendant
};