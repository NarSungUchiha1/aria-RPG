const timers = new Map(); // dungeonId -> { stageTimeout, stageWarning, overallTimeout, overallWarning }

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
 * @param {number} dungeonId
 * @param {object} client - WhatsApp client
 * @param {object} targetChat - Chat to send messages
 * @param {function} onFail - Callback when any timer expires
 */
function startDungeonTimers(dungeonId, client, targetChat, onFail) {
    clearDungeonTimers(dungeonId);
    
    // ----- Stage Timer (5 min, warn at 3 min) -----
    const stageWarning = setTimeout(async () => {
        try {
            await targetChat.sendMessage(
                `══〘 ⏳ STAGE WARNING 〙══╮\n┃◆ The enemies are calling for reinforcements!\n┃◆ You have 2 minutes left to clear this stage.\n╰═══════════════════════╯`
            );
        } catch (e) {}
    }, 180000); // 3 minutes
    
    const stageTimeout = setTimeout(async () => {
        try {
            await onFail('stage');
        } catch (e) {}
    }, 300000); // 5 minutes
    
    // ----- Overall Timer (30 min, warn at 25 min) -----
    const overallWarning = setTimeout(async () => {
        try {
            await targetChat.sendMessage(
                `══〘 ⏳ DUNGEON WARNING 〙══╮\n┃◆ The dungeon's energy is fading!\n┃◆ You have 5 minutes before it collapses.\n╰═══════════════════════╯`
            );
        } catch (e) {}
    }, 1500000); // 25 minutes = 25 * 60 * 1000
    
    const overallTimeout = setTimeout(async () => {
        try {
            await onFail('overall');
        } catch (e) {}
    }, 1800000); // 30 minutes = 30 * 60 * 1000
    
    timers.set(dungeonId, { stageTimeout, stageWarning, overallTimeout, overallWarning });
}

/**
 * Reset only the stage timer (call on stage advance). Overall timer keeps running.
 */
function resetStageTimer(dungeonId, client, targetChat, onFail) {
    const entry = timers.get(dungeonId);
    if (!entry) return;
    
    // Clear old stage timers
    clearTimeout(entry.stageTimeout);
    clearTimeout(entry.stageWarning);
    
    // Create new stage timers
    const stageWarning = setTimeout(async () => {
        try {
            await targetChat.sendMessage(
                `══〘 ⏳ STAGE WARNING 〙══╮\n┃◆ The enemies are calling for reinforcements!\n┃◆ You have 2 minutes left to clear this stage.\n╰═══════════════════════╯`
            );
        } catch (e) {}
    }, 180000);
    
    const stageTimeout = setTimeout(async () => {
        try {
            await onFail('stage');
        } catch (e) {}
    }, 300000);
    
    // Update entry
    entry.stageWarning = stageWarning;
    entry.stageTimeout = stageTimeout;
    timers.set(dungeonId, entry);
}

module.exports = {
    startDungeonTimers,
    resetStageTimer,
    clearDungeonTimers
};