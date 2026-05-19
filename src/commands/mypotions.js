const db = require('../database/db');
const { POTIONS } = require('../systems/potions');

module.exports = {
    name: 'mypotions',

    async execute(msg, args, { userId }) {

        try {

            const [player] = await db.execute(
                "SELECT role FROM players WHERE id=?",
                [userId]
            );

            if (!player.length) {
                return msg.reply("❌ Not registered.");
            }

            if (player[0].role !== "Explorer") {
                return msg.reply(
`╔══〘 ⚗️ POTION VAULT 〙══╗
┃◆ ❌ Only Explorers can use this.
╚═══════════════════════════╝`
                );
            }

            const [pots] = await db.execute(
                "SELECT * FROM potion_inventory WHERE player_id=? AND quantity > 0",
                [userId]
            );

            if (!pots.length) {
                return msg.reply(
`╔══〘 ⚗️ POTION VAULT 〙══╗
┃◆ You have no brewed potions.
╚═══════════════════════════╝`
                );
            }

            let text =
`╔══〘 ⚗️ YOUR POTIONS 〙══╗
┃◆\n`;

            for (const p of pots) {

                const pot = POTIONS[p.potion_name];

                text +=
`┃◆ 🧪 ${p.potion_name}
┃◆ Qty: ${p.quantity}
┃◆ ${pot?.desc || "Unknown Potion"}
┃◆\n`;
            }

            text += `╚═══════════════════════════╝`;

            msg.reply(text);

        } catch (err) {
            console.error(err);
            msg.reply("❌ Failed to load potions.");
        }
    }
};