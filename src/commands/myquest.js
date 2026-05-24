const db = require('../database/db');

const OBJECTIVE_LABELS = {
    dungeon_clear:  { label: 'Complete full dungeons',         example: 'Clear a dungeon from stage 1 to the boss' },
    kill_enemies:   { label: 'Kill enemies in dungeons',       example: 'Use !attack or !skill to land the killing blow' },
    stage_clear:    { label: 'Clear dungeon stages',           example: 'Use !onward after defeating all enemies on a stage' },
    pvp_win:        { label: 'Win PvP duels',                  example: 'Challenge someone with !duel and win' },
    boss_kill:      { label: 'Kill dungeon bosses',            example: 'Deal the killing blow on the final stage boss' },
};

module.exports = {
    name: 'myquest',
    aliases: ['questcheck', 'myquests'],
    async execute(msg, args, { userId }) {
        try {
            const [quests] = await db.execute(
                `SELECT cq.*, c.name as clan_name, p.nickname as assigner_nick
                 FROM clan_quests cq
                 JOIN clans c ON c.id = cq.clan_id
                 JOIN players p ON p.id = cq.assigned_by
                 WHERE cq.assigned_to = ? AND cq.status = 'active'
                 ORDER BY cq.created_at DESC`,
                [userId]
            );

            if (!quests.length) {
                // Also check recently completed
                const [done] = await db.execute(
                    `SELECT cq.title, cq.reward_gold, cq.reward_xp, c.name as clan_name
                     FROM clan_quests cq JOIN clans c ON c.id=cq.clan_id
                     WHERE cq.assigned_to=? AND cq.status='completed'
                     ORDER BY cq.created_at DESC LIMIT 3`,
                    [userId]
                );

                let text = `══〘 📜 CLAN QUESTS 〙══╮\n┃◆ No active quests assigned.\n┃◆ Ask your clan master to give you a trial.\n`;
                if (done.length) {
                    text += `┃◆\n┃◆ Recently completed:\n`;
                    done.forEach(q => {
                        text += `┃◆ ✅ ${q.title} — ${q.clan_name}\n`;
                    });
                }
                text += `╰═══════════════════════╯`;
                return msg.reply(text);
            }

            let text = `╔══〘 📜 YOUR CLAN QUEST 〙══╗\n┃◆\n`;

            for (const q of quests) {
                const pct    = Math.min(100, Math.floor((q.progress / q.target) * 100));
                const filled = Math.floor(pct / 10);
                const bar    = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
                const info   = OBJECTIVE_LABELS[q.objective] || { label: q.objective, example: '' };
                const remaining = q.target - q.progress;

                text +=
                    `┃◆ 🏰 *${q.clan_name}*\n` +
                    `┃◆ Assigned by: ${q.assigner_nick}\n` +
                    `┃◆\n` +
                    `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃◆ 📌 *${q.title}*\n` +
                    `┃◆ ${q.description}\n` +
                    `┃◆\n` +
                    `┃◆ WHAT TO DO:\n` +
                    `┃◆ ${info.label}\n` +
                    `┃◆ 💡 ${info.example}\n` +
                    `┃◆\n` +
                    `┃◆ PROGRESS:\n` +
                    `┃◆ ${bar}\n` +
                    `┃◆ ${q.progress} / ${q.target} — ${pct}% done\n` +
                    `┃◆ ${remaining} more to go\n` +
                    `┃◆\n` +
                    `┃◆ 🎁 REWARD:\n` +
                    `┃◆ 💰 ${Number(q.reward_gold).toLocaleString()} Gold\n` +
                    `┃◆ ⭐ ${Number(q.reward_xp).toLocaleString()} XP\n` +
                    `┃◆\n`;
            }

            text += `╚═══════════════════════════╝`;
            return msg.reply(text);

        } catch (err) {
            console.error('myquest error:', err);
            msg.reply("❌ Failed to fetch quest.");
        }
    }
};