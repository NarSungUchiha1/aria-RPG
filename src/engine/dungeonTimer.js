// dungeonId -> { stageTimeout, stageWarning, overallTimeout, overallWarning }
const timers = new Map();

// ── TIMING CONFIG ────────────────────────────────────────
const STAGE_WARN_MS    = 3  * 60 * 1000;  //  3 min  → warning fires (2 min left)
const STAGE_LIMIT_MS   = 5  * 60 * 1000;  //  5 min  → stage fails
const OVERALL_WARN_MS  = 20 * 60 * 1000;  // 20 min  → warning fires (5 min left)
const OVERALL_LIMIT_MS = 25 * 60 * 1000;  // 25 min  → dungeon collapses
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

/**
 * Start both stage timer and overall timer (called when dungeon begins).
 * @param {number}   dungeonId
 * @param {object}   client      - Baileys socket
 * @param {object}   targetChat  - Chat to send messages to (the dungeon GC)
 * @param {function} onFail      - Callback(type) when any timer expires
 */
function startDungeonTimers(dungeonId, client, targetChat, onFail) {
    clearDungeonTimers(dungeonId);

    // ── Stage Warning (3 min in → 2 min left) ──────────────
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
        } catch (e) {}
    }, STAGE_WARN_MS);

    // ── Stage Timeout (5 min) ──────────────────────────────
    const stageTimeout = setTimeout(async () => {
        try { await onFail('stage'); } catch (e) {}
    }, STAGE_LIMIT_MS);

    // ── Overall Warning (20 min in → 5 min left) ──────────
    const overallWarning = setTimeout(async () => {
        try {
            await targetChat.sendMessage(
                `══〘 ⏳ DUNGEON COLLAPSING 〙══╮\n` +
                `┃◆ The dungeon's energy is destabilizing!\n` +
                `┃◆ ⚠️ 5 minutes before total collapse.\n` +
                `┃◆ Fail = instant death + dungeon lost.\n` +
                `┃◆ Push through — clear remaining stages!\n` +
                `╰═══════════════════════╯`
            );
        } catch (e) {}
    }, OVERALL_WARN_MS);

    // ── Overall Timeout (25 min) ───────────────────────────
    const overallTimeout = setTimeout(async () => {
        try { await onFail('overall'); } catch (e) {}
    }, OVERALL_LIMIT_MS);

    timers.set(dungeonId, { stageTimeout, stageWarning, overallTimeout, overallWarning });
}

/**
 * Reset only the stage timer when advancing a stage.
 * Overall timer keeps running from where it started.
 */
function resetStageTimer(dungeonId, client, targetChat, onFail) {
    const entry = timers.get(dungeonId);
    if (!entry) return;

    clearTimeout(entry.stageTimeout);
    clearTimeout(entry.stageWarning);

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
        } catch (e) {}
    }, STAGE_WARN_MS);

    const stageTimeout = setTimeout(async () => {
        try { await onFail('stage'); } catch (e) {}
    }, STAGE_LIMIT_MS);

    entry.stageWarning = stageWarning;
    entry.stageTimeout = stageTimeout;
    timers.set(dungeonId, entry);
}

module.exports = {
    startDungeonTimers,
    resetStageTimer,
    clearDungeonTimers
};