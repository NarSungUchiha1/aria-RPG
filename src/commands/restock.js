const db = require('../database/db');
const { restockAllItems } = require('../systems/shopSystem');

module.exports = {
    name: 'restock',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply(
            `══〘 🛒 RESTOCK 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );

        // No args — restock everything
        if (!args.length) {
            try {
                await restockAllItems();
                return msg.reply(
                    `══〘 🛒 RESTOCK 〙══╮\n` +
                    `┃◆ ✅ All shop items restocked!\n` +
                    `┃◆ Mana Potion guaranteed at 10.\n` +
                    `╰═══════════════════════╯`
                );
            } catch (err) {
                console.error(err);
                return msg.reply(`══〘 🛒 RESTOCK 〙══╮\n┃◆ ❌ Restock failed.\n╰═══════════════════════╯`);
            }
        }

        // Specific item restock
        let amount = null;
        const lastArg = args[args.length - 1];
        if (!isNaN(lastArg)) { amount = parseInt(lastArg); args.pop(); }
        const itemName = args.join(' ').trim();
        if (!itemName) return msg.reply(`══〘 🛒 RESTOCK 〙══╮\n┃◆ ❌ Specify an item name.\n╰═══════════════════════╯`);

        try {
            const [rows] = await db.execute("SELECT * FROM shop_stock WHERE item_name=?", [itemName]);
            if (!rows.length) {
                const newStock = amount || 5;
                await db.execute(
                    "INSERT INTO shop_stock (item_name, stock, max_stock, restocked_amount, last_restock) VALUES (?, ?, ?, ?, NOW())",
                    [itemName, newStock, newStock, newStock]
                );
                return msg.reply(`══〘 🛒 RESTOCK 〙══╮\n┃◆ ✅ ${itemName} added.\n┃◆ Stock: ${newStock}\n╰═══════════════════════╯`);
            }
            const maxStock = rows[0].max_stock || 5;
            const newStock = amount !== null ? amount : maxStock;
            await db.execute("UPDATE shop_stock SET stock=?, last_restock=NOW() WHERE item_name=?", [newStock, itemName]);
            return msg.reply(`══〘 🛒 RESTOCK 〙══╮\n┃◆ ✅ ${itemName}\n┃◆ Stock: ${newStock}/${maxStock}\n╰═══════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🛒 RESTOCK 〙══╮\n┃◆ ❌ Restock failed.\n╰═══════════════════════╯`);
        }
    }
};