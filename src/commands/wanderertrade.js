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
                const giveList = Object.entries(trade.give).map(([m,q]) => `${m}×${q}`).join(', ');
                return msg.reply(
                    `══〘 👤 WANDERER 〙══╮\n┃◆ ❌ Not enough materials.\n┃◆ Need: ${giveList}\n╰═══════════════════════╯`
                );
            }

            await addMaterials(userId, { [trade.receive]: trade.receiveQty });
            wanderer.accepted.add(userId);

            return msg.reply(
                `╔══〘 👤 WANDERER 〙══╗\n┃◆\n┃◆ He nods once.\n┃◆ The exchange is made.\n┃◆\n┃◆ You received:\n┃◆ • ${trade.receive} ×${trade.receiveQty}\n┃◆\n┃◆ He turns and walks back\n┃◆ into nothing.\n╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error('wanderertrade error:', err);
            msg.reply('❌ Trade failed.');
        }
    }
};