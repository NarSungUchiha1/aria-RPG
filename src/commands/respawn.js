const db = require('../database/db');
const { applyBuff } = require('../systems/activeBuffs');
const { removePlayerFromDungeon, getActiveDungeon, demoteRaider } = require('../engine/dungeon');

module.exports = {
    name: 'respawn',
    async execute(msg, args, { userId, client }) {
        try {
            const [rows] = await db.execute("SELECT hp, max_hp FROM players WHERE id=?", [userId]);
            if (!rows.length) return msg.reply(
                `══〘 💀 RESPAWN 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );
            if (rows[0].hp > 0) return msg.reply(
                `══〘 💀 RESPAWN 〙══╮\n┃◆ ⚡ You are still alive!\n╰═══════════════════════╯`
            );

            // ── Gold penalty (20%) ───────────────────────────────────────────
            const [goldRow] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const currentGold = goldRow[0]?.gold || 0;
            const goldLoss    = Math.floor(currentGold * 0.2);
            await db.execute("UPDATE currency SET gold = GREATEST(0, gold - ?) WHERE player_id=?", [goldLoss, userId]);

            // ── XP penalty (10%) ─────────────────────────────────────────────
            const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const currentXp = xpRow[0]?.xp || 0;
            const xpLoss    = Math.floor(currentXp * 0.1);
            await db.execute("UPDATE xp SET xp = GREATEST(0, xp - ?) WHERE player_id=?", [xpLoss, userId]);

            // ── Durability loss on equipped items ────────────────────────────
            const [equipped] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? AND equipped=1",
                [userId]
            );
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

            // ── Remove from dungeon if inside ────────────────────────────────
            const dungeon = await getActiveDungeon();
            let removedFromDungeon = false;
            if (dungeon) {
                const [inDungeon] = await db.execute(
                    "SELECT * FROM dungeon_players WHERE player_id=? AND dungeon_id=?",
                    [userId, dungeon.id]
                );
                if (inDungeon.length) {
                    await removePlayerFromDungeon(userId, dungeon.id);
                    try { await demoteRaider(client, userId); } catch (e) {}
                    removedFromDungeon = true;
                }
            }

            // ── Revive at 50% HP ─────────────────────────────────────────────
            const reviveHp = Math.floor(rows[0].max_hp / 2);
            await db.execute("UPDATE players SET hp=? WHERE id=?", [reviveHp, userId]);

            // ── ✅ Weakened debuff via activeBuffs (in-memory, read by combat) ──
            // Previous version used buffSystem.js (DB-based) which combat never reads.
            // activeBuffs.js is what skillSystem.js and dungeon.js actually check.
            applyBuff('player', userId, { type: 'debuff', stat: 'strength',     value: -10, duration: 5 });
            applyBuff('player', userId, { type: 'debuff', stat: 'agility',      value: -10, duration: 5 });
            applyBuff('player', userId, { type: 'debuff', stat: 'intelligence', value: -10, duration: 5 });
            applyBuff('player', userId, { type: 'debuff', stat: 'stamina',      value: -10, duration: 5 });

            let reply =
                `══〘 💀 RESPAWN 〙══╮\n` +
                `┃◆ ✅ Revived at ${reviveHp}/${rows[0].max_hp} HP\n` +
                `┃◆━━━━━━━━━━━━\n` +
                `┃◆ ── PENALTIES ──\n` +
                `┃◆ 💰 Gold lost:  -${goldLoss}\n` +
                `┃◆ ⭐ XP lost:    -${xpLoss}\n`;

            if (brokenItems.length) {
                reply += `┃◆ 💔 Broken: ${brokenItems.join(', ')}\n`;
            } else if (equipped.length) {
                reply += `┃◆ 🔧 Equipped items: -20 durability\n`;
            }
            if (removedFromDungeon) {
                reply += `┃◆ 🏰 Removed from active dungeon\n`;
            }
            reply +=
                `┃◆━━━━━━━━━━━━\n` +
                `┃◆ ⚠️ WEAKENED — -10 all stats\n` +
                `┃◆    for 5 combat turns\n` +
                `╰═══════════════════════╯`;

            return msg.reply(reply);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 💀 RESPAWN 〙══╮\n┃◆ ❌ Respawn failed.\n╰═══════════════════════╯`);
        }
    }
};