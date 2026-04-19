const db = require('../database/db');
const getUserId = require('../utils/getUserId');
const { applyEffect } = require('../systems/buffSystem');
const { removePlayerFromDungeon, getActiveDungeon } = require('../engine/dungeon');

module.exports = {
    name: 'respawn',
    async execute(msg, args, { userId }) {
        try {
            const [rows] = await db.execute("SELECT hp, max_hp FROM players WHERE id=?", [userId]);
            if (!rows.length) return msg.reply("❌ You are not registered.");
            if (rows[0].hp > 0) return msg.reply("⚡ You are already alive.");

            // Gold penalty (20%)
            const [goldRow] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const currentGold = goldRow[0]?.gold || 0;
            const goldLoss = Math.floor(currentGold * 0.2);
            await db.execute("UPDATE currency SET gold = GREATEST(0, gold - ?) WHERE player_id=?", [goldLoss, userId]);

            // XP penalty (10%)
            const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const currentXp = xpRow[0]?.xp || 0;
            const xpLoss = Math.floor(currentXp * 0.1);
            await db.execute("UPDATE xp SET xp = GREATEST(0, xp - ?) WHERE player_id=?", [xpLoss, userId]);

            // Durability loss on equipped items (20 points each)
            const [equipped] = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [userId]);
            let brokenItems = [];
            for (const item of equipped) {
                const newDur = Math.max(0, (item.durability || 100) - 20);
                if (newDur <= 0) {
                    await db.execute("DELETE FROM inventory WHERE id=?", [item.id]);
                    brokenItems.push(item.item_name);
                } else {
                    await db.execute("UPDATE inventory SET durability=? WHERE id=?", [newDur, item.id]);
                }
            }

            // Remove from dungeon if inside
            const dungeon = await getActiveDungeon();
            let removedFromDungeon = false;
            if (dungeon) {
                const [inDungeon] = await db.execute(
                    "SELECT * FROM dungeon_players WHERE player_id=? AND dungeon_id=?",
                    [userId, dungeon.id]
                );
                if (inDungeon.length) {
                    await removePlayerFromDungeon(userId, dungeon.id);
                    removedFromDungeon = true;
                }
            }

            // Revive at 50% HP
            await db.execute("UPDATE players SET hp = max_hp / 2 WHERE id=?", [userId]);

            // Apply "Weakened" debuff (5 minutes)
            await applyEffect('player', userId, 'Weakened', 
                { str_penalty: 0.2, agi_penalty: 0.2, int_penalty: 0.2, sta_penalty: 0.2 }, 
                300, null);

            let reply = `══〘 💀 RESPAWN 〙══╮
┃◆ You have been revived at 50% HP.
┃◆────────────
┃◆ 💰 Gold lost: ${goldLoss}
┃◆ ⭐ XP lost: ${xpLoss}
`;
            if (brokenItems.length) {
                reply += `┃◆ 💔 Items broken: ${brokenItems.join(', ')}\n`;
            } else if (equipped.length) {
                reply += `┃◆ 🛠️ Equipped items lost 20 durability\n`;
            }
            if (removedFromDungeon) {
                reply += `┃◆ 🏰 Removed from active dungeon\n`;
            }
            reply += `┃◆ ⚠️ Debuff: Weakened (5 min) -20% all stats\n`;
            reply += `╰═══════════════════════╯`;
            return msg.reply(reply);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Respawn failed.");
        }
    }
};