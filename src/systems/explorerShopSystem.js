/**
 * EXPLORER SHOP SYSTEM
 * Data and logic for the Explorer shop.
 * Separated from the command file to avoid circular dependencies.
 */
const db = require('../database/db');

const SHOP_ITEMS = [
    { id: 1,  name: "Adventurer's Charm",  emoji: '🧿', desc: '+8% survival rate on next rift. One use.',                        price: 800,   effect: 'survival_boost',    value: 0.08, uses: 1, lore: 'A trinket sold at every market. Works more often than it should.' },
    { id: 2,  name: 'Void Lantern',         emoji: '🏮', desc: '+1 guaranteed extra material drop on next rift.',                  price: 1200,  effect: 'extra_drop',        value: 1,    uses: 1, lore: 'Light that sees what normal eyes miss in the dark.' },
    { id: 3,  name: "Explorer's Cloak",     emoji: '🧥', desc: '+12% survival rate for 3 rifts.',                                 price: 3000,  effect: 'survival_boost',    value: 0.12, uses: 3, lore: 'Woven from fabric recovered from rifts that should not have been survivable.' },
    { id: 4,  name: 'Rift Compass',         emoji: '🧭', desc: 'Guarantees at least 1 rare material drop on next rift.',          price: 2500,  effect: 'rare_guarantee',    value: 1,    uses: 1, lore: 'Points toward things worth finding. Not always safely.' },
    { id: 5,  name: "Wanderer's Token",     emoji: '🪙', desc: 'On death in a rift — survive as wounded instead. One use.',       price: 4000,  effect: 'death_to_wound',    value: 1,    uses: 1, lore: 'The Wanderer leaves these behind sometimes. Nobody knows why.' },
    { id: 6,  name: "Scholar's Tome",       emoji: '📚', desc: '+2 extra drops on next rift. Rare+ quality.',                     price: 5000,  effect: 'rare_extra_drops',  value: 2,    uses: 1, lore: 'Written in a language that did not exist until someone needed it.' },
    { id: 7,  name: 'Void Anchor',          emoji: '⚓', desc: 'Return from next rift at full HP regardless of wounds.',          price: 3500,  effect: 'no_wound',          value: 1,    uses: 1, lore: 'Keeps you tethered to yourself when the void tries to pull pieces away.' },
    { id: 8,  name: 'Deep Rift Map',        emoji: '🗺️', desc: '+20% survival rate in prestige rifts only. 2 uses.',             price: 8000,  effect: 'prestige_survival', value: 0.20, uses: 2, lore: 'Someone mapped the deep rifts. They did not come back to sell it in person.' },
    { id: 9,  name: 'Rift Extender',        emoji: '⏳', desc: 'Extends your return window from 2 hours to 4 hours.',             price: 1500,  effect: 'extend_timeout',    value: 1,    uses: 1, lore: 'Time inside the void does not move the same way. This corrects for that.' },
    { id: 10, name: 'Prestige Rift Pass',   emoji: '✦',  desc: 'Prestige only — guaranteed Malachar Fragment on next rift.',      price: 15000, effect: 'fragment_guarantee',value: 1,    uses: 1, prestige: true, lore: 'The fragments respond to this. Nobody is sure why they respond at all.' }
];

async function ensureShopTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS explorer_inventory (
            player_id   VARCHAR(50) NOT NULL,
            item_id     INT NOT NULL,
            item_name   VARCHAR(100) NOT NULL,
            uses_left   INT DEFAULT 1,
            PRIMARY KEY (player_id, item_id)
        )
    `).catch(() => {});
}

async function getExplorerItems(playerId) {
    await ensureShopTables();
    const [rows] = await db.execute(
        "SELECT item_id, item_name, uses_left FROM explorer_inventory WHERE player_id=? AND uses_left > 0",
        [playerId]
    );
    return rows;
}

async function consumeShopItem(playerId, itemId) {
    await db.execute(
        "UPDATE explorer_inventory SET uses_left = uses_left - 1 WHERE player_id=? AND item_id=?",
        [playerId, itemId]
    );
}

module.exports = { SHOP_ITEMS, ensureShopTables, getExplorerItems, consumeShopItem };