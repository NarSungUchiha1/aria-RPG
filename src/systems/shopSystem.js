const db = require('../database/db');
const itemStats = require('../data/itemStats');
const weaponMoves = require('../data/weaponMoves');

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

// Seeded shuffle
function shuffleArray(array, randFn) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(randFn() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

const roleItemPools = {
    Tank: ["Shield","Armor Plate","Tower Shield","Vanguard Helm","Golemheart Gauntlets",
           "Fortify Potion","Taunt Scroll","Iron Skin","Heavy Boots","Guard Helm"],
    Assassin: ["Dagger","Shadow Dagger","Twin Fang Blades","Wind Katana","Nightshade Bow",
               "Poison Vial","Smoke Bomb","Silent Boots","Backstab Scroll","Cloak"],
    Mage: ["Spell Book","Arcane Staff","Frostbane Wand","Void Scepter","Celestial Orb",
           "Mana Potion","Fire Scroll","Ice Wand","Arcane Ring","Magic Cloak"],
    Healer: ["Healing Staff","Celestial Orb","Blessing Charm","Holy Water","Revive Scroll",
             "Herb Kit","Divine Protection","Cleanse Potion","Mana Potion"],
    Ranger: ["Bow","Nightshade Bow","Arrow Bundle","Trap Kit","Eagle Eye Potion",
             "Camouflage Cloak","Wind Katana"],
    Berserker: ["Battle Axe","Rage Blade","Iron Greatsword","Warhammer","Dragonbone Mace",
                "Rage Potion","War Cry Scroll","Blood Charm","Heavy Blade"]
};

const rankRequirements = {
    "Tower Shield": "E",
    "Vanguard Helm": "D",
    "Golemheart Gauntlets": "C",
    "Shadow Dagger": "E",
    "Twin Fang Blades": "D",
    "Wind Katana": "C",
    "Nightshade Bow": "C",
    "Arcane Staff": "E",
    "Frostbane Wand": "D",
    "Void Scepter": "C",
    "Celestial Orb": "B",
    "Iron Greatsword": "E",
    "Warhammer": "D",
    "Dragonbone Mace": "C",
    "Obsidian Cleaver": "C",
    "Whisperblade": "C",
    "Inferno Rod": "C",
    "Bulwark of Stone": "C",
    "Abyssal Greatsword": "B",
    "Voidreaper Dagger": "B",
    "Staff of the Eternal": "B",
    "Aegis of the Fallen": "B",
    "Titan's Wrath": "A",
    "Eclipse Edge": "A",
    "Celestial Codex": "A",
    "Fortress Aegis": "A",
    "Godslayer": "S",
    "Eternity's Edge": "S",
    "Omniscient Scepter": "S",
    "Aegis Immortal": "S"
};

function getMaxStockForItem(itemName) {
    const required = rankRequirements[itemName];
    if (!required) return 5;
    switch (required) {
        case 'E': return 4;
        case 'D': return 3;
        case 'C': return 2;
        default: return 1;
    }
}

function isItemAllowedForRank(itemName, playerRank) {
    const required = rankRequirements[itemName];
    if (!required) return true;
    const rankOrder = ['F','E','D','C','B','A','S'];
    return rankOrder.indexOf(playerRank) >= rankOrder.indexOf(required);
}

const specialWeapons = [
    { name: "Obsidian Cleaver", minRank: 'C' },
    { name: "Whisperblade", minRank: 'C' },
    { name: "Inferno Rod", minRank: 'C' },
    { name: "Bulwark of Stone", minRank: 'C' },
    { name: "Abyssal Greatsword", minRank: 'B' },
    { name: "Voidreaper Dagger", minRank: 'B' },
    { name: "Staff of the Eternal", minRank: 'B' },
    { name: "Aegis of the Fallen", minRank: 'B' },
    { name: "Titan's Wrath", minRank: 'A' },
    { name: "Eclipse Edge", minRank: 'A' },
    { name: "Celestial Codex", minRank: 'A' },
    { name: "Fortress Aegis", minRank: 'A' },
    { name: "Godslayer", minRank: 'S' },
    { name: "Eternity's Edge", minRank: 'S' },
    { name: "Omniscient Scepter", minRank: 'S' },
    { name: "Aegis Immortal", minRank: 'S' }
];

function getSpecialItemForRank(playerRank, randFn = Math.random) {
    const rankOrder = ['F','E','D','C','B','A','S'];
    const playerRankIdx = rankOrder.indexOf(playerRank);
    const eligible = specialWeapons.filter(w => rankOrder.indexOf(w.minRank) <= playerRankIdx);
    if (eligible.length === 0) return null;
    const randomValue = typeof randFn === 'function' ? randFn() : Math.random();
    return eligible[Math.floor(randomValue * eligible.length)].name;
}

function getItemPrice(itemName, playerRank) {
    const data = itemStats[itemName] || {};
    const minRank = data.minRank;
    if (minRank) {
        const basePrices = { 'C': 1000000, 'B': 2500000, 'A': 5000000, 'S': 10000000 };
        return basePrices[minRank] || 1000000;
    }
    return 100 + Math.floor(Math.random() * 150);
}

// ========== GLOBAL RESTOCK SEED ==========
let cachedRestockTimestamp = null;
let cachedRestockSeed = null;

async function getGlobalRestockSeed() {
    const [rows] = await db.execute("SELECT MAX(last_restock) as last_restock FROM shop_stock");
    const timestamp = rows[0]?.last_restock ? new Date(rows[0].last_restock).getTime() : Date.now();
    
    if (cachedRestockTimestamp === timestamp) {
        return cachedRestockSeed;
    }
    
    cachedRestockTimestamp = timestamp;
    cachedRestockSeed = timestamp;
    return timestamp;
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
    // Use the global restock timestamp for consistency
    const seed = await getGlobalRestockSeed();
    const now = new Date(seed);
    await db.execute(
        "INSERT INTO shop_stock (item_name, stock, max_stock, restocked_amount, last_restock) VALUES (?, ?, ?, ?, ?)",
        [itemName, initialStock, maxStock, initialStock, now]
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
                 stock = ?,
                 max_stock = ?,
                 restocked_amount = ?,
                 last_restock = ?`,
            [item, newStock, maxStock, newStock, now, newStock, maxStock, newStock, now]
        );
    }
    cachedRestockTimestamp = null;
    cachedRestockSeed = null;
    console.log("🛒 Shop restocked – seed reset.");
}

async function getRestockTimeRemaining() {
    const [rows] = await db.execute("SELECT MAX(last_restock) as last_restock FROM shop_stock");
    if (!rows[0]?.last_restock) return "23h 59m";
    const last = new Date(rows[0].last_restock);
    const next = new Date(last.getTime() + 24 * 60 * 60 * 1000);
    const diff = next - Date.now();
    if (diff <= 0) return "0h 0m";
    const hours = Math.floor(diff / (60 * 60 * 1000));
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
            stat: data.primaryStat || 'strength',
            value: data.base?.attack || 5,
            price: getItemPrice(name, playerRank),
            emoji: { strength:'💪', agility:'⚡', intelligence:'🧠', stamina:'🛡️' }[data.primaryStat] || '✨',
            moves,
            stock,
            restockedAmount
        });
    }
    return items;
}

const shopCache = new Map();

async function getPlayerShop(playerId, role, playerRank) {
    const seed = await getGlobalRestockSeed();
    const cacheKey = `${role}_${playerRank}_${seed}`;
    
    if (shopCache.has(cacheKey)) {
        return shopCache.get(cacheKey);
    }
    
    const items = await generateShopItems(role, playerRank, seed);
    shopCache.set(cacheKey, items);
    return items;
}

async function clearShopCacheForRoleRank(role, playerRank) {
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