const db = require('../database/db');
const { getNextGrade, upgradeCosts, durabilityValues, getGradeIncrementCount } = require('../data/weaponGrades');
const itemStats = require('../data/itemStats');

const RANK_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];

module.exports = {
    name: 'upgradeweapon',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply(
            `══〘 ⬆️ UPGRADE WEAPON 〙══╮\n┃◆ ❌ Use: !upgradeweapon <item number>\n╰═══════════════════════╯`
        );
        const index = parseInt(args[0]) - 1;
        if (isNaN(index) || index < 0) return msg.reply(
            `══〘 ⬆️ UPGRADE WEAPON 〙══╮\n┃◆ ❌ Invalid number.\n╰═══════════════════════╯`
        );

        try {
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? AND item_name NOT LIKE '%Void Shard%' ORDER BY id",
                [userId]
            );
            const item = items[index];
            if (!item) return msg.reply(
                `══〘 ⬆️ UPGRADE WEAPON 〙══╮\n┃◆ ❌ Item not found.\n┃◆ Use !inventory to check.\n╰═══════════════════════╯`
            );

            const data = itemStats[item.item_name];
            if (!data) return msg.reply(
                `══〘 ⬆️ UPGRADE WEAPON 〙══╮\n┃◆ ❌ This item cannot be upgraded.\n╰═══════════════════════╯`
            );

            const currentGrade = item.grade || 'F';
            const nextGrade    = getNextGrade(currentGrade);
            if (!nextGrade) return msg.reply(
                `══〘 ⬆️ UPGRADE WEAPON 〙══╮\n┃◆ ❌ Already max grade (S).\n╰═══════════════════════╯`
            );

            // ✅ Cap upgrade grade at player's current rank
            const [playerRow] = await db.execute("SELECT `rank` FROM players WHERE id=?", [userId]);
            const playerRank  = playerRow[0]?.rank || 'F';
            const playerRankIdx = RANK_ORDER.indexOf(playerRank);
            const nextGradeIdx  = RANK_ORDER.indexOf(nextGrade);

            if (nextGradeIdx > playerRankIdx) {
                return msg.reply(
                    `══〘 ⬆️ UPGRADE WEAPON 〙══╮\n` +
                    `┃◆ ❌ Cannot upgrade to grade ${nextGrade}.\n` +
                    `┃◆ Your rank: ${playerRank}\n` +
                    `┃◆ Max weapon grade = your rank.\n` +
                    `┃◆ Use !rankup to advance first.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const cost = upgradeCosts[currentGrade];
            const [money] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const gold    = money[0]?.gold || 0;
            if (gold < cost) return msg.reply(
                `══〘 ⬆️ UPGRADE WEAPON 〙══╮\n` +
                `┃◆ ❌ Not enough gold.\n` +
                `┃◆ Need: ${cost} Gold\n` +
                `┃◆ Have: ${gold} Gold\n` +
                `╰═══════════════════════╯`
            );

            const incrementCount = getGradeIncrementCount(nextGrade);
            const newBonuses = {
                strength:     (data.base.strength     || 0) + (data.increment.strength     || 0) * incrementCount,
                agility:      (data.base.agility       || 0) + (data.increment.agility      || 0) * incrementCount,
                intelligence: (data.base.intelligence  || 0) + (data.increment.intelligence || 0) * incrementCount,
                stamina:      (data.base.stamina        || 0) + (data.increment.stamina      || 0) * incrementCount,
                attack:       (data.base.attack         || 0) + (data.increment.attack       || 0) * incrementCount,
                defense:      (data.base.defense        || 0) + (data.increment.defense      || 0) * incrementCount,
            };

            const oldCount = getGradeIncrementCount(currentGrade);
            const oldBonuses = {
                strength:     (data.base.strength     || 0) + (data.increment.strength     || 0) * oldCount,
                agility:      (data.base.agility       || 0) + (data.increment.agility      || 0) * oldCount,
                intelligence: (data.base.intelligence  || 0) + (data.increment.intelligence || 0) * oldCount,
                stamina:      (data.base.stamina        || 0) + (data.increment.stamina      || 0) * oldCount,
                attack:       (data.base.attack         || 0) + (data.increment.attack       || 0) * oldCount,
                defense:      (data.base.defense        || 0) + (data.increment.defense      || 0) * oldCount,
            };

            const newDurability = durabilityValues[nextGrade];

            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [cost, userId]);
            await db.execute(
                `UPDATE inventory SET
                    grade              = ?,
                    strength_bonus     = ?,
                    agility_bonus      = ?,
                    intelligence_bonus = ?,
                    stamina_bonus      = ?,
                    attack_bonus       = ?,
                    defense_bonus      = ?,
                    max_durability     = ?,
                    durability         = ?
                 WHERE id = ?`,
                [
                    nextGrade,
                    newBonuses.strength, newBonuses.agility, newBonuses.intelligence,
                    newBonuses.stamina, newBonuses.attack, newBonuses.defense,
                    newDurability, newDurability, item.id
                ]
            );

            return msg.reply(
                `══〘 ⬆️ WEAPON UPGRADE 〙══╮\n` +
                `┃◆ ${item.item_name} (${currentGrade} → ${nextGrade})\n` +
                `┃◆ 💰 Cost: ${cost} Gold\n` +
                `┃◆────────────\n` +
                (newBonuses.strength     ? `┃◆ 💪 STR: +${oldBonuses.strength}     → +${newBonuses.strength}\n`     : '') +
                (newBonuses.agility      ? `┃◆ ⚡ AGI: +${oldBonuses.agility}      → +${newBonuses.agility}\n`      : '') +
                (newBonuses.intelligence ? `┃◆ 🧠 INT: +${oldBonuses.intelligence} → +${newBonuses.intelligence}\n` : '') +
                (newBonuses.stamina      ? `┃◆ 🛡️ STA: +${oldBonuses.stamina}     → +${newBonuses.stamina}\n`      : '') +
                (newBonuses.attack       ? `┃◆ ⚔️ ATK: +${oldBonuses.attack}      → +${newBonuses.attack}\n`       : '') +
                (newBonuses.defense      ? `┃◆ 🛡️ DEF: +${oldBonuses.defense}     → +${newBonuses.defense}\n`      : '') +
                `┃◆ 🔧 Durability: ${newDurability}\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ⬆️ UPGRADE WEAPON 〙══╮\n┃◆ ❌ Upgrade failed.\n╰═══════════════════════╯`);
        }
    }
};