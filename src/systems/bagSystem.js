const db = require('../database/db');

const BAGS = {
    'Small Bag':  { slots: 5,  durability: 10, price: 300,  repair: 50  },
    'Medium Bag': { slots: 10, durability: 20, price: 700,  repair: 100 },
    'Large Bag':  { slots: 20, durability: 30, price: 1500, repair: 180 }
};

async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS bag_contents (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            player_id   VARCHAR(50) NOT NULL,
            material    VARCHAR(100) NOT NULL,
            quantity    INT DEFAULT 1,
            UNIQUE KEY unique_bag_item (player_id, material)
        )
    `).catch(() => {});
}

// ── Get equipped bag from inventory ──────────────────────────────────────────
async function getPlayerBag(playerId) {
    await ensureTables();
    const [rows] = await db.execute(
        "SELECT * FROM inventory WHERE player_id=? AND item_type='bag' AND equipped=1 LIMIT 1",
        [playerId]
    );
    if (!rows.length) return null;
    const item = rows[0];
    const bagData = BAGS[item.item_name] || {};
    return {
        id:            item.id,
        bag_type:      item.item_name,
        slots:         bagData.slots || 5,
        durability:    item.durability !== null ? item.durability : bagData.durability,
        max_durability: item.max_durability || bagData.durability
    };
}

async function getBagContents(playerId) {
    await ensureTables();
    const [rows] = await db.execute(
        "SELECT * FROM bag_contents WHERE player_id=?", [playerId]
    );
    return rows;
}

async function getBagSlotsUsed(playerId) {
    const contents = await getBagContents(playerId);
    return contents.reduce((sum, c) => sum + c.quantity, 0);
}

async function addToBag(playerId, material, quantity = 1) {
    const bag = await getPlayerBag(playerId);
    if (!bag) return { ok: false, reason: 'no_bag' };
    if (bag.durability <= 0) return { ok: false, reason: 'broken' };

    const used = await getBagSlotsUsed(playerId);
    if (used + quantity > bag.slots) return { ok: false, reason: 'full', slots: bag.slots, used };

    await db.execute(
        `INSERT INTO bag_contents (player_id, material, quantity)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
        [playerId, material, quantity, quantity]
    );
    return { ok: true };
}

// Called when player !emptybag — moves everything to player_materials
async function emptyBag(playerId) {
    await ensureTables();
    const bag = await getPlayerBag(playerId);
    if (!bag) return { ok: false, reason: 'no_bag' };

    const contents = await getBagContents(playerId);
    if (!contents.length) return { ok: false, reason: 'empty' };

    for (const item of contents) {
        await db.execute(
            `INSERT INTO player_materials (player_id, material, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
            [playerId, item.material, item.quantity, item.quantity]
        );
    }
    await db.execute("DELETE FROM bag_contents WHERE player_id=?", [playerId]);

    // Reduce bag durability by 1
    const newDur = Math.max(0, bag.durability - 1);
    await db.execute("UPDATE inventory SET durability=? WHERE id=?", [newDur, bag.id]);

    if (newDur <= 0) {
        return { ok: true, contents, bagBroke: true };
    }
    return { ok: true, contents, bagBroke: false, durability: newDur, max_durability: bag.max_durability };
}

// Called on player death — destroy bag contents AND unequip+delete the bag
async function destroyBag(playerId) {
    await db.execute("DELETE FROM bag_contents WHERE player_id=?", [playerId]);
    // Delete the equipped bag from inventory
    await db.execute(
        "DELETE FROM inventory WHERE player_id=? AND item_type='bag' AND equipped=1",
        [playerId]
    );
}

// Repair bag — costs gold, restores durability
async function repairBag(playerId) {
    await ensureTables();
    const bag = await getPlayerBag(playerId);
    if (!bag) return { ok: false, reason: 'no_bag' };
    if (bag.durability >= bag.max_durability) return { ok: false, reason: 'full' };

    const bagData = BAGS[bag.bag_type];
    const cost = bagData?.repair || 100;

    const [money] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [playerId]);
    const gold = money[0]?.gold || 0;
    if (gold < cost) return { ok: false, reason: 'no_gold', cost, gold };

    await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [cost, playerId]);
    await db.execute("UPDATE inventory SET durability=max_durability WHERE id=?", [bag.id]);
    return { ok: true, cost };
}

// ── Shared Stage Drop Pool — per dungeon, numbered, first come first served ──
// Key: dungeonId, Value: [ { id, material, rarity, emoji, takenBy } ]
const stagePools = new Map();

function setStageDrops(dungeonId, drops) {
    stagePools.set(dungeonId, drops);
    // Auto-expire after 90 seconds
    setTimeout(() => stagePools.delete(dungeonId), 90000);
}

function getStageDrops(dungeonId) {
    return stagePools.get(dungeonId) || [];
}

function claimStageDrop(dungeonId, dropIndex, playerId) {
    const pool = stagePools.get(dungeonId);
    if (!pool || !pool[dropIndex]) return { ok: false, reason: 'no_drop' };
    if (pool[dropIndex].takenBy) return { ok: false, reason: 'already_taken', takenBy: pool[dropIndex].takenBy };
    pool[dropIndex].takenBy = playerId;
    return { ok: true, drop: pool[dropIndex] };
}

function clearStageDrops(dungeonId) {
    stagePools.delete(dungeonId);
}

module.exports = {
    BAGS,
    ensureTables,
    getPlayerBag,
    getBagContents,
    getBagSlotsUsed,
    addToBag,
    emptyBag,
    destroyBag,
    repairBag,
    setStageDrops,
    getStageDrops,
    claimStageDrop,
    clearStageDrops
};