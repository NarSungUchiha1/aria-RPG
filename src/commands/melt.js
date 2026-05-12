const db = require('../database/db');

// Melt values — reasonable return, not worth holding onto
const MELT_VALUE = {
    // ── CONSUMABLES ──────────────────────────────────────────────────
    'Potion': 35, 'Mana Potion': 50, 'Fortify Potion': 40, 'Rage Potion': 45,
    'Eagle Eye Potion': 40, 'Cleanse Potion': 35, 'Revive Scroll': 150,
    'Fire Scroll': 60, 'Backstab Scroll': 65, 'Taunt Scroll': 65,
    'War Cry Scroll': 65, 'Poison Vial': 60, 'Smoke Bomb': 50,
    'Herb Kit': 45, 'Holy Water': 50, 'Blood Charm': 65,
    'Blessing Charm': 65, 'Arrow Bundle': 40, 'Trap Kit': 55,
    'Divine Protection': 75,
    // ── BAGS ─────────────────────────────────────────────────────────
    'Small Bag': 100, 'Medium Bag': 230, 'Large Bag': 500, 'Prestige Bag': 650,
    // ── MISC / ACCESSORIES ───────────────────────────────────────────
    'Iron Skin': 50, 'Heavy Boots': 55, 'Guard Helm': 55,
    'Silent Boots': 55, 'Cloak': 45, 'Camouflage Cloak': 55,
    'Magic Cloak': 70, 'Arcane Ring': 75, 'Bow': 75,
    'Healing Staff': 95, 'Ice Wand': 88,
    // ── F RANK WEAPONS ────────────────────────────────────────────────
    'Dagger': 65, 'Battle Axe': 85, 'Rage Blade': 90, 'Warhammer': 95,
    'Shield': 72, 'Armor Plate': 80, 'Spell Book': 85, 'Heavy Blade': 85,
    // ── E RANK ────────────────────────────────────────────────────────
    'Shadow Dagger': 130, 'Arcane Staff': 140,
    'Iron Greatsword': 138, 'Tower Shield': 145,
    // ── D RANK ────────────────────────────────────────────────────────
    'Twin Fang Blades': 230, 'Frostbane Wand': 240, 'Vanguard Helm': 225,
    // ── C RANK ────────────────────────────────────────────────────────
    'Wind Katana': 400, 'Nightshade Bow': 400, 'Void Scepter': 430,
    'Golemheart Gauntlets': 370, 'Dragonbone Mace': 420,
    // ── C RANK SPECIAL (expensive shop weapons) ───────────────────────
    'Obsidian Cleaver': 50000, 'Whisperblade': 50000,
    'Inferno Rod': 50000, 'Bulwark of Stone': 50000,
    // ── B RANK ────────────────────────────────────────────────────────
    'Celestial Orb': 80000, 'Abyssal Greatsword': 100000,
    'Voidreaper Dagger': 100000, 'Staff of the Eternal': 100000,
    'Aegis of the Fallen': 100000,
    // ── A RANK ────────────────────────────────────────────────────────
    "Titan's Wrath": 200000, 'Eclipse Edge': 200000,
    'Celestial Codex': 200000, 'Fortress Aegis': 200000,
    // ── S RANK ────────────────────────────────────────────────────────
    'Godslayer': 400000, "Eternity's Edge": 400000,
    'Omniscient Scepter': 400000, 'Aegis Immortal': 400000,
    // ── PRESTIGE WEAPONS (~10% of shop price) ─────────────────────────
    'Void Crusher': 7500, 'Fracture Cleaver': 20000,
    'Abyss Annihilator': 75000, "Malachar's Fist": 300000,
    'Void Fang': 7500, 'Fracture Edge': 20000,
    'Abyss Phantom': 75000, "Malachar's Shadow": 300000,
    'Void Codex': 7500, 'Fracture Scepter': 20000,
    'Abyss Tome': 75000, "Malachar's Gospel": 300000,
    'Void Bulwark': 7500, 'Fracture Rampart': 20000,
    'Abyss Fortress': 75000, "Malachar's Seal": 300000,
    'Void Mend': 7500, 'Fracture Chalice': 20000,
    'Abyss Lantern': 75000, "Malachar's Grace": 300000,
}

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