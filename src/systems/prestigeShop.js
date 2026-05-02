/**
 * PRESTIGE SHOP
 * Available only to Prestige players.
 * Weapons are tier above forged legendaries.
 * Each role has 3 prestige weapons per rank tier (PF-PS).
 */

const db = require('../database/db');

const PRESTIGE_ITEMS = {
    // ── ALL ROLES ────────────────────────────────────────────────────────────
    consumables: [
        { name: 'Void Elixir',        price: 500,  desc: 'Restores 60% HP. Void-infused.',        type: 'consumable' },
        { name: 'Fracture Potion',    price: 800,  desc: 'Restores full HP. Rare.',                type: 'consumable' },
        { name: 'Abyss Tonic',        price: 1200, desc: '+50% damage for 3 turns.',               type: 'consumable' },
        { name: 'Prestige Bag',       price: 2000, desc: '30 slots. Near-indestructible.',         type: 'bag', slots: 30, durability: 500 }
    ],

    // ── BERSERKER ────────────────────────────────────────────────────────────
    Berserker: [
        // PF-PE tier
        { name: 'Void Crusher',       price: 3000,  minPrestige: 1, stats: { strength: 280, attack: 260 }, durability: 220,
          desc: 'A berserker\'s weapon forged from the bones of a void titan.' },
        // PD-PC tier
        { name: 'Fracture Cleaver',   price: 8000,  minPrestige: 1, stats: { strength: 550, attack: 520 }, durability: 280,
          desc: 'Every swing tears a small hole in reality.' },
        // PB-PA tier
        { name: 'Abyss Annihilator',  price: 20000, minPrestige: 1, stats: { strength: 1100, attack: 1000 }, durability: 350,
          desc: 'It remembers every world it has ended.' },
        // PS tier
        { name: "Malachar's Fist",    price: 50000, minPrestige: 2, stats: { strength: 2200, attack: 2000, stamina: 300 }, durability: 500,
          desc: 'Torn from Malachar\'s own gauntlet during the first war.' }
    ],

    // ── ASSASSIN ─────────────────────────────────────────────────────────────
    Assassin: [
        { name: 'Void Fang',          price: 3000,  minPrestige: 1, stats: { agility: 280, attack: 270 }, durability: 220,
          desc: 'Leaves wounds that don\'t close for reasons nobody can explain.' },
        { name: 'Fracture Edge',      price: 8000,  minPrestige: 1, stats: { agility: 550, attack: 540 }, durability: 280,
          desc: 'Phases through armour. The void passes through everything.' },
        { name: 'Abyss Phantom',      price: 20000, minPrestige: 1, stats: { agility: 1100, attack: 1050 }, durability: 350,
          desc: 'Invisible even when in use. The kill just happens.' },
        { name: "Malachar's Shadow",  price: 50000, minPrestige: 2, stats: { agility: 2200, attack: 2100, strength: 200 }, durability: 500,
          desc: 'This blade existed before its owner did.' }
    ],

    // ── MAGE ─────────────────────────────────────────────────────────────────
    Mage: [
        { name: 'Void Codex',         price: 3000,  minPrestige: 1, stats: { intelligence: 280, attack: 260 }, durability: 220,
          desc: 'Writes its own spells. The mage just channels.' },
        { name: 'Fracture Scepter',   price: 8000,  minPrestige: 1, stats: { intelligence: 550, attack: 530 }, durability: 280,
          desc: 'Each cast destabilises local space-time slightly.' },
        { name: 'Abyss Tome',         price: 20000, minPrestige: 1, stats: { intelligence: 1100, attack: 1000 }, durability: 350,
          desc: 'Contains spells from a civilisation that no longer exists.' },
        { name: "Malachar's Gospel",  price: 50000, minPrestige: 2, stats: { intelligence: 2200, attack: 2000, stamina: 200 }, durability: 500,
          desc: 'Malachar wrote this himself. It was found in the rubble.' }
    ],

    // ── TANK ─────────────────────────────────────────────────────────────────
    Tank: [
        { name: 'Void Bulwark',       price: 3000,  minPrestige: 1, stats: { stamina: 280, defense: 300 }, durability: 280,
          desc: 'Absorbs void energy and converts it to protection.' },
        { name: 'Fracture Rampart',   price: 8000,  minPrestige: 1, stats: { stamina: 550, defense: 600 }, durability: 350,
          desc: 'Hits against it feel wrong. Like punching at something that isn\'t quite there.' },
        { name: 'Abyss Fortress',     price: 20000, minPrestige: 1, stats: { stamina: 1100, defense: 1200 }, durability: 450,
          desc: 'Ancient. Pre-dates the Gates. Nobody knows who made it.' },
        { name: "Malachar's Seal",    price: 50000, minPrestige: 2, stats: { stamina: 2200, defense: 2500, strength: 200 }, durability: 600,
          desc: 'It was the original seal. Repurposed. The irony is not lost on anyone.' }
    ],

    // ── HEALER ───────────────────────────────────────────────────────────────
    Healer: [
        { name: 'Void Mend',          price: 3000,  minPrestige: 1, stats: { intelligence: 280, stamina: 200 }, durability: 220,
          desc: 'Heals wounds that conventional medicine couldn\'t touch.' },
        { name: 'Fracture Chalice',   price: 8000,  minPrestige: 1, stats: { intelligence: 550, stamina: 400 }, durability: 280,
          desc: 'The healing burns. But it works faster than anything else.' },
        { name: 'Abyss Lantern',      price: 20000, minPrestige: 1, stats: { intelligence: 1100, stamina: 800 }, durability: 350,
          desc: 'Carries the light of a world that no longer exists. Still warm.' },
        { name: "Malachar's Grace",   price: 50000, minPrestige: 2, stats: { intelligence: 2200, stamina: 1500 }, durability: 500,
          desc: 'Malachar had healers. This belonged to the last one.' }
    ]
};

async function getPrestigeShopItems(playerId, role, prestigeLevel) {
    const roleItems = PRESTIGE_ITEMS[role] || [];
    const consumables = PRESTIGE_ITEMS.consumables;

    // Filter by prestige level
    const available = roleItems.filter(i => (i.minPrestige || 1) <= prestigeLevel);

    return { weapons: available, consumables };
}

async function buyPrestigeItem(playerId, itemName, role, prestigeLevel) {
    const roleItems = PRESTIGE_ITEMS[role] || [];
    const consumables = PRESTIGE_ITEMS.consumables;
    const allItems = [...roleItems, ...consumables];

    const item = allItems.find(i => i.name.toLowerCase() === itemName.toLowerCase());
    if (!item) return { ok: false, reason: 'Item not found in prestige shop.' };
    if ((item.minPrestige || 1) > prestigeLevel) return { ok: false, reason: `Requires Prestige ${item.minPrestige}.` };

    // Check gold
    const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [playerId]);
    if (!gold.length || gold[0].gold < item.price) return { ok: false, reason: `Need ${item.price} Gold. Have ${gold[0]?.gold || 0}.` };

    await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [item.price, playerId]);

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
        // Weapon
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

module.exports = { PRESTIGE_ITEMS, getPrestigeShopItems, buyPrestigeItem };