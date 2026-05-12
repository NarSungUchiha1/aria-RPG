const db = require('../database/db');
const { ensureTables, HEALER_GC } = require('../systems/healerMarket');

module.exports = {
    name: 'listservice',
    async execute(msg, args, { userId, client }) {
        // Only works in the healer GC

        await ensureTables();

        try {
            const [player] = await db.execute(
                "SELECT nickname, role FROM players WHERE id=?", [userId]
            );
            if (!player.length) return msg.reply(
                `══〘 💚 LIST SERVICE 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );
            if (player[0].role !== 'Healer') return msg.reply(
                `══〘 💚 LIST SERVICE 〙══╮\n` +
                `┃◆ ❌ Only Healers can list services.\n` +
                `┃◆ Your role: ${player[0].role}\n` +
                `╰═══════════════════════╯`
            );

            // Parse: !listservice <gold> <xp> <description...>
            if (args.length < 3) return msg.reply(
                `══〘 💚 LIST SERVICE 〙══╮\n` +
                `┃◆ ❌ Use: !listservice <gold> <xp> <description>\n` +
                `┃◆ Example: !listservice 200 100 Full HP restoration\n` +
                `╰═══════════════════════╯`
            );

            const priceGold = parseInt(args[0]);
            const priceXp   = parseInt(args[1]);
            const description = args.slice(2).join(' ');

            if (isNaN(priceGold) || isNaN(priceXp) || priceGold < 0 || priceXp < 0) return msg.reply(
                `══〘 💚 LIST SERVICE 〙══╮\n` +
                `┃◆ ❌ Invalid prices. Use numbers only.\n` +
                `╰═══════════════════════╯`
            );

            await db.execute(
                `INSERT INTO healer_listings (healer_id, nickname, description, price_gold, price_xp, is_active, updated_at)
                 VALUES (?, ?, ?, ?, ?, 1, NOW())
                 ON DUPLICATE KEY UPDATE
                     nickname=?, description=?, price_gold=?, price_xp=?, is_active=1, updated_at=NOW()`,
                [userId, player[0].nickname, description, priceGold, priceXp,
                 player[0].nickname, description, priceGold, priceXp]
            );

            return msg.reply(
                `══〘 💚 SERVICE LISTED 〙══╮\n` +
                `┃◆ ✅ ${player[0].nickname}\n` +
                `┃◆ 💰 ${priceGold} Gold  ⭐ ${priceXp} XP\n` +
                `┃◆ 📋 ${description}\n` +
                `┃◆ \n` +
                `┃◆ Players can hire you with !healers\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 💚 LIST SERVICE 〙══╮\n┃◆ ❌ Failed to list service.\n╰═══════════════════════╯`);
        }
    }
};