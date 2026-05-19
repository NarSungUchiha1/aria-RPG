const db = require('../database/db');
const { POTIONS } = require('../systems/potions');

module.exports = {
    name: 'mypotions',

    async execute(msg, args, { userId }) {

        try {

            const [playerRows] = await db.execute(
                "SELECT role, nickname FROM players WHERE id=?",
                [userId]
            );

            if (!playerRows.length) {
                return msg.reply("❌ Not registered.");
            }

            const player = playerRows[0];

            // get owned potions
            const [pots] = await db.execute(
                `SELECT *
                 FROM potion_inventory
                 WHERE player_id=?
                 AND quantity > 0`,
                [userId]
            );

            if (!pots.length) {
                return msg.reply(
`╔══〘 ⚗️ POTION INVENTORY 〙══╗
┃◆ You have no potions.
╚══════════════════════════════╝`
                );
            }

            let text =
`╔══〘 ⚗️ POTION INVENTORY 〙══╗
┃◆ 👤 ${player.nickname}
┃◆ 🎭 ${player.role}
┃◆\n`;

            for (const p of pots) {

                const pot = POTIONS[p.potion_name];

                text +=
`┃◆ 🧪 ${p.potion_name}
┃◆ 📦 Qty: ${p.quantity}
┃◆ ${pot?.desc || "Unknown Potion"}
┃◆\n`;
            }

            // explorer bonus info
            if (player.role === "Explorer") {
                text +=
`┃◆━━━━━━━━━━━━━━━━
┃◆ 🧪 Explorer Vault Access
┃◆ You can brew & list potions
┃◆ using !potionmarket list
┃◆━━━━━━━━━━━━━━━━\n`;
            }

            text += `╚══════════════════════════════╝`;

            return msg.reply(text);

        } catch (err) {
            console.error(err);
            msg.reply("❌ Failed to load potions.");
        }
    }
};