const { claimQuestRewards, ensureTables } = require('../systems/questSystem');

module.exports = {
    name: 'claim',
    async execute(msg, args, { userId, client }) {
        const questId = parseInt(args[0]);
        if (isNaN(questId)) {
            return msg.reply(
                `══〘 🎁 CLAIM 〙══╮\n` +
                `┃◆ ❌ Use: !claim <quest_id>\n` +
                `┃◆ Find IDs in !quests\n` +
                `╰═══════════════════════╯`
            );
        }

        try {
            await ensureTables();
            const result = await claimQuestRewards(userId, questId, client);

            if (result.error) {
                return msg.reply(
                    `══〘 🎁 CLAIM 〙══╮\n` +
                    `┃◆ ❌ ${result.error}\n` +
                    `╰═══════════════════════╯`
                );
            }

            const q = result.quest;
            const isAchievement = q.quest_type === 'achievement';

            let text =
                `══〘 🎁 REWARDS CLAIMED 〙══╮\n` +
                `┃◆ 📜 ${q.title}\n` +
                `┃◆────────────\n` +
                `┃◆ ⭐ +${q.reward_xp} XP\n` +
                `┃◆ 💰 +${q.reward_gold} Gold\n`;

            if (q.reward_sp)    text += `┃◆ ✨ +${q.reward_sp} SP\n`;
            if (q.reward_title) text += `┃◆ 🎖️ Title: "${q.reward_title}"\n`;
            if (isAchievement)  text += `┃◆ 🏆 Achievement unlocked!\n`;

            text += `╰═══════════════════════╯`;

            return msg.reply(text);
        } catch (err) {
            console.error(err);
            msg.reply(
                `══〘 🎁 CLAIM 〙══╮\n` +
                `┃◆ ❌ Claim failed.\n` +
                `╰═══════════════════════╯`
            );
        }
    }
};