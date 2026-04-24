const db = require('../database/db');
const { ensureTables, HEALER_GC } = require('../systems/healerMarket');

module.exports = {
    name: 'contracts',
    async execute(msg, args, { userId }) {

        await ensureTables();

        try {
            const [player] = await db.execute("SELECT role FROM players WHERE id=?", [userId]);
            if (!player.length) return msg.reply(
                `══〘 📋 CONTRACTS 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );
            if (player[0].role !== 'Healer') return msg.reply(
                `══〘 📋 CONTRACTS 〙══╮\n┃◆ ❌ Only Healers can view contracts.\n╰═══════════════════════╯`
            );

            const [contracts] = await db.execute(
                "SELECT * FROM healer_contracts WHERE healer_id=? ORDER BY created_at DESC LIMIT 10",
                [userId]
            );

            if (!contracts.length) return msg.reply(
                `══〘 📋 CONTRACTS 〙══╮\n┃◆ No contracts yet.\n┃◆ Use !listservice to get started.\n╰═══════════════════════╯`
            );

            let text = `══〘 📋 MY CONTRACTS 〙══╮\n`;
            contracts.forEach((c, i) => {
                const status = c.status === 'completed' ? '✅ Done'
                             : c.status === 'cancelled' ? '❌ Cancelled'
                             : '⏳ Pending';
                const date = new Date(c.created_at).toLocaleDateString();
                text +=
                    `┃◆ ${i + 1}. *${c.client_nick}*\n` +
                    `┃◆    💰 ${c.gold_paid} Gold  ⭐ ${c.xp_paid} XP\n` +
                    `┃◆    ${status}  •  ${date}\n` +
                    `┃◆────────────\n`;
            });

            text += `╰═══════════════════════╯`;
            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 📋 CONTRACTS 〙══╮\n┃◆ ❌ Could not load contracts.\n╰═══════════════════════╯`);
        }
    }
};