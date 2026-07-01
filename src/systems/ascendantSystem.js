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

// ══════════════════════════════════════════════════════════════════════
// RESONANCE PROFILE SYSTEM — post-prestige identity registration
// Stages: 1 (Name) → 2 (Identity/Image) → 3 (All 5 Moves + Descriptions)
// ══════════════════════════════════════════════════════════════════════

const RESONANCE_REQUIRED_CLEARS = 200;

// ── CONSTELLATIONS ────────────────────────────────────────────────────
const SOULBOUND_CONSTELLATIONS = [
    { name: 'The Frozen Throne',   symbol: '♑', start: [1,1],   end: [1,19]  },
    { name: 'The Abyssal Eye',     symbol: '♒', start: [1,20],  end: [2,18]  },
    { name: 'The Drowned Serpent', symbol: '♓', start: [2,19],  end: [3,20]  },
    { name: 'The War Herald',      symbol: '♈', start: [3,21],  end: [4,19]  },
    { name: 'The Iron Colossus',   symbol: '♉', start: [4,20],  end: [5,20]  },
    { name: 'The Twin Blades',     symbol: '♊', start: [5,21],  end: [6,20]  },
    { name: 'The Hollow Crown',    symbol: '♋', start: [6,21],  end: [7,22]  },
    { name: 'The Burning Mane',    symbol: '♌', start: [7,23],  end: [8,22]  },
    { name: 'The Silent Weaver',   symbol: '♍', start: [8,23],  end: [9,22]  },
    { name: 'The Shattered Scale', symbol: '♎', start: [9,23],  end: [10,22] },
    { name: 'The Void Fang',      symbol: '♏', start: [10,23], end: [11,21] },
    { name: 'The Last Arrow',     symbol: '♐', start: [11,22], end: [12,21] },
    { name: 'The Frozen Throne',   symbol: '♑', start: [12,22], end: [12,31] },
];
const CYCLE_NAMES = ['','I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'];

function formatGenesisDate(date) {
    const d = new Date(date);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const doy = month * 100 + day;
    let constellation = SOULBOUND_CONSTELLATIONS[0];
    for (const c of SOULBOUND_CONSTELLATIONS) {
        if (doy >= c.start[0]*100+c.start[1] && doy <= c.end[0]*100+c.end[1]) { constellation = c; break; }
    }
    const ord = day===1||day===21||day===31?'st':day===2||day===22?'nd':day===3||day===23?'rd':'th';
    return `${constellation.symbol} ${constellation.name} — ${day}${ord} Night, Cycle ${CYCLE_NAMES[month]||month}`;
}

// ── RESONANCE PROFILE TABLE ───────────────────────────────────────────
async function ensureResonanceProfileTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS resonance_profiles (
            player_id    VARCHAR(50) PRIMARY KEY,
            res_name     VARCHAR(50) NOT NULL,
            res_image    LONGTEXT,
            genesis_date DATETIME DEFAULT NOW(),
            authority    VARCHAR(100) DEFAULT 'Resonant',
            moves        TEXT,
            created_at   DATETIME DEFAULT NOW()
        )
    `).catch(e => console.error('[Resonance] Table error:', e.message));
    await db.execute('ALTER TABLE players ADD COLUMN IF NOT EXISTS dungeons_cleared INT DEFAULT 0').catch(() => {});
}

async function getResonanceProfile(playerId) {
    const [rows] = await db.execute('SELECT * FROM resonance_profiles WHERE player_id=?', [playerId]);
    if (!rows.length) return null;
    const p = rows[0];
    try { p.moves = JSON.parse(p.moves || '[]'); } catch { p.moves = []; }
    return p;
}

async function isResonated(playerId) {
    const [rows] = await db.execute('SELECT 1 FROM resonance_profiles WHERE player_id=? LIMIT 1', [playerId]);
    return rows.length > 0;
}

async function canResonate(playerId) {
    const [rows] = await db.execute(
        "SELECT `rank`, COALESCE(prestige_level,0) as prestige_level, COALESCE(dungeons_cleared,0) as dungeons_cleared FROM players WHERE id=?",
        [playerId]
    );
    if (!rows.length) return { ok: false, reason: 'not_registered' };
    if (await isResonated(playerId)) return { ok: false, reason: 'already_resonated' };
    const p = rows[0];

    // Must be a Prestige hunter
    if (p.prestige_level < 1) return { ok: false, reason: 'not_prestige' };

    // Must be Rank PS (or already Ascendant)
    const rankIdx = PRESTIGE_RANK_ORDER.indexOf(p.rank);
    if (rankIdx < PRESTIGE_RANK_ORDER.indexOf('PS') && p.rank !== ASCENDANT_RANK)
        return { ok: false, reason: 'not_ps_rank', rank: p.rank };

    // Must have cleared at least one PS dungeon
    const [psClears] = await db.execute(
        `SELECT COALESCE(SUM(pq.progress), 0) as clears
         FROM player_quests pq
         JOIN quests q ON q.id = pq.quest_id
         WHERE pq.player_id=? AND q.objective_type='prestige_clear'`,
        [playerId]
    ).catch(() => [[{ clears: 0 }]]);
    if ((psClears[0]?.clears || 0) < 1) return { ok: false, reason: 'no_ps_clear' };

    // 200 total dungeon clears
    if (p.dungeons_cleared < RESONANCE_REQUIRED_CLEARS)
        return { ok: false, reason: 'not_enough_clears', current: p.dungeons_cleared, required: RESONANCE_REQUIRED_CLEARS };
    return { ok: true };
}

// ── FLOW STATE MACHINE ────────────────────────────────────────────────
const resonanceFlows = new Map();

function startResFlow(playerId) {
    resonanceFlows.set(playerId, { stage: 'name', startedAt: Date.now() });
}
function getResFlow(playerId) {
    const f = resonanceFlows.get(playerId);
    if (!f) return null;
    if (Date.now() - f.startedAt > 10*60*1000) { resonanceFlows.delete(playerId); return null; }
    return f;
}
function isInResFlow(playerId) { return resonanceFlows.has(playerId); }
function endResFlow(playerId) { resonanceFlows.delete(playerId); }

async function handleResonanceFlow(playerId, text, rawMsg, fakeMsg, sock) {
    const flow = getResFlow(playerId);
    if (!flow) return false;

    if (text.toLowerCase() === '!cancel') {
        endResFlow(playerId);
        await fakeMsg.reply(
            `╭══〘 ✦ RESONANCE 〙══╮\n` +
            `┃✧ ❌ Resonance cancelled.\n` +
            `┃✧ Use !resonance to start again.\n` +
            `╰═══════════════════════╯`
        );
        return true;
    }

    try {
        switch (flow.stage) {

            // ── STAGE 1: NAME ─────────────────────────────────────
            case 'name': {
                const name = text.trim();
                if (name.length < 2 || name.length > 30) {
                    await fakeMsg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ⚠️ Name must be 2-30 characters.\n┃✧ Try again:\n╰═══════════════════════╯`);
                    return true;
                }
                const [dup] = await db.execute('SELECT player_id FROM resonance_profiles WHERE res_name=? AND player_id!=?', [name, playerId]);
                if (dup.length) {
                    await fakeMsg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ❌ That name is already taken.\n┃✧ Choose another:\n╰═══════════════════════╯`);
                    return true;
                }
                await db.execute(
                    'INSERT INTO resonance_profiles (player_id, res_name, genesis_date) VALUES (?,?,NOW()) ON DUPLICATE KEY UPDATE res_name=?',
                    [playerId, name, name]
                );
                flow.stage = 'image';
                await fakeMsg.reply(
                    `╭══〘 ⚡ STAGE 2 — IDENTITY 〙══╮\n` +
                    `┃✧\n` +
                    `┃✧ Name locked: *${name}*\n` +
                    `┃✧\n` +
                    `┃✧ Now upload your identity image.\n` +
                    `┃✧ This will be permanently tied to\n` +
                    `┃✧ your !me card and *cannot be\n` +
                    `┃✧ changed later*.\n` +
                    `┃✧\n` +
                    `┃✧ Send a direct image in this chat\n` +
                    `┃✧ (as a photo, not a file):\n` +
                    `╰═══════════════════════════════╯`
                );
                return true;
            }

            // ── STAGE 2: IDENTITY (IMAGE) ─────────────────────────
            case 'image': {
                const imageMsg = rawMsg.message?.imageMessage;
                if (!imageMsg) {
                    await fakeMsg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ⚠️ Send an *image*, not text.\n┃✧ (as a photo, not a file)\n╰═══════════════════════╯`);
                    return true;
                }
                try {
                    const { downloadMediaMessage } = require('@whiskeysockets/baileys');
                    const buffer = await downloadMediaMessage(rawMsg, 'buffer', {});
                    const base64 = buffer.toString('base64');
                    if (base64.length > 700000) {
                        await fakeMsg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ⚠️ Image too large (under 500KB).\n┃✧ Send a smaller one:\n╰═══════════════════════╯`);
                        return true;
                    }
                    await db.execute('UPDATE resonance_profiles SET res_image=? WHERE player_id=?', [base64, playerId]);
                    flow.stage = 'moves';
                    await fakeMsg.reply(
                        `╭══〘 ⚡ STAGE 3 — SIGNATURE MOVES 〙══╮\n` +
                        `┃✧\n` +
                        `┃✧ ✅ Identity image saved.\n` +
                        `┃✧\n` +
                        `┃✧ Now define your *5 Signature Moves*.\n` +
                        `┃✧ Send all 5 in *one message*, each\n` +
                        `┃✧ on its own line:\n` +
                        `┃✧\n` +
                        `┃✧ _Move Name - What it does_\n` +
                        `┃✧\n` +
                        `┃✧ Example:\n` +
                        `┃✧ Shadow Strike - A slash from the void\n` +
                        `┃✧ Void Burst - Pure void energy blast\n` +
                        `┃✧ Dark Shield - Absorbs incoming damage\n` +
                        `┃✧ Soul Reap - Drains enemy life force\n` +
                        `┃✧ Final Judgment - Ultimate finisher\n` +
                        `╰═══════════════════════════════════════╯`
                    );
                    return true;
                } catch (e) {
                    console.error('[Resonance] Image download error:', e.message);
                    await fakeMsg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ❌ Failed to download image.\n┃✧ Try sending it again:\n╰═══════════════════════╯`);
                    return true;
                }
            }

            // ── STAGE 3: ALL 5 MOVES + DESCRIPTIONS ───────────────
            case 'moves': {
                const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
                if (lines.length !== 5) {
                    await fakeMsg.reply(
                        `╭══〘 ✦ RESONANCE 〙══╮\n` +
                        `┃✧ ⚠️ Need exactly *5 moves*.\n` +
                        `┃✧ You sent ${lines.length}.\n` +
                        `┃✧\n` +
                        `┃✧ Each on its own line:\n` +
                        `┃✧ _Move Name - What it does_\n` +
                        `╰═══════════════════════╯`
                    );
                    return true;
                }

                const moves = [];
                for (let i = 0; i < 5; i++) {
                    const dashIdx = lines[i].indexOf(' - ');
                    if (dashIdx === -1) {
                        await fakeMsg.reply(
                            `╭══〘 ✦ RESONANCE 〙══╮\n` +
                            `┃✧ ⚠️ Line ${i+1} is missing the *" - "*\n` +
                            `┃✧ separator between name and description.\n` +
                            `┃✧\n` +
                            `┃✧ Format: _Move Name - What it does_\n` +
                            `╰═══════════════════════╯`
                        );
                        return true;
                    }
                    const name = lines[i].substring(0, dashIdx).trim();
                    const desc = lines[i].substring(dashIdx + 3).trim();
                    if (name.length < 2 || name.length > 40) {
                        await fakeMsg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ⚠️ Move ${i+1} name must be 2-40 chars.\n╰═══════════════════════╯`);
                        return true;
                    }
                    if (desc.length < 3 || desc.length > 100) {
                        await fakeMsg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ⚠️ Move ${i+1} description must be 3-100 chars.\n╰═══════════════════════╯`);
                        return true;
                    }
                    moves.push({ name, desc });
                }

                // Check for duplicate move names
                const names = moves.map(m => m.name.toLowerCase());
                if (new Set(names).size !== 5) {
                    await fakeMsg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ⚠️ Each move must have a unique name.\n╰═══════════════════════╯`);
                    return true;
                }

                await db.execute('UPDATE resonance_profiles SET moves=?, authority=? WHERE player_id=?',
                    [JSON.stringify(moves), 'Resonant', playerId]
                );
                endResFlow(playerId);

                const profile = await getResonanceProfile(playerId);
                const genesis = formatGenesisDate(profile.genesis_date);
                const moveList = moves.map((m, i) => `┃✧ ${i+1}. *${m.name}*\n┃✧    _${m.desc}_`).join('\n');

                await fakeMsg.reply(
                    `╭══〘 ⚡ RESONANCE COMPLETE 〙══╮\n` +
                    `┃✧\n` +
                    `┃✧ You have transcended.\n` +
                    `┃✧ The old system no longer binds you.\n` +
                    `┃✧\n` +
                    `┃✧ ━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `┃✧ 👤 ${profile.res_name}\n` +
                    `┃✧ 🌌 Soulbound Genesis:\n` +
                    `┃✧    ${genesis}\n` +
                    `┃✧ 👑 Authority: ${profile.authority}\n` +
                    `┃✧ ━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `┃✧ ⚔️ SIGNATURE MOVES:\n` +
                    `${moveList}\n` +
                    `┃✧ ━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `┃✧\n` +
                    `┃✧ Use *!me* to view your card.\n` +
                    `╰═══════════════════════════════╯`
                );
                return true;
            }

            default: { endResFlow(playerId); return false; }
        }
    } catch (err) {
        console.error('[Resonance] Flow error:', err);
        endResFlow(playerId);
        await fakeMsg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ❌ Something went wrong.\n┃✧ Use !resonance to try again.\n╰═══════════════════════╯`);
        return true;
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
    triggerAscendant,
    // Resonance profile exports
    RESONANCE_REQUIRED_CLEARS,
    ensureResonanceProfileTable,
    getResonanceProfile,
    isResonated,
    canResonate,
    formatGenesisDate,
    handleResonanceFlow,
    isInResFlow,
    startResFlow,
    endResFlow
};