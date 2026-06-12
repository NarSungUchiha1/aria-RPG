/**
 * raidContext.js — Per-execution raid group context
 *
 * Replaces global.overrideRaidGroup with AsyncLocalStorage so test GC
 * and live GC commands run fully in parallel without sharing state.
 *
 * Usage in index.js:
 *   const { runWithGroup } = require('./src/utils/raidContext');
 *   await runWithGroup(groupJid, () => command.execute(...));
 *
 * Usage in any command/system (drop-in replacement for the inline pattern):
 *   const { getRaidGroup } = require('../utils/raidContext');
 *
 * Existing inline pattern still works too — global.overrideRaidGroup is
 * overridden as a getter that reads from AsyncLocalStorage, so every file
 * that does `global.overrideRaidGroup || process.env.RAID_GROUP_JID`
 * automatically gets the correct per-execution value with zero changes.
 */

const { AsyncLocalStorage } = require('async_hooks');

const storage = new AsyncLocalStorage();

const LIVE_RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

// Override global.overrideRaidGroup as a getter backed by AsyncLocalStorage.
// Every existing file that reads `global.overrideRaidGroup` now gets the
// per-execution value automatically — no changes needed anywhere else.
Object.defineProperty(global, 'overrideRaidGroup', {
    get() {
        return storage.getStore()?.groupJid || null;
    },
    set(val) {
        // Legacy testmode.js may still write to this — silently ignore.
        // The real value is set via runWithGroup().
    },
    configurable: true
});

/**
 * Run fn() inside a context where getRaidGroup() returns groupJid.
 * Everything called from fn() — including async chains — sees the same value.
 */
function runWithGroup(groupJid, fn) {
    return storage.run({ groupJid }, fn);
}

/**
 * Get the raid group for the current execution context.
 * Falls back to live raid group if called outside a runWithGroup() context.
 */
function getRaidGroup() {
    return storage.getStore()?.groupJid || LIVE_RAID_GROUP;
}

module.exports = { runWithGroup, getRaidGroup };
