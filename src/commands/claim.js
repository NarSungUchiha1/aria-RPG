const { claimQuestRewards } = require('../systems/questSystem');

module.exports = {
    name: 'claim',
    async execute(msg, args, { userId }) {
        const questId = parseInt(args[0]);
        if (isNaN(questId)) return msg.reply("❌ Use: !claim <quest_id>");
        const result = await claimQuestRewards(userId, questId);
        if (result.error) return msg.reply(result.error);
        return msg.reply(`══〘 🎁 REWARDS 〙══╮
┃◆ +${result.rewards.reward_xp} XP
┃◆ +${result.rewards.reward_gold} Gold
${result.rewards.reward_sp ? `┃◆ +${result.rewards.reward_sp} SP\n` : ''}
╰═══════════════════════╯`);
    }
};