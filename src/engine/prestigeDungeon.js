/**
 * PRESTIGE DUNGEON SYSTEM
 * Separate from normal dungeons.
 * Uses prestigeEnemies.js — enemies start at 1000HP for PF rank.
 * Prestige rank maps: F→PF, E→PE, D→PD, C→PC, B→PB, A→PA, S→PS
 * Auto-spawns after normal dungeon ends (complete, expire, or admin close).
 */

const db = require('../database/db');
const prestigeEnemies = require('../data/prestigeEnemies');

const PRESTIGE_RANK_MAP = {
    F: 'PF', E: 'PE', D: 'PD', C: 'PC', B: 'PB', A: 'PA', S: 'PS'
};

const PRESTIGE_RANK_ORDER = ['PF', 'PE', 'PD', 'PC', 'PB', 'PA', 'PS'];

const PRESTIGE_BOSSES = {
    PF: 'Void Sentinel',
    PE: 'Fracture Beast',
    PD: 'Void Warlord',
    PC: 'Abyss Monarch',
    PB: 'The Fracture God',
    PA: "Malachar's Herald",
    PS: 'Malachar'
};

const MAX_STAGES = { PF: 3, PE: 3, PD: 4, PC: 4, PB: 5, PA: 5, PS: 6 };

// FIX: Updated player limits per spec
const MAX_RAIDERS = { PF: 3, PE: 4, PD: 4, PC: 4, PB: 5, PA: 5, PS: 7 };

// ── PRESTIGE LOBBY TIMER ─────────────────────────────────
const PRESTIGE_LOBBY_WARN_MS  = 8  * 60 * 1000;
const PRESTIGE_LOBBY_CLOSE_MS = 10 * 60 * 1000;

const prestigeLobbyTimers = new Map();

// FIX: mutex to prevent double-spawn race condition
let _prestigeSpawnInProgress = false;

function clearPrestigeLobbyTimer(dungeonId) {
    const t = prestigeLobbyTimers.get(dungeonId);
    if (t) {
        clearTimeout(t.warning);
        clearTimeout(t.timeout);
        prestigeLobbyTimers.delete(dungeonId);
    }
}

function startPrestigeLobbyTimer(dungeonId, client, RAID_GROUP, remaining = null) {
    clearPrestigeLobbyTimer(dungeonId);

    const totalDuration = remaining || PRESTIGE_LOBBY_CLOSE_MS;
    const warningDelay = remaining
        ? Math.max(0, totalDuration - (PRESTIGE_LOBBY_CLOSE_MS - PRESTIGE_LOBBY_WARN_MS))
        : PRESTIGE_LOBBY_WARN_MS;
    const closeDelay = remaining || PRESTIGE_LOBBY_CLOSE_MS;

    const warning = setTimeout(async () => {
        try {
            await client.sendMessage(RAID_GROUP, {
                text:
                    `╔══〘 ✦ PRESTIGE PORTAL 〙══╗\n` +
                    `┃★ ⚠️ The void rift is destabilizing!\n` +
                    `┃★ ⏳ 2 minutes left to enter.\n` +
                    `┃★ DM !enter now — Prestige Hunters only.\n` +
                    `╚═══════════════════════════╝`
            });
        } catch (e) {}
    }, warningDelay);

    const timeout = setTimeout(async () => {
        try {
            const [rows] = await db.execute(
                'SELECT id FROM dungeon WHERE id=? AND is_active=1 AND locked=0',
                [dungeonId]
            );
            if (rows.length) {
                const [playersInside] = await db.execute(
                    'SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=? AND is_alive=1',
                    [dungeonId]
                );
                if (playersInside[0].cnt > 0) {
                    console.log(`★ Prestige dungeon ${dungeonId} timer fired but players inside — keeping active.`);
                    prestigeLobbyTimers.delete(dungeonId);
                    return;
                }
                const [updateResult] = await db.execute(
                    'UPDATE dungeon SET is_active=0 WHERE id=? AND is_active=1 AND locked=0',
                    [dungeonId]
                );
                if (updateResult.affectedRows === 0) {
                    prestigeLobbyTimers.delete(dungeonId);
                    return;
                }
                await client.sendMessage(RAID_GROUP, {
                    text:
                        `╔══〘 ✦ PRESTIGE PORTAL 〙══╗\n` +
                        `┃★ The void rift has sealed itself.\n` +
                        `┃★ No Prestige Hunters stepped through.\n` +
                        `╚═══════════════════════════╝`
                });
                console.log(`★ Prestige dungeon ${dungeonId} expired — no one entered.`);
            }
        } catch (e) {
            console.error('Prestige lobby timeout error:', e.message);
        }
        prestigeLobbyTimers.delete(dungeonId);
    }, closeDelay);

    prestigeLobbyTimers.set(dungeonId, { warning, timeout });
}

// ── WEIGHTED PRESTIGE RANK ───────────────────────────────
async function getWeightedPrestigeRank() {
    // FIX: Old system was player-count driven — if most players are F/E rank,
    // PF/PE spawned almost exclusively. Replaced with a flat base distribution
    // so every prestige rank spawns regularly, with a mild higher-tier bias.
    //
    // Target rough distribution:
    //   PF ~10%  PE ~12%  PD ~15%  PC ~18%  PB ~18%  PA ~15%  PS ~12%
    //
    // We still check which prestige players actually exist so we never spawn
    // a rank nobody can enter.

    const PRESTIGE_RANKS_ORDERED = ['PF', 'PE', 'PD', 'PC', 'PB', 'PA', 'PS'];

    // Base weights — flat-ish with mild upper-tier boost
    const BASE_WEIGHTS = {
        PF: 10, PE: 12, PD: 15, PC: 18, PB: 18, PA: 15, PS: 12
    };

    // Check which ranks actually have eligible prestige players
    // A player can enter a prestige dungeon of their equivalent rank or lower
    // (PF players can do PF, PE players can do PF+PE, etc.)
    let eligibleRanks = new Set(PRESTIGE_RANKS_ORDERED);
    try {
        const [rows] = await db.execute(
            "SELECT DISTINCT `rank` FROM players WHERE COALESCE(prestige_level,0) > 0"
        );
        if (rows.length) {
            // Find highest prestige rank in player base
            const RANK_TO_PRESTIGE = { F:'PF', E:'PE', D:'PD', C:'PC', B:'PB', A:'PA', S:'PS' };
            const playerPrestigeRanks = rows.map(r => RANK_TO_PRESTIGE[r.rank]).filter(Boolean);
            const highestIdx = Math.max(...playerPrestigeRanks.map(r => PRESTIGE_RANKS_ORDERED.indexOf(r)));
            // Only spawn ranks up to the highest rank players can actually enter
            eligibleRanks = new Set(PRESTIGE_RANKS_ORDERED.slice(0, highestIdx + 1));
        }
    } catch(e) {}

    // Build final weights from eligible ranks only
    const weights = {};
    let total = 0;
    for (const rank of PRESTIGE_RANKS_ORDERED) {
        if (eligibleRanks.has(rank)) {
            weights[rank] = BASE_WEIGHTS[rank] || 10;
            total += weights[rank];
        }
    }
    if (total === 0) return 'PF';

    const roll = Math.random() * total;
    let cumulative = 0;
    for (const rank of PRESTIGE_RANKS_ORDERED) {
        if (!weights[rank]) continue;
        cumulative += weights[rank];
        if (roll <= cumulative) return rank;
    }
    return 'PF';
}

async function spawnPrestigeEnemies(dungeonId, prestigeRank, stage) {
    const data = prestigeEnemies[prestigeRank];
    if (!data) return;

    const maxStage = MAX_STAGES[prestigeRank] || 3;
    const isBoss = stage === maxStage;

    let toSpawn = [];
    if (isBoss) {
        toSpawn = [{ ...data.boss }];
    } else {
        const RANK_ENEMY_COUNT = {
            PF: [2, 4], PE: [3, 5], PD: [3, 6],
            PC: [4, 7], PB: [5, 8], PA: [6, 9], PS: [7, 10]
        };
        const [minE, maxE] = RANK_ENEMY_COUNT[prestigeRank] || [1, 3];
        const count = Math.floor(Math.random() * (maxE - minE + 1)) + minE;
        for (let i = 0; i < count; i++) {
            const mini = data.miniBosses[Math.floor(Math.random() * data.miniBosses.length)];
            toSpawn.push({ ...mini });
        }
    }

    for (const e of toSpawn) {
        await db.execute(
            `INSERT INTO dungeon_enemies (dungeon_id, name, max_hp, current_hp, atk, def, exp, gold, evasion, moves)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dungeonId, e.name, e.hp, e.hp, e.atk, e.def,
             e.exp, e.gold, e.evasion || 0,
             JSON.stringify(e.moves || [])]
        );
    }
}

async function getPrestigeRankForPlayer(playerId) {
    const [rows] = await db.execute(
        "SELECT `rank`, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
        [playerId]
    );
    if (!rows.length) return null;
    return PRESTIGE_RANK_MAP[rows[0].rank] || 'PF';
}

async function spawnPrestigeDungeon(prestigeRank, client, RAID_GROUP) {
    const data = prestigeEnemies[prestigeRank];
    if (!data) return null;

    // Skip if any dungeon has active players inside
    try {
        const [activePlayers] = await db.execute(
            "SELECT COUNT(*) as cnt FROM dungeon_players dp JOIN dungeon d ON d.id=dp.dungeon_id WHERE d.is_active=1 AND dp.is_alive=1"
        );
        if (activePlayers[0].cnt > 0) {
            console.log('⏭️ Prestige spawn skipped — players still active in a dungeon');
            return null;
        }
    } catch(e) {}

    const maxStage = MAX_STAGES[prestigeRank] || 3;
    const bossName = PRESTIGE_BOSSES[prestigeRank];
    const maxRaiders = MAX_RAIDERS[prestigeRank] || 3;

    // Check no active prestige dungeon
    const [active] = await db.execute(
        "SELECT id FROM dungeon WHERE is_active=1 AND dungeon_rank LIKE 'P%' LIMIT 1"
    );
    if (active.length) return null;

    const [result] = await db.execute(
        `INSERT INTO dungeon (dungeon_rank, stage, max_stage, boss_name, is_active, stage_cleared, in_combat, locked)
         VALUES (?, 1, ?, ?, 1, 0, 0, 0)`,
        [prestigeRank, maxStage, bossName]
    );
    const dungeonId = result.insertId;

    const lorelines = {
        PF: 'The void left something behind when the Leviathan fell.',
        PE: 'The Fracture deepens. The ground between worlds grows thin.',
        PD: 'These creatures did not come from a Gate. They came from what was left.',
        PC: 'Malachar is not here yet. But his influence has been for centuries.',
        PB: 'The system cannot classify what comes next.',
        PA: "Malachar's heralds do not announce. They arrive.",
        PS: 'This is the end. Or the beginning of what comes after the end.'
    };

    const { tagAll } = require('../utils/tagAll');
    let mentions = [];
    try { const t = await tagAll(client); mentions = t.mentions || []; } catch(e) { console.log('★ tagAll failed:', e.message); }

    console.log('★ Sending prestige dungeon alert to:', RAID_GROUP);
    await client.sendMessage(RAID_GROUP, {
        text:
            `╔══〘 ✦ PRESTIGE DUNGEON 〙══╗\n` +
            `┃★ \n` +
            `┃★ 〝${lorelines[prestigeRank]}〞\n` +
            `┃★ \n` +
            `┃★────────────\n` +
            `┃★ Rank:       ${prestigeRank}\n` +
            `┃★ Stages:     ${maxStage}\n` +
            `┃★ Boss:       ${bossName}\n` +
            `┃★ Max Raiders: ${maxRaiders}\n` +
            `┃★ \n` +
            `┃★ ⚠️ Prestige Hunters only.\n` +
            `┃★ DM !enter to join.\n` +
            `┃★ ⏳ Portal closes in 10 minutes.\n` +
            `┃★ \n` +
            `╚═══════════════════════════╝`,
        mentions
    }).then(() => console.log('★ Prestige alert sent OK')).catch(e => console.error('★ Alert send failed:', e.message));

    // Start prestige lobby timer
    startPrestigeLobbyTimer(dungeonId, client, RAID_GROUP);

    return dungeonId;
}

// ── PUBLIC TRIGGER — called after any normal dungeon ends ──
// FIX: mutex flag prevents race condition when called from multiple paths simultaneously
async function trySpawnPrestigeDungeon(client, RAID_GROUP) {
    if (_prestigeSpawnInProgress) {
        console.log('★ trySpawnPrestigeDungeon: already in progress — skipping');
        return;
    }
    _prestigeSpawnInProgress = true;
    try {
        // Check if any prestige players exist
        const [prestigePlayers] = await db.execute(
            "SELECT COUNT(*) as cnt FROM players WHERE COALESCE(prestige_level,0) > 0"
        );
        if (!prestigePlayers[0]?.cnt) { console.log('★ No prestige players — skip spawn'); return; }

        // Check no prestige dungeon already active
        const [alreadyActive] = await db.execute(
            "SELECT id FROM dungeon WHERE is_active=1 AND dungeon_rank LIKE 'P%' LIMIT 1"
        );
        if (alreadyActive.length) { console.log('★ Prestige dungeon already active — skip spawn'); return; }

        // Don't spawn if a prestige dungeon ran in the last 25 minutes
        const [recentPrestige] = await db.execute(
            "SELECT id FROM dungeon WHERE dungeon_rank LIKE 'P%' AND created_at > DATE_SUB(NOW(), INTERVAL 25 MINUTE) LIMIT 1"
        );
        if (recentPrestige.length) { console.log('★ Prestige dungeon ran recently — skip auto spawn'); return; }

        // Short delay so normal dungeon closure messages settle first
        await new Promise(r => setTimeout(r, 3000));

        if (!RAID_GROUP) { console.error('★ trySpawnPrestigeDungeon: RAID_GROUP is undefined — set RAID_GROUP_JID env var'); return; }

        // Re-check after delay — another call may have spawned in the meantime
        const [doubleCheck] = await db.execute(
            "SELECT id FROM dungeon WHERE is_active=1 AND dungeon_rank LIKE 'P%' LIMIT 1"
        );
        if (doubleCheck.length) { console.log('★ Prestige dungeon spawned by another call during delay — skip'); return; }

        console.log('★ RAID_GROUP for prestige spawn:', RAID_GROUP);
        const prestigeRank = await getWeightedPrestigeRank();
        console.log(`★ Auto-spawning prestige dungeon rank ${prestigeRank}`);
        await spawnPrestigeDungeon(prestigeRank, client, RAID_GROUP);
        console.log('★ Prestige dungeon spawned successfully.');
    } catch (e) {
        console.error('★ trySpawnPrestigeDungeon error:', e.message);
        console.error(e.stack);
    } finally {
        _prestigeSpawnInProgress = false;
    }
}

module.exports = {
    spawnPrestigeDungeon,
    spawnPrestigeEnemies,
    getPrestigeRankForPlayer,
    getWeightedPrestigeRank,
    trySpawnPrestigeDungeon,
    startPrestigeLobbyTimer,
    clearPrestigeLobbyTimer,
    PRESTIGE_RANK_MAP,
    PRESTIGE_RANK_ORDER,
    MAX_STAGES,
    MAX_RAIDERS
};