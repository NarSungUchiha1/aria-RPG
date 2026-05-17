const db = require('../database/db');
const { enterRift, isExploring, EXPLORATION_GC, ENTRY_COSTS } = require('../systems/explorationSystem');

const SURVIVAL_RATES = {
    F: 0.95, E: 0.92, D: 0.88, C: 0.83, B: 0.77, A: 0.70, S: 0.62,
    PF: 0.55, PE: 0.50, PD: 0.44, PC: 0.38, PB: 0.32, PA: 0.25, PS: 0.18
};

// Explorer bonus — +5% survival at every tier
const EXPLORER_SURVIVAL_BONUS = 0.05;

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

            // Explorer only
            if (p.role !== 'Explorer') return msg.reply(
                `╔══〘 🌀 VOID RIFT 〙══╗\n` +
                `┃◆\n` +
                `┃◆ ❌ Rifts are sealed to you.\n` +
                `┃◆\n` +
                `┃◆ Only *Explorers* can enter\n` +
                `┃◆ the void rifts.\n` +
                `┃◆\n` +
                `┃◆ Fighters raid dungeons.\n` +
                `┃◆ Explorers walk the void.\n` +
                `╚═══════════════════════════╝`
            );

            const active = await isExploring(userId);
            if (active) {
                const elapsed   = Date.now() - new Date(active.entered_at).getTime();
                const remaining = Math.max(0, Math.ceil((45 * 60 * 1000 - elapsed) / 60000));
                return msg.reply(
                    `══〘 🌀 RIFT 〙══╮\n` +
                    `┃◆ Already in a rift.\n` +
                    `┃◆ ⏳ ${remaining > 0 ? remaining + ' minutes until you can return.' : 'Ready — type !return'}\n` +
                    `╰═══════════════════════╯`
                );
            }

            const isPrestige  = p.prestige_level > 0;
            const rank        = p.rank;
            const cost        = ENTRY_COSTS[rank] || 500;
            const baseSurvival = SURVIVAL_RATES[rank] || 0.80;
            const survivalPct = Math.min(99, Math.floor((baseSurvival + EXPLORER_SURVIVAL_BONUS) * 100));

            const result = await enterRift(userId, rank, p.role, isPrestige);
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
                `┃◆ Rift Tier: ${rank}${isPrestige ? ' ✦ Void Rift' : ''}\n` +
                `┃◆ Entry Cost: ${cost.toLocaleString()}G\n` +
                `┃◆ ⚠️ Survival Chance: ${survivalPct}%\n` +
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