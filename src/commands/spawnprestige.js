const { spawnPrestigeDungeon } = require('../engine/prestigeDungeon');
const db = require('../database/db');

const VALID_RANKS = ['PF', 'PE', 'PD', 'PC', 'PB', 'PA', 'PS'];
const RAID_GROUP  = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

module.exports = {
    name: 'spawnprestige',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply(
            `╔══〘 ✦ PRESTIGE SPAWN 〙══╗\n┃★ ❌ Admin only.\n╚═══════════════════════════╝`
        );

        const rank = (args[0] || 'PF').toUpperCase();
        if (!VALID_RANKS.includes(rank)) return msg.reply(
            `╔══〘 ✦ PRESTIGE SPAWN 〙══╗\n` +
            `┃★ ❌ Invalid rank.\n` +
            `┃★ Use: PF PE PD PC PB PA PS\n` +
            `╚═══════════════════════════╝`
        );

        try {
            // Close any existing prestige dungeon first
            const [existing] = await db.execute(
                "SELECT id FROM dungeon WHERE is_active=1 AND dungeon_rank LIKE 'P%' LIMIT 1"
            );
            if (existing.length) {
                await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [existing[0].id]);
                await msg.reply(`⚠️ Closed existing prestige dungeon. Spawning ${rank}...`);
            }

            const dungeonId = await spawnPrestigeDungeon(rank, client, RAID_GROUP);
            if (!dungeonId) return msg.reply(
                `╔══〘 ✦ PRESTIGE SPAWN 〙══╗\n┃★ ❌ Spawn failed — check logs.\n╚═══════════════════════════╝`
            );

            return msg.reply(
                `╔══〘 ✦ PRESTIGE SPAWNED 〙══╗\n` +
                `┃★ ✅ Rank ${rank} dungeon is live.\n` +
                `┃★ Alert sent to raid group.\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error('spawnprestige error:', err);
            msg.reply(`╔══〘 ✦ PRESTIGE SPAWN 〙══╗\n┃★ ❌ ${err.message}\n╚═══════════════════════════╝`);
        }
    }
};