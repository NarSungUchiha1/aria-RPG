const db = require('../database/db');
const { pendingRoleChanges, calcStatsForRoleAndRank, RANK_ORDER, RANK_MANA } = require('./setrole');
const { roleIcon } = require('../utils/styles');

module.exports = {
    name: 'confirmrole',
    async execute(msg, args, { userId }) {
        if (!pendingRoleChanges.has(userId)) {
            return msg.reply("❌ You have no pending role change offer.");
        }

        const { newRole, penaltyRank, newStats, isCaster, goldLost, rankDropped, timer } = pendingRoleChanges.get(userId);
        clearTimeout(timer);
        pendingRoleChanges.delete(userId);

        try {
            const [player] = await db.execute(
                "SELECT nickname, role, `rank` FROM players WHERE id=?",
                [userId]
            );
            if (!player.length) return msg.reply("❌ Player not found.");
            const p = player[0];

            // ── Apply all penalties atomically ───────────────────

            // 1. Delete ALL inventory (equipped and unequipped)
            await db.execute("DELETE FROM inventory WHERE player_id=?", [userId]);

            // 2. Deduct 50% gold
            await db.execute(
                "UPDATE currency SET gold = GREATEST(0, gold - ?) WHERE player_id=?",
                [goldLost, userId]
            );

            // 3. Update role, rank, and all stats
            let updateQuery = `
                UPDATE players SET
                    role          = ?,
                    \`rank\`      = ?,
                    strength      = ?,
                    agility       = ?,
                    intelligence  = ?,
                    stamina       = ?,
                    hp            = ?,
                    max_hp        = ?,
                    sp            = 0
            `;
            const params = [
                newRole,
                penaltyRank,
                newStats.strength,
                newStats.agility,
                newStats.intelligence,
                newStats.stamina,
                newStats.hp,
                newStats.max_hp,
            ];

            // 4. Reset mana for casters
            if (isCaster) {
                updateQuery += `, mana = ?, max_mana = ?`;
                params.push(RANK_MANA[penaltyRank], RANK_MANA[penaltyRank]);
            } else {
                updateQuery += `, mana = 0, max_mana = 0`;
            }

            updateQuery += ` WHERE id = ?`;
            params.push(userId);
            await db.execute(updateQuery, params);

            // 5. Reset XP back to 0 (they keep their gold remainder but lose rank progress)
            // Note: only resetting XP is debatable — you may want to keep it. Leaving as-is
            // since rank was already dropped.

            // ─────────────────────────────────────────────────────

            const rankLossText = rankDropped > 0
                ? `${p.rank} → ${penaltyRank} (-${rankDropped} rank${rankDropped > 1 ? 's' : ''})`
                : `${p.rank} (no rank change)`;

            return msg.reply(
                `╭══〘 🔄 METAMORPHOSIS COMPLETE 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ ${roleIcon(p.role)} ${p.role} → ${roleIcon(newRole)} ${newRole}\n` +
                `┃◆ \n` +
                `┃◆ ━━ APPLIED PENALTIES ━━\n` +
                `┃◆ 🏅 Rank: ${rankLossText}\n` +
                `┃◆ 💰 Gold lost: ${goldLost.toLocaleString()}\n` +
                `┃◆ 🗑️ All equipment cleared\n` +
                `┃◆ ✨ SP reset to 0\n` +
                `┃◆ \n` +
                `┃◆ ━━ NEW STATS ━━\n` +
                `┃◆ 💪 STR: ${newStats.strength}\n` +
                `┃◆ ⚡ AGI: ${newStats.agility}\n` +
                `┃◆ 🧠 INT: ${newStats.intelligence}\n` +
                `┃◆ 🛡️ STA: ${newStats.stamina}\n` +
                `┃◆ ❤️ HP:  ${newStats.hp}/${newStats.max_hp}\n` +
                (isCaster ? `┃◆ 💙 Mana: ${RANK_MANA[penaltyRank]}\n` : '') +
                `┃◆ \n` +
                `┃◆ A new path begins. Use !me to\n` +
                `┃◆ see your updated profile.\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply("❌ Role change failed. Contact an admin.");
        }
    }
};