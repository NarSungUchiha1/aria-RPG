const db = require('./src/database/db');

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

async function updateForgedWeaponsToPrestigeGrade() {
    try {
        console.log('Starting forged weapons grade update...');

        // Create a comma-separated list of weapon names for the SQL query
        const namePlaceholders = FORGED_WEAPON_NAMES.map(() => '?').join(',');
        const query = `UPDATE inventory SET grade = 'P' WHERE item_name IN (${namePlaceholders}) AND item_type = 'weapon'`;

        const result = await db.execute(query, FORGED_WEAPON_NAMES);
        console.log(`Updated ${result[0].affectedRows} forged weapons to prestige grade (P)`);

        // Verify the update
        const verifyQuery = `SELECT COUNT(*) as count FROM inventory WHERE item_name IN (${namePlaceholders}) AND item_type = 'weapon' AND grade = 'P'`;
        const verifyResult = await db.execute(verifyQuery, FORGED_WEAPON_NAMES);
        console.log(`Verification: ${verifyResult[0][0].count} weapons now have prestige grade`);

        console.log('Forged weapons grade update completed successfully!');
    } catch (error) {
        console.error('Error updating forged weapons:', error);
    } finally {
        process.exit(0);
    }
}

// Run the update if this script is executed directly
if (require.main === module) {
    updateForgedWeaponsToPrestigeGrade();
}

module.exports = { updateForgedWeaponsToPrestigeGrade, FORGED_WEAPON_NAMES };