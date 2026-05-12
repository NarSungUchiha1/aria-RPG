const { getPlayerBag, getBagContents, getBagSlotsUsed, BAGS } = require('../systems/bagSystem');

module.exports = {
    name: 'checkbag',
    async execute(msg, args, { userId }) {
        try {
            const bag = await getPlayerBag(userId);
            if (!bag) return msg.reply(
                `══〘 🎒 BAG 〙══╮\n` +
                `┃◆ ❌ No bag equipped.\n` +
                `┃◆ Buy one from the shop:\n` +
                `┃◆ Small (5 slots) • Medium (10) • Large (20)\n` +
                `╰═══════════════════════╯`
            );

            const contents = await getBagContents(userId);
            const used = await getBagSlotsUsed(userId);

            let text =
                `══〘 🎒 YOUR BAG 〙══╮\n` +
                `┃◆ ${bag.bag_type}\n` +
                `┃◆ 🔧 Durability: ${bag.durability}/${bag.max_durability}\n` +
                `┃◆ 📦 Slots: ${used}/${bag.slots}\n` +
                `┃◆────────────\n`;

            if (!contents.length) {
                text += `┃◆ Bag is empty.\n`;
            } else {
                contents.forEach(c => { text += `┃◆ ${c.material} ×${c.quantity}\n`; });
            }

            text +=
                `┃◆────────────\n` +
                `┃◆ !emptybag → bank all findings\n` +
                `┃◆ !repairbag → repair durability\n` +
                `╰═══════════════════════╯`;

            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🎒 BAG 〙══╮\n┃◆ ❌ Failed to check bag.\n╰═══════════════════════╯`);
        }
    }
};