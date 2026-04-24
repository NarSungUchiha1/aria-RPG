const db = require('../database/db');

async function ensureTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS pvp_challenges (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            challenger_id VARCHAR(50) NOT NULL,
            target_id     VARCHAR(50) NOT NULL,
            bet_amount    INT DEFAULT 0,
            status        ENUM('pending','accepted','declined') DEFAULT 'pending',
            created_at    DATETIME DEFAULT NOW()
        )
    `).catch(() => {});
}

module.exports = {
    name: 'duel',
    async execute(msg, args, { userId, client }) {
        await ensureTable();

        if (!msg.mentionedIds.length) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ Use: !duel @user [bet]\n╰═══════════════════════╯`
        );

        const targetId = msg.mentionedIds[0].replace(/@c\.us/g, "").split("@")[0];

        if (targetId === userId) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You cannot duel yourself.\n╰═══════════════════════╯`
        );

        try {
            const [challenger] = await db.execute(
                "SELECT nickname, `rank`, role, strength, agility, intelligence, stamina, hp FROM players WHERE id=?", [userId]
            );
            const [target] = await db.execute(
                "SELECT nickname, `rank`, role, strength, agility, intelligence, stamina, hp FROM players WHERE id=?", [targetId]
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
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You are dead. Use !respawn first.\n╰═══════════════════════╯`
            );
            if (t.hp <= 0) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ *${t.nickname}* is dead and cannot duel.\n╰═══════════════════════╯`
            );

            const [inDungeonT] = await db.execute(
                "SELECT * FROM dungeon_players WHERE player_id=? AND is_alive=1", [targetId]
            );
            if (inDungeonT.length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ *${t.nickname}* is inside a dungeon.\n╰═══════════════════════╯`
            );

            const [inDungeonC] = await db.execute(
                "SELECT * FROM dungeon_players WHERE player_id=? AND is_alive=1", [userId]
            );
            if (inDungeonC.length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You are inside a dungeon.\n╰═══════════════════════╯`
            );

            // Parse bet
            let betAmount = 0;
            const betArg = args.find(a => !a.startsWith('@') && !isNaN(parseInt(a)));
            if (betArg) betAmount = Math.max(0, parseInt(betArg));

            if (betAmount > 0) {
                const [cGold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
                const [tGold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [targetId]);
                if (!cGold.length || cGold[0].gold < betAmount) return msg.reply(
                    `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You don't have ${betAmount} Gold.\n╰═══════════════════════╯`
                );
                if (!tGold.length || tGold[0].gold < betAmount) return msg.reply(
                    `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ *${t.nickname}* doesn't have ${betAmount} Gold.\n╰═══════════════════════╯`
                );
            }

            // Check no existing pending challenge
            const [existing] = await db.execute(
                "SELECT id FROM pvp_challenges WHERE challenger_id=? AND target_id=? AND status='pending'",
                [userId, targetId]
            );
            if (existing.length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You already challenged *${t.nickname}*.\n╰═══════════════════════╯`
            );

            await db.execute(
                "INSERT INTO pvp_challenges (challenger_id, target_id, bet_amount) VALUES (?, ?, ?)",
                [userId, targetId, betAmount]
            );

            const betLine = betAmount > 0
                ? `┃◆ 💰 Bet: ${betAmount} Gold each  •  Pot: ${betAmount * 2} Gold\n`
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
                `┃◆ ⚔️ Both fight at 700 HP\n` +
                `┃◆ \n` +
                `┃◆ *${t.nickname}* — respond:\n` +
                `┃◆ ✅ !accept @${c.nickname}\n` +
                `┃◆ ❌ !decline @${c.nickname}\n` +
                `┃◆ ⏳ Expires in 5 minutes\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ Duel failed.\n╰═══════════════════════╯`);
        }
    }
};