const db = require('../database/db');
const { POTIONS } = require('../systems/potions');
const { consumeMaterials, getMaterials, EXPLORATION_GC } = require('../systems/explorationSystem');

module.exports = {
    name: 'brew',
    async execute(msg, args, { userId }) {
        try {
            const jid = msg.from;
            if (EXPLORATION_GC && jid !== EXPLORATION_GC) return msg.reply(
                `══〘 ⚗️ BREW 〙══╮\n┃◆ ❌ Brew in the Exploration GC.\n╰═══════════════════════╯`
            );

            const [player] = await db.execute(
                "SELECT nickname, role, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
                [userId]
            );
            if (!player.length) return msg.reply("❌ Not registered.");
            const p = player[0];

            if (!['Mage','Healer'].includes(p.role)) return msg.reply(
                `══〘 ⚗️ BREW 〙══╮\n┃◆ ❌ Only Mages and Healers can brew.\n╰═══════════════════════╯`
            );

            // Show all potions
            if (!args[0]) {
                let text = `╔══〘 ⚗️ ALCHEMY 〙══╗\n┃◆\n`;
                let i = 1;
                for (const [name, pot] of Object.entries(POTIONS)) {
                    if (pot.prestige && !p.prestige_level) continue;
                    const ingList = Object.entries(pot.ingredients).map(([m,q]) => `${m}×${q}`).join(', ');
                    text +=
                        `┃◆ ${i}. *${name}*\n` +
                        `┃◆    ${pot.desc}\n` +
                        `┃◆    📦 ${ingList}\n` +
                        `┃◆    💰 Min price: ${pot.minPrice.toLocaleString()}G\n` +
                        `┃◆\n`;
                    i++;
                }
                text += `┃◆ CMD: !brew <number>\n╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            // Brew by number
            const num = parseInt(args[0]);
            const available = Object.entries(POTIONS).filter(([, pot]) => !pot.prestige || p.prestige_level > 0);
            const entry = available[num - 1];
            if (!entry) return msg.reply("❌ Invalid number. Type !brew to see list.");

            const [potName, potion] = entry;

            // Check materials
            const hasMats = await consumeMaterials(userId, potion.ingredients);
            if (!hasMats) {
                const ingList = Object.entries(potion.ingredients).map(([m,q]) => `${m}×${q}`).join(', ');
                return msg.reply(
                    `══〘 ⚗️ BREW 〙══╮\n` +
                    `┃◆ ❌ Not enough materials.\n` +
                    `┃◆ Need: ${ingList}\n` +
                    `┃◆ Type !materials to check stock.\n` +
                    `╰═══════════════════════╯`
                );
            }

            // Add potion to inventory
            await db.execute(`
                INSERT INTO potion_inventory (player_id, potion_name, quantity)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE quantity = quantity + 1
            `, [userId, potName]);

            return msg.reply(
                `╔══〘 ⚗️ BREWED 〙══╗\n` +
                `┃◆\n` +
                `┃◆ *${potName}*\n` +
                `┃◆ ${potion.desc}\n` +
                `┃◆\n` +
                `┃◆ 〝${potion.lore}〞\n` +
                `┃◆\n` +
                `┃◆ !listpotion <name> <price>\n` +
                `┃◆ to sell it on the market.\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error('brew error:', err);
            msg.reply('❌ Brewing failed.');
        }
    }
};