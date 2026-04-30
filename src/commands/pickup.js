const db = require('../database/db');
const { getStagePool, getRankedContributors } = require('../systems/contributionSystem');
const { addToBag, getPlayerBag, getBagSlotsUsed } = require('../systems/bagSystem');

module.exports = {
    name: 'pickup',
    async execute(msg, args, { userId }) {
        try {
            const [inDungeon] = await db.execute(
                "SELECT dungeon_id FROM dungeon_players WHERE player_id=? AND is_alive=1",
                [userId]
            );
            if (!inDungeon.length) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n┃◆ ❌ You are not in a dungeon.\n╰═══════════════════════╯`
            );

            const dungeonId = inDungeon[0].dungeon_id;
            const drops = getStagePool(dungeonId);

            if (!drops.length) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n┃◆ ❌ No drops available.\n┃◆ Drops appear after each stage clear.\n╰═══════════════════════╯`
            );

            // Show list if no number given
            if (!args[0]) {
                let text = `══〘 💎 AVAILABLE DROPS 〙══╮\n┃◆ \n`;
                drops.forEach((d, i) => {
                    text += `┃◆ ${i + 1}. ${d.emoji} *${d.material}* [${d.rarity.toUpperCase()}]\n`;
                });
                text += `┃◆ \n┃◆ !pickup <number> to collect\n┃◆ Everyone can pick each item!\n╰═══════════════════════╯`;
                return msg.reply(text);
            }

            const index = parseInt(args[0]) - 1;
            if (isNaN(index) || index < 0 || index >= drops.length) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n┃◆ ❌ Invalid number.\n╰═══════════════════════╯`
            );

            const drop = drops[index];

            // Check contribution — low contributors can't pick
            const ranked = getRankedContributors(dungeonId);
            const hasContribution = ranked.find(r => r.playerId === userId);
            if (!hasContribution) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n` +
                `┃◆ ❌ Your contribution was too low.\n` +
                `┃◆ Deal more damage or heal teammates\n` +
                `┃◆ to qualify for loot.\n` +
                `╰═══════════════════════╯`
            );

            // Check already picked this item
            if (drop.takenBy.includes(userId)) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n┃◆ ❌ You already picked that item.\n╰═══════════════════════╯`
            );

            // Check bag
            const bag = await getPlayerBag(userId);
            if (!bag) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n┃◆ ❌ No bag equipped.\n┃◆ Buy one from !shop first.\n╰═══════════════════════╯`
            );
            if (bag.durability <= 0) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n┃◆ ❌ Bag is broken. Use !repairbag.\n╰═══════════════════════╯`
            );

            const used = await getBagSlotsUsed(userId);
            if (used >= bag.slots) return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n┃◆ ❌ Bag full (${used}/${bag.slots}).\n┃◆ Use !emptybag to bank items.\n╰═══════════════════════╯`
            );

            // Add to bag — both players can get the same item
            await addToBag(userId, drop.material, 1);
            drop.takenBy.push(userId);

            return msg.reply(
                `══〘 💎 PICKUP 〙══╮\n` +
                `┃◆ ✅ Picked up!\n` +
                `┃◆ ${drop.emoji} *${drop.material}*\n` +
                `┃◆ [${drop.rarity.toUpperCase()}]\n` +
                `┃◆ Bag: ${used + 1}/${bag.slots} slots\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 💎 PICKUP 〙══╮\n┃◆ ❌ Pickup failed.\n╰═══════════════════════╯`);
        }
    }
};