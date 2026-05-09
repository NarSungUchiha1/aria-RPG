const db = require('../database/db');

async function ensureTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS pvp_challenges (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            challenger_id VARCHAR(50) NOT NULL,
            target_id     VARCHAR(50) NOT NULL,
            bet_amount    INT DEFAULT 0,
            status        ENUM('pending','accepted','declined') DEFAULT 'pending',
            team_key      VARCHAR(64) DEFAULT NULL,
            created_at    DATETIME DEFAULT NOW()
        )
    `).catch(() => {});

    await db.execute(`ALTER TABLE pvp_challenges ADD COLUMN IF NOT EXISTS team_key VARCHAR(64) DEFAULT NULL`).catch(() => {});
}

module.exports = {
    name: 'duel',
    async execute(msg, args, { userId, client }) {
        await ensureTable();

        if (!msg.mentionedIds.length) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ Use: !duel @user [bet]\n╰═══════════════════════╯`
        );

        const targetIds = [...new Set(msg.mentionedIds.map(id => id.replace(/@c\.us/g, "").split("@")[0]).filter(id => id !== userId))];
        if (!targetIds.length) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You cannot duel yourself.\n╰═══════════════════════╯`
        );

        const betArg = args.find(a => !a.startsWith('@') && !isNaN(parseInt(a)));
        let betAmount = 0;
        if (betArg) betAmount = Math.max(0, parseInt(betArg));
        if (betAmount > 0 && targetIds.length > 1) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ Party duels cannot include bets yet.\n╰═══════════════════════╯`
        );

        try {
            const [challenger] = await db.execute(
                "SELECT nickname, `rank`, role, strength, agility, intelligence, stamina, hp FROM players WHERE id=?", [userId]
            );
            if (!challenger.length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You are not registered.\n╰═══════════════════════╯`
            );
            const c = challenger[0];

            const [targets] = await db.execute(
                `SELECT id, nickname, \`rank\`, role, strength, agility, intelligence, stamina, hp
                 FROM players WHERE id IN (${targetIds.map(() => '?').join(',')})`,
                targetIds
            );
            if (targets.length !== targetIds.length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ One or more mentioned players are not registered.\n╰═══════════════════════╯`
            );

            const invalidTarget = targets.find(t => t.hp <= 0);
            if (invalidTarget) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ *${invalidTarget.nickname}* is dead and cannot duel.\n╰═══════════════════════╯`
            );

            const [inDungeonC] = await db.execute(
                "SELECT * FROM dungeon_players WHERE player_id=? AND is_alive=1", [userId]
            );
            if (inDungeonC.length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You are inside a dungeon.\n╰═══════════════════════╯`
            );

            const [inDungeonTargets] = await db.execute(
                `SELECT player_id FROM dungeon_players WHERE player_id IN (${targetIds.map(() => '?').join(',')}) AND is_alive=1`,
                targetIds
            );
            if (inDungeonTargets.length && inDungeonTargets[0].length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ One or more targets are inside a dungeon.\n╰═══════════════════════╯`
            );

            const [existing] = await db.execute(
                `SELECT id FROM pvp_challenges WHERE challenger_id=? AND target_id IN (${targetIds.map(() => '?').join(',')}) AND status='pending'`,
                [userId, ...targetIds]
            );
            if (existing.length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You already have a pending challenge to one of those players.\n╰═══════════════════════╯`
            );

            const teamKey = `${userId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
            const placeholders = targetIds.map(() => '(?, ?, ?, ?)').join(',');
            const params = [];
            targetIds.forEach(id => params.push(userId, id, betAmount, teamKey));

            await db.execute(
                `INSERT INTO pvp_challenges (challenger_id, target_id, bet_amount, team_key) VALUES ${placeholders}`,
                params
            );

            const betLine = betAmount > 0
                ? `┃◆ 💰 Bet: ${betAmount} Gold each  •  Pot: ${betAmount * 2} Gold\n`
                : `┃◆ 💰 No bet — honour duel\n`;

            const targetLines = targets.map(t =>
                `┃◆ • ${t.nickname} [${t.rank}] • ${t.role} • STR:${t.strength} AGI:${t.agility} INT:${t.intelligence} STA:${t.stamina}\n`
            ).join('');

            return msg.reply(
                `╭══〘 ⚔️ DUEL CHALLENGE 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ *${c.nickname}* [${c.rank}] challenges:\n` +
                `${targetLines}` +
                `┃◆ \n` +
                `┃◆ ── *${c.nickname}* ──\n` +
                `┃◆ 🎭 ${c.role}\n` +
                `┃◆ 💪 ${c.strength}  ⚡ ${c.agility}  🧠 ${c.intelligence}  🛡️ ${c.stamina}\n` +
                `┃◆ \n` +
                `${betLine}` +
                `┃◆ ━━━━━━━━━━━━\n` +
                `┃◆ ⚔️ Team duel awaits acceptance.\n` +
                `┃◆ \n` +
                `┃◆ Targets — respond:\n` +
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
