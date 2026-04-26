const { repairBag, getPlayerBag } = require('../systems/bagSystem');

module.exports = {
    name: 'repairbag',
    async execute(msg, args, { userId }) {
        try {
            const bag = await getPlayerBag(userId);
            if (!bag) return msg.reply(
                `══〘 🎒 REPAIR BAG 〙══╮\n┃◆ ❌ You don't have a bag.\n╰═══════════════════════╯`
            );
            if (bag.durability >= bag.max_durability) return msg.reply(
                `══〘 🎒 REPAIR BAG 〙══╮\n┃◆ ✅ Bag is already at full durability.\n╰═══════════════════════╯`
            );

            const result = await repairBag(userId);
            if (!result.ok) {
                if (result.reason === 'no_gold') return msg.reply(
                    `══〘 🎒 REPAIR BAG 〙══╮\n` +
                    `┃◆ ❌ Not enough gold.\n` +
                    `┃◆ Need: ${result.cost} Gold\n` +
                    `┃◆ Have: ${result.gold} Gold\n` +
                    `╰═══════════════════════╯`
                );
            }

            return msg.reply(
                `══〘 🎒 REPAIR BAG 〙══╮\n` +
                `┃◆ ✅ ${bag.bag_type} repaired!\n` +
                `┃◆ 💰 Cost: ${result.cost} Gold\n` +
                `┃◆ 🎒 Durability: ${bag.max_durability}/${bag.max_durability}\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🎒 REPAIR BAG 〙══╮\n┃◆ ❌ Repair failed.\n╰═══════════════════════╯`);
        }
    }
};