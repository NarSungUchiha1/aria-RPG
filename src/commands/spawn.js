const { spawnDungeon } = require('../engine/dungeon');

module.exports = {
    name: 'spawn',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");
        
        const rank = (args[0] || "F").toUpperCase();
        const validRanks = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
        if (!validRanks.includes(rank)) {
            return msg.reply("❌ Invalid rank. Use: F, E, D, C, B, A, or S");
        }

        try {
            // Build targetChat object that dungeon.js expects
            const targetJid = process.env.ANNOUNCEMENT_GROUP || msg.from;

            const targetChat = {
                id: { _serialized: targetJid },
                sendMessage: async (content) => {
                    await client.sendMessage(targetJid, { text: content });
                }
            };

            const dungeon = await spawnDungeon(rank, client, targetChat);

            return msg.reply(`══〘 ✅ DUNGEON SPAWNED 〙══╮
┃◆ Rank: ${rank}
┃◆ Max Stage: ${dungeon.maxStage}
┃◆ Boss: ${dungeon.boss}
┃◆────────────
┃◆ Announcement sent to the raid group.
╰══════════════════════════╯`);

        } catch (err) {
            console.error("Spawn error:", err);
            msg.reply("❌ Spawn failed.");
        }
    }
};