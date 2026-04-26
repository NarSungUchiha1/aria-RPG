const db = require('../database/db');

const BAGS = {
    'Small Bag':  { slots: 5,  durability: 10, price: 300,  repair: 50  },
    'Medium Bag': { slots: 10, durability: 20, price: 700,  repair: 100 },
    'Large Bag':  { slots: 20, durability: 30, price: 1500, repair: 180 }
};

async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS player_bags (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            player_id   VARCHAR(50) NOT NULL UNIQUE,
            bag_type    VARCHAR(50) NOT NULL,
            slots       INT NOT NULL,
            durability  INT NOT NULL,
            max_durability INT NOT NULL
        )
    `).catch(() => {});

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

async function getPlayerBag(playerId) {
    await ensureTables();
    const [rows] = await db.execute("SELECT * FROM player_bags WHERE player_id=?", [playerId]);
    return rows[0] || null;
}

async function getBagContents(playerId) {
    const [rows] = await db.execute("SELECT * FROM bag_contents WHERE player_id=?", [playerId]);
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

// Called when player types !emptybag — moves everything to player_materials
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

    // Reduce bag durability by 1 on each successful empty
    await db.execute(
        "UPDATE player_bags SET durability = GREATEST(0, durability - 1) WHERE player_id=?",
        [playerId]
    );

    const [updated] = await db.execute("SELECT durability FROM player_bags WHERE player_id=?", [playerId]);
    const newDur = updated[0]?.durability || 0;
    if (newDur <= 0) {
        await destroyBag(playerId);
        return { ok: true, contents, bagBroke: true };
    }

    return { ok: true, contents, bagBroke: false, durability: newDur };
}

// Called on player death — destroy bag and all contents
async function destroyBag(playerId) {
    await db.execute("DELETE FROM bag_contents WHERE player_id=?", [playerId]);
    await db.execute("DELETE FROM player_bags WHERE player_id=?", [playerId]);
}

// Called when player buys a bag from shop
async function giveBag(playerId, bagType) {
    await ensureTables();
    const bagData = BAGS[bagType];
    if (!bagData) return false;

    await db.execute(
        `INSERT INTO player_bags (player_id, bag_type, slots, durability, max_durability)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE bag_type=?, slots=?, durability=?, max_durability=?`,
        [playerId, bagType, bagData.slots, bagData.durability, bagData.durability,
         bagType, bagData.slots, bagData.durability, bagData.durability]
    );
    return true;
}

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
    await db.execute("UPDATE player_bags SET durability = max_durability WHERE player_id=?", [playerId]);
    return { ok: true, cost };
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
    giveBag,
    repairBag
};