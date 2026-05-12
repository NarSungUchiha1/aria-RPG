// dungeonId -> { stageTimeout, stageWarning, overallTimeout, overallWarning }
const timers = new Map();

// ── HIGH PRESTIGE ranks — 10-min stage, no overall limit ─────────────────────
const HIGH_PRESTIGE = new Set(['PA', 'PB', 'PS']);

// ── TIMING CONFIG ─────────────────────────────────────────
// Normal dungeons
const STAGE_WARN_MS    = 3  * 60 * 1000;  //  3 min  → warning (2 min left)
const STAGE_LIMIT_MS   = 5  * 60 * 1000;  //  5 min  → stage fails
const OVERALL_WARN_MS  = 20 * 60 * 1000;  // 20 min  → warning (5 min left)
const OVERALL_LIMIT_MS = 25 * 60 * 1000;  // 25 min  → dungeon collapses

// PA / PB / PS dungeons
const HP_STAGE_WARN_MS  = 8  * 60 * 1000; //  8 min  → warning (2 min left)
const HP_STAGE_LIMIT_MS = 10 * 60 * 1000; // 10 min  → stage fails
// No overall limit for high prestige
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

    const warnMs  = isHP ? HP_STAGE_WARN_MS  : STAGE_WARN_MS;
    const limitMs = isHP ? HP_STAGE_LIMIT_MS : STAGE_LIMIT_MS;
    const warnMin = isHP ? 2 : 2;
    const limitMin = isHP ? 10 : 5;

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
    }, warnMs);

    const stageTimeout = setTimeout(async () => {
        try { await onFail('stage'); } catch (e) {}
    }, limitMs);

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
            } catch (e) {}
        }, OVERALL_WARN_MS);

        overallTimeout = setTimeout(async () => {
            try { await onFail('overall'); } catch (e) {}
        }, OVERALL_LIMIT_MS);
    }

    timers.set(dungeonId, { stageTimeout, stageWarning, overallTimeout, overallWarning });
}

function resetStageTimer(dungeonId, client, targetChat, onFail, dungeonRank) {
    const entry = timers.get(dungeonId);
    if (!entry) return;

    clearTimeout(entry.stageTimeout);
    clearTimeout(entry.stageWarning);

    const isHP    = HIGH_PRESTIGE.has(dungeonRank);
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
        } catch (e) {}
    }, warnMs);

    const stageTimeout = setTimeout(async () => {
        try { await onFail('stage'); } catch (e) {}
    }, limitMs);

    entry.stageWarning = stageWarning;
    entry.stageTimeout = stageTimeout;
    timers.set(dungeonId, entry);
}

module.exports = { startDungeonTimers, resetStageTimer, clearDungeonTimers };