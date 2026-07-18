// dungeonId -> { stageTimeout, stageWarning, overallTimeout, overallWarning }
const timers = new Map();

// ── ALL prestige ranks get 7-min stage timer, no overall limit ───────────────
const HIGH_PRESTIGE = new Set(['PF','PE','PD','PC','PB','PA','PS']);

// ── TIMING CONFIG ─────────────────────────────────────────

// Normal dungeons
const STAGE_WARN_MS    = 3  * 60 * 1000;  // 3 min  → warning
const STAGE_LIMIT_MS   = 5  * 60 * 1000;  // 5 min  → stage fails
const OVERALL_WARN_MS  = 20 * 60 * 1000;  // 20 min → warning
const OVERALL_LIMIT_MS = 25 * 60 * 1000;  // 25 min → collapse

// Prestige dungeons (PF → PS)
const HP_STAGE_WARN_MS  = 5 * 60 * 1000;  // 5 min → warning
const HP_STAGE_LIMIT_MS = 7 * 60 * 1000;  // 7 min → stage fail

// the Hollow King has NO timers
// ─────────────────────────────────────────────────────────

function clearDungeonTimers(dungeonId) {
    const entry = timers.get(dungeonId);

    if (entry) {
        clearTimeout(entry.stageTimeout);
        clearTimeout(entry.stageWarning);
        clearTimeout(entry.overallTimeout);
        clearTimeout(entry.overallWarning);

        timers.delete(dungeonId);
    }
}

function startDungeonTimers(dungeonId, client, targetChat, onFail, dungeonRank) {

    clearDungeonTimers(dungeonId);

    const isHP = HIGH_PRESTIGE.has(dungeonRank);
    const isHollowKing = dungeonRank === 'MALACHAR';

    // ── MALACHAR: NO TIMERS ──────────────────────────────
    if (isHollowKing) {
        timers.set(dungeonId, {
            stageTimeout: null,
            stageWarning: null,
            overallTimeout: null,
            overallWarning: null
        });

        return;
    }

    const warnMs  = isHP ? HP_STAGE_WARN_MS  : STAGE_WARN_MS;
    const limitMs = isHP ? HP_STAGE_LIMIT_MS : STAGE_LIMIT_MS;

    // ── STAGE WARNING ────────────────────────────────────

    const stageWarning = setTimeout(async () => {
        try {
            await targetChat.sendMessage(
                `══〘 ⏳ STAGE WARNING 〙══╮\n` +
                `┃◆ The enemies are calling for reinforcements!\n` +
                `┃◆ ⚠️ 2 minutes left to clear this stage.\n` +
                `┃◆ Fail = instant death for ALL raiders.\n` +
                `┃◆ Use !dungeon to see remaining enemies.\n` +
                `╰═══════════════════════╯`
            );
        } catch (e) {
            console.error('Stage warning error:', e.message);
        }
    }, warnMs);

    // ── STAGE FAILURE ────────────────────────────────────

    const stageTimeout = setTimeout(async () => {
        try {
            await onFail('stage');
        } catch (e) {
            console.error('Stage timeout error:', e.message);
        }
    }, limitMs);

    // ── OVERALL DUNGEON TIMERS (NORMAL ONLY) ────────────

    let overallWarning = null;
    let overallTimeout = null;

    if (!isHP) {

        overallWarning = setTimeout(async () => {
            try {
                await targetChat.sendMessage(
                    `══〘 ⏳ DUNGEON COLLAPSING 〙══╮\n` +
                    `┃◆ The dungeon's energy is destabilizing!\n` +
                    `┃◆ ⚠️ 5 minutes before total collapse.\n` +
                    `┃◆ Fail = instant death + dungeon lost.\n` +
                    `┃◆ Push through — clear remaining stages!\n` +
                    `╰═══════════════════════╯`
                );
            } catch (e) {
                console.error('Overall warning error:', e.message);
            }
        }, OVERALL_WARN_MS);

        overallTimeout = setTimeout(async () => {
            try {
                await onFail('overall');
            } catch (e) {
                console.error('Overall timeout error:', e.message);
            }
        }, OVERALL_LIMIT_MS);
    }

    timers.set(dungeonId, {
        stageTimeout,
        stageWarning,
        overallTimeout,
        overallWarning
    });
}

function resetStageTimer(dungeonId, client, targetChat, onFail, dungeonRank) {

    const entry = timers.get(dungeonId);

    if (!entry) return;

    const isHP = HIGH_PRESTIGE.has(dungeonRank);
    const isHollowKing = dungeonRank === 'MALACHAR';

    // ── MALACHAR NEVER RESETS TIMERS ────────────────────
    if (isHollowKing) return;

    clearTimeout(entry.stageTimeout);
    clearTimeout(entry.stageWarning);

    const warnMs  = isHP ? HP_STAGE_WARN_MS  : STAGE_WARN_MS;
    const limitMs = isHP ? HP_STAGE_LIMIT_MS : STAGE_LIMIT_MS;

    const stageWarning = setTimeout(async () => {
        try {
            await targetChat.sendMessage(
                `══〘 ⏳ STAGE WARNING 〙══╮\n` +
                `┃◆ The enemies are calling for reinforcements!\n` +
                `┃◆ ⚠️ 2 minutes left to clear this stage.\n` +
                `┃◆ Fail = instant death for ALL raiders.\n` +
                `┃◆ Use !dungeon to see remaining enemies.\n` +
                `╰═══════════════════════╯`
            );
        } catch (e) {
            console.error('Stage warning reset error:', e.message);
        }
    }, warnMs);

    const stageTimeout = setTimeout(async () => {
        try {
            await onFail('stage');
        } catch (e) {
            console.error('Stage timeout reset error:', e.message);
        }
    }, limitMs);

    entry.stageWarning = stageWarning;
    entry.stageTimeout = stageTimeout;

    timers.set(dungeonId, entry);
}

module.exports = {
    startDungeonTimers,
    resetStageTimer,
    clearDungeonTimers
};