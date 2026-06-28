const { getPlayerQuests, progressBar, ensureTables } = require('../systems/questSystem');
const db = require('../database/db');

module.exports = {
    name: 'quests',
    async execute(msg, args, { userId }) {
        try {
            await ensureTables();

            // Get player role for display
            const [playerRow] = await db.execute("SELECT role, nickname FROM players WHERE id=?", [userId]);
            if (!playerRow.length) return msg.reply(
                `══〘 📜 QUESTS 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );
            const role = playerRow[0].role;

            const { daily, achievements, party } = await getPlayerQuests(userId);

            let text = `══〘 📜 QUESTS 〙══╮\n`;
            text += `┃◆ 🎭 ${role} — ${playerRow[0].nickname}\n`;
            text += `┃◆━━━━━━━━━━━━\n`;

            // ── Daily (3 quests, sequential 1-3) ──────────────────────────
            text += `┃◆ 📅 DAILY QUESTS\n`;
            if (!daily.length) {
                text += `┃◆   No daily quests yet.\n`;
            } else {
                daily.forEach((q, i) => {
                    const bar    = progressBar(q.progress, q.objective_count);
                    const status = q.claimed   ? `✅ Claimed`
                                 : q.completed ? `🎁 !claim ${q.quest_id}`
                                 : `🔄 ${bar}`;
                    text += `┃◆ ${i + 1}. *${q.title}*\n`;
                    text += `┃◆    ${q.description}\n`;
                    text += `┃◆    ${status}\n`;
                    if (i < daily.length - 1) text += `┃◆   ──\n`;
                });
            }

            text += `┃◆━━━━━━━━━━━━\n`;

            // ── Achievements (top 4 most relevant) ────────────────────────
            text += `┃◆ 🏆 ACHIEVEMENTS\n`;
            if (!achievements.length) {
                text += `┃◆   None unlocked yet.\n`;
            } else {
                achievements.forEach((a, i) => {
                    const bar    = progressBar(a.progress, a.objective_count);
                    const status = a.claimed   ? `✅ Claimed`
                                 : a.completed ? `🎁 !claim ${a.quest_id}`
                                 : `🔄 ${bar}`;
                    text += `┃◆ ${i + 1}. *${a.title}*\n`;
                    text += `┃◆    ${a.description}\n`;
                    if (a.reward_title) text += `┃◆    🎖️ Unlocks title: "${a.reward_title}"\n`;
                    text += `┃◆    ${status}\n`;
                    if (i < achievements.length - 1) text += `┃◆   ──\n`;
                });
            }

            text += `┃◆━━━━━━━━━━━━\n`;

            // ── Party (weekly) ─────────────────────────────────────────────
            text += `┃◆ 👥 PARTY QUEST (WEEKLY)\n`;
            if (!party.length) {
                text += `┃◆   No party quests this week.\n`;
            } else {
                party.forEach((p, i) => {
                    const bar    = progressBar(p.progress, p.objective_count);
                    const status = p.claimed   ? `✅ Claimed`
                                 : p.completed ? `🎁 !claim ${p.quest_id}`
                                 : `🔄 ${bar}`;
                    text += `┃◆ ${i + 1}. *${p.title}*\n`;
                    text += `┃◆    ${p.description}\n`;
                    text += `┃◆    ${status}\n`;
                    if (i < party.length - 1) text += `┃◆   ──\n`;
                });
            }

            text += `┃◆━━━━━━━━━━━━\n`;
            text += `┃◆ Use !claim <id> to collect rewards\n`;
            text += `╰═══════════════════════╯`;

            return msg.reply(text);
        } catch (err) {
            console.error('Quest load error:', err);
            msg.reply(
                `══〘 📜 QUESTS 〙══╮\n` +
                `┃◆ ❌ Could not load quests.\n` +
                `┃◆ ${err.message}\n` +
                `╰═══════════════════════╯`
            );
        }
    }
};