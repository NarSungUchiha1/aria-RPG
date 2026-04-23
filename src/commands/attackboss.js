const db = require('../database/db');
const { attackWorldBoss } = require('../systems/worldBossSystem');

module.exports = {
    name: 'attackboss',
    async execute(msg, args, { userId }) {
        const [player] = await db.execute("SELECT strength FROM players WHERE id=?", [userId]);
        if (!player.length) return msg.reply(
            `══〘 🌍 BOSS ATTACK 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
        );
        const damage = player[0].strength * 5 + 10;
        const result = await attackWorldBoss(userId, damage);
        if (result.error) return msg.reply(
            `══〘 🌍 BOSS ATTACK 〙══╮\n┃◆ ❌ ${result.error}\n╰═══════════════════════╯`
        );
        let reply =
            `══〘 🌍 BOSS ATTACK 〙══╮\n` +
            `┃◆ ⚔️ You deal ${damage} damage to ${result.boss.name}!\n`;
        if (result.defeated) reply += `┃◆ ✅ World boss defeated! Rewards distributed.\n`;
        else reply += `┃◆ ❤️ Boss HP: ${result.newHp}/${result.boss.max_hp}\n`;
        reply += `╰═══════════════════════╯`;
        return msg.reply(reply);
    }
};