const db = require('../database/db');
const getUserId = require('../utils/getUserId');

const VALID_STATS = ['strength', 'agility', 'intelligence', 'stamina'];

module.exports = {
    name: 'upgrade',
    async execute(msg, args, { userId }) {
        if (args.length < 2) {
            return msg.reply("❌ Use: !upgrade <stat> <points>\nStats: strength, agility, intelligence, stamina");
        }

        const stat = args[0].toLowerCase();
        if (!VALID_STATS.includes(stat)) {
            return msg.reply("❌ Invalid stat. Choose: strength, agility, intelligence, stamina");
        }

        const points = parseInt(args[1]);
        if (isNaN(points) || points <= 0) {
            return msg.reply("❌ Invalid points amount.");
        }

        try {
            const [player] = await db.execute("SELECT sp, strength, agility, intelligence, stamina FROM players WHERE id=?", [userId]);
            if (!player.length) return msg.reply("❌ Not registered.");

            const p = player[0];
            if (p.sp < points) {
                return msg.reply(`❌ You only have ${p.sp} SP. Convert XP first.`);
            }

            await db.execute("UPDATE players SET sp = sp - ? WHERE id=?", [points, userId]);
            await db.execute(`UPDATE players SET ${stat} = ${stat} + ? WHERE id=?`, [points, userId]);

            const [updated] = await db.execute(`SELECT ${stat} FROM players WHERE id=?`, [userId]);
            const newValue = updated[0][stat];

            return msg.reply(`╭══〘 ⬆️ STAT UPGRADE 〙══╮
┃
┃   ${stat.toUpperCase()} +${points}
┃   New value: ${newValue}
┃   Remaining SP: ${p.sp - points}
┃
╰══════════════════════════╯`);
        } catch (err) {
            console.error(err);
            msg.reply("❌ Upgrade failed.");
        }
    }
};