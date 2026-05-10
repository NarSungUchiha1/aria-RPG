const db = require('../database/db');

const PARTY_MAX = 5; // max members per side in party duels

async function ensureTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS pvp_challenges (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            challenger_id VARCHAR(50) NOT NULL,
            target_id     VARCHAR(50) NOT NULL,
            bet_amount    INT DEFAULT 0,
            status        ENUM('pending','accepted','declined') DEFAULT 'pending',
            duel_type     ENUM('solo','party') DEFAULT 'solo',
            created_at    DATETIME DEFAULT NOW()
        )
    `).catch(() => {});

    // Add duel_type column for tables that predate it (no IF NOT EXISTS — compatible with older MySQL)
    await db.execute(`ALTER TABLE pvp_challenges ADD COLUMN duel_type ENUM('solo','party') DEFAULT 'solo'`).catch(() => {});
}

module.exports = {
    name: 'duel',
    async execute(msg, args, { userId, client }) {
        await ensureTable();

        // ── Mode detection ─────────────────────────────────────────────────
        // !duel @user [bet]           → solo
        // !duel solo @user [bet]      → solo
        // !duel party @a @b @c [bet]  → party (max 5 enemy targets)
        const firstArg = args[0]?.toLowerCase();
        let mode = 'solo';
        let effectiveArgs = args;
        if (firstArg === 'solo') {
            mode = 'solo';
            effectiveArgs = args.slice(1);
        } else if (firstArg === 'party') {
            mode = 'party';
            effectiveArgs = args.slice(1);
        }

        if (!msg.mentionedIds.length) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n` +
            `┃◆ ❌ Mention who you want to duel.\n` +
            `┃◆ \n` +
            `┃◆ *Solo:*  !duel @player [bet]\n` +
            `┃◆ *Party:* !duel party @a @b @c\n` +
            `┃◆          Max ${PARTY_MAX} players per side.\n` +
            `╰═══════════════════════╯`
        );

        const targetIds = [...new Set(
            msg.mentionedIds
                .map(id => id.replace(/@c\.us/g, '').split('@')[0])
                .filter(id => id !== userId)
        )];

        if (!targetIds.length) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You cannot duel yourself.\n╰═══════════════════════╯`
        );

        // Solo: exactly 1 target
        if (mode === 'solo' && targetIds.length > 1) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n` +
            `┃◆ ❌ Solo duels: one opponent only.\n` +
            `┃◆ For multiple opponents use: !duel party @a @b\n` +
            `╰═══════════════════════╯`
        );

        // Party: max PARTY_MAX targets (challenger is on their own team so max side = PARTY_MAX)
        if (mode === 'party' && targetIds.length > PARTY_MAX) return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n` +
            `┃◆ ❌ Party max is ${PARTY_MAX} players per side.\n` +
            `┃◆ You tagged ${targetIds.length} — remove ${targetIds.length - PARTY_MAX}.\n` +
            `╰═══════════════════════╯`
        );

        const betArg = effectiveArgs.find(a => !a.startsWith('@') && !isNaN(parseInt(a)));
        let betAmount = 0;
        if (betArg) betAmount = Math.max(0, parseInt(betArg));
        if (betAmount > 0 && mode === 'party') return msg.reply(
            `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ Bets are only allowed in solo duels.\n╰═══════════════════════╯`
        );

        try {
            const [challenger] = await db.execute(
                "SELECT nickname, `rank`, role, strength, agility, intelligence, stamina, hp FROM players WHERE id=?",
                [userId]
            );
            if (!challenger.length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You are not registered.\n╰═══════════════════════╯`
            );
            const c = challenger[0];
            if (c.hp <= 0) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You are dead. Use !respawn first.\n╰═══════════════════════╯`
            );

            const [targets] = await db.execute(
                `SELECT id, nickname, \`rank\`, role, strength, agility, intelligence, stamina, hp
                 FROM players WHERE id IN (${targetIds.map(() => '?').join(',')})`,
                targetIds
            );
            if (targets.length !== targetIds.length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ One or more mentioned players are not registered.\n╰═══════════════════════╯`
            );

            const deadTarget = targets.find(t => t.hp <= 0);
            if (deadTarget) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ *${deadTarget.nickname}* is dead and cannot duel.\n╰═══════════════════════╯`
            );

            // Dungeon check — challenger
            const [inDungeonC] = await db.execute(
                "SELECT 1 FROM dungeon_players WHERE player_id=? AND is_alive=1 LIMIT 1", [userId]
            );
            if (inDungeonC.length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You are inside a dungeon.\n╰═══════════════════════╯`
            );

            // Dungeon check — targets (fixed: check rows.length not rows[0].length)
            const [inDungeonTargets] = await db.execute(
                `SELECT player_id FROM dungeon_players WHERE player_id IN (${targetIds.map(() => '?').join(',')}) AND is_alive=1 LIMIT 1`,
                targetIds
            );
            if (inDungeonTargets.length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ One or more targets are inside a dungeon.\n╰═══════════════════════╯`
            );

            // Pending challenge check
            const [existing] = await db.execute(
                `SELECT id FROM pvp_challenges WHERE challenger_id=? AND target_id IN (${targetIds.map(() => '?').join(',')}) AND status='pending'`,
                [userId, ...targetIds]
            );
            if (existing.length) return msg.reply(
                `══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ You already have a pending challenge to one of those players.\n╰═══════════════════════╯`
            );

            const placeholders = targetIds.map(() => '(?, ?, ?, ?)').join(',');
            const params = [];
            targetIds.forEach(id => params.push(userId, id, betAmount, mode));

            await db.execute(
                `INSERT INTO pvp_challenges (challenger_id, target_id, bet_amount, duel_type) VALUES ${placeholders}`,
                params
            );

            const betLine = betAmount > 0
                ? `┃◆ 💰 Bet: *${betAmount} Gold* each  —  Pot: *${betAmount * 2} Gold*\n`
                : ``;

            // ── SOLO CHALLENGE ────────────────────────────────────────────────
            if (mode === 'solo') {
                const t = targets[0];
                return msg.reply(
                    `╭══〘 ⚔️  DUEL CHALLENGE 〙══╮\n` +
                    `┃◆ \n` +
                    `┃◆ 🔵 *${c.nickname}* [${c.rank}]\n` +
                    `┃◆    ${c.role}\n` +
                    `┃◆    💪 ${c.strength}  ⚡ ${c.agility}  🧠 ${c.intelligence}  🛡️ ${c.stamina}\n` +
                    `┃◆ \n` +
                    `┃◆          ⚔️  *vs*\n` +
                    `┃◆ \n` +
                    `┃◆ 🔴 *${t.nickname}* [${t.rank}]\n` +
                    `┃◆    ${t.role}\n` +
                    `┃◆    💪 ${t.strength}  ⚡ ${t.agility}  🧠 ${t.intelligence}  🛡️ ${t.stamina}\n` +
                    `┃◆ \n` +
                    `${betLine}` +
                    `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
                    `┃◆ ✅  !accept @${c.nickname}\n` +
                    `┃◆ ❌  !decline @${c.nickname}\n` +
                    `┃◆ ⏳ Expires in 5 minutes\n` +
                    `╰════════════════════════════════╯`
                );
            }

            // ── PARTY CHALLENGE ───────────────────────────────────────────────
            const challengedLines = targets.map(t =>
                `┃◆    • *${t.nickname}* [${t.rank}] • ${t.role}`
            ).join('\n');

            return msg.reply(
                `╭══〘 ⚔️  PARTY DUEL CHALLENGE 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ 🔵 *${c.nickname}* [${c.rank}] is calling out:\n` +
                `┃◆    ${c.role}  •  💪 ${c.strength}  ⚡ ${c.agility}\n` +
                `┃◆ \n` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ 🔴  Players Challenged\n` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `${challengedLines}\n` +
                `┃◆ \n` +
                `${betLine}` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ 📋  HOW THIS WORKS\n` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ \n` +
                `┃◆ 1️⃣  Each challenged player accepts:\n` +
                `┃◆       !accept @${c.nickname}\n` +
                `┃◆ \n` +
                `┃◆ 2️⃣  Once all accept — *Assembly phase* opens.\n` +
                `┃◆       Both sides recruit allies & lock in.\n` +
                `┃◆       Use: !joinparty @leader\n` +
                `┃◆ \n` +
                `┃◆ 3️⃣  Leaders confirm → *DUEL BEGINS.*\n` +
                `┃◆       Use: !startduel\n` +
                `┃◆ \n` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ ❌ To decline:  !decline @${c.nickname}\n` +
                `┃◆ ⏳ Expires in 5 minutes\n` +
                `╰═══════════════════════════════════╯`
            );
        } catch (err) {
            console.error('duel error:', err);
            msg.reply(`══〘 ⚔️ DUEL 〙══╮\n┃◆ ❌ Duel failed.\n╰═══════════════════════╯`);
        }
    }
};