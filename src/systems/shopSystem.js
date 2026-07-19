const db = require('../database/db');
const itemStats = require('../data/itemStats');
const weaponMoves = require('../data/weaponMoves');

const CONSUMABLES = new Set([
    'Potion', 'Mana Potion', 'Fortify Potion', 'Rage Potion', 'Eagle Eye Potion', 'Cleanse Potion', 'Fatigue Potion',
    'Small Bag', 'Medium Bag', 'Large Bag',
    'Revive Scroll', 'Fire Scroll', 'Backstab Scroll', 'Taunt Scroll', 'War Cry Scroll',
    'Poison Vial', 'Smoke Bomb', 'Herb Kit', 'Holy Water', 'Elixir',
    'Blood Charm', 'Blessing Charm', 'Arrow Bundle', 'Trap Kit', 'Divine Protection',
]);

// Seeded random (Mulberry32)
function seededRandom(seed) {
    return function() {
        seed |= 0;
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function shuffleArray(array, randFn) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(randFn() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const roleItemPools = {
    Tank: ["Duskward Shield","Vigil Plating","Duskwatch Tower","Vigil Helm","Duskstone Gauntlets",
           "Fortify Potion","Fatigue Potion","Taunt Scroll","Iron Skin","Heavy Boots","Guard Helm",
           "Small Bag","Medium Bag","Large Bag"],
    Assassin: ["Duskfang Dagger","Umbral Fang","Twin Gloamfangs","Duskwind Katana","Nightgloam Bow",
               "Poison Vial","Fatigue Potion","Smoke Bomb","Duskstep Boots","Backstab Scroll","Cloak",
               "Small Bag","Medium Bag","Large Bag"],
    Mage: ["Gloam Primer","Gloamlight Staff","Gloamfrost Wand","Umbral Scepter","Eclipse Orb",
           "Mana Potion","Fatigue Potion","Fire Scroll","Ice Wand","Arcane Ring","Magic Cloak",
           "Small Bag","Medium Bag","Large Bag"],
    Healer: ["Ember Staff","Eclipse Orb","Blessing Charm","Holy Water","Revive Scroll",
             "Herb Kit","Divine Protection","Cleanse Potion","Mana Potion","Fatigue Potion",
             "Small Bag","Medium Bag","Large Bag"],
    Ranger: ["Bow","Nightgloam Bow","Arrow Bundle","Trap Kit","Eagle Eye Potion",
             "Camouflage Cloak","Duskwind Katana",
             "Small Bag","Medium Bag","Large Bag"],
    Berserker: ["Gloam Axe","Duskrend Blade","Duskiron Greatsword","Gloamhammer","Duskbone Mace",
                "Rage Potion","Fatigue Potion","War Cry Scroll","Blood Charm","Duskheavy Blade",
                "Small Bag","Medium Bag","Large Bag"]
};

const rankRequirements = {
    "Duskwatch Tower": "E", "Vigil Helm": "D", "Duskstone Gauntlets": "C",
    "Umbral Fang": "E", "Twin Gloamfangs": "D", "Duskwind Katana": "C",
    "Nightgloam Bow": "C", "Gloamlight Staff": "E", "Gloamfrost Wand": "D",
    "Umbral Scepter": "C", "Eclipse Orb": "B", "Duskiron Greatsword": "E",
    "Gloamhammer": "D", "Duskbone Mace": "C", "Nightglass Cleaver": "C",
    "Gloamwhisper": "C", "Cinderrod": "C", "Bulwark of Dusk": "C",
    "Umbral Greatsword": "B", "Gloamreaper Dagger": "B", "Staff of the Long Dusk": "B",
    "Aegis of the Hollow": "B", "Umbra Titan's Wrath": "A", "Eclipse Edge": "A",
    "Twilight Codex": "A", "Duskwall Aegis": "A", "Sunslayer": "S",
    "Last Hour's Edge": "S", "Umbral Oracle Scepter": "S", "Aegis Everdark": "S"
};

// ✅ Fixed price table — prices never change between purchases or sessions
const fixedPrices = {
    // Consumables
    "Mana Potion": 150, "Potion": 100, "Fortify Potion": 120,
    "Rage Potion": 130, "Fatigue Potion": 140, "Eagle Eye Potion": 120, "Cleanse Potion": 110,
    // Scrolls / misc
    "Taunt Scroll": 200, "Backstab Scroll": 200, "War Cry Scroll": 200,
    "Fire Scroll": 180, "Revive Scroll": 500,
    // Accessories / armour (no rank req)
    "Iron Skin": 150, "Heavy Boots": 160, "Guard Helm": 170,
    // Bags
    "Small Bag": 300, "Medium Bag": 700, "Large Bag": 1500,
    "Duskstep Boots": 160, "Poison Vial": 180, "Smoke Bomb": 150,
    "Cloak": 140, "Arrow Bundle": 120, "Trap Kit": 160,
    "Camouflage Cloak": 160, "Blood Charm": 200, "Duskheavy Blade": 250,
    "Blessing Charm": 200, "Holy Water": 150, "Herb Kit": 130,
    "Divine Protection": 220, "Bow": 220, "Ember Staff": 280,
    "Ice Wand": 260, "Arcane Ring": 230, "Magic Cloak": 210,
    // Rank F weapons / armour
    "Duskfang Dagger": 200, "Duskward Shield": 220, "Vigil Plating": 240,
    "Gloam Primer": 250, "Gloam Axe": 260, "Duskrend Blade": 270, "Gloamhammer": 280,
    // Rank E
    "Umbral Fang": 400, "Gloamlight Staff": 420,
    "Duskiron Greatsword": 410, "Duskwatch Tower": 430,
    // Rank D
    "Twin Gloamfangs": 700, "Gloamfrost Wand": 720, "Vigil Helm": 680,
    // Rank C
    "Duskwind Katana": 1200, "Nightgloam Bow": 1200, "Umbral Scepter": 1300,
    "Duskstone Gauntlets": 1100, "Duskbone Mace": 1250,
    "Nightglass Cleaver": 1000000, "Gloamwhisper": 1000000,
    "Cinderrod": 1000000, "Bulwark of Dusk": 1000000,
    // Rank B
    "Eclipse Orb": 2000000, "Umbral Greatsword": 2500000,
    "Gloamreaper Dagger": 2500000, "Staff of the Long Dusk": 2500000,
    "Aegis of the Hollow": 2500000,
    // Rank A
    "Umbra Titan's Wrath": 5000000, "Eclipse Edge": 5000000,
    "Twilight Codex": 5000000, "Duskwall Aegis": 5000000,
    // Rank S
    "Sunslayer": 10000000, "Last Hour's Edge": 10000000,
    "Umbral Oracle Scepter": 10000000, "Aegis Everdark": 10000000,
};

function getItemPrice(itemName) {
    if (fixedPrices[itemName] !== undefined) return fixedPrices[itemName];
    // Fallback for unlisted items — derive from minRank
    const data = itemStats[itemName] || {};
    if (data.minRank) {
        const rankPrices = { C: 1000000, B: 2500000, A: 5000000, S: 10000000 };
        return rankPrices[data.minRank] || 1000000;
    }
    return 200; // known fallback, never random
}

function getMaxStockForItem(itemName) {
    // ✅ Specific overrides
    const stockOverrides = {
        'Mana Potion': 10,
        'Potion':      10,
        'Fatigue Potion': 7,
        'Small Bag':   5,
        'Medium Bag':  3,
        'Large Bag':   2
    };
    if (stockOverrides[itemName] !== undefined) return stockOverrides[itemName];

    const required = rankRequirements[itemName];
    if (!required) return 5;
    switch (required) {
        case 'E': return 4;
        case 'D': return 3;
        case 'C': return 2;
        default:  return 1;
    }
}

function isItemAllowedForRank(itemName, playerRank) {
    const required = rankRequirements[itemName];
    if (!required) return true;
    const rankOrder = ['F','E','D','C','B','A','S'];
    return rankOrder.indexOf(playerRank) >= rankOrder.indexOf(required);
}

const specialWeapons = [
    { name: "Nightglass Cleaver",     minRank: 'C' },
    { name: "Gloamwhisper",         minRank: 'C' },
    { name: "Cinderrod",          minRank: 'C' },
    { name: "Bulwark of Dusk",     minRank: 'C' },
    { name: "Umbral Greatsword",   minRank: 'B' },
    { name: "Gloamreaper Dagger",    minRank: 'B' },
    { name: "Staff of the Long Dusk", minRank: 'B' },
    { name: "Aegis of the Hollow",  minRank: 'B' },
    { name: "Umbra Titan's Wrath",        minRank: 'A' },
    { name: "Eclipse Edge",         minRank: 'A' },
    { name: "Twilight Codex",      minRank: 'A' },
    { name: "Duskwall Aegis",       minRank: 'A' },
    { name: "Sunslayer",            minRank: 'S' },
    { name: "Last Hour's Edge",      minRank: 'S' },
    { name: "Umbral Oracle Scepter",   minRank: 'S' },
    { name: "Aegis Everdark",       minRank: 'S' }
];

function getSpecialItemForRank(playerRank, randFn = Math.random) {
    const rankOrder = ['F','E','D','C','B','A','S'];
    const playerRankIdx = rankOrder.indexOf(playerRank);
    const eligible = specialWeapons.filter(w => rankOrder.indexOf(w.minRank) <= playerRankIdx);
    if (eligible.length === 0) return null;
    const randomValue = typeof randFn === 'function' ? randFn() : Math.random();
    return eligible[Math.floor(randomValue * eligible.length)].name;
}

// ── Daily seed — shop looks identical all day, resets at midnight ──
// Using YYYYMMDD as an integer (e.g. 20241115) — always fits in 32-bit.
function getDailySeed() {
    const now = new Date();
    return now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
}

// Items always guaranteed in every shop — never rotated out
// They deplete and restock normally, just always present
const GUARANTEED_ITEMS = {
    all:  { 'Fatigue Potion': { stock: 7,  max: 7  } },
    Mage:   { 'Mana Potion': { stock: 10, max: 10 } },
    Healer: { 'Mana Potion': { stock: 10, max: 10 } }
};

async function getItemStock(itemName) {
    const [rows] = await db.execute(
        "SELECT stock, restocked_amount FROM shop_stock WHERE item_name = ?",
        [itemName]
    );
    if (rows.length) {
        return { stock: rows[0].stock, restockedAmount: rows[0].restocked_amount };
    }
    // First time seeing this item — init it
    const maxStock = getMaxStockForItem(itemName);
    const initialStock = Math.floor(Math.random() * maxStock) + 1;
    await db.execute(
        "INSERT INTO shop_stock (item_name, stock, max_stock, restocked_amount, last_restock) VALUES (?, ?, ?, ?, NOW())",
        [itemName, initialStock, maxStock, initialStock]
    );
    return { stock: initialStock, restockedAmount: initialStock };
}

async function decreaseStock(itemName) {
    await db.execute("UPDATE shop_stock SET stock = GREATEST(0, stock - 1) WHERE item_name = ?", [itemName]);
}

async function restockAllItems() {
    const allItems = new Set();
    Object.values(roleItemPools).forEach(pool => pool.forEach(item => allItems.add(item)));
    specialWeapons.forEach(w => allItems.add(w.name));
    const now = new Date();
    for (const item of allItems) {
        const maxStock = getMaxStockForItem(item);
        const newStock = Math.floor(Math.random() * maxStock) + 1;
        await db.execute(
            `INSERT INTO shop_stock (item_name, stock, max_stock, restocked_amount, last_restock)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                 stock = ?, max_stock = ?, restocked_amount = ?, last_restock = ?`,
            [item, newStock, maxStock, newStock, now, newStock, maxStock, newStock, now]
        );
    }

    // ── Always guarantee Fatigue Potion (7) and Mana Potion (10) restock ─────
    await db.execute(
        `INSERT INTO shop_stock (item_name, stock, max_stock, restocked_amount, last_restock)
         VALUES ('Fatigue Potion', 7, 7, 7, NOW())
         ON DUPLICATE KEY UPDATE stock=7, max_stock=7, restocked_amount=7, last_restock=NOW()`
    );
    await db.execute(
        `INSERT INTO shop_stock (item_name, stock, max_stock, restocked_amount, last_restock)
         VALUES ('Mana Potion', 10, 10, 10, NOW())
         ON DUPLICATE KEY UPDATE stock=10, max_stock=10, restocked_amount=10, last_restock=NOW()`
    );

    shopCache.clear();
    console.log("🛒 Shop restocked.");
}

function getRestockTimeRemaining() {
    const now   = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const diff    = midnight - now;
    const hours   = Math.floor(diff / (60 * 60 * 1000));
    const minutes = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    return `${hours}h ${minutes}m`;
}

async function generateShopItems(role, playerRank, seed) {
    const rand = seededRandom(seed);
    const pool = roleItemPools[role] || roleItemPools.Tank;
    const allowedPool = pool.filter(itemName => isItemAllowedForRank(itemName, playerRank)
        && itemName !== 'Fatigue Potion' && itemName !== 'Mana Potion'); // excluded — added permanently below
    const shuffled = shuffleArray([...allowedPool], rand);
    const selected = shuffled.slice(0, 6);

    if (playerRank !== 'F' && playerRank !== 'E' && rand() < 0.3) {
        const specialName = getSpecialItemForRank(playerRank, rand);
        if (specialName) {
            const replaceIndex = Math.floor(rand() * selected.length);
            selected[replaceIndex] = specialName;
        }
    }

    const items = [];
    for (const name of selected) {
        const data = itemStats[name] || {};
        const { stock, restockedAmount } = await getItemStock(name);
        const movesList = weaponMoves[name] || [];
        const moves = movesList.map(m => m.name).join(', ');
        items.push({
            id: items.length + 1,
            name,
            grade: 'F',
            stat: CONSUMABLES.has(name) ? 'consumable' : (data.primaryStat || 'strength'),
            value: data.base?.attack || 5,
            price: getItemPrice(name),
            emoji: CONSUMABLES.has(name)
                ? '🧪'
                : ({ strength:'💪', agility:'⚡', intelligence:'🧠', stamina:'🛡️' }[data.primaryStat] || '✨'),
            moves,
            stock,
            restockedAmount
        });
    }

    // ── Guaranteed items — always at bottom, normal stock from DB ────────────
    const guaranteedNames = [
        ...Object.keys(GUARANTEED_ITEMS.all),
        ...Object.keys(GUARANTEED_ITEMS[role] || {})
    ];
    for (const name of guaranteedNames) {
        const { stock, restockedAmount } = await getItemStock(name);
        items.push({
            id: items.length + 1, name, grade: 'F',
            stat: 'consumable', value: 0, price: getItemPrice(name),
            emoji: '🧪', moves: '', stock, restockedAmount
        });
    }

    return items;
}

const shopCache = new Map();

async function getPlayerShop(playerId, role, playerRank) {
    const seed = getDailySeed();
    const cacheKey = `${role}_${playerRank}_${seed}`;
    if (shopCache.has(cacheKey)) return shopCache.get(cacheKey);
    const items = await generateShopItems(role, playerRank, seed);
    shopCache.set(cacheKey, items);
    return items;
}

function clearShopCacheForRoleRank(role, playerRank) {
    shopCache.clear();
}

module.exports = {
    getPlayerShop,
    decreaseStock,
    restockAllItems,
    getRestockTimeRemaining,
    getMaxStockForItem,
    clearShopCacheForRoleRank,
    isItemAllowedForRank,
    getSpecialItemForRank
};