const db = require('../database/db');

// List of all forged weapon names that should be prestige grade
const FORGED_WEAPON_NAMES = [
    // Common tier
    "Bonecrusher", "Thorn Dagger", "Iron Ward", "Bone Staff", "Splint Mace",
    // Uncommon tier
    "Shadow Fang", "Ember Greatsword", "Frost Barrier", "Venom Codex", "Ember Chalice",
    // Rare tier
    "Soulreaper", "Void Edge", "Stormwall", "Blood Grimoire", "Soul Lantern",
    // Legendary tier
    "Abyssal Reckoning", "Wraithblade", "Aegis of Eternity", "The Last Word", "Cradle of Life",
    // Prestige weapons
    "Void Ravager", "Fracture Titan Blade", "Malachars Replica",
    "Void Phantom Blade", "Fracture Reaper", "Malachars Shadow Replica",
    "Void Grimoire", "Fracture Codex Supreme", "Malachars Gospel Replica",
    "Void Aegis", "Fracture Fortress Shield"
];

module.exports = {
    name: 'updateforged',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply(
            `╔══〘 ✦ UPDATE FORGED 〙══╗\n┃★ ❌ Admin only.\n╚═══════════════════════════╝`
        );

        try {
            msg.reply(`╔══〘 ✦ UPDATE FORGED 〙══╗\n┃★ 🔄 Updating forged weapons to prestige grade...\n╚═══════════════════════════╝`);

            // Create a comma-separated list of weapon names for the SQL query
            const namePlaceholders = FORGED_WEAPON_NAMES.map(() => '?').join(',');
            const query = `UPDATE inventory SET grade = 'P' WHERE item_name IN (${namePlaceholders}) AND item_type = 'weapon'`;

            const result = await db.execute(query, FORGED_WEAPON_NAMES);

            // Verify the update
            const verifyQuery = `SELECT COUNT(*) as count FROM inventory WHERE item_name IN (${namePlaceholders}) AND item_type = 'weapon' AND grade = 'P'`;
            const verifyResult = await db.execute(verifyQuery, FORGED_WEAPON_NAMES);

            return msg.reply(
                `╔══〘 ✦ UPDATE FORGED 〙══╗\n` +
                `┃★ ✅ Updated ${result[0].affectedRows} forged weapons to prestige grade!\n` +
                `┃★ 📊 Total prestige-grade forged weapons: ${verifyResult[0][0].count}\n` +
                `┃★ Prestige players can now equip their forged weapons.\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error('updateforged error:', err);
            msg.reply(`╔══〘 ✦ UPDATE FORGED 〙══╗\n┃★ ❌ Update failed: ${err.message}\n╚═══════════════════════════╝`);
        }
    }
};