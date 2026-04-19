const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { getNextGrade, upgradeCosts, durabilityValues, getGradeIncrementCount } = require('../data/weaponGrades');
const itemStats = require('../data/itemStats');

module.exports = {
    name: 'upgradeweapon',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply("❌ Use: !upgradeweapon <item number>");
        const index = parseInt(args[0]) - 1;
        if (isNaN(index) || index < 0) return msg.reply("❌ Invalid number.");

        try {
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? ORDER BY id",
                [userId]
            );
            const item = items[index];
            if (!item) return msg.reply("❌ Item not found.");
            
            const currentGrade = item.grade || 'F';
            const nextGrade = getNextGrade(currentGrade);
            if (!nextGrade) return msg.reply("❌ Already max grade (S).");

            const cost = upgradeCosts[currentGrade];
            const [money] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const gold = money[0]?.gold || 0;
            if (gold < cost) return msg.reply(`❌ Need ${cost} gold.`);

            const data = itemStats[item.item_name];
            if (!data) return msg.reply("❌ This item cannot be upgraded.");

            const incrementCount = getGradeIncrementCount(nextGrade);
            
            const newBonuses = {
                strength: (data.base.strength || 0) + (data.increment.strength || 0) * incrementCount,
                agility: (data.base.agility || 0) + (data.increment.agility || 0) * incrementCount,
                intelligence: (data.base.intelligence || 0) + (data.increment.intelligence || 0) * incrementCount,
                stamina: (data.base.stamina || 0) + (data.increment.stamina || 0) * incrementCount,
                attack: (data.base.attack || 0) + (data.increment.attack || 0) * incrementCount,
                defense: (data.base.defense || 0) + (data.increment.defense || 0) * incrementCount
            };

            const newDurability = durabilityValues[nextGrade];

            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [cost, userId]);
            await db.execute(
                `UPDATE inventory SET 
                    grade = ?,
                    strength_bonus = ?,
                    agility_bonus = ?,
                    intelligence_bonus = ?,
                    stamina_bonus = ?,
                    attack_bonus = ?,
                    defense_bonus = ?,
                    max_durability = ?,
                    durability = ?
                WHERE id = ?`,
                [
                    nextGrade,
                    newBonuses.strength,
                    newBonuses.agility,
                    newBonuses.intelligence,
                    newBonuses.stamina,
                    newBonuses.attack,
                    newBonuses.defense,
                    newDurability,
                    newDurability,
                    item.id
                ]
            );

            const oldCount = getGradeIncrementCount(currentGrade);
            const oldBonuses = {
                strength: (data.base.strength || 0) + (data.increment.strength || 0) * oldCount,
                agility: (data.base.agility || 0) + (data.increment.agility || 0) * oldCount,
                intelligence: (data.base.intelligence || 0) + (data.increment.intelligence || 0) * oldCount,
                stamina: (data.base.stamina || 0) + (data.increment.stamina || 0) * oldCount,
                attack: (data.base.attack || 0) + (data.increment.attack || 0) * oldCount,
                defense: (data.base.defense || 0) + (data.increment.defense || 0) * oldCount
            };

            return msg.reply(`══〘 ⬆️ WEAPON UPGRADE 〙══╮
┃◆ ${item.item_name} (${currentGrade} → ${nextGrade})
┃◆ Cost: ${cost} gold
┃◆────────────
┃◆ 💪 STR: +${oldBonuses.strength} → +${newBonuses.strength}
┃◆ ⚡ AGI: +${oldBonuses.agility} → +${newBonuses.agility}
┃◆ 🧠 INT: +${oldBonuses.intelligence} → +${newBonuses.intelligence}
┃◆ 🛡️ STA: +${oldBonuses.stamina} → +${newBonuses.stamina}
┃◆ ⚔️ ATK: +${oldBonuses.attack} → +${newBonuses.attack}
┃◆ 🛡️ DEF: +${oldBonuses.defense} → +${newBonuses.defense}
┃◆ 🔧 Durability: ${newDurability}
╰═══════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Upgrade failed.");
        }
    }
};