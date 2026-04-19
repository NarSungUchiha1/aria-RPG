const { spawnDungeon } = require('../engine/dungeon');

module.exports = {
    name: 'spawn',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");
        const rank = (args[0] || "F").toUpperCase();
        try {
            let targetChat;
            if (process.env.ANNOUNCEMENT_GROUP) {
                targetChat = await client.getChatById(process.env.ANNOUNCEMENT_GROUP);
            } else {
                targetChat = await msg.getChat();
            }
            const dungeon = await spawnDungeon(rank, client, targetChat);
            return msg.reply(`══〘 ✅ DUNGEON SPAWNED 〙══╮
┃◆ Rank: ${rank}
┃◆ Max Stage: ${dungeon.maxStage}
┃◆ Boss: ${dungeon.boss}
┃◆────────────
┃◆ Announcement sent to the raid group.
╰══════════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Spawn failed.");
        }
    }
};