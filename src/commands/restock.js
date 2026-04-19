const db = require('../database/db');
const { getMaxStockForItem } = require('../systems/shopSystem');

// Import the helper from shopSystem (we'll export it)
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
    "Dragonbone Mace": "C"
};

function getMaxStockForItemLocal(itemName) {
    const required = rankRequirements[itemName];
    if (!required) return 5;
    switch (required) {
        case 'E': return 4;
        case 'D': return 3;
        case 'C': return 2;
        default: return 1;
    }
}

module.exports = {
    name: 'restock',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");

        if (args.length < 1) {
            return msg.reply("❌ Use: !restock <item name> [amount]");
        }

        // Item name may have spaces; parse amount as last arg if it's a number
        let amount = null;
        const lastArg = args[args.length - 1];
        if (!isNaN(lastArg)) {
            amount = parseInt(lastArg);
            args.pop(); // remove amount from name
        }

        const itemName = args.join(' ').trim();
        if (!itemName) return msg.reply("❌ Please specify an item name.");

        try {
            // Check if item exists in shop_stock
            const [rows] = await db.execute(
                "SELECT * FROM shop_stock WHERE item_name = ?",
                [itemName]
            );

            if (rows.length === 0) {
                return msg.reply(`❌ Item "${itemName}" not found in shop database.`);
            }

            const maxStock = rows[0].max_stock || getMaxStockForItemLocal(itemName);
            const newStock = (amount !== null) ? amount : maxStock;

            if (newStock < 0 || newStock > maxStock) {
                return msg.reply(`❌ Amount must be between 0 and ${maxStock}.`);
            }

            await db.execute(
                "UPDATE shop_stock SET stock = ?, last_restock = NOW() WHERE item_name = ?",
                [newStock, itemName]
            );

            return msg.reply(`══〘 🔧 RESTOCK 〙══╮
┃◆ ${itemName}
┃◆ Stock set to: ${newStock}/${maxStock}
╰═══════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Restock failed.");
        }
    }
};