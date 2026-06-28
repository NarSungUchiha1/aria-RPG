const db = require('../database/db');

const STACKABLE_TYPES = new Set(['potion', 'consumable', 'material', 'scroll', 'charm']);
const CONSUMABLES = new Set([
    'Potion', 'Mana Potion', 'Fortify Potion', 'Rage Potion', 'Eagle Eye Potion', 'Cleanse Potion',
    'Revive Scroll', 'Fire Scroll', 'Backstab Scroll', 'Taunt Scroll', 'War Cry Scroll',
    'Poison Vial', 'Smoke Bomb', 'Herb Kit', 'Holy Water', 'Elixir',
    'Blood Charm', 'Blessing Charm', 'Arrow Bundle', 'Trap Kit', 'Divine Protection',
]);

function isStackable(item) {
    return STACKABLE_TYPES.has(item.item_type?.toLowerCase()) || CONSUMABLES.has(item.item_name);
}

/**
 * Fetches the stacked inventory list — same list inventory.js displays.
 * Only uses columns confirmed to exist in the inventory table.
 * Optional columns (grade, attack_bonus) use COALESCE so they don't crash
 * if they haven't been added yet on a fresh DB.
 */
async function getStackedInventory(userId) {
    const [items] = await db.execute(
        `SELECT id, item_name, item_type, equipped,
                quantity,
                COALESCE(durability, 100)     AS durability,
                COALESCE(max_durability, 100) AS max_durability,
                COALESCE(grade, 'F')          AS grade,
                COALESCE(attack_bonus, 0)     AS attack_bonus
         FROM inventory
         WHERE player_id=?
         AND item_name NOT LIKE '%Void Shard%'
         ORDER BY equipped DESC, id`,
        [userId]
    );

    const stacked = [];
    const seen = new Map();

    items.forEach(it => {
        if (isStackable(it)) {
            const key = `${it.item_name}__${it.item_type}`;
            if (seen.has(key)) {
                seen.get(key).count++;
                seen.get(key).ids.push(it.id);
            } else {
                const entry = { ...it, count: 1, ids: [it.id] };
                seen.set(key, entry);
                stacked.push(entry);
            }
        } else {
            stacked.push({ ...it, count: 1, ids: [it.id] });
        }
    });

    return stacked;
}

/**
 * Resolves a 1-based display number to the actual DB item row.
 * Returns null if not found.
 */
async function getInventoryItem(userId, number) {
    const list = await getStackedInventory(userId);
    const item = list[number - 1];
    if (!item) return null;
    const [rows] = await db.execute('SELECT * FROM inventory WHERE id=?', [item.ids[0]]);
    return rows[0] || null;
}

module.exports = { getStackedInventory, getInventoryItem, isStackable, CONSUMABLES, STACKABLE_TYPES };