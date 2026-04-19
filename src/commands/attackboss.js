const db = require('../database/db');
const { attackWorldBoss } = require('../systems/worldBossSystem');

module.exports = {
    name: 'attackboss',
    async execute(msg, args, { userId }) {
        const [player] = await db.execute("SELECT strength FROM players WHERE id=?", [userId]);
        if (!player.length) return msg.reply("❌ Not registered.");
        const damage = player[0].strength * 5 + 10; // Example formula
        const result = await attackWorldBoss(userId, damage);
        if (result.error) return msg.reply(result.error);
        let reply = `══〘 ⚔️ BOSS ATTACK 〙══╮\n┃◆ You deal ${damage} damage to ${result.boss.name}!\n`;
        if (result.defeated) reply += `┃◆ ✅ World boss defeated! Rewards distributed.\n`;
        else reply += `┃◆ Boss HP: ${result.newHp}/${result.boss.max_hp}\n`;
        reply += `╰═══════════════════════╯`;
        return msg.reply(reply);
    }
};