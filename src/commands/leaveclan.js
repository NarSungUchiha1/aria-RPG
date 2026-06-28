const db = require('../database/db');
const { getPlayerClan } = require('../systems/clanSystem');

async function ensurePenaltyTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS clan_leave_penalty (
            player_id   VARCHAR(60) PRIMARY KEY,
            left_clan   VARCHAR(60),
            left_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            can_join_at TIMESTAMP NOT NULL
        )
    `).catch(() => {});
}

module.exports = {
    name: 'leaveclan',
    async execute(msg, args, { userId }) {
        await ensurePenaltyTable();
        try {
            const clan = await getPlayerClan(userId);
            if (!clan) return msg.reply(
                `══〘 🏰 LEAVE CLAN 〙══╮\n` +
                `┃◆ ❌ You are not in a clan.\n` +
                `╰═══════════════════════╯`
            );

            // Cannot leave if you are the master — transfer first
            if (clan.leader_id === userId) return msg.reply(
                `══〘 🏰 LEAVE CLAN 〙══╮\n` +
                `┃◆ ❌ You are the Clan Master.\n` +
                `┃◆ Transfer leadership first:\n` +
                `┃◆ !clan transfer @member\n` +
                `╰═══════════════════════╯`
            );

            // Confirm step — require !leaveclan confirm
            if (args[0]?.toLowerCase() !== 'confirm') {
                return msg.reply(
                    `╔══〘 ⚠️ LEAVE CLAN 〙══╗\n` +
                    `┃◆\n` +
                    `┃◆ Are you sure you want to leave\n` +
                    `┃◆ *${clan.name}*?\n` +
                    `┃◆\n` +
                    `┃◆ ⚠️ PENALTIES:\n` +
                    `┃◆ 💰 Lose 20% of your gold\n` +
                    `┃◆ 🔮 Clan blessing stripped\n` +
                    `┃◆ ⏳ Cannot join any clan\n` +
                    `┃◆    for 30 days\n` +
                    `┃◆\n` +
                    `┃◆ Type *!leaveclan confirm* to proceed.\n` +
                    `╚═══════════════════════════╝`
                );
            }

            // ── Apply penalties ────────────────────────────────────────────

            // 1. Deduct 20% gold
            const [goldRow] = await db.execute('SELECT gold FROM currency WHERE player_id=?', [userId]);
            const currentGold = Number(goldRow[0]?.gold || 0);
            const penalty = Math.floor(currentGold * 0.20);
            if (penalty > 0) {
                await db.execute('UPDATE currency SET gold = GREATEST(0, gold - ?) WHERE player_id=?', [penalty, userId]);
            }

            // 2. Strip clan blessing — reset any active blessing buffs
            await db.execute(
                'DELETE FROM clan_blessing_state WHERE player_id=?', [userId]
            ).catch(() => {});

            // 3. Remove from clan
            await db.execute('DELETE FROM clan_members WHERE player_id=?', [userId]);
            await db.execute('UPDATE clans SET member_count = GREATEST(0, member_count - 1) WHERE id=?', [clan.id]);

            // 4. Record 30-day cooldown
            await db.execute(
                `INSERT INTO clan_leave_penalty (player_id, left_clan, left_at, can_join_at)
                 VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 30 DAY))
                 ON DUPLICATE KEY UPDATE left_clan=?, left_at=NOW(), can_join_at=DATE_ADD(NOW(), INTERVAL 30 DAY)`,
                [userId, clan.name, clan.name]
            );

            const [player] = await db.execute('SELECT nickname FROM players WHERE id=?', [userId]);
            const nick = player[0]?.nickname || userId;

            return msg.reply(
                `╔══〘 🏰 CLAN LEFT 〙══╗\n` +
                `┃◆\n` +
                `┃◆ *${nick}* has left *${clan.name}*.\n` +
                `┃◆\n` +
                `┃◆ 💰 -${penalty.toLocaleString()} Gold (20%)\n` +
                `┃◆ 🔮 Blessing stripped\n` +
                `┃◆ ⏳ Can rejoin a clan in 30 days\n` +
                `┃◆\n` +
                `┃◆ The road ahead is yours alone.\n` +
                `╚═══════════════════════════╝`
            );

        } catch(e) {
            console.error('leaveclan error:', e.message);
            msg.reply('❌ Failed to leave clan.');
        }
    }
};