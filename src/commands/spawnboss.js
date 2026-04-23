const { spawnWorldBoss, getActiveWorldBoss } = require('../systems/worldBossSystem');

module.exports = {
    name: 'spawnboss',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply(
            `══〘 🌍 SPAWN BOSS 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );

        try {
            const existing = await getActiveWorldBoss();
            if (existing) return msg.reply(
                `══〘 🌍 SPAWN BOSS 〙══╮\n` +
                `┃◆ ⚠️ A world boss is already active.\n` +
                `┃◆ 👹 ${existing.name} [${existing.rank}]\n` +
                `┃◆ ❤️ HP: ${Number(existing.current_hp).toLocaleString()}/${Number(existing.max_hp).toLocaleString()}\n` +
                `┃◆ Use !attackboss to fight it.\n` +
                `╰═══════════════════════╯`
            );

            const boss = await spawnWorldBoss(client);

            return msg.reply(
                `══〘 🌍 SPAWN BOSS 〙══╮\n` +
                `┃◆ ✅ ${boss.name} spawned!\n` +
                `┃◆ Announcement sent to the group.\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🌍 SPAWN BOSS 〙══╮\n┃◆ ❌ Spawn failed.\n╰═══════════════════════╯`);
        }
    }
};