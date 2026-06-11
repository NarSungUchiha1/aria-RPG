/**
 * ACTIVE POTION EFFECTS
 * In-memory store of active potion effects per player per dungeon.
 * Effects are checked during skill use and combat resolution.
 */

const db = require('../database/db');

// activeEffects: Map<playerId, { potionName, effect, data, dungeonId, expiresAt, charges }>
const activeEffects = new Map();

function setEffect(playerId, dungeonId, potionName, effect, data = {}, charges = null) {
    activeEffects.set(playerId, { potionName, effect, data, dungeonId, charges });
}

function getEffect(playerId, dungeonId) {
    const e = activeEffects.get(playerId);
    if (!e) return null;
    if (e.dungeonId !== dungeonId) return null;
    return e;
}

function clearEffect(playerId) {
    activeEffects.delete(playerId);
}

function consumeCharge(playerId) {
    const e = activeEffects.get(playerId);
    if (!e || e.charges === null) return;
    e.charges--;
    if (e.charges <= 0) activeEffects.delete(playerId);
}

// Turn-based effects: decremented each skill use
const turnEffects = new Map(); // playerId -> { effect, turnsLeft, data }

function setTurnEffect(playerId, effect, turns, data = {}) {
    turnEffects.set(playerId, { effect, turnsLeft: turns, data });
}

function getTurnEffect(playerId) {
    return turnEffects.get(playerId) || null;
}

function tickTurnEffect(playerId) {
    const e = turnEffects.get(playerId);
    if (!e) return null;
    e.turnsLeft--;
    if (e.turnsLeft <= 0) turnEffects.delete(playerId);
    return e;
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
    setEffect, getEffect, clearEffect, consumeCharge,
    setTurnEffect, getTurnEffect, tickTurnEffect,
    trackDeath, getDeaths, trackHpLost, getHpLost,
    activeEffects, turnEffects
};