const db = require('../database/db');

module.exports = {
    name: 'tradematerial',
    async execute(msg, args, { userId }) {
        if (!msg.mentionedIds.length || !args[1] || !args[2]) return msg.reply(
            `══〘 💎 TRADE MATERIAL 〙══╮\n` +
            `┃◆ ❌ Use: !tradematerial @user <material name> <qty>\n` +
            `┃◆ Example: !tradematerial @john Iron Shard 3\n` +
            `╰═══════════════════════╯`
        );

        const targetId = msg.mentionedIds[0].replace(/@c\.us/g, '').split('@')[0];
        if (targetId === userId) return msg.reply(
            `══〘 💎 TRADE MATERIAL 〙══╮\n┃◆ ❌ Cannot trade with yourself.\n╰═══════════════════════╯`
        );

        // Parse material name and quantity — qty is last arg, name is everything in between
        const qty = parseInt(args[args.length - 1]);
        if (isNaN(qty) || qty < 1) return msg.reply(
            `══〘 💎 TRADE MATERIAL 〙══╮\n┃◆ ❌ Invalid quantity.\n╰═══════════════════════╯`
        );

        // Material name = all args after @mention, before qty
        const mentionArg = args[0]; // @mention
        const materialName = args.slice(1, args.length - 1).join(' ');
        if (!materialName) return msg.reply(
            `══〘 💎 TRADE MATERIAL 〙══╮\n┃◆ ❌ Specify a material name.\n╰═══════════════════════╯`
        );

        try {
            const [sender] = await db.execute("SELECT nickname FROM players WHERE id=?", [userId]);
            const [target] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);

            if (!sender.length) return msg.reply(`══〘 💎 TRADE MATERIAL 〙══╮\n┃◆ ❌ You are not registered.\n╰═══════════════════════╯`);
            if (!target.length) return msg.reply(`══〘 💎 TRADE MATERIAL 〙══╮\n┃◆ ❌ Target player not registered.\n╰═══════════════════════╯`);

            // Check sender has the material
            const [held] = await db.execute(
                "SELECT quantity FROM player_materials WHERE player_id=? AND material=?",
                [userId, materialName]
            );

            if (!held.length || held[0].quantity < qty) return msg.reply(
                `══〘 💎 TRADE MATERIAL 〙══╮\n` +
                `┃◆ ❌ You don't have enough.\n` +
                `┃◆ Need: ${qty}× ${materialName}\n` +
                `┃◆ Have: ${held[0]?.quantity || 0}\n` +
                `╰═══════════════════════╯`
            );

            // Transfer
            await db.execute(
                "UPDATE player_materials SET quantity = quantity - ? WHERE player_id=? AND material=?",
                [qty, userId, materialName]
            );
            await db.execute(
                "DELETE FROM player_materials WHERE player_id=? AND material=? AND quantity <= 0",
                [userId, materialName]
            );
            await db.execute(
                `INSERT INTO player_materials (player_id, material, quantity)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE quantity = quantity + ?`,
                [targetId, materialName, qty, qty]
            );

            return msg.reply(
                `══〘 💎 TRADE MATERIAL 〙══╮\n` +
                `┃◆ ✅ Trade complete!\n` +
                `┃◆ \n` +
                `┃◆ ${qty}× *${materialName}*\n` +
                `┃◆ sent to *${target[0].nickname}*\n` +
                `┃◆ \n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 💎 TRADE MATERIAL 〙══╮\n┃◆ ❌ Trade failed.\n╰═══════════════════════╯`);
        }
    }
};