const db = require('../database/db');
const { getStageDrops, claimStageDrop, addToBag, getPlayerBag, getBagSlotsUsed } = require('../systems/bagSystem');

module.exports = {
    name: 'pickup',
    async execute(msg, args, { userId }) {
        try {
            // Must be in an active dungeon
            const [inDungeon] = await db.execute(
                "SELECT dungeon_id FROM dungeon_players WHERE player_id=? AND is_alive=1",
                [userId]
            );
            if (!inDungeon.length) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n┃◆ ❌ You are not in a dungeon.\n╰═══════════════════════╯`
            );

            const dungeonId = inDungeon[0].dungeon_id;
            const drops = getStageDrops(dungeonId);

            if (!drops.length) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n` +
                `┃◆ ❌ No drops available right now.\n` +
                `┃◆ Drops appear after each stage clear.\n` +
                `╰═══════════════════════╯`
            );

            // Show list if no number given
            if (!args[0]) {
                let text = `══〘 💎 AVAILABLE DROPS 〙══╮\n┃◆ \n`;
                drops.forEach((d, i) => {
                    const status = d.takenBy ? `✅ Taken` : `⬜ Available`;
                    text += `┃◆ ${i + 1}. ${d.emoji} *${d.material}* [${d.rarity.toUpperCase()}] ${status}\n`;
                });
                text += `┃◆ \n┃◆ !pickup <number> to collect\n╰═══════════════════════╯`;
                return msg.reply(text);
            }

            const index = parseInt(args[0]) - 1;
            if (isNaN(index) || index < 0 || index >= drops.length) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n┃◆ ❌ Invalid number. Use !pickup to see list.\n╰═══════════════════════╯`
            );

            // Check bag
            const bag = await getPlayerBag(userId);
            if (!bag) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n` +
                `┃◆ ❌ You don't have a bag equipped.\n` +
                `┃◆ Buy one from the shop: !shop\n` +
                `╰═══════════════════════╯`
            );
            if (bag.durability <= 0) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n` +
                `┃◆ ❌ Your bag is broken.\n` +
                `┃◆ Use !repairbag to fix it.\n` +
                `╰═══════════════════════╯`
            );

            const used = await getBagSlotsUsed(userId);
            if (used >= bag.slots) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n` +
                `┃◆ ❌ Your bag is full! (${used}/${bag.slots} slots)\n` +
                `┃◆ Use !emptybag to bank your findings first.\n` +
                `╰═══════════════════════╯`
            );

            // Try to claim
            const claim = claimStageDrop(dungeonId, index, userId);
            if (!claim.ok) {
                if (claim.reason === 'already_taken') return msg.reply(
                    `══〘 💎 PICKUP 〙══╮\n┃◆ ❌ Someone already grabbed that one!\n╰═══════════════════════╯`
                );
                return msg.reply(
                    `══〘 💎 PICKUP 〙══╮\n┃◆ ❌ Drop no longer available.\n╰═══════════════════════╯`
                );
            }

            // Add to bag
            await addToBag(userId, claim.drop.material, 1);

            return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n` +
                `┃◆ ✅ Picked up!\n` +
                `┃◆ ${claim.drop.emoji} *${claim.drop.material}*\n` +
                `┃◆ [${claim.drop.rarity.toUpperCase()}]\n` +
                `┃◆ Stored in your bag.\n` +
                `┃◆ Slots: ${used + 1}/${bag.slots}\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 💎 PICKUP 〙══╮\n┃◆ ❌ Pickup failed.\n╰═══════════════════════╯`);
        }
    }
};