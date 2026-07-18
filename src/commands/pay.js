const db = require('../database/db');

module.exports = {
    name: 'pay',
    async execute(msg, args, { userId }) {
        if (!args[0] || !args[1]) {
            return msg.reply(
                `══〘 💰 PAY 〙══╮\n` +
                `┃◆ ❌ Use: !pay @user <amount>\n` +
                `╰═══════════════════════╯`
            );
        }

        const mentioned = msg.mentionedIds;
        if (!mentioned.length) {
            return msg.reply(
                `══〘 💰 PAY 〙══╮\n` +
                `┃◆ ❌ Mention a player.\n` +
                `╰═══════════════════════╯`
            );
        }

        const targetId = mentioned[0].replace(/@c\.us/g, "").split("@")[0];
        const amount   = parseInt(args[1]);

        // Lumens transfers between players in the SAME active dungeon are allowed.
        // Paying someone outside the dungeon, or in a different dungeon, is blocked.
        const [sPayD] = await db.execute("SELECT dp.dungeon_id FROM dungeon_players dp JOIN dungeon d ON d.id=dp.dungeon_id WHERE dp.player_id=? AND dp.is_alive=1 AND d.is_active=1", [userId]);
        const [tPayD] = await db.execute("SELECT dp.dungeon_id FROM dungeon_players dp JOIN dungeon d ON d.id=dp.dungeon_id WHERE dp.player_id=? AND dp.is_alive=1 AND d.is_active=1", [targetId]);
        const sInDungeon = sPayD.length > 0;
        const tInDungeon = tPayD.length > 0;
        const samePayDungeon = sInDungeon && tInDungeon && sPayD[0].dungeon_id === tPayD[0].dungeon_id;

        if ((sInDungeon || tInDungeon) && !samePayDungeon) {
            if (sInDungeon && !tInDungeon) return msg.reply(
                `══〘 💰 PAY 〙══╮\n┃◆ ❌ You cannot send gold to\n┃◆ someone outside the dungeon.\n╰═══════════════════════╯`
            );
            if (tInDungeon && !sInDungeon) return msg.reply(
                `══〘 💰 PAY 〙══╮\n┃◆ ❌ Cannot pay a player\n┃◆ currently inside a dungeon.\n╰═══════════════════════╯`
            );
            return msg.reply(
                `══〘 💰 PAY 〙══╮\n┃◆ ❌ You are both in dungeons,\n┃◆ but not the same one.\n╰═══════════════════════╯`
            );
        }

        if (isNaN(amount) || amount <= 0) {
            return msg.reply(
                `══〘 💰 PAY 〙══╮\n` +
                `┃◆ ❌ Invalid amount.\n` +
                `╰═══════════════════════╯`
            );
        }

        if (targetId === userId) {
            return msg.reply(
                `══〘 💰 PAY 〙══╮\n` +
                `┃◆ ❌ You cannot pay yourself.\n` +
                `╰═══════════════════════╯`
            );
        }

        try {
            const [target] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
            if (!target.length) {
                return msg.reply(
                    `══〘 💰 PAY 〙══╮\n` +
                    `┃◆ ❌ That player is not registered.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const [sender] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            if (!sender.length || sender[0].gold < amount) {
                return msg.reply(
                    `══〘 💰 PAY 〙══╮\n` +
                    `┃◆ ❌ Not enough gold.\n` +
                    `┃◆ You have: ${sender[0]?.gold || 0} gold\n` +
                    `╰═══════════════════════╯`
                );
            }

            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [amount, userId]);
            await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [amount, targetId]);

            return msg.reply(
                `══〘 💰 GOLD SENT 〙══╮\n` +
                `┃◆ To:     ${target[0].nickname}\n` +
                `┃◆ Amount: ${amount} Lumens\n` +
                `┃◆ ✅ Transfer successful.\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(
                `══〘 💰 PAY 〙══╮\n` +
                `┃◆ ❌ Payment failed.\n` +
                `╰═══════════════════════╯`
            );
        }
    }
};