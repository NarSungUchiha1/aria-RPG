const db = require('../database/db');
const { getInventoryItem } = require('../utils/inventoryHelper');

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
    'Duskstep Boots': 55, 'Cloak': 45, 'Camouflage Cloak': 55,
    'Magic Cloak': 70, 'Arcane Ring': 75, 'Bow': 75,
    'Ember Staff': 95, 'Ice Wand': 88,
    // ── F RANK WEAPONS ────────────────────────────────────────────────
    'Duskfang Dagger': 65, 'Gloam Axe': 85, 'Duskrend Blade': 90, 'Gloamhammer': 95,
    'Duskward Shield': 72, 'Vigil Plating': 80, 'Gloam Primer': 85, 'Duskheavy Blade': 85,
    // ── E RANK ────────────────────────────────────────────────────────
    'Umbral Fang': 130, 'Gloamlight Staff': 140,
    'Duskiron Greatsword': 138, 'Duskwatch Tower': 145,
    // ── D RANK ────────────────────────────────────────────────────────
    'Twin Gloamfangs': 230, 'Gloamfrost Wand': 240, 'Vigil Helm': 225,
    // ── C RANK ────────────────────────────────────────────────────────
    'Duskwind Katana': 400, 'Nightgloam Bow': 400, 'Umbral Scepter': 430,
    'Duskstone Gauntlets': 370, 'Duskbone Mace': 420,
    // ── C RANK SPECIAL (expensive shop weapons) ───────────────────────
    'Nightglass Cleaver': 50000, 'Gloamwhisper': 50000,
    'Cinderrod': 50000, 'Bulwark of Dusk': 50000,
    // ── B RANK ────────────────────────────────────────────────────────
    'Eclipse Orb': 80000, 'Umbral Greatsword': 100000,
    'Gloamreaper Dagger': 100000, 'Staff of the Long Dusk': 100000,
    'Aegis of the Hollow': 100000,
    // ── A RANK ────────────────────────────────────────────────────────
    "Umbra Titan's Wrath": 200000, 'Eclipse Edge': 200000,
    'Twilight Codex': 200000, 'Duskwall Aegis': 200000,
    // ── S RANK ────────────────────────────────────────────────────────
    'Sunslayer': 400000, "Last Hour's Edge": 400000,
    'Umbral Oracle Scepter': 400000, 'Aegis Everdark': 400000,
    // ── PRESTIGE WEAPONS (~10% of shop price) ─────────────────────────
    'Gloam Crusher': 7500, 'Eclipse Cleaver': 20000,
    'Umbra Annihilator': 75000, "The Hollow King's Fist": 300000,
    'Gloamfang': 7500, 'Eclipse Edge': 20000,
    'Umbra Phantom': 75000, "The Hollow King's Shadow": 300000,
    'Gloam Codex': 7500, 'Eclipse Scepter': 20000,
    'Umbra Tome': 75000, "The Hollow King's Gospel": 300000,
    'Gloam Bulwark': 7500, 'Eclipse Rampart': 20000,
    'Umbra Fortress': 75000, "The Hollow King's Seal": 300000,
    'Gloam Mend': 7500, 'Eclipse Chalice': 20000,
    'Umbra Lantern': 75000, "The Hollow King's Grace": 300000,
}

// Prestige consumables — cannot be melted
const PRESTIGE_CONSUMABLES = new Set([
    'Gloam Elixir', 'Fracture Potion', 'Umbra Tonic'
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
                "SELECT id, item_name, item_type, grade, equipped FROM inventory WHERE player_id=? AND item_name NOT LIKE '%Void Shard%' ORDER BY equipped DESC, id",
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
                    text += `┃★ #${w.inventoryNum}. *${w.item_name}* → ${val.toLocaleString()}L${eq}\n`;
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
                `┃★ 💰 +${goldGain.toLocaleString()} Lumens\n` +
                `┃★ Balance: ${(goldRow[0]?.gold || 0).toLocaleString()}L\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`╔══〘 ✦ MELT 〙══╗\n┃★ ❌ Melt failed.\n╚═══════════════════════════╝`);
        }
    }
};