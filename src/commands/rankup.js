const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { getSpecialItemForRank } = require('../systems/shopSystem');
const itemStats = require('../data/itemStats');

const rankOrder = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];

const rankRequirements = {
    E: 500,
    D: 1200,
    C: 2500,
    B: 5000,
    A: 10000,
    S: 20000
};

const rankStatIncreases = {
    E: 4,
    D: 6,
    C: 8,
    B: 12,
    A: 16,
    S: 22
};

const rankHpIncreases = {
    E: 20,
    D: 35,
    C: 50,
    B: 70,
    A: 100,
    S: 150
};

const rankMaxMana = {
    F: 50,
    E: 100,
    D: 160,
    C: 240,
    B: 330,
    A: 420,
    S: 500
};

module.exports = {
    name: 'rankup',
    async execute(msg, args, { userId }) {
        try {
            const [player] = await db.execute(
                "SELECT `rank`, role, strength, agility, intelligence, stamina, hp, max_hp, mana, max_mana FROM players WHERE id=?",
                [userId]
            );
            if (!player.length) return msg.reply("❌ Not registered.");

            const currentRank = player[0].rank;
            const currentIdx = rankOrder.indexOf(currentRank);
            if (currentIdx === -1) return msg.reply("❌ Invalid rank data.");
            if (currentIdx === rankOrder.length - 1) {
                return msg.reply("❌ You are already max rank (S).");
            }

            const nextRank = rankOrder[currentIdx + 1];
            const requiredXp = rankRequirements[nextRank];
            const statIncrease = rankStatIncreases[nextRank];
            const hpIncrease = rankHpIncreases[nextRank];

            const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const currentXp = Number(xpRow[0]?.xp) || 0;

            if (currentXp < requiredXp) {
                return msg.reply(`❌ You need ${requiredXp} XP to rank up to ${nextRank}. You have ${currentXp} XP.`);
            }

            await db.execute("UPDATE xp SET xp = xp - ? WHERE player_id=?", [requiredXp, userId]);

            const role = player[0].role;
            const isCaster = (role === 'Mage' || role === 'Healer');
            const newMaxMana = isCaster ? rankMaxMana[nextRank] : null;

            let updateQuery = `UPDATE players SET 
                \`rank\` = ?,
                strength = strength + ?,
                agility = agility + ?,
                intelligence = intelligence + ?,
                stamina = stamina + ?,
                hp = hp + ?,
                max_hp = max_hp + ?`;
            const params = [nextRank, statIncrease, statIncrease, statIncrease, statIncrease, hpIncrease, hpIncrease];

            if (isCaster) {
                updateQuery += `, mana = ?, max_mana = ?`;
                params.push(newMaxMana, newMaxMana);
            }

            updateQuery += ` WHERE id = ?`;
            params.push(userId);

            await db.execute(updateQuery, params);

            let reply = `══〘 🏅 RANK UP 〙══╮
┃◆ Congratulations!
┃◆ Rank: ${currentRank} → ${nextRank}
┃◆ XP Cost: ${requiredXp}
┃◆────────────
┃◆ 💪 STR/AGI/INT/STA +${statIncrease}
┃◆ ❤️ Max HP +${hpIncrease}`;

            if (isCaster) {
                reply += `\n┃◆ 💙 Max Mana: ${rankMaxMana[currentRank]} → ${newMaxMana}`;
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
                    reply += `\n┃◆ 🎁 Special Weapon: ${specialName} added to inventory!`;
                }
            }

            reply += `\n╰═══════════════════════╯`;

            return msg.reply(reply);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Rank up failed.");
        }
    }
};