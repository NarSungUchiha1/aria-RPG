const db = require('../database/db');
const { getActiveWanderer, WANDERER_TRADES } = require('../systems/wanderer');
const { consumeMaterials, addMaterials, EXPLORATION_GC } = require('../systems/explorationSystem');

module.exports = {
    name: 'wanderertrade',
    async execute(msg, args, { userId }) {
        try {
            const jid = msg.from;
            if (EXPLORATION_GC && jid !== EXPLORATION_GC) return msg.reply(
                `══〘 👤 WANDERER 〙══╮\n┃◆ The Wanderer only visits the Exploration GC.\n╰═══════════════════════╯`
            );

            const wanderer = getActiveWanderer();
            if (!wanderer) return msg.reply(
                `══〘 👤 WANDERER 〙══╮\n┃◆ He is not here.\n┃◆ Watch for when he appears.\n╰═══════════════════════╯`
            );
            if (Date.now() > wanderer.expiresAt) return msg.reply(
                `══〘 👤 WANDERER 〙══╮\n┃◆ He already left.\n╰═══════════════════════╯`
            );
            if (wanderer.accepted.has(userId)) return msg.reply(
                `══〘 👤 WANDERER 〙══╮\n┃◆ You already traded with him.\n╰═══════════════════════╯`
            );

            const trade = WANDERER_TRADES[wanderer.tradeIndex];
            const success = await consumeMaterials(userId, trade.give);

            if (!success) {
                const giveList = Object.entries(trade.give).map(([m,q]) => `${m} ×${q}`).join('\n┃◆   ');
                return msg.reply(
                    `══〘 👤 WANDERER 〙══╮\n` +
                    `┃◆ ❌ You don't have enough.\n` +
                    `┃◆ He needs:\n` +
                    `┃◆   ${giveList}\n` +
                    `┃◆ Check !expmaterials.\n` +
                    `╰═══════════════════════╯`
                );
            }

            let rewardText = '';

            // Give material reward
            if (trade.receive && trade.receiveQty > 0) {
                await addMaterials(userId, { [trade.receive]: trade.receiveQty });
                rewardText += `┃◆ 📦 ${trade.receive} ×${trade.receiveQty}\n`;
            }

            // Give gold reward
            if (trade.receiveGold && trade.receiveGold > 0) {
                await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [trade.receiveGold, userId]);
                rewardText += `┃◆ 💰 ${trade.receiveGold.toLocaleString()} Gold\n`;
            }

            wanderer.accepted.add(userId);

            return msg.reply(
                `╔══〘 👤 WANDERER 〙══╗\n` +
                `┃◆\n` +
                `┃◆ He nods once.\n` +
                `┃◆ The exchange is made.\n` +
                `┃◆\n` +
                `┃◆ You received:\n` +
                rewardText +
                `┃◆\n` +
                `┃◆ He turns and walks back\n` +
                `┃◆ into nothing.\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error('wanderertrade error:', err);
            msg.reply('❌ Trade failed.');
        }
    }
};