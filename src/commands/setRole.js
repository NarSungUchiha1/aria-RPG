const db = require('../database/db');
const { roleIcon } = require('../utils/styles');

const VALID_ROLES = ['Tank', 'Assassin', 'Mage', 'Healer', 'Berserker'];
const RANK_ORDER  = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
const RANK_MANA   = { F: 50, E: 100, D: 160, C: 240, B: 330, A: 420, S: 500 };
const CONFIRM_TTL = 2 * 60 * 1000; // 2 minutes to accept

// Cumulative stat gain over F-rank baseline per rank
const RANK_STAT_GAIN = { F: 0, E: 4, D: 10, C: 18, B: 30, A: 46, S: 68 };
const RANK_HP_GAIN   = { F: 0, E: 20, D: 55, C: 105, B: 175, A: 275, S: 425 };

// Base stats at F rank per role (mirrors register.js)
const ROLE_BASE = {
    Tank:      { strength: 8,  agility: 5,  intelligence: 5,  stamina: 10, hp: 150 },
    Assassin:  { strength: 7,  agility: 10, intelligence: 5,  stamina: 5,  hp: 110 },
    Mage:      { strength: 5,  agility: 7,  intelligence: 10, stamina: 5,  hp: 110 },
    Healer:    { strength: 5,  agility: 5,  intelligence: 9,  stamina: 8,  hp: 120 },
    Berserker: { strength: 10, agility: 7,  intelligence: 5,  stamina: 5,  hp: 130 },
};

function calcStatsForRoleAndRank(role, rank) {
    const base   = ROLE_BASE[role];
    const gain   = RANK_STAT_GAIN[rank] || 0;
    const hpGain = RANK_HP_GAIN[rank]   || 0;
    return {
        strength:     base.strength     + gain,
        agility:      base.agility      + gain,
        intelligence: base.intelligence + gain,
        stamina:      base.stamina      + gain,
        hp:           base.hp + hpGain,
        max_hp:       base.hp + hpGain,
    };
}

// Shared pending map — confirmrole.js and cancelrole.js import this
const pendingRoleChanges = new Map();

module.exports = {
    name: 'setrole',

    // Exported so confirmrole.js and cancelrole.js can use them
    pendingRoleChanges,
    calcStatsForRoleAndRank,
    RANK_ORDER,
    RANK_MANA,

    async execute(msg, args, { isAdmin, userId }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");

        if (!msg.mentionedIds.length || args.length < 2) {
            return msg.reply(
                `❌ Use: !setrole @player <role>\n` +
                `Roles: ${VALID_ROLES.join(', ')}`
            );
        }

        const targetId = msg.mentionedIds[0];

        // Find role name anywhere in args (case-insensitive)
        const roleArg = args.find(a =>
            VALID_ROLES.map(r => r.toLowerCase()).includes(a.toLowerCase())
        );
        if (!roleArg) {
            return msg.reply(`❌ Invalid role. Choose: ${VALID_ROLES.join(', ')}`);
        }
        const newRole = VALID_ROLES.find(r => r.toLowerCase() === roleArg.toLowerCase());

        try {
            const [player] = await db.execute(
                "SELECT nickname, role, `rank` FROM players WHERE id=?",
                [targetId]
            );
            if (!player.length) return msg.reply("❌ That player is not registered.");
            const p = player[0];

            if (p.role === newRole) {
                return msg.reply(`❌ ${p.nickname} is already a ${newRole}.`);
            }

            // ── Calculate penalties ──────────────────────────────
            const currentIdx  = RANK_ORDER.indexOf(p.rank);
            const penaltyIdx  = Math.max(0, currentIdx - 2);
            const penaltyRank = RANK_ORDER[penaltyIdx];
            const rankDropped = currentIdx - penaltyIdx;

            const [goldRow] = await db.execute(
                "SELECT gold FROM currency WHERE player_id=?", [targetId]
            );
            const currentGold = goldRow[0]?.gold || 0;
            const goldLost    = Math.floor(currentGold * 0.5);
            const newStats    = calcStatsForRoleAndRank(newRole, penaltyRank);
            const isCaster    = (newRole === 'Mage' || newRole === 'Healer');

            const [equippedItems] = await db.execute(
                "SELECT item_name FROM inventory WHERE player_id=? AND equipped=1",
                [targetId]
            );
            // ─────────────────────────────────────────────────────

            // Cancel any existing pending for this player
            if (pendingRoleChanges.has(targetId)) {
                clearTimeout(pendingRoleChanges.get(targetId).timer);
            }

            const timer = setTimeout(() => {
                pendingRoleChanges.delete(targetId);
            }, CONFIRM_TTL);

            pendingRoleChanges.set(targetId, {
                newRole, adminId: userId, timer,
                penaltyRank, newStats, isCaster, goldLost, rankDropped
            });

            const rankLossText = rankDropped > 0
                ? `🏅 Rank: ${p.rank} → ${penaltyRank} (-${rankDropped})`
                : `🏅 Rank stays at ${p.rank} (already at floor)`;

            const equipLines = equippedItems.length
                ? equippedItems.map(i => `┃◆     • ${i.item_name}`).join('\n')
                : `┃◆     (none equipped)`;

            // Send the offer — goes to the current chat (which should be the player's DM
            // since setrole can be used anywhere, admin should run it in player's DM)
            return msg.reply(
                `╭══〘 ⚠️ ROLE CHANGE OFFER 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ ${p.nickname}, an admin has offered\n` +
                `┃◆ you a complete metamorphosis:\n` +
                `┃◆ \n` +
                `┃◆ ${roleIcon(p.role)} ${p.role} → ${roleIcon(newRole)} ${newRole}\n` +
                `┃◆ \n` +
                `┃◆ ━━ PENALTIES ━━\n` +
                `┃◆ ${rankLossText}\n` +
                `┃◆ 💰 Gold lost: ${goldLost.toLocaleString()} (50%)\n` +
                `┃◆ 🗑️ ALL equipment deleted:\n` +
                `${equipLines}\n` +
                `┃◆ 📊 New stats (${newRole} @ ${penaltyRank}):\n` +
                `┃◆   💪 STR: ${newStats.strength}\n` +
                `┃◆   ⚡ AGI: ${newStats.agility}\n` +
                `┃◆   🧠 INT: ${newStats.intelligence}\n` +
                `┃◆   🛡️ STA: ${newStats.stamina}\n` +
                `┃◆   ❤️ HP:  ${newStats.hp}\n` +
                (isCaster ? `┃◆   💙 Mana: ${RANK_MANA[penaltyRank]}\n` : ``) +
                `┃◆ \n` +
                `┃◆ ✅ !confirmrole → Accept\n` +
                `┃◆ ❌ !cancelrole  → Decline\n` +
                `┃◆ ⏳ Expires in 2 minutes\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply("❌ setrole failed.");
        }
    }
};