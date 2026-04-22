const db = require('../database/db');
const {
    getActiveDungeon,
    lockDungeon,
    isDungeonLocked,
    spawnStageEnemies,
    getDungeonEnemyRevealText,
    demoteAllRaiders
} = require('../engine/dungeon');
const { startDungeonTimers, clearDungeonTimers } = require('../engine/dungeonTimer');

module.exports = {
    name: 'begin',
    async execute(msg, args, { userId, isAdmin, client }) {
        // ✅ Admin only — normal players rely on the auto-start
        if (!isAdmin) return msg.reply("❌ Admin only. The dungeon auto-starts after 5 minutes.");

        try {
            const dungeon = await getActiveDungeon();
            if (!dungeon) return msg.reply("❌ No active dungeon to force-start.");

            if (isDungeonLocked(dungeon.id)) {
                return msg.reply("⚠️ Dungeon has already begun.");
            }

            const [players] = await db.execute(
                "SELECT player_id FROM dungeon_players WHERE dungeon_id=?",
                [dungeon.id]
            );
            if (!players.length) {
                return msg.reply("❌ No players have entered the dungeon yet.");
            }

            await lockDungeon(dungeon.id);
            await spawnStageEnemies(dungeon.id, dungeon.dungeon_rank, 1);

            // targetChat is always the dungeon GC (begin is DUNGEON_GC_ONLY in index.js)
            const targetChat = await msg.getChat();

            const failCallback = async (type) => {
                const failMsg = type === 'stage'
                    ? `══〘 💀 STAGE FAILED 〙══╮\n┃◆ Reinforcements have arrived!\n┃◆ The dungeon overwhelms you. You have died.\n┃◆ ☠️ All raiders: HP set to 0\n┃◆ 💸 Respawn penalties apply on revival.\n╰═══════════════════════╯`
                    : `══〘 💀 DUNGEON COLLAPSED 〙══╮\n┃◆ The dungeon's energy dissipates!\n┃◆ You are crushed by the collapsing realm.\n┃◆ ☠️ All raiders: HP set to 0\n┃◆ 💸 Respawn penalties apply on revival.\n╰═══════════════════════╯`;

                try {
                    const [alive] = await db.execute(
                        "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                        [dungeon.id]
                    );
                    for (const p of alive) {
                        await db.execute("UPDATE players SET hp = 0 WHERE id=?", [p.player_id]);
                    }
                    await demoteAllRaiders(client, dungeon.id);
                    await db.execute("DELETE FROM dungeon_players WHERE dungeon_id=?", [dungeon.id]);
                    await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [dungeon.id]);
                    clearDungeonTimers(dungeon.id);
                    await targetChat.sendMessage(failMsg);
                } catch (err) {
                    console.error("Begin failCallback error:", err);
                }
            };

            await startDungeonTimers(dungeon.id, client, targetChat, failCallback);

            // ── Message 1: Dungeon begins ──
            await msg.reply(
                `╭══〘 ⚔️ DUNGEON HAS BEGUN 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ 🚪 The gates slam shut.\n` +
                `┃◆ No one enters. No one leaves.\n` +
                `┃◆ You fight until victory — or death.\n` +
                `┃◆ \n` +
                `┃◆ The air grows heavy. Shadows stir\n` +
                `┃◆ in the depths ahead. Steel yourselves.\n` +
                `┃◆ \n` +
                `┃◆ Stage 1/${dungeon.max_stage}  •  Rank: ${dungeon.dungeon_rank}\n` +
                `┃◆ ⏱️ 5 min per stage  •  25 min total\n` +
                `┃◆ \n` +
                `┃◆ ⚠️ Defeat all enemies to advance.\n` +
                `┃◆ Use !skill <move> [enemy #] to fight!\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`
            );

            // ── Message 2: Enemy stats reveal ──
            const revealText = await getDungeonEnemyRevealText(dungeon.id);
            if (revealText) return msg.reply(revealText);

        } catch (err) {
            console.error(err);
            msg.reply("❌ Failed to force-start dungeon.");
        }
    }
};