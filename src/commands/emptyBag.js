const db = require('../database/db');
const { emptyBag, getPlayerBag } = require('../systems/bagSystem');

module.exports = {
    name: 'emptybag',
    async execute(msg, args, { userId }) {
        try {
            const bag = await getPlayerBag(userId);
            if (!bag) return msg.reply(
                `══〘 🎒 EMPTY BAG 〙══╮\n` +
                `┃◆ ❌ You don't have a bag.\n` +
                `┃◆ Buy one from the shop.\n` +
                `╰═══════════════════════╯`
            );

            // Can't empty while in dungeon
            const [inDungeon] = await db.execute(
                "SELECT * FROM dungeon_players WHERE player_id=? AND is_alive=1", [userId]
            );
            if (inDungeon.length) return msg.reply(
                `══〘 🎒 EMPTY BAG 〙══╮\n` +
                `┃◆ ❌ You are still in a dungeon.\n` +
                `┃◆ Clear the dungeon first.\n` +
                `╰═══════════════════════╯`
            );

            const result = await emptyBag(userId);

            if (!result.ok) {
                if (result.reason === 'empty') return msg.reply(
                    `══〘 🎒 EMPTY BAG 〙══╮\n┃◆ ❌ Your bag is empty.\n╰═══════════════════════╯`
                );
                return msg.reply(
                    `══〘 🎒 EMPTY BAG 〙══╮\n┃◆ ❌ Could not empty bag.\n╰═══════════════════════╯`
                );
            }

            let text =
                `══〘 🎒 BAG EMPTIED 〙══╮\n` +
                `┃◆ Materials banked:\n` +
                `┃◆────────────\n`;

            result.contents.forEach(c => {
                text += `┃◆ ${c.material} ×${c.quantity}\n`;
            });

            if (result.bagBroke) {
                text +=
                    `┃◆────────────\n` +
                    `┃◆ ⚠️ Your bag fell apart from wear.\n` +
                    `┃◆ Buy a new one from the shop.\n`;
            } else {
                text += `┃◆────────────\n┃◆ 🎒 Durability: ${result.durability}/${bag.max_durability}\n`;
            }

            text += `╰═══════════════════════╯`;
            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🎒 EMPTY BAG 〙══╮\n┃◆ ❌ Failed.\n╰═══════════════════════╯`);
        }
    }
};