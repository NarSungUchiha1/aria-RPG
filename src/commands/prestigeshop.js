/**
 * PRESTIGE SHOP
 * Prices calibrated against prestige gold economy:
 * PF run: ~3,000-4,000 gold per run
 * PE run: ~6,000-8,000 gold per run
 * PD run: ~12,000-16,000 gold per run
 * PC run: ~25,000-35,000 gold per run
 * PB run: ~50,000-70,000 gold per run
 * PA run: ~120,000-150,000 gold per run
 * PS run: ~200,000-300,000 gold per run
 *
 * Target: 10-20 runs to afford the next weapon tier.
 */

const db = require('../database/db');

const PRESTIGE_STOCK = {
    'Void Elixir': 5, 'Fracture Potion': 3, 'Abyss Tonic': 2, 'Prestige Bag': 2,
    // PF-PE weapons — entry level
    'Void Crusher': 2, 'Void Fang': 2, 'Void Codex': 2, 'Void Bulwark': 2, 'Void Mend': 2,
    // PD-PC weapons
    'Fracture Cleaver': 2, 'Fracture Edge': 2, 'Fracture Scepter': 2, 'Fracture Rampart': 2, 'Fracture Chalice': 2,
    // Tank damage weapons
    'Void Earthbreaker': 2, 'Fracture Colossus': 1,
    // PB-PA weapons — rare
    'Abyss Annihilator': 1, 'Abyss Phantom': 1, 'Abyss Tome': 1, 'Abyss Fortress': 1, 'Abyss Lantern': 1,
    // PS weapons — one per restock
    "Malachar's Fist": 1, "Malachar's Shadow": 1, "Malachar's Gospel": 1, "Malachar's Seal": 1, "Malachar's Grace": 1,
};

const PRESTIGE_ITEMS = {
    consumables: [
        { name: 'Void Elixir',     price: 5000,   desc: 'Restores 60% HP. Void-infused.',  type: 'consumable' },
        { name: 'Fracture Potion', price: 12000,  desc: 'Restores full HP.',               type: 'consumable' },
        { name: 'Abyss Tonic',     price: 20000,  desc: '+50% damage for 3 turns.',        type: 'consumable' },
        { name: 'Prestige Bag',    price: 40000,  desc: '30 slots. Near-indestructible.',  type: 'bag', slots: 30, durability: 500 }
    ],

    Berserker: [
        // PF tier — affordable after ~10 runs
        { name: 'Void Crusher',      price: 35000,    minPrestige: 1, stats: { strength: 350, attack: 320 }, durability: 220, desc: 'Forged from the bones of a void titan.' },
        // PD tier
        { name: 'Fracture Cleaver',  price: 130000,   minPrestige: 1, stats: { strength: 700, attack: 660 }, durability: 280, desc: 'Every swing tears a small hole in reality.' },
        // PB tier
        { name: 'Abyss Annihilator', price: 500000,   minPrestige: 1, stats: { strength: 1400, attack: 1300 }, durability: 350, desc: 'It remembers every world it has ended.' },
        // PS tier
        { name: "Malachar's Fist",   price: 2000000,  minPrestige: 2, stats: { strength: 2800, attack: 2600, stamina: 400 }, durability: 500, desc: "Torn from Malachar's own gauntlet during the first war." }
    ],

    Assassin: [
        { name: 'Void Fang',         price: 35000,    minPrestige: 1, stats: { agility: 350, attack: 340 }, durability: 220, desc: "Leaves wounds that don't close." },
        { name: 'Fracture Edge',     price: 130000,   minPrestige: 1, stats: { agility: 700, attack: 680 }, durability: 280, desc: 'Phases through armour.' },
        { name: 'Abyss Phantom',     price: 500000,   minPrestige: 1, stats: { agility: 1400, attack: 1350 }, durability: 350, desc: 'Invisible even when in use.' },
        { name: "Malachar's Shadow", price: 2000000,  minPrestige: 2, stats: { agility: 2800, attack: 2700, strength: 300 }, durability: 500, desc: 'This blade existed before its owner did.' }
    ],

    Mage: [
        { name: 'Void Codex',        price: 35000,    minPrestige: 1, stats: { intelligence: 350, attack: 320 }, durability: 220, desc: 'Writes its own spells.' },
        { name: 'Fracture Scepter',  price: 130000,   minPrestige: 1, stats: { intelligence: 700, attack: 670 }, durability: 280, desc: 'Each cast destabilises local space-time.' },
        { name: 'Abyss Tome',        price: 500000,   minPrestige: 1, stats: { intelligence: 1400, attack: 1300 }, durability: 350, desc: 'Contains spells from a civilisation that no longer exists.' },
        { name: "Malachar's Gospel", price: 2000000,  minPrestige: 2, stats: { intelligence: 2800, attack: 2600, stamina: 300 }, durability: 500, desc: 'Malachar wrote this himself. It was found in the rubble.' }
    ],

    Tank: [
        { name: 'Void Bulwark',       price: 35000,   minPrestige: 1, stats: { stamina: 350, defense: 400 }, durability: 280, desc: 'Absorbs void energy and converts it to protection.' },
        { name: 'Void Earthbreaker',  price: 100000,  minPrestige: 1, stats: { stamina: 700, strength: 500, attack: 450 }, durability: 300, desc: 'Channels void energy through sheer mass.' },
        { name: 'Fracture Rampart',   price: 130000,  minPrestige: 1, stats: { stamina: 700, defense: 780 }, durability: 350, desc: "Hits against it feel wrong." },
        { name: 'Fracture Colossus',  price: 400000,  minPrestige: 1, stats: { stamina: 1500, strength: 1000, attack: 900 }, durability: 380, desc: 'Built for one purpose.' },
        { name: 'Abyss Fortress',     price: 500000,  minPrestige: 1, stats: { stamina: 1400, defense: 1600 }, durability: 450, desc: "Ancient. Pre-dates the Gates." },
        { name: "Malachar's Seal",    price: 2000000, minPrestige: 2, stats: { stamina: 2800, defense: 3200, strength: 300 }, durability: 600, desc: 'It was the original seal. Repurposed.' }
    ],

    Healer: [
        { name: 'Void Mend',         price: 35000,   minPrestige: 1, stats: { intelligence: 350, stamina: 250 }, durability: 220, desc: 'Heals wounds conventional medicine could not touch.' },
        { name: 'Fracture Chalice',  price: 130000,  minPrestige: 1, stats: { intelligence: 700, stamina: 500 }, durability: 280, desc: 'The healing burns. But it works faster.' },
        { name: 'Abyss Lantern',     price: 500000,  minPrestige: 1, stats: { intelligence: 1400, stamina: 1000 }, durability: 350, desc: 'Carries the light of a world that no longer exists.' },
        { name: "Malachar's Grace",  price: 2000000, minPrestige: 2, stats: { intelligence: 2800, stamina: 2000 }, durability: 500, desc: "Malachar had healers. This belonged to the last one." }
    ]
};

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

async function getPrestigeStock(itemName) {
    const [rows] = await db.execute("SELECT stock FROM prestige_shop_stock WHERE item_name=?", [itemName]);
    if (rows.length) return rows[0].stock;
    const max = PRESTIGE_STOCK[itemName] || 1;
    await db.execute("INSERT INTO prestige_shop_stock (item_name, stock, max_stock) VALUES (?, ?, ?)", [itemName, max, max]);
    return max;
}

async function decreasePrestigeStock(itemName) {
    await db.execute("UPDATE prestige_shop_stock SET stock = GREATEST(0, stock - 1) WHERE item_name=?", [itemName]);
}

async function restockPrestigeShop() {
    await ensurePrestigeStockTable();
    const allItems = [
        ...PRESTIGE_ITEMS.consumables,
        ...Object.values(PRESTIGE_ITEMS).filter(Array.isArray).flat()
    ];
    for (const item of allItems) {
        const max = PRESTIGE_STOCK[item.name] || 1;
        await db.execute(
            `INSERT INTO prestige_shop_stock (item_name, stock, max_stock)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE stock=?, max_stock=?`,
            [item.name, max, max, max, max]
        );
    }
    console.log('★ Prestige shop restocked.');
}

async function getPrestigeShopItems(playerId, role, prestigeLevel) {
    await ensurePrestigeStockTable();
    const roleItems   = PRESTIGE_ITEMS[role] || [];
    const consumables = PRESTIGE_ITEMS.consumables;
    const available   = roleItems.filter(i => (i.minPrestige || 1) <= prestigeLevel);
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

    const stock = await getPrestigeStock(item.name);
    if (stock <= 0) return { ok: false, reason: `*${item.name}* is out of stock. Restocks daily.` };

    const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [playerId]);
    const playerGold = gold[0]?.gold || 0;
    if (playerGold < item.price) return { ok: false, reason: `Need ${item.price.toLocaleString()} Gold. You have ${playerGold.toLocaleString()}.` };

    await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [item.price, playerId]);
    await decreasePrestigeStock(item.name);

    if (item.type === 'bag') {
        await db.execute("INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped) VALUES (?, ?, 'bag', 1, 0)", [playerId, item.name]);
    } else if (item.type === 'consumable') {
        await db.execute("INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped) VALUES (?, ?, 'consumable', 1, 0)", [playerId, item.name]);
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