/**
 * THE WANDERER
 * A mysterious NPC that appears randomly in the Exploration GC.
 * Offers 1 rare trade. Players have 30 minutes to accept.
 * Admin can spawn manually with !spawnwanderer.
 */
const db = require('../database/db');

const WANDERER_WINDOW = 30 * 60 * 1000; // 30 minutes

const WANDERER_TRADES = [
    { give: { 'Healing Moss': 5, 'Root Extract': 3 }, receive: 'Void Crystal', receiveQty: 1, desc: 'Common herbs for a void crystal.' },
    { give: { 'Spell Component': 3, 'Void Ink': 2 }, receive: 'Ancient Tome Fragment', receiveQty: 1, desc: 'Spell components for a tome fragment.' },
    { give: { 'Shadow Fragment': 4, 'Void Water': 2 }, receive: 'Shadow Essence', receiveQty: 2, desc: 'Shadow fragments refined into essence.' },
    { give: { 'Life Essence': 3, 'Ancient Herb': 3 }, receive: 'Blood Root', receiveQty: 2, desc: 'Life essence traded for blood root.' },
    { give: { 'Void Crystal': 2, 'Ancient Herb': 2 }, receive: 'Malachar Fragment', receiveQty: 1, desc: 'Two void crystals. A fragment of something older.' },
    { give: { 'Blood Root': 3, 'Shadow Essence': 2 }, receive: 'Ancient Tome Fragment', receiveQty: 2, desc: 'He does not say where he got these.' },
    { give: { 'Healing Moss': 8, 'Life Essence': 4 }, receive: 'Void Crystal', receiveQty: 3, desc: 'A bulk offer. The Wanderer is generous today.' },
    { give: { 'Void Ink': 3, 'Spell Component': 3 }, receive: 'Malachar Fragment', receiveQty: 1, desc: 'He looks at you for a long time before agreeing.' }
];

const WANDERER_APPEARANCES = [
    '〝A hooded figure steps through a rift that should not be open.\nHe says nothing. He simply shows you what he has.〞',
    '〝The Wanderer does not knock. He is simply there.\nHe has been here before. You do not remember it.〞',
    '〝He trades in things the System does not classify.\nHe has been doing this longer than the Gates have existed.〞',
    '〝He holds something out. No words.\nThe void recognises him. It steps aside.〞'
];

let activeWanderer = null; // { tradeIndex, expiresAt, accepted: Set }

async function ensureWandererTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS wanderer_trades (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            trade_index  INT NOT NULL,
            appeared_at  DATETIME DEFAULT NOW(),
            expires_at   DATETIME NOT NULL,
            is_active    TINYINT DEFAULT 1
        )
    `).catch(() => {});
}

function getActiveWanderer() { return activeWanderer; }

function spawnWandererInMemory() {
    const tradeIndex = Math.floor(Math.random() * WANDERER_TRADES.length);
    activeWanderer = {
        tradeIndex,
        expiresAt: Date.now() + WANDERER_WINDOW,
        accepted: new Set()
    };
    setTimeout(() => { activeWanderer = null; }, WANDERER_WINDOW);
    return tradeIndex;
}

async function spawnWanderer(client, EXPLORATION_GC) {
    const tradeIndex = spawnWandererInMemory();
    const trade      = WANDERER_TRADES[tradeIndex];
    const appearance = WANDERER_APPEARANCES[Math.floor(Math.random() * WANDERER_APPEARANCES.length)];

    const giveList = Object.entries(trade.give).map(([m,q]) => `${m}×${q}`).join(', ');

    const msg =
        `╔══〘 👤 THE WANDERER 〙══╗\n` +
        `┃◆\n` +
        `┃◆ ${appearance}\n` +
        `┃◆\n` +
        `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
        `┃◆ HIS OFFER:\n` +
        `┃◆ Give: ${giveList}\n` +
        `┃◆ Receive: ${trade.receive} ×${trade.receiveQty}\n` +
        `┃◆\n` +
        `┃◆ 〝${trade.desc}〞\n` +
        `┃◆\n` +
        `┃◆ !wanderertrade — accept the offer\n` +
        `┃◆ ⏳ 30 minutes. Then he leaves.\n` +
        `╚═══════════════════════════╝`;

    if (client && EXPLORATION_GC) await client.sendMessage(EXPLORATION_GC, { text: msg }).catch(() => {});
    return trade;
}

module.exports = {
    WANDERER_TRADES,
    getActiveWanderer,
    spawnWanderer,
    spawnWandererInMemory,
    ensureWandererTable
};