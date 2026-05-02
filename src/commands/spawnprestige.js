const { spawnPrestigeDungeon, PRESTIGE_RANK_ORDER } = require('../engine/prestigeDungeon');

const RAID_GROUP = process.env.RAID_GROUP_JID;

module.exports = {
    name: 'spawnprestige',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply(
            `══〘 ✦ PRESTIGE DUNGEON 〙══╮\n┃★ ❌ Admin only.\n╰═══════════════════════╯`
        );

        const rank = args[0]?.toUpperCase();
        if (!rank || !PRESTIGE_RANK_ORDER.includes(rank)) return msg.reply(
            `══〘 ✦ PRESTIGE DUNGEON 〙══╮\n` +
            `┃★ ❌ Specify a valid rank.\n` +
            `┃★ Options: ${PRESTIGE_RANK_ORDER.join(', ')}\n` +
            `┃★ Example: !spawnprestige PF\n` +
            `╰═══════════════════════╯`
        );

        try {
            const dungeonId = await spawnPrestigeDungeon(rank, client, RAID_GROUP);
            if (!dungeonId) return msg.reply(
                `══〘 ✦ PRESTIGE DUNGEON 〙══╮\n` +
                `┃★ ❌ A prestige dungeon is already active.\n` +
                `╰═══════════════════════╯`
            );

            return msg.reply(
                `╔══〘 ✦ PRESTIGE DUNGEON 〙══╗\n` +
                `┃★ ✅ ${rank} dungeon spawned!\n` +
                `┃★ Announcement sent to GC.\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ✦ PRESTIGE DUNGEON 〙══╮\n┃★ ❌ Failed: ${err.message}\n╰═══════════════════════╯`);
        }
    }
};