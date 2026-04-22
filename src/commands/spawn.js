const { spawnDungeon, getActiveDungeon, getWeightedDungeonRank } = require('../engine/dungeon');

module.exports = {
    name: 'spawn',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");

        const validRanks = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];

        // If rank given, validate it. If not, use weighted selection.
        let rank;
        if (args[0]) {
            rank = args[0].toUpperCase();
            if (!validRanks.includes(rank)) {
                return msg.reply("❌ Invalid rank. Use: F E D C B A S\nOr omit rank to auto-select based on player population.");
            }
        } else {
            rank = await getWeightedDungeonRank();
        }

        try {
            // Warn if there's already an active dungeon but allow admin override
            const active = await getActiveDungeon();
            if (active) {
                // Force-close the old one and spawn new — spawnDungeon handles teardown
                await msg.reply(`⚠️ Closing existing Rank ${active.dungeon_rank} dungeon and spawning new one...`);
            }

            const dungeon = await spawnDungeon(rank, client);

            return msg.reply(
                `══〘 ✅ DUNGEON SPAWNED 〙══╮\n` +
                `┃◆ Rank: ${rank}${!args[0] ? ' (auto-selected)' : ''}\n` +
                `┃◆ Max Stage: ${dungeon.maxStage}\n` +
                `┃◆ Boss: ${dungeon.boss}\n` +
                `┃◆────────────\n` +
                `┃◆ Announcement sent to the raid group.\n` +
                `╰══════════════════════════╯`
            );
        } catch (err) {
            console.error("Spawn error:", err);
            msg.reply("❌ Spawn failed.");
        }
    }
};