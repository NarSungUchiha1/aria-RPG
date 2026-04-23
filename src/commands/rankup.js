const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { getSpecialItemForRank } = require('../systems/shopSystem');
const itemStats = require('../data/itemStats');

const rankOrder = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];

const rankRequirements = {
    E: 1000, D: 3000, C: 7000, B: 15000, A: 30000, S: 60000
};

const rankStatIncreases = {
    E: 4, D: 6, C: 8, B: 12, A: 16, S: 22
};

const rankHpIncreases = {
    E: 20, D: 35, C: 50, B: 70, A: 100, S: 150
};

const rankMaxMana = {
    F: 50, E: 100, D: 160, C: 240, B: 330, A: 420, S: 500
};

module.exports = {
    name: 'rankup',
    async execute(msg, args, { userId }) {
        try {
            const [player] = await db.execute(
                "SELECT `rank`, role, strength, agility, intelligence, stamina, hp, max_hp, mana, max_mana FROM players WHERE id=?",
                [userId]
            );
            if (!player.length) return msg.reply(
                `══〘 🏅 RANK UP 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );

            const currentRank = player[0].rank;
            const currentIdx  = rankOrder.indexOf(currentRank);

            if (currentIdx === -1) return msg.reply(
                `══〘 🏅 RANK UP 〙══╮\n┃◆ ❌ Invalid rank data.\n╰═══════════════════════╯`
            );
            if (currentIdx === rankOrder.length - 1) return msg.reply(
                `══〘 🏅 RANK UP 〙══╮\n┃◆ ❌ Already max rank (S).\n╰═══════════════════════╯`
            );

            const nextRank    = rankOrder[currentIdx + 1];
            const requiredXp  = rankRequirements[nextRank];
            const statIncrease = rankStatIncreases[nextRank];
            const hpIncrease  = rankHpIncreases[nextRank];

            const [xpRow]    = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const currentXp  = Number(xpRow[0]?.xp) || 0;

            if (currentXp < requiredXp) {
                return msg.reply(
                    `══〘 🏅 RANK UP 〙══╮\n` +
                    `┃◆ ❌ Not enough XP.\n` +
                    `┃◆ Need: ${requiredXp} XP\n` +
                    `┃◆ Have: ${currentXp} XP\n` +
                    `┃◆ Short: ${requiredXp - currentXp} XP\n` +
                    `╰═══════════════════════╯`
                );
            }

            await db.execute("UPDATE xp SET xp = xp - ? WHERE player_id=?", [requiredXp, userId]);

            const role      = player[0].role;
            const isCaster  = (role === 'Mage' || role === 'Healer');
            const newMaxMana = isCaster ? rankMaxMana[nextRank] : null;

            let updateQuery =
                `UPDATE players SET
                    \`rank\` = ?,
                    strength     = strength     + ?,
                    agility      = agility      + ?,
                    intelligence = intelligence + ?,
                    stamina      = stamina      + ?,
                    hp           = hp           + ?,
                    max_hp       = max_hp       + ?`;
            const params = [nextRank, statIncrease, statIncrease, statIncrease, statIncrease, hpIncrease, hpIncrease];

            if (isCaster) {
                updateQuery += `, mana = ?, max_mana = ?`;
                params.push(newMaxMana, newMaxMana);
            }
            updateQuery += ` WHERE id = ?`;
            params.push(userId);

            await db.execute(updateQuery, params);

            // ✅ Quest tracking — rank_reached achievement
            try {
                const { updateQuestProgress } = require('../systems/questSystem');
                await updateQuestProgress(userId, 'rank_reached', 1, null);
            } catch (e) {}

            let reply =
                `══〘 🏅 RANK UP 〙══╮\n` +
                `┃◆ 🎉 Congratulations!\n` +
                `┃◆ Rank: ${currentRank} → ${nextRank}\n` +
                `┃◆ XP Cost: ${requiredXp}\n` +
                `┃◆────────────\n` +
                `┃◆ 💪 STR/AGI/INT/STA +${statIncrease}\n` +
                `┃◆ ❤️ Max HP +${hpIncrease}\n`;

            if (isCaster) {
                reply += `┃◆ 💙 Max Mana: ${rankMaxMana[currentRank]} → ${newMaxMana}\n`;
            }

            // Special weapon reward for rank C and above
            if (rankOrder.indexOf(nextRank) >= rankOrder.indexOf('C')) {
                const specialName = getSpecialItemForRank(nextRank);
                if (specialName) {
                    const itemData = itemStats[specialName];
                    await db.execute(
                        "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped, grade) VALUES (?, ?, ?, 1, 0, 'F')",
                        [userId, specialName, itemData.primaryStat]
                    );
                    const [result] = await db.execute("SELECT LAST_INSERT_ID() as id");
                    const itemId = result[0].id;
                    await db.execute(
                        `UPDATE inventory SET
                            strength_bonus = ?, agility_bonus = ?, intelligence_bonus = ?, stamina_bonus = ?,
                            attack_bonus = ?, defense_bonus = ?, durability = 100, max_durability = 100
                         WHERE id = ?`,
                        [
                            itemData.base.strength || 0, itemData.base.agility || 0,
                            itemData.base.intelligence || 0, itemData.base.stamina || 0,
                            itemData.base.attack || 0, itemData.base.defense || 0,
                            itemId
                        ]
                    );
                    reply += `┃◆ 🎁 Reward: ${specialName} added!\n`;
                }
            }

            reply += `╰═══════════════════════╯`;
            return msg.reply(reply);

        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🏅 RANK UP 〙══╮\n┃◆ ❌ Rank up failed.\n╰═══════════════════════╯`);
        }
    }
};