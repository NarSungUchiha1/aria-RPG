const db = require('../database/db');
const getUserId = require('../utils/getUserId');

module.exports = {
    name: 'duel',
    async execute(msg, args, { userId, client }) {
        if (args.length < 1) {
            return msg.reply("❌ Use: !duel @user [bet amount]");
        }

        // Extract target from mention
        let targetId = null;
        if (msg.mentionedIds.length > 0) {
            targetId = msg.mentionedIds[0].replace(/@c\.us/g, "").split("@")[0];
        } else {
            return msg.reply("❌ You must mention a player to duel.");
        }

        if (targetId === userId) {
            return msg.reply("❌ You cannot duel yourself.");
        }

        // Check if target exists
        const [target] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
        if (!target.length) {
            return msg.reply("❌ That player is not registered.");
        }

        // Check if either player is dead
        const [challengerHp] = await db.execute("SELECT hp FROM players WHERE id=?", [userId]);
        if (challengerHp.length && challengerHp[0].hp <= 0) {
            return msg.reply("❌ You are dead and cannot duel. Use !respawn.");
        }
        const [targetHp] = await db.execute("SELECT hp FROM players WHERE id=?", [targetId]);
        if (targetHp.length && targetHp[0].hp <= 0) {
            return msg.reply("❌ That player is dead and cannot duel.");
        }

        // Check if target is inside a dungeon (cannot duel)
        const [inDungeon] = await db.execute(
            "SELECT * FROM dungeon_players WHERE player_id=? AND is_alive=1",
            [targetId]
        );
        if (inDungeon.length) {
            return msg.reply("❌ That player is inside a dungeon and cannot duel.");
        }

        // Check if challenger is in dungeon
        const [challengerInDungeon] = await db.execute(
            "SELECT * FROM dungeon_players WHERE player_id=? AND is_alive=1",
            [userId]
        );
        if (challengerInDungeon.length) {
            return msg.reply("❌ You are inside a dungeon and cannot duel.");
        }

        // Parse bet amount
        let betAmount = 0;
        if (args[1]) {
            betAmount = parseInt(args[1]);
            if (isNaN(betAmount) || betAmount < 0) {
                return msg.reply("❌ Invalid bet amount.");
            }
        }

        // If bet > 0, check challenger has enough gold
        if (betAmount > 0) {
            const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            if (!gold.length || gold[0].gold < betAmount) {
                return msg.reply(`❌ You don't have ${betAmount} gold to bet.`);
            }
            // Check target has enough gold
            const [targetGold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [targetId]);
            if (!targetGold.length || targetGold[0].gold < betAmount) {
                return msg.reply(`❌ ${target[0].nickname} doesn't have ${betAmount} gold.`);
            }
        }

        // Check for existing pending challenge between these two
        const [existing] = await db.execute(
            "SELECT * FROM pvp_challenges WHERE challenger_id=? AND target_id=? AND status='pending' AND expires_at > NOW()",
            [userId, targetId]
        );
        if (existing.length) {
            return msg.reply("❌ You already have a pending challenge with this player.");
        }

        // Create challenge with bet amount
        await db.execute(
            "INSERT INTO pvp_challenges (challenger_id, target_id, bet_amount) VALUES (?, ?, ?)",
            [userId, targetId, betAmount]
        );

        // Notify target
        const challengerContact = await msg.getContact();
        const challengerName = challengerContact.pushname || userId;
        const betText = betAmount > 0 ? ` for ${betAmount} gold` : '';

        return msg.reply(`══〘 ⚔️ DUEL CHALLENGE 〙══╮
┃◆ ${challengerName} challenges ${target[0].nickname}${betText}!
┃◆ Type !accept @${challengerName} to fight, or !decline to refuse.
┃◆ Challenge expires in 5 minutes.
╰═══════════════════════╯`);
    }
};