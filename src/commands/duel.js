const db = require('../database/db');

module.exports = {
    name: 'duel',
    async execute(msg, args, { userId, client }) {
        if (args.length < 1) {
            return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n` +
                `┃◆ ❌ Use: !duel @user [bet]\n` +
                `╰═══════════════════════╯`
            );
        }

        let targetId = null;
        if (msg.mentionedIds.length > 0) {
            targetId = msg.mentionedIds[0].replace(/@c\.us/g, "").split("@")[0];
        } else {
            return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n` +
                `┃◆ ❌ Mention a player to duel.\n` +
                `╰═══════════════════════╯`
            );
        }

        if (targetId === userId) {
            return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n` +
                `┃◆ ❌ You cannot duel yourself.\n` +
                `╰═══════════════════════╯`
            );
        }

        // Fetch both players' full info
        const [challenger] = await db.execute(
            "SELECT nickname, `rank`, role, strength, agility, intelligence, stamina, hp FROM players WHERE id=?",
            [userId]
        );
        const [target] = await db.execute(
            "SELECT nickname, `rank`, role, strength, agility, intelligence, stamina, hp FROM players WHERE id=?",
            [targetId]
        );

        if (!challenger.length) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You are not registered.\n╰═══════════════════════╯`
        );
        if (!target.length) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ That player is not registered.\n╰═══════════════════════╯`
        );

        const c = challenger[0];
        const t = target[0];

        if (c.hp <= 0) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n` +
            `┃◆ ❌ You are dead. Use !respawn first.\n` +
            `╰═══════════════════════╯`
        );
        if (t.hp <= 0) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n` +
            `┃◆ ❌ *${t.nickname}* is dead and cannot duel.\n` +
            `╰═══════════════════════╯`
        );

        const [inDungeonTarget] = await db.execute(
            "SELECT * FROM dungeon_players WHERE player_id=? AND is_alive=1", [targetId]
        );
        if (inDungeonTarget.length) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n` +
            `┃◆ ❌ *${t.nickname}* is inside a dungeon.\n` +
            `╰═══════════════════════╯`
        );

        const [inDungeonSelf] = await db.execute(
            "SELECT * FROM dungeon_players WHERE player_id=? AND is_alive=1", [userId]
        );
        if (inDungeonSelf.length) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n` +
            `┃◆ ❌ You are inside a dungeon.\n` +
            `╰═══════════════════════╯`
        );

        // Parse bet
        let betAmount = 0;
        if (args[1]) {
            betAmount = parseInt(args[1]);
            if (isNaN(betAmount) || betAmount < 0) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ Invalid bet amount.\n╰═══════════════════════╯`
            );
        }

        if (betAmount > 0) {
            const [gold]       = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const [targetGold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [targetId]);
            if (!gold.length || gold[0].gold < betAmount) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n` +
                `┃◆ ❌ You don't have ${betAmount} gold.\n` +
                `╰═══════════════════════╯`
            );
            if (!targetGold.length || targetGold[0].gold < betAmount) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n` +
                `┃◆ ❌ *${t.nickname}* doesn't have ${betAmount} gold.\n` +
                `╰═══════════════════════╯`
            );
        }

        const [existing] = await db.execute(
            "SELECT * FROM pvp_challenges WHERE challenger_id=? AND target_id=? AND status='pending' AND expires_at > NOW()",
            [userId, targetId]
        );
        if (existing.length) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n` +
            `┃◆ ❌ You already challenged *${t.nickname}*.\n` +
            `┃◆ Wait for them to respond.\n` +
            `╰═══════════════════════╯`
        );

        await db.execute(
            "INSERT INTO pvp_challenges (challenger_id, target_id, bet_amount) VALUES (?, ?, ?)",
            [userId, targetId, betAmount]
        );

        const betLine = betAmount > 0
            ? `┃◆ 💰 Bet: ${betAmount} Gold each\n┃◆    Pot: ${betAmount * 2} Gold\n`
            : `┃◆ 💰 No bet — honour duel\n`;

        return msg.reply(
            `╭══〘 ⚔️ DUEL CHALLENGE 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ *${c.nickname}* [${c.rank}] challenges\n` +
            `┃◆ *${t.nickname}* [${t.rank}] to a duel!\n` +
            `┃◆ \n` +
            `┃◆ ── *${c.nickname}* ──\n` +
            `┃◆ 🎭 ${c.role}\n` +
            `┃◆ 💪 ${c.strength}  ⚡ ${c.agility}  🧠 ${c.intelligence}  🛡️ ${c.stamina}\n` +
            `┃◆ \n` +
            `┃◆ ── *${t.nickname}* ──\n` +
            `┃◆ 🎭 ${t.role}\n` +
            `┃◆ 💪 ${t.strength}  ⚡ ${t.agility}  🧠 ${t.intelligence}  🛡️ ${t.stamina}\n` +
            `┃◆ \n` +
            `${betLine}` +
            `┃◆ ━━━━━━━━━━━━\n` +
            `┃◆ ⚔️ Both duelists fight at 700 HP\n` +
            `┃◆ \n` +
            `┃◆ *${t.nickname}* — accept or decline?\n` +
            `┃◆ ✅ !accept @${c.nickname}\n` +
            `┃◆ ❌ !decline @${c.nickname}\n` +
            `┃◆ ⏳ Expires in 5 minutes\n` +
            `┃◆ \n` +
            `╰═══════════════════════════╯`
        );
    }
};