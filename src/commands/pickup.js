const { getPendingDrop, clearPendingDrop, addToBag, getPlayerBag } = require('../systems/bagSystem');

module.exports = {
    name: 'pickup',
    async execute(msg, args, { userId }) {
        try {
            const drop = getPendingDrop(userId);
            if (!drop) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n` +
                `┃◆ ❌ No pending drop.\n` +
                `┃◆ Drops expire after 60 seconds.\n` +
                `╰═══════════════════════╯`
            );

            const bag = await getPlayerBag(userId);
            if (!bag) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n` +
                `┃◆ ❌ You don't have a bag.\n` +
                `┃◆ Buy one from the shop first.\n` +
                `╰═══════════════════════╯`
            );
            if (bag.durability <= 0) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n` +
                `┃◆ ❌ Your bag is broken.\n` +
                `┃◆ Use !repairbag to fix it.\n` +
                `╰═══════════════════════╯`
            );

            const result = await addToBag(userId, drop.material, 1);

            if (!result.ok) {
                if (result.reason === 'full') return msg.reply(
                    `══〘 💎 PICKUP 〙══╮\n` +
                    `┃◆ ❌ Bag is full (${result.used}/${result.slots} slots).\n` +
                    `┃◆ !emptybag to bank items first.\n` +
                    `╰═══════════════════════╯`
                );
                return msg.reply(
                    `══〘 💎 PICKUP 〙══╮\n┃◆ ❌ Could not pick up item.\n╰═══════════════════════╯`
                );
            }

            clearPendingDrop(userId);

            return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n` +
                `┃◆ ✅ Picked up!\n` +
                `┃◆ ${drop.emoji} *${drop.material}*\n` +
                `┃◆ [${drop.rarity.toUpperCase()}]\n` +
                `┃◆ Stored in your bag.\n` +
                `┃◆ !checkbag to view contents.\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 💎 PICKUP 〙══╮\n┃◆ ❌ Pickup failed.\n╰═══════════════════════╯`);
        }
    }
};