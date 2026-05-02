const db = require('../database/db');

// ~35% of original shop price for normal items
// ~20% for prestige weapons (they're powerful but you're moving on)
const MELT_VALUE = {
    // ── CONSUMABLES ─────────────────────────────────
    'Potion': 35, 'Mana Potion': 52, 'Fortify Potion': 42, 'Rage Potion': 45,
    'Eagle Eye Potion': 42, 'Cleanse Potion': 38, 'Revive Scroll': 175,
    'Fire Scroll': 63, 'Backstab Scroll': 70, 'Taunt Scroll': 70, 'War Cry Scroll': 70,
    'Poison Vial': 63, 'Smoke Bomb': 52, 'Herb Kit': 45, 'Holy Water': 52,
    'Blood Charm': 70, 'Blessing Charm': 70, 'Arrow Bundle': 42, 'Trap Kit': 56,
    'Divine Protection': 77,
    // Prestige consumables — not meltable, handled in code
    // ── BAGS ────────────────────────────────────────
    'Small Bag': 105, 'Medium Bag': 245, 'Large Bag': 525,
    'Prestige Bag': 700,
    // ── ACCESSORIES / MISC ───────────────────────────
    'Iron Skin': 52, 'Heavy Boots': 56, 'Guard Helm': 59,
    'Silent Boots': 56, 'Cloak': 49, 'Camouflage Cloak': 56,
    'Magic Cloak': 73, 'Arcane Ring': 80,
    'Bow': 77, 'Healing Staff': 98, 'Ice Wand': 91,
    // ── F RANK WEAPONS ───────────────────────────────
    'Dagger': 70, 'Battle Axe': 90, 'Rage Blade': 95, 'Warhammer': 100,
    'Shield': 77, 'Armor Plate': 84, 'Spell Book': 87, 'Heavy Blade': 87,
    // ── E RANK ───────────────────────────────────────
    'Shadow Dagger': 140, 'Arcane Staff': 147,
    'Iron Greatsword': 143, 'Tower Shield': 150,
    // ── D RANK ───────────────────────────────────────
    'Twin Fang Blades': 245, 'Frostbane Wand': 252, 'Vanguard Helm': 238,
    // ── C RANK ───────────────────────────────────────
    'Wind Katana': 420, 'Nightshade Bow': 420, 'Void Scepter': 455,
    'Golemheart Gauntlets': 385, 'Dragonbone Mace': 437,
    'Obsidian Cleaver': 350000, 'Whisperblade': 350000,
    'Inferno Rod': 350000, 'Bulwark of Stone': 350000,
    // ── B RANK ───────────────────────────────────────
    'Celestial Orb': 700000, 'Abyssal Greatsword': 875000,
    'Voidreaper Dagger': 875000, 'Staff of the Eternal': 875000,
    'Aegis of the Fallen': 875000,
    // ── A RANK ───────────────────────────────────────
    "Titan's Wrath": 1750000, 'Eclipse Edge': 1750000,
    'Celestial Codex': 1750000, 'Fortress Aegis': 1750000,
    // ── S RANK ───────────────────────────────────────
    'Godslayer': 3500000, "Eternity's Edge": 3500000,
    'Omniscient Scepter': 3500000, 'Aegis Immortal': 3500000,
    // ── PRESTIGE WEAPONS (~20% of shop price) ────────
    'Void Crusher': 600, 'Fracture Cleaver': 1600, 'Abyss Annihilator': 4000, "Malachar's Fist": 10000,
    'Void Fang': 600, 'Fracture Edge': 1600, 'Abyss Phantom': 4000, "Malachar's Shadow": 10000,
    'Void Codex': 600, 'Fracture Scepter': 1600, 'Abyss Tome': 4000, "Malachar's Gospel": 10000,
    'Void Bulwark': 600, 'Fracture Rampart': 1600, 'Abyss Fortress': 4000, "Malachar's Seal": 10000,
    'Void Mend': 600, 'Fracture Chalice': 1600, 'Abyss Lantern': 4000, "Malachar's Grace": 10000,
};

// Prestige consumables — cannot be melted
const PRESTIGE_CONSUMABLES = new Set([
    'Void Elixir', 'Fracture Potion', 'Abyss Tonic'
]);

// Fallback by grade
const MELT_BY_GRADE = {
    F: 80, E: 145, D: 245, C: 420, B: 875000, A: 1750000, S: 3500000, P: 2000
};

module.exports = {
    name: 'melt',
    async execute(msg, args, { userId }) {
        try {
            const [playerRow] = await db.execute(
                "SELECT nickname, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
                [userId]
            );
            if (!playerRow.length) return msg.reply(
                `╔══〘 ✦ MELT 〙══╗\n┃★ ❌ Not registered.\n╚═══════════════════════════╝`
            );

            const p = playerRow[0];
            if (!p.prestige_level) return msg.reply(
                `╔══〘 ✦ MELT 〙══╗\n` +
                `┃★ ❌ Prestige players only.\n` +
                `╚═══════════════════════════╝`
            );

            // Pull full inventory — same order as !inventory
            const [allItems] = await db.execute(
                "SELECT id, item_name, item_type, grade, equipped FROM inventory WHERE player_id=? ORDER BY id",
                [userId]
            );

            // Tag each item with its inventory number and whether it's meltable
            const tagged = allItems.map((item, i) => ({
                ...item,
                inventoryNum: i + 1,
                meltable: !PRESTIGE_CONSUMABLES.has(item.item_name)
            }));

            const meltable = tagged.filter(i => i.meltable);

            // Show list if no argument
            if (!args[0]) {
                if (!meltable.length) return msg.reply(
                    `╔══〘 ✦ MELT 〙══╗\n┃★ Nothing to melt.\n╚═══════════════════════════╝`
                );

                let text = `╔══〘 ✦ MELT 〙══╗\n┃★ \n`;
                meltable.forEach(w => {
                    const grade = w.grade || 'F';
                    const val   = MELT_VALUE[w.item_name] ?? MELT_BY_GRADE[grade] ?? 80;
                    const eq    = w.equipped ? ' ⚠️' : '';
                    text += `┃★ #${w.inventoryNum}. *${w.item_name}* → ${val.toLocaleString()}G${eq}\n`;
                });
                text +=
                    `┃★ \n` +
                    `┃★ Use your !inventory number\n` +
                    `┃★ !melt <#> to destroy\n` +
                    `╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            const invNum = parseInt(args[0]);
            if (isNaN(invNum) || invNum < 1) return msg.reply(
                `╔══〘 ✦ MELT 〙══╗\n┃★ ❌ Invalid number.\n╚═══════════════════════════╝`
            );

            const weapon = meltable.find(w => w.inventoryNum === invNum);
            if (!weapon) return msg.reply(
                `╔══〘 ✦ MELT 〙══╗\n` +
                `┃★ ❌ Item #${invNum} can't be melted.\n` +
                `┃★ Use !melt to see what can.\n` +
                `╚═══════════════════════════╝`
            );

            if (weapon.equipped) return msg.reply(
                `╔══〘 ✦ MELT 〙══╗\n` +
                `┃★ ❌ Unequip *${weapon.item_name}* first.\n` +
                `╚═══════════════════════════╝`
            );

            const grade    = weapon.grade || 'F';
            const goldGain = MELT_VALUE[weapon.item_name] ?? MELT_BY_GRADE[grade] ?? 80;

            await db.execute("DELETE FROM inventory WHERE id=?", [weapon.id]);
            await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [goldGain, userId]);

            const [goldRow] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);

            return msg.reply(
                `╔══〘 ✦ MELTED 〙══╗\n` +
                `┃★ *${weapon.item_name}* dissolved.\n` +
                `┃★────────────\n` +
                `┃★ 💰 +${goldGain.toLocaleString()} Gold\n` +
                `┃★ Balance: ${(goldRow[0]?.gold || 0).toLocaleString()}G\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`╔══〘 ✦ MELT 〙══╗\n┃★ ❌ Melt failed.\n╚═══════════════════════════╝`);
        }
    }
};