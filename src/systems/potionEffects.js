/**
 * ACTIVE POTION EFFECTS
 * In-memory store of active potion effects per player per dungeon.
 * Effects are checked during skill use and combat resolution.
 *
 * FIX: previously each player could only hold ONE active effect at a time —
 * drinking a second potion silently overwrote the first. Now each player
 * can hold multiple simultaneous effects, keyed by effect name, so drinking
 * Berserk then Immunity keeps BOTH active instead of losing Berserk.
 */

const db = require('../database/db');

// activeEffects: Map<playerId, Map<effectName, { potionName, effect, data, dungeonId, charges }>>
const activeEffects = new Map();

function setEffect(playerId, dungeonId, potionName, effect, data = {}, charges = null) {
    if (!activeEffects.has(playerId)) activeEffects.set(playerId, new Map());
    activeEffects.get(playerId).set(effect, { potionName, effect, data, dungeonId, charges });
}

// getEffect — backward compatible single-effect getter.
// Returns the most recently set effect matching dungeonId (or any if dungeonId is null/undefined).
// For checking a SPECIFIC effect type while others may also be active, use getEffectByName.
function getEffect(playerId, dungeonId) {
    const playerMap = activeEffects.get(playerId);
    if (!playerMap || playerMap.size === 0) return null;
    let fallback = null;
    for (const e of playerMap.values()) {
        if (dungeonId == null || e.dungeonId === dungeonId) fallback = e;
    }
    return fallback;
}

// getEffectByName — look up one specific effect type regardless of what else is active
function getEffectByName(playerId, effectName, dungeonId) {
    const playerMap = activeEffects.get(playerId);
    if (!playerMap) return null;
    const e = playerMap.get(effectName);
    if (!e) return null;
    if (dungeonId != null && e.dungeonId !== dungeonId) return null;
    return e;
}

// getAllEffects — every active effect for a player (optionally filtered by dungeon)
function getAllEffects(playerId, dungeonId) {
    const playerMap = activeEffects.get(playerId);
    if (!playerMap) return [];
    const all = [...playerMap.values()];
    return dungeonId == null ? all : all.filter(e => e.dungeonId === dungeonId);
}

function clearEffect(playerId, effectName) {
    if (effectName) {
        const playerMap = activeEffects.get(playerId);
        if (playerMap) playerMap.delete(effectName);
    } else {
        activeEffects.delete(playerId); // clear everything (legacy behavior)
    }
}

function consumeCharge(playerId, effectName) {
    const playerMap = activeEffects.get(playerId);
    if (!playerMap) return;
    if (effectName) {
        const e = playerMap.get(effectName);
        if (!e || e.charges === null) return;
        e.charges--;
        if (e.charges <= 0) playerMap.delete(effectName);
        return;
    }
    for (const [name, e] of playerMap.entries()) {
        if (e.charges !== null) {
            e.charges--;
            if (e.charges <= 0) playerMap.delete(name);
            return;
        }
    }
}

// ── Turn-based effects ────────────────────────────────────────────────────────
// turnEffects: Map<playerId, Map<effectName, { effect, turnsLeft, data }>>
const turnEffects = new Map();

function setTurnEffect(playerId, effect, turns, data = {}) {
    if (!turnEffects.has(playerId)) turnEffects.set(playerId, new Map());
    turnEffects.get(playerId).set(effect, { effect, turnsLeft: turns, data });
}

function getTurnEffect(playerId) {
    const playerMap = turnEffects.get(playerId);
    if (!playerMap || playerMap.size === 0) return null;
    let last = null;
    for (const e of playerMap.values()) last = e;
    return last;
}

function getTurnEffectByName(playerId, effectName) {
    const playerMap = turnEffects.get(playerId);
    if (!playerMap) return null;
    return playerMap.get(effectName) || null;
}

function getAllTurnEffects(playerId) {
    const playerMap = turnEffects.get(playerId);
    if (!playerMap) return [];
    return [...playerMap.values()];
}

function tickTurnEffect(playerId, effectName) {
    const playerMap = turnEffects.get(playerId);
    if (!playerMap) return null;
    if (effectName) {
        const e = playerMap.get(effectName);
        if (!e) return null;
        e.turnsLeft--;
        if (e.turnsLeft <= 0) playerMap.delete(effectName);
        return e;
    }
    let lastTicked = null;
    for (const [name, e] of [...playerMap.entries()]) {
        e.turnsLeft--;
        lastTicked = e;
        if (e.turnsLeft <= 0) playerMap.delete(name);
    }
    return lastTicked;
}

// Death tracker per dungeon: playerId -> { dungeonId, deaths }
const deathTracker = new Map();

function trackDeath(playerId, dungeonId) {
    const key = `${playerId}:${dungeonId}`;
    const current = deathTracker.get(key) || 0;
    deathTracker.set(key, current + 1);
}

function getDeaths(playerId, dungeonId) {
    return deathTracker.get(`${playerId}:${dungeonId}`) || 0;
}

// HP lost tracker: playerId -> { dungeonId, hpLost }
const hpLostTracker = new Map();

function trackHpLost(playerId, dungeonId, amount) {
    const key = `${playerId}:${dungeonId}`;
    const current = hpLostTracker.get(key) || 0;
    hpLostTracker.set(key, current + amount);
}

function getHpLost(playerId, dungeonId) {
    return hpLostTracker.get(`${playerId}:${dungeonId}`) || 0;
}

module.exports = {
    setEffect, getEffect, getEffectByName, getAllEffects, clearEffect, consumeCharge,
    setTurnEffect, getTurnEffect, getTurnEffectByName, getAllTurnEffects, tickTurnEffect,
    trackDeath, getDeaths, trackHpLost, getHpLost,
    activeEffects, turnEffects
};