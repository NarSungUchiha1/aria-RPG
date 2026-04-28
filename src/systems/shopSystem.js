const db = require('../database/db');
const itemStats = require('../data/itemStats');
const weaponMoves = require('../data/weaponMoves');

const CONSUMABLES = new Set([
    'Potion', 'Mana Potion', 'Fortify Potion', 'Rage Potion', 'Eagle Eye Potion', 'Cleanse Potion',
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
    Tank: ["Shield","Armor Plate","Tower Shield","Vanguard Helm","Golemheart Gauntlets",
           "Fortify Potion","Taunt Scroll","Iron Skin","Heavy Boots","Guard Helm",
           "Small Bag","Medium Bag","Large Bag"],
    Assassin: ["Dagger","Shadow Dagger","Twin Fang Blades","Wind Katana","Nightshade Bow",
               "Poison Vial","Smoke Bomb","Silent Boots","Backstab Scroll","Cloak",
               "Small Bag","Medium Bag","Large Bag"],
    Mage: ["Spell Book","Arcane Staff","Frostbane Wand","Void Scepter","Celestial Orb",
           "Mana Potion","Fire Scroll","Ice Wand","Arcane Ring","Magic Cloak",
           "Small Bag","Medium Bag","Large Bag"],
    Healer: ["Healing Staff","Celestial Orb","Blessing Charm","Holy Water","Revive Scroll",
             "Herb Kit","Divine Protection","Cleanse Potion","Mana Potion",
             "Small Bag","Medium Bag","Large Bag"],
    Ranger: ["Bow","Nightshade Bow","Arrow Bundle","Trap Kit","Eagle Eye Potion",
             "Camouflage Cloak","Wind Katana",
             "Small Bag","Medium Bag","Large Bag"],
    Berserker: ["Battle Axe","Rage Blade","Iron Greatsword","Warhammer","Dragonbone Mace",
                "Rage Potion","War Cry Scroll","Blood Charm","Heavy Blade",
                "Small Bag","Medium Bag","Large Bag"]
};

const rankRequirements = {
    "Tower Shield": "E", "Vanguard Helm": "D", "Golemheart Gauntlets": "C",
    "Shadow Dagger": "E", "Twin Fang Blades": "D", "Wind Katana": "C",
    "Nightshade Bow": "C", "Arcane Staff": "E", "Frostbane Wand": "D",
    "Void Scepter": "C", "Celestial Orb": "B", "Iron Greatsword": "E",
    "Warhammer": "D", "Dragonbone Mace": "C", "Obsidian Cleaver": "C",
    "Whisperblade": "C", "Inferno Rod": "C", "Bulwark of Stone": "C",
    "Abyssal Greatsword": "B", "Voidreaper Dagger": "B", "Staff of the Eternal": "B",
    "Aegis of the Fallen": "B", "Titan's Wrath": "A", "Eclipse Edge": "A",
    "Celestial Codex": "A", "Fortress Aegis": "A", "Godslayer": "S",
    "Eternity's Edge": "S", "Omniscient Scepter": "S", "Aegis Immortal": "S"
};

// ✅ Fixed price table — prices never change between purchases or sessions
const fixedPrices = {
    // Consumables
    "Mana Potion": 150, "Potion": 100, "Fortify Potion": 120,
    "Rage Potion": 130, "Eagle Eye Potion": 120, "Cleanse Potion": 110,
    // Scrolls / misc
    "Taunt Scroll": 200, "Backstab Scroll": 200, "War Cry Scroll": 200,
    "Fire Scroll": 180, "Revive Scroll": 500,
    // Accessories / armour (no rank req)
    "Iron Skin": 150, "Heavy Boots": 160, "Guard Helm": 170,
    // Bags
    "Small Bag": 300, "Medium Bag": 700, "Large Bag": 1500,
    "Silent Boots": 160, "Poison Vial": 180, "Smoke Bomb": 150,
    "Cloak": 140, "Arrow Bundle": 120, "Trap Kit": 160,
    "Camouflage Cloak": 160, "Blood Charm": 200, "Heavy Blade": 250,
    "Blessing Charm": 200, "Holy Water": 150, "Herb Kit": 130,
    "Divine Protection": 220, "Bow": 220, "Healing Staff": 280,
    "Ice Wand": 260, "Arcane Ring": 230, "Magic Cloak": 210,
    // Rank F weapons / armour
    "Dagger": 200, "Shield": 220, "Armor Plate": 240,
    "Spell Book": 250, "Battle Axe": 260, "Rage Blade": 270, "Warhammer": 280,
    // Rank E
    "Shadow Dagger": 400, "Arcane Staff": 420,
    "Iron Greatsword": 410, "Tower Shield": 430,
    // Rank D
    "Twin Fang Blades": 700, "Frostbane Wand": 720, "Vanguard Helm": 680,
    // Rank C
    "Wind Katana": 1200, "Nightshade Bow": 1200, "Void Scepter": 1300,
    "Golemheart Gauntlets": 1100, "Dragonbone Mace": 1250,
    "Obsidian Cleaver": 1000000, "Whisperblade": 1000000,
    "Inferno Rod": 1000000, "Bulwark of Stone": 1000000,
    // Rank B
    "Celestial Orb": 2000000, "Abyssal Greatsword": 2500000,
    "Voidreaper Dagger": 2500000, "Staff of the Eternal": 2500000,
    "Aegis of the Fallen": 2500000,
    // Rank A
    "Titan's Wrath": 5000000, "Eclipse Edge": 5000000,
    "Celestial Codex": 5000000, "Fortress Aegis": 5000000,
    // Rank S
    "Godslayer": 10000000, "Eternity's Edge": 10000000,
    "Omniscient Scepter": 10000000, "Aegis Immortal": 10000000,
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
        'Mana Potion': 5,
        'Potion': 5,
        'Small Bag': 5,
        'Medium Bag': 3,
        'Large Bag': 2
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
    { name: "Obsidian Cleaver",     minRank: 'C' },
    { name: "Whisperblade",         minRank: 'C' },
    { name: "Inferno Rod",          minRank: 'C' },
    { name: "Bulwark of Stone",     minRank: 'C' },
    { name: "Abyssal Greatsword",   minRank: 'B' },
    { name: "Voidreaper Dagger",    minRank: 'B' },
    { name: "Staff of the Eternal", minRank: 'B' },
    { name: "Aegis of the Fallen",  minRank: 'B' },
    { name: "Titan's Wrath",        minRank: 'A' },
    { name: "Eclipse Edge",         minRank: 'A' },
    { name: "Celestial Codex",      minRank: 'A' },
    { name: "Fortress Aegis",       minRank: 'A' },
    { name: "Godslayer",            minRank: 'S' },
    { name: "Eternity's Edge",      minRank: 'S' },
    { name: "Omniscient Scepter",   minRank: 'S' },
    { name: "Aegis Immortal",       minRank: 'S' }
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

async function getItemStock(itemName) {
    const [rows] = await db.execute(
        "SELECT stock, restocked_amount FROM shop_stock WHERE item_name = ?",
        [itemName]
    );
    if (rows.length) {
        return { stock: rows[0].stock, restockedAmount: rows[0].restocked_amount };
    }
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
    const allowedPool = pool.filter(itemName => isItemAllowedForRank(itemName, playerRank));
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
            price: getItemPrice(name), // ✅ fixed — no playerRank arg needed
            emoji: CONSUMABLES.has(name)
                ? '🧪'
                : ({ strength:'💪', agility:'⚡', intelligence:'🧠', stamina:'🛡️' }[data.primaryStat] || '✨'),
            moves,
            stock,
            restockedAmount
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
    getSpecialItemForRank
};