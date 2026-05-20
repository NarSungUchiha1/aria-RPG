/**
 * MALACHAR PHASE SYSTEM
 *
 * Tracks HP thresholds and triggers ATK escalation + cinematic announcements.
 * Modelled after the Leviathan battle state pattern.
 *
 * Phases:
 *  >75%  — Phase 1  (×1.0)  "He watches. Not yet committed."
 *  ≤75%  — Phase 2  (×1.5)  "He sees you now. He is deciding."
 *  ≤50%  — Phase 3  (×2.2)  "He has decided. You are not enough."
 *  ≤25%  — Phase 4  (×3.5)  "He has decided. You are not enough." (escalated)
 *  ≤5%   — Full Void (×3.5) "This is what he was holding back."
 */

const db = require('../database/db');
const { sendWithRetry } = require('../utils/sendWithRetry');

// Phase definitions — ordered from highest threshold to lowest
const PHASES = [
    {
        id:          'phase1',
        threshold:   0.75,
        multiplier:  1.0,
        label:       'PHASE 1',
        emoji:       '👁️',
        quote:       'He watches. Not yet committed.',
        color:       '⬜',
    },
    {
        id:          'phase2',
        threshold:   0.50,
        multiplier:  1.5,
        label:       'PHASE 2',
        emoji:       '🟠',
        quote:       'He sees you now. He is deciding.',
        color:       '🟧',
    },
    {
        id:          'phase3',
        threshold:   0.25,
        multiplier:  2.2,
        label:       'PHASE 3',
        emoji:       '🔴',
        quote:       'He has decided. You are not enough.',
        color:       '🟥',
    },
    {
        id:          'fullvoid',
        threshold:   0.05,
        multiplier:  3.5,
        label:       'FULL VOID',
        emoji:       '🌑',
        quote:       'This is what he was holding back.',
        color:       '⬛',
    },
];

// In-memory state keyed by dungeonId (string)
// { baseAtk, maxHp, enemyId, currentPhaseIndex, announcedIds: Set }
const phaseState = new Map();

// ── HP BAR ────────────────────────────────────────────────────────────────────
function buildHpBar(current, max, segments = 14) {
    const pct = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(pct * segments);
    const bar = '🟥'.repeat(filled) + '⬛'.repeat(segments - filled);
    const pctStr = (pct * 100).toFixed(1);
    return { bar, pctStr };
}

// ── INIT ──────────────────────────────────────────────────────────────────────
async function initMalacharPhase(dungeonId) {
    try {
        const key = String(dungeonId);
        const [rows] = await db.execute(
            "SELECT id, atk, max_hp FROM dungeon_enemies WHERE dungeon_id=? AND name='Malachar' LIMIT 1",
            [dungeonId]
        );
        if (!rows.length) {
            console.warn('[MalacharPhase] Malachar enemy not found for dungeon', dungeonId);
            return;
        }
        phaseState.set(key, {
            baseAtk:          rows[0].atk,
            maxHp:            rows[0].max_hp,
            enemyId:          rows[0].id,
            currentPhaseIdx:  -1,        // nothing announced yet
            announcedIds:     new Set(),
        });
        console.log(`[MalacharPhase] Initialised for dungeon ${dungeonId} — base ATK: ${rows[0].atk}, max HP: ${rows[0].max_hp}`);
    } catch(e) {
        console.error('[MalacharPhase] initMalacharPhase error:', e.message);
    }
}

// ── CLEAR ─────────────────────────────────────────────────────────────────────
function clearMalacharPhase(dungeonId) {
    phaseState.delete(String(dungeonId));
}

// ── PHASE CHECK (call this after every hit on Malachar) ───────────────────────
async function checkPhaseTransition(dungeonId, currentHp, client, RAID_GROUP) {
    try {
        const key   = String(dungeonId);
        const state = phaseState.get(key);
        if (!state) return;

        const pct = currentHp / state.maxHp;
        const { bar, pctStr } = buildHpBar(currentHp, state.maxHp);

        // Walk phases from lowest threshold upward — pick the deepest one triggered
        for (let i = PHASES.length - 1; i >= 0; i--) {
            const phase = PHASES[i];
            if (pct <= phase.threshold && !state.announcedIds.has(phase.id)) {
                state.announcedIds.add(phase.id);
                state.currentPhaseIdx = i;

                // Scale ATK in DB
                const newAtk = Math.round(state.baseAtk * phase.multiplier);
                await db.execute(
                    "UPDATE dungeon_enemies SET atk=? WHERE id=?",
                    [newAtk, state.enemyId]
                ).catch(() => {});

                // Announce to raid group
                await sendWithRetry(client, RAID_GROUP, {
                    text:
                        `╔══〘 ${phase.emoji} MALACHAR — ${phase.label} 〙══╗\n` +
                        `┃★\n` +
                        `┃★  〝 ${phase.quote} 〞\n` +
                        `┃★\n` +
                        `┃★  ⚔️  ATK ×${phase.multiplier}  (${Math.round((phase.multiplier - 1) * 100)}% increase)\n` +
                        `┃★\n` +
                        `┃★  🩸 Malachar HP\n` +
                        `┃★  ${bar}\n` +
                        `┃★  ${pctStr}% remaining\n` +
                        `┃★\n` +
                        `╚════════════════════════════╝`
                }).catch(() => {});

                // Only announce the deepest newly crossed threshold per hit
                break;
            }
        }
    } catch(e) {
        console.error('[MalacharPhase] checkPhaseTransition error:', e.message);
    }
}

// ── HP BAR ONLY (for !dungeon status display) ─────────────────────────────────
function getMalacharHpBar(dungeonId, currentHp) {
    const state = phaseState.get(String(dungeonId));
    if (!state) return null;
    const { bar, pctStr } = buildHpBar(currentHp, state.maxHp);
    const phaseIdx = state.currentPhaseIdx;
    const phaseName = phaseIdx >= 0 ? PHASES[phaseIdx].label : 'PHASE 1';
    return { bar, pctStr, phaseName };
}

function getCurrentMultiplier(dungeonId) {
    const state = phaseState.get(String(dungeonId));
    if (!state || state.currentPhaseIdx < 0) return 1.0;
    return PHASES[state.currentPhaseIdx].multiplier;
}

module.exports = {
    initMalacharPhase,
    clearMalacharPhase,
    checkPhaseTransition,
    getMalacharHpBar,
    getCurrentMultiplier,
    PHASES,
};