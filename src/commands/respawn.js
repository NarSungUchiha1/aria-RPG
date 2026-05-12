const db = require('../database/db');
const { removePlayerFromDungeon, getActiveDungeon } = require('../engine/dungeon');

module.exports = {
    name: 'respawn',
    async execute(msg, args, { userId }) {
        try {
            const [rows] = await db.execute("SELECT hp, max_hp FROM players WHERE id=?", [userId]);
            if (!rows.length) return msg.reply(
                `══〘 💀 RESPAWN 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );
            if (rows[0].hp > 0) return msg.reply(
                `══〘 💀 RESPAWN 〙══╮\n┃◆ ⚡ You are already alive.\n╰═══════════════════════╯`
            );

            // Gold penalty 20%
            const [goldRow] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const goldLoss = Math.floor((goldRow[0]?.gold || 0) * 0.2);
            await db.execute("UPDATE currency SET gold = GREATEST(0, gold - ?) WHERE player_id=?", [goldLoss, userId]);

            // XP penalty 10%
            const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const xpLoss = Math.floor((xpRow[0]?.xp || 0) * 0.1);
            await db.execute("UPDATE xp SET xp = GREATEST(0, xp - ?) WHERE player_id=?", [xpLoss, userId]);

            // Durability loss on equipped items
            const [equipped] = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [userId]);
            const brokenItems = [];
            for (const item of equipped) {
                const newDur = Math.max(0, (item.durability || 100) - 20);
                if (newDur <= 0) {
                    await db.execute("DELETE FROM inventory WHERE id=?", [item.id]);
                    brokenItems.push(item.item_name);
                } else {
                    await db.execute("UPDATE inventory SET durability=? WHERE id=?", [newDur, item.id]);
                }
            }

            // Remove from dungeon
            let removedFromDungeon = false;
            try {
                const dungeon = await getActiveDungeon();
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
            } catch(e) {}

            // Revive at 50% HP
            await db.execute("UPDATE players SET hp = FLOOR(max_hp / 2) WHERE id=?", [userId]);

            let reply =
                `══〘 💀 RESPAWN 〙══╮\n` +
                `┃◆ ✅ Revived at 50% HP.\n` +
                `┃◆────────────\n` +
                `┃◆ 💰 Gold lost: ${goldLoss}\n` +
                `┃◆ ⭐ XP lost:   ${xpLoss}\n`;

            if (brokenItems.length) reply += `┃◆ 💔 Broken: ${brokenItems.join(', ')}\n`;
            else if (equipped.length) reply += `┃◆ 🛠️ Equipped items: -20 durability\n`;
            if (removedFromDungeon) reply += `┃◆ 🏰 Removed from dungeon\n`;

            reply += `╰═══════════════════════╯`;
            return msg.reply(reply);

        } catch (err) {
            console.error(err);
            msg.reply(`══〘 💀 RESPAWN 〙══╮\n┃◆ ❌ Respawn failed: ${err.message}\n╰═══════════════════════╯`);
        }
    }
};