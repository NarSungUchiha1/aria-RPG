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
const { spawnPrestigeEnemies } = require('../engine/prestigeDungeon');

module.exports = {
    name: 'begin',
    async execute(msg, args, { userId, isAdmin, client }) {
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
                return msg.reply("❌ No players have entered yet.");
            }

            const isPrestige = dungeon.dungeon_rank && dungeon.dungeon_rank.startsWith('P');

            await lockDungeon(dungeon.id);

            try {
                const { initStage } = require('../systems/contributionSystem');
                initStage(dungeon.id);
            } catch(e) {}

            // Spawn correct enemies based on dungeon type
            if (isPrestige) {
                await spawnPrestigeEnemies(dungeon.id, dungeon.dungeon_rank, 1);
            } else {
                await spawnStageEnemies(dungeon.id, dungeon.dungeon_rank, 1);
            }

            const targetChat = await msg.getChat();

            const failCallback = async (type) => {
                const failMsg = isPrestige
                    ? `╔══〘 ✦ VOID DUNGEON COLLAPSED 〙══╗\n┃★ The void reclaims what was opened.\n┃★ ☠️ All hunters have fallen.\n┃★ 💸 Respawn penalties apply.\n╚═══════════════════════════╝`
                    : `══〘 💀 DUNGEON COLLAPSED 〙══╮\n┃◆ The dungeon's energy dissipates!\n┃◆ ☠️ All raiders: HP set to 0\n┃◆ 💸 Respawn penalties apply on revival.\n╰═══════════════════════╯`;

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

            await startDungeonTimers(dungeon.id, client, targetChat, failCallback, dungeon.dungeon_rank);

            if (isPrestige) {
                await msg.reply(
                    `╔══〘 ✦ THE VOID OPENS 〙══╗\n` +
                    `┃★ \n` +
                    `┃★ The rift seals behind you.\n` +
                    `┃★ What lies ahead has no name\n` +
                    `┃★ in any living language.\n` +
                    `┃★ \n` +
                    `┃★ Stage 1/${dungeon.max_stage}  •  Rank: ${dungeon.dungeon_rank}\n` +
                    `┃★ ⏱️ 5 min per stage\n` +
                    `┃★ \n` +
                    `┃★ Use !skill <move> [enemy #]\n` +
                    `┃★ \n` +
                    `╚═══════════════════════════╝`
                );
            } else {
                await msg.reply(
                    `╭══〘 ⚔️ DUNGEON BEGINS 〙══╮\n` +
                    `┃◆ \n` +
                    `┃◆ 🚪 The gates slam shut.\n` +
                    `┃◆ No one enters. No one leaves.\n` +
                    `┃◆ \n` +
                    `┃◆ Stage 1/${dungeon.max_stage}  •  Rank: ${dungeon.dungeon_rank}\n` +
                    `┃◆ ⏱️ 5 min per stage  •  25 min total\n` +
                    `┃◆ \n` +
                    `┃◆ Use !skill <move> [enemy #]\n` +
                    `┃◆ \n` +
                    `╰═══════════════════════════╯`
                );
            }

            const revealText = await getDungeonEnemyRevealText(dungeon.id);
            if (revealText) return msg.reply(revealText);

        } catch (err) {
            console.error('begin error:', err);
            msg.reply("❌ Failed to force-start dungeon.");
        }
    }
};