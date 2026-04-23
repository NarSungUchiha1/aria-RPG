const db = require('../database/db');
const {
    getActiveDungeon,
    isPlayerInDungeon,
    advanceStage,
    getMaxStageForDungeon,
    getDungeonStatusText,
    demoteAllRaiders
} = require('../engine/dungeon');
const { resetStageTimer, clearDungeonTimers } = require('../engine/dungeonTimer');

module.exports = {
    name: 'onward',
    async execute(msg, args, { userId, client }) {
        try {
            const dungeon = await getActiveDungeon();
            if (!dungeon) return msg.reply(
                `══〘 🧭 ONWARD 〙══╮\n┃◆ ❌ No active dungeon.\n╰═══════════════════════╯`
            );
            if (!dungeon.locked) return msg.reply(
                `══〘 🧭 ONWARD 〙══╮\n┃◆ ❌ Dungeon hasn't started yet.\n┃◆ Wait for auto-start or ask an admin.\n╰═══════════════════════╯`
            );

            if (!(await isPlayerInDungeon(userId, dungeon.id))) {
                return msg.reply(
                    `══〘 🧭 ONWARD 〙══╮\n┃◆ ❌ You are not inside the dungeon.\n╰═══════════════════════╯`
                );
            }

            if (!dungeon.stage_cleared) {
                return msg.reply(`══〘 ⚠️ BLOCKED 〙══╮\n┃◆ The path forward is sealed by a lingering malevolence. Defeat all enemies first!\n┃◆ Use !dungeon to check status.\n╰═══════════════════════╯`);
            }

            const maxStage = await getMaxStageForDungeon(dungeon.id);

            // ── DUNGEON CLEARED ──
            if (dungeon.stage >= maxStage) {
                const [participants] = await db.execute(
                    "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                    [dungeon.id]
                );
                const rewardGold = Math.floor(Math.random() * 300) + 200;
                const rewardXp = Math.floor(Math.random() * 120) + 60; // -40% from original

                for (const p of participants) {
                    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [rewardGold, p.player_id]);
                    await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [rewardXp, p.player_id]);

                    // ✅ Quest tracking — dungeon clear and survive
                    // ✅ Quest tracking — fire and forget
                    (async () => {
                        try {
                            const { updateQuestProgress } = require('../systems/questSystem');
                            await updateQuestProgress(p.player_id, 'dungeon_clear',   1, client);
                            await updateQuestProgress(p.player_id, 'dungeon_survive', 1, client);
                            await updateQuestProgress(p.player_id, 'dungeon_enter',   1, client);
                            if (dungeon.dungeon_rank === 'S') {
                                await updateQuestProgress(p.player_id, 'srank_clear', 1, client);
                            }
                        } catch (e) {}
                    })();
                }

                // ✅ Roll for Void Shard drops (event only, per survivor)
                try {
                    const { handleShardDrop } = require('./event');
                    await handleShardDrop(dungeon.id, client);
                } catch (e) {}

                // ✅ Demote all raiders before closing
                await demoteAllRaiders(client, dungeon.id);

                // Bulk-remove players and close dungeon
                await db.execute("DELETE FROM dungeon_players WHERE dungeon_id=?", [dungeon.id]);
                await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [dungeon.id]);
                clearDungeonTimers(dungeon.id);

                return msg.reply(`══〘 👑 DUNGEON CLEARED 〙══╮
┃◆ The chamber falls silent. ${dungeon.boss_name} lies vanquished, its reign of terror ended.
┃◆ Each survivor feels the dungeon's gratitude:
┃◆ 💰 +${rewardGold} Gold   ⭐ +${rewardXp} XP
┃◆ As the exit shimmers into view, you step out into the light.
╰═══════════════════════╯`);
            }

            // ── ADVANCE STAGE ──
            const next = dungeon.stage + 1;
            await advanceStage(dungeon.id, next);

            // ✅ Track stage clear — fire and forget
            (async () => {
                try {
                    const { updateQuestProgress } = require('../systems/questSystem');
                    const [alive] = await db.execute(
                        "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                        [dungeon.id]
                    );
                    for (const p of alive) {
                        await updateQuestProgress(p.player_id, 'stage_clear', 1, client);
                    }
                } catch (e) {}
            })();

            // targetChat is the dungeon GC (onward is restricted there by index.js routing)
            const targetChat = await msg.getChat();

            const failCallback = async () => {
                try {
                    const [players] = await db.execute(
                        "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                        [dungeon.id]
                    );
                    for (const p of players) {
                        await db.execute("UPDATE players SET hp = 0 WHERE id=?", [p.player_id]);
                    }

                    // ✅ Demote all raiders before closing
                    await demoteAllRaiders(client, dungeon.id);

                    await db.execute("DELETE FROM dungeon_players WHERE dungeon_id=?", [dungeon.id]);
                    await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [dungeon.id]);
                    clearDungeonTimers(dungeon.id);

                    await targetChat.sendMessage(`══〘 💀 STAGE FAILED 〙══╮\n┃◆ Reinforcements have arrived!\n┃◆ The dungeon overwhelms you. You have died.\n╰═══════════════════════╯`);
                } catch (err) {
                    console.error("Onward failCallback error:", err);
                }
            };

            // Reset stage timer only — overall timer keeps running from begin/auto-start
            await resetStageTimer(dungeon.id, client, targetChat, failCallback);

            await msg.reply(`══〘 🧭 STAGE ${next}/${maxStage} 〙══╮
┃◆ The stone door grinds open, revealing a deeper darkness. The air grows colder, and new threats stir in the shadows.
╰═══════════════════════╯`);

            const statusText = await getDungeonStatusText(dungeon.id);
            return msg.reply(statusText);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🧭 ONWARD 〙══╮\n┃◆ ❌ Onward failed.\n╰═══════════════════════╯`);
        }
    }
};