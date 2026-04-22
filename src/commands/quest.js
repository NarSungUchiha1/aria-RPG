const { getPlayerQuests, progressBar, ensureTables } = require('../systems/questSystem');

module.exports = {
    name: 'quests',
    async execute(msg, args, { userId }) {
        try {
            await ensureTables();
            const { daily, achievements, party } = await getPlayerQuests(userId);

            let text = `══〘 📜 QUESTS 〙══╮\n`;

            // ── Daily ──────────────────────────────────────────────
            text += `┃◆ ── 📅 DAILY ──\n`;
            if (!daily.length) {
                text += `┃◆ No daily quests assigned.\n`;
            } else {
                for (const q of daily) {
                    const status = q.claimed    ? '✅ CLAIMED'
                                 : q.completed  ? '🎁 CLAIM: !claim ' + q.id
                                 : '🔄 IN PROGRESS';
                    text += `┃◆ [#${q.id}] ${q.title}\n`;
                    text += `┃◆   ${progressBar(q.progress, q.objective_count)}\n`;
                    text += `┃◆   ${status}\n`;
                    text += `┃◆────────────\n`;
                }
            }

            // ── Achievements (top 5 most relevant) ────────────────
            text += `┃◆ ── 🏆 ACHIEVEMENTS ──\n`;
            if (!achievements.length) {
                text += `┃◆ No achievements yet.\n`;
            } else {
                for (const a of achievements) {
                    const status = a.claimed    ? '✅ CLAIMED'
                                 : a.completed  ? '🎁 CLAIM: !claim ' + a.id
                                 : '🔄 IN PROGRESS';
                    text += `┃◆ [#${a.id}] ${a.title}\n`;
                    if (a.reward_title) text += `┃◆   🎖️ Unlocks: "${a.reward_title}"\n`;
                    text += `┃◆   ${progressBar(a.progress, a.objective_count)}\n`;
                    text += `┃◆   ${status}\n`;
                    text += `┃◆────────────\n`;
                }
            }

            // ── Party (weekly) ─────────────────────────────────────
            text += `┃◆ ── 👥 PARTY (WEEKLY) ──\n`;
            if (!party.length) {
                text += `┃◆ No party quests this week.\n`;
            } else {
                for (const p of party) {
                    const status = p.claimed    ? '✅ CLAIMED'
                                 : p.completed  ? '🎁 CLAIM: !claim ' + p.id
                                 : '🔄 IN PROGRESS';
                    text += `┃◆ [#${p.id}] ${p.title}\n`;
                    text += `┃◆   ${progressBar(p.progress, p.objective_count)}\n`;
                    text += `┃◆   ${status}\n`;
                    text += `┃◆────────────\n`;
                }
            }

            text += `┃◆ Use !claim <#> to collect rewards\n`;
            text += `╰═══════════════════════╯`;

            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(
                `══〘 📜 QUESTS 〙══╮\n` +
                `┃◆ ❌ Could not load quests.\n` +
                `╰═══════════════════════╯`
            );
        }
    }
};