const db = require('../database/db');

// Gold returned per weapon — ~35% of original shop price
const MELT_VALUE = {
    // F rank
    'Dagger': 70, 'Battle Axe': 90, 'Rage Blade': 95, 'Warhammer': 100,
    'Shield': 75, 'Armor Plate': 85, 'Spell Book': 90,
    // E rank
    'Shadow Dagger': 140, 'Arcane Staff': 145,
    'Iron Greatsword': 145, 'Tower Shield': 150,
    // D rank
    'Twin Fang Blades': 245, 'Frostbane Wand': 250, 'Vanguard Helm': 235,
    // C rank
    'Wind Katana': 420, 'Nightshade Bow': 420, 'Void Scepter': 455,
    'Golemheart Gauntlets': 385, 'Dragonbone Mace': 440,
    'Obsidian Cleaver': 350000, 'Whisperblade': 350000,
    'Inferno Rod': 350000, 'Bulwark of Stone': 350000,
    // B rank
    'Celestial Orb': 700000, 'Abyssal Greatsword': 875000,
    'Voidreaper Dagger': 875000, 'Staff of the Eternal': 875000,
    'Aegis of the Fallen': 875000,
    // A rank
    "Titan's Wrath": 1750000, 'Eclipse Edge': 1750000,
    'Celestial Codex': 1750000, 'Fortress Aegis': 1750000,
    // S rank
    'Godslayer': 3500000, "Eternity's Edge": 3500000,
    'Omniscient Scepter': 3500000, 'Aegis Immortal': 3500000,
};

// Fallback by grade if weapon not in table
const MELT_VALUE_BY_GRADE = {
    F: 80, E: 145, D: 245, C: 420, B: 875000, A: 1750000, S: 3500000
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
                `┃★ Normal weapons are melted\n` +
                `┃★ into void gold at prestige.\n` +
                `╚═══════════════════════════╝`
            );

            // Show inventory if no argument
            if (!args[0]) {
                const [weapons] = await db.execute(
                    "SELECT id, item_name, grade FROM inventory WHERE player_id=? AND item_type='weapon' AND (grade IS NULL OR grade != 'P') ORDER BY id",
                    [userId]
                );
                if (!weapons.length) return msg.reply(
                    `╔══〘 ✦ MELT 〙══╗\n` +
                    `┃★ No normal weapons to melt.\n` +
                    `┃★ All weapons are prestige grade.\n` +
                    `╚═══════════════════════════╝`
                );

                let text = `╔══〘 ✦ MELT WEAPONS 〙══╗\n┃★ \n`;
                weapons.forEach((w, i) => {
                    const grade = w.grade || 'F';
                    const val   = MELT_VALUE[w.item_name] ?? MELT_VALUE_BY_GRADE[grade] ?? 80;
                    text += `┃★ ${i + 1}. *${w.item_name}* [${grade}] → ${val}G\n`;
                });
                text +=
                    `┃★ \n` +
                    `┃★ !melt <number> to destroy\n` +
                    `┃★ and receive gold.\n` +
                    `╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            const idx = parseInt(args[0]) - 1;
            if (isNaN(idx) || idx < 0) return msg.reply(
                `╔══〘 ✦ MELT 〙══╗\n┃★ ❌ Invalid number.\n╚═══════════════════════════╝`
            );

            const [weapons] = await db.execute(
                "SELECT id, item_name, grade, equipped FROM inventory WHERE player_id=? AND item_type='weapon' AND (grade IS NULL OR grade != 'P') ORDER BY id",
                [userId]
            );

            const weapon = weapons[idx];
            if (!weapon) return msg.reply(
                `╔══〘 ✦ MELT 〙══╗\n┃★ ❌ Weapon not found.\n╚═══════════════════════════╝`
            );

            if (weapon.equipped) return msg.reply(
                `╔══〘 ✦ MELT 〙══╗\n` +
                `┃★ ❌ Unequip *${weapon.item_name}* first.\n` +
                `╚═══════════════════════════╝`
            );

            const grade    = weapon.grade || 'F';
            const goldGain = MELT_VALUE[weapon.item_name] ?? MELT_VALUE_BY_GRADE[grade] ?? 80;

            await db.execute("DELETE FROM inventory WHERE id=?", [weapon.id]);
            await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [goldGain, userId]);

            const [goldRow] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);

            return msg.reply(
                `╔══〘 ✦ MELTED 〙══╗\n` +
                `┃★ *${weapon.item_name}* [${grade}]\n` +
                `┃★ dissolved into void energy.\n` +
                `┃★────────────\n` +
                `┃★ 💰 +${goldGain} Gold\n` +
                `┃★ Balance: ${(goldRow[0]?.gold || 0).toLocaleString()}G\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`╔══〘 ✦ MELT 〙══╗\n┃★ ❌ Melt failed.\n╚═══════════════════════════╝`);
        }
    }
};