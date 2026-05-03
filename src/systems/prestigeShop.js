/**
 * PRESTIGE SHOP
 * Available only to Prestige players.
 * Weapons are void-tier — far above forged legendaries.
 * Stock is limited and restocks daily (same as normal shop).
 * Each role has 4 weapons across prestige rank tiers (PF→PS).
 */

const db = require('../database/db');

// ── MAX STOCK PER ITEM ───────────────────────────────────────────────────────
const PRESTIGE_STOCK = {
    // Consumables — more available
    'Void Elixir':      5,
    'Fracture Potion':  3,
    'Abyss Tonic':      2,
    'Prestige Bag':     2,
    // PF-PE weapons — slightly more common
    'Void Crusher': 2, 'Void Fang': 2, 'Void Codex': 2, 'Void Bulwark': 2, 'Void Mend': 2,
    // PD-PC weapons
    'Fracture Cleaver': 2, 'Fracture Edge': 2, 'Fracture Scepter': 2, 'Fracture Rampart': 2, 'Fracture Chalice': 2,
    // PB-PA weapons — rarer
    'Abyss Annihilator': 1, 'Abyss Phantom': 1, 'Abyss Tome': 1, 'Abyss Fortress': 1, 'Abyss Lantern': 1,
    // PS weapons — only 1 ever
    "Malachar's Fist": 1, "Malachar's Shadow": 1, "Malachar's Gospel": 1, "Malachar's Seal": 1, "Malachar's Grace": 1,
};

const PRESTIGE_ITEMS = {
    // ── ALL ROLES ─────────────────────────────────────────────────────────────
    consumables: [
        { name: 'Void Elixir',     price: 8000,  desc: 'Restores 60% HP. Void-infused.',  type: 'consumable' },
        { name: 'Fracture Potion', price: 15000, desc: 'Restores full HP. Rare.',          type: 'consumable' },
        { name: 'Abyss Tonic',     price: 25000, desc: '+50% damage for 3 turns.',         type: 'consumable' },
        { name: 'Prestige Bag',    price: 50000, desc: '30 slots. Near-indestructible.',   type: 'bag', slots: 30, durability: 500 }
    ],

    // ── BERSERKER ─────────────────────────────────────────────────────────────
    Berserker: [
        { name: 'Void Crusher',      price: 75000,    minPrestige: 1, stats: { strength: 280, attack: 260 }, durability: 220,
          desc: 'Forged from the bones of a void titan.' },
        { name: 'Fracture Cleaver',  price: 200000,   minPrestige: 1, stats: { strength: 550, attack: 520 }, durability: 280,
          desc: 'Every swing tears a small hole in reality.' },
        { name: 'Abyss Annihilator', price: 750000,   minPrestige: 1, stats: { strength: 1100, attack: 1000 }, durability: 350,
          desc: 'It remembers every world it has ended.' },
        { name: "Malachar's Fist",   price: 3000000,  minPrestige: 2, stats: { strength: 2200, attack: 2000, stamina: 300 }, durability: 500,
          desc: 'Torn from Malachar\'s own gauntlet during the first war.' }
    ],

    // ── ASSASSIN ──────────────────────────────────────────────────────────────
    Assassin: [
        { name: 'Void Fang',         price: 75000,    minPrestige: 1, stats: { agility: 280, attack: 270 }, durability: 220,
          desc: 'Leaves wounds that don\'t close for reasons nobody can explain.' },
        { name: 'Fracture Edge',     price: 200000,   minPrestige: 1, stats: { agility: 550, attack: 540 }, durability: 280,
          desc: 'Phases through armour. The void passes through everything.' },
        { name: 'Abyss Phantom',     price: 750000,   minPrestige: 1, stats: { agility: 1100, attack: 1050 }, durability: 350,
          desc: 'Invisible even when in use. The kill just happens.' },
        { name: "Malachar's Shadow", price: 3000000,  minPrestige: 2, stats: { agility: 2200, attack: 2100, strength: 200 }, durability: 500,
          desc: 'This blade existed before its owner did.' }
    ],

    // ── MAGE ──────────────────────────────────────────────────────────────────
    Mage: [
        { name: 'Void Codex',        price: 75000,    minPrestige: 1, stats: { intelligence: 280, attack: 260 }, durability: 220,
          desc: 'Writes its own spells. The mage just channels.' },
        { name: 'Fracture Scepter',  price: 200000,   minPrestige: 1, stats: { intelligence: 550, attack: 530 }, durability: 280,
          desc: 'Each cast destabilises local space-time slightly.' },
        { name: 'Abyss Tome',        price: 750000,   minPrestige: 1, stats: { intelligence: 1100, attack: 1000 }, durability: 350,
          desc: 'Contains spells from a civilisation that no longer exists.' },
        { name: "Malachar's Gospel", price: 3000000,  minPrestige: 2, stats: { intelligence: 2200, attack: 2000, stamina: 200 }, durability: 500,
          desc: 'Malachar wrote this himself. It was found in the rubble.' }
    ],

    // ── TANK ──────────────────────────────────────────────────────────────────
    Tank: [
        { name: 'Void Bulwark',      price: 75000,    minPrestige: 1, stats: { stamina: 280, defense: 300 }, durability: 280,
          desc: 'Absorbs void energy and converts it to protection.' },
        { name: 'Fracture Rampart',  price: 200000,   minPrestige: 1, stats: { stamina: 550, defense: 600 }, durability: 350,
          desc: 'Hits against it feel wrong. Like punching at something that isn\'t quite there.' },
        { name: 'Abyss Fortress',    price: 750000,   minPrestige: 1, stats: { stamina: 1100, defense: 1200 }, durability: 450,
          desc: 'Ancient. Pre-dates the Gates. Nobody knows who made it.' },
        { name: "Malachar's Seal",   price: 3000000,  minPrestige: 2, stats: { stamina: 2200, defense: 2500, strength: 200 }, durability: 600,
          desc: 'It was the original seal. Repurposed.' }
    ],

    // ── HEALER ────────────────────────────────────────────────────────────────
    Healer: [
        { name: 'Void Mend',         price: 75000,    minPrestige: 1, stats: { intelligence: 280, stamina: 200 }, durability: 220,
          desc: 'Heals wounds that conventional medicine couldn\'t touch.' },
        { name: 'Fracture Chalice',  price: 200000,   minPrestige: 1, stats: { intelligence: 550, stamina: 400 }, durability: 280,
          desc: 'The healing burns. But it works faster than anything else.' },
        { name: 'Abyss Lantern',     price: 750000,   minPrestige: 1, stats: { intelligence: 1100, stamina: 800 }, durability: 350,
          desc: 'Carries the light of a world that no longer exists. Still warm.' },
        { name: "Malachar's Grace",  price: 3000000,  minPrestige: 2, stats: { intelligence: 2200, stamina: 1500 }, durability: 500,
          desc: 'Malachar had healers. This belonged to the last one.' }
    ]
};

// ── STOCK HELPERS ─────────────────────────────────────────────────────────────
async function getPrestigeStock(itemName) {
    const [rows] = await db.execute(
        "SELECT stock FROM prestige_shop_stock WHERE item_name=?", [itemName]
    );
    if (rows.length) return rows[0].stock;
    // First time — initialise
    const max = PRESTIGE_STOCK[itemName] || 1;
    await db.execute(
        "INSERT INTO prestige_shop_stock (item_name, stock, max_stock) VALUES (?, ?, ?)",
        [itemName, max, max]
    );
    return max;
}

async function decreasePrestigeStock(itemName) {
    await db.execute(
        "UPDATE prestige_shop_stock SET stock = GREATEST(0, stock - 1) WHERE item_name=?",
        [itemName]
    );
}

async function restockPrestigeShop() {
    const allItems = [
        ...PRESTIGE_ITEMS.consumables,
        ...Object.values(PRESTIGE_ITEMS).filter(Array.isArray).flat()
    ];
    for (const item of allItems) {
        const max = PRESTIGE_STOCK[item.name] || 1;
        await db.execute(
            `INSERT INTO prestige_shop_stock (item_name, stock, max_stock)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE stock = ?, max_stock = ?`,
            [item.name, max, max, max, max]
        );
    }
    console.log('★ Prestige shop restocked.');
}

async function ensurePrestigeStockTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS prestige_shop_stock (
            item_name VARCHAR(100) PRIMARY KEY,
            stock INT DEFAULT 1,
            max_stock INT DEFAULT 1,
            last_restock DATETIME DEFAULT NOW()
        )
    `).catch(() => {});
}

// ── SHOP QUERIES ──────────────────────────────────────────────────────────────
async function getPrestigeShopItems(playerId, role, prestigeLevel) {
    await ensurePrestigeStockTable();
    const roleItems  = PRESTIGE_ITEMS[role] || [];
    const consumables = PRESTIGE_ITEMS.consumables;
    const available  = roleItems.filter(i => (i.minPrestige || 1) <= prestigeLevel);

    // Attach stock to each item
    for (const item of [...available, ...consumables]) {
        item.stock = await getPrestigeStock(item.name);
    }
    return { weapons: available, consumables };
}

async function buyPrestigeItem(playerId, itemName, role, prestigeLevel) {
    await ensurePrestigeStockTable();
    const roleItems   = PRESTIGE_ITEMS[role] || [];
    const consumables = PRESTIGE_ITEMS.consumables;
    const allItems    = [...roleItems, ...consumables];

    const item = allItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (!item) return { ok: false, reason: 'Item not found in prestige shop.' };
    if ((item.minPrestige || 1) > prestigeLevel) return { ok: false, reason: `Requires Prestige ${item.minPrestige}.` };

    // Check stock
    const stock = await getPrestigeStock(item.name);
    if (stock <= 0) return { ok: false, reason: `*${item.name}* is out of stock. Wait for the daily restock.` };

    // Check gold
    const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [playerId]);
    const playerGold = gold[0]?.gold || 0;
    if (playerGold < item.price) return { ok: false, reason: `Need ${item.price.toLocaleString()} Gold. You have ${playerGold.toLocaleString()}.` };

    await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [item.price, playerId]);
    await decreasePrestigeStock(item.name);

    if (item.type === 'bag') {
        await db.execute(
            "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped) VALUES (?, ?, 'bag', 1, 0)",
            [playerId, item.name]
        );
    } else if (item.type === 'consumable') {
        await db.execute(
            "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped) VALUES (?, ?, 'consumable', 1, 0)",
            [playerId, item.name]
        );
    } else {
        const dur = item.durability || 200;
        await db.execute(
            `INSERT INTO inventory (player_id, item_name, item_type, quantity, grade,
             strength_bonus, agility_bonus, intelligence_bonus, stamina_bonus,
             attack_bonus, defense_bonus, durability, max_durability, equipped)
             VALUES (?, ?, 'weapon', 1, 'P', ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
            [playerId, item.name,
             item.stats?.strength || 0, item.stats?.agility || 0,
             item.stats?.intelligence || 0, item.stats?.stamina || 0,
             item.stats?.attack || 0, item.stats?.defense || 0,
             dur, dur]
        );
    }

    return { ok: true, item };
}

module.exports = {
    PRESTIGE_ITEMS,
    getPrestigeShopItems,
    buyPrestigeItem,
    restockPrestigeShop,
    ensurePrestigeStockTable
};