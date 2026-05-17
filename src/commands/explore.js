const db = require('../database/db');
const { enterRift, isExploring, EXPLORATION_GC, ENTRY_COSTS } = require('../systems/explorationSystem');

module.exports = {
    name: 'explore',
    async execute(msg, args, { userId }) {
        try {
            const jid = msg.from;
            if (EXPLORATION_GC && jid !== EXPLORATION_GC) return msg.reply(
                `══〘 🌀 RIFT 〙══╮\n┃◆ ❌ Exploration only works\n┃◆ in the Exploration GC.\n╰═══════════════════════╯`
            );

            const [player] = await db.execute(
                "SELECT nickname, role, `rank`, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
                [userId]
            );
            if (!player.length) return msg.reply("❌ Not registered.");

            const p = player[0];
            if (!['Mage','Healer'].includes(p.role)) return msg.reply(
                `══〘 🌀 RIFT 〙══╮\n` +
                `┃◆ ❌ Explorers only.\n` +
                `┃◆ Only Mages and Healers\n` +
                `┃◆ can enter the void rifts.\n` +
                `┃◆ Fighters raid. You explore.\n` +
                `╰═══════════════════════╯`
            );

            const active = await isExploring(userId);
            if (active) {
                const elapsed  = Date.now() - new Date(active.entered_at).getTime();
                const remaining = Math.max(0, Math.ceil((45 * 60 * 1000 - elapsed) / 60000));
                return msg.reply(
                    `══〘 🌀 RIFT 〙══╮\n` +
                    `┃◆ Already in a rift.\n` +
                    `┃◆ ⏳ ${remaining > 0 ? remaining + ' minutes until you can return.' : 'Ready — type !return'}\n` +
                    `╰═══════════════════════╯`
                );
            }

            const isPrestige = p.prestige_level > 0;
            const rank       = p.rank;
            const cost       = ENTRY_COSTS[rank] || 500;
            const result     = await enterRift(userId, rank, p.role, isPrestige);

            if (!result.ok) return msg.reply(
                `══〘 🌀 RIFT 〙══╮\n┃◆ ❌ ${result.reason}\n╰═══════════════════════╯`
            );

            return msg.reply(
                `╔══〘 🌀 VOID RIFT ENTERED 〙══╗\n` +
                `┃◆\n` +
                `┃◆ 〝${result.narrative}〞\n` +
                `┃◆\n` +
                `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃◆ Explorer: ${p.nickname}\n` +
                `┃◆ Role: ${p.role}\n` +
                `┃◆ Rift Tier: ${rank}${isPrestige ? ' (Void Rift)' : ''}\n` +
                `┃◆ Entry Cost: ${cost.toLocaleString()}G\n` +
                `┃◆\n` +
                `┃◆ ⏳ Return in ${result.readyIn}\n` +
                `┃◆ Type !return when ready.\n` +
                `┃◆ Max 2 hours before\n` +
                `┃◆ the void takes it back.\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error('explore error:', err);
            msg.reply('❌ Exploration failed.');
        }
    }
};