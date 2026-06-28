const db = require('../database/db');
const { POTIONS } = require('../systems/potions');
const { consumeMaterials, getMaterials, EXPLORATION_GC } = require('../systems/explorationSystem');

const RARITY_EMOJI = { legendary: '🌌', rare: '💜', uncommon: '💙', common: '⬜' };
const MATERIAL_RARITIES = {
    'Healing Moss':'common','Purified Water':'common','Root Extract':'common','Ember Root':'common',
    'Void Water':'common','Iron Root':'common','Life Essence':'uncommon','Ancient Herb':'uncommon',
    'Shadow Moss':'uncommon','Shadow Fragment':'uncommon','Spell Component':'uncommon',
    'Void Crystal':'rare','Blood Root':'rare','Shadow Essence':'rare','Void Ink':'rare',
    'Ancient Tome Fragment':'legendary','Malachar Fragment':'legendary'
};

async function canBrew(userId, ingredients) {
    for (const [mat, qty] of Object.entries(ingredients)) {
        const [rows] = await db.execute(
            "SELECT quantity FROM exploration_materials WHERE player_id=? AND material=?",
            [userId, mat]
        );
        if (!rows.length || rows[0].quantity < qty) return false;
    }
    return true;
}

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

            if (p.role !== 'Explorer') return msg.reply(
                `══〘 ⚗️ BREW 〙══╮\n┃◆ ❌ Only Explorers can brew.\n╰═══════════════════════╯`
            );

            // Show all potions with canBrew status
            if (!args[0]) {
                const entries = Object.entries(POTIONS).filter(([, pot]) =>
                    !pot.prestige || p.prestige_level > 0
                );

                let text =
                    `╔══〘 ⚗️ VOID ALCHEMY 〙══╗\n` +
                    `┃◆\n`;

                for (let i = 0; i < entries.length; i++) {
                    const [name, pot] = entries[i];
                    const brewable = await canBrew(userId, pot.ingredients);
                    const ingList  = Object.entries(pot.ingredients).map(([m,q]) => `${m}×${q}`).join(', ');
                    const status   = brewable ? '✅' : '🔒';
                    const prestige = pot.prestige ? ' ✦' : '';

                    text +=
                        `┃◆ ${status} *${i+1}. ${name}*${prestige}\n` +
                        `┃◆    ${pot.desc}\n` +
                        `┃◆    📦 ${ingList}\n` +
                        `┃◆    💰 Min: ${pot.minPrice.toLocaleString()}G\n` +
                        `┃◆\n`;
                }

                text +=
                    `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃◆ ✅ = Can brew now\n` +
                    `┃◆ 🔒 = Missing materials\n` +
                    `┃◆ !brew <number> to craft\n` +
                    `╚═══════════════════════════╝`;

                return msg.reply(text);
            }

            // Brew by number
            const num = parseInt(args[0]);
            const available = Object.entries(POTIONS).filter(([, pot]) =>
                !pot.prestige || p.prestige_level > 0
            );
            const entry = available[num - 1];
            if (!entry) return msg.reply("❌ Invalid number. Type !brew to see list.");
            const [potName, potion] = entry;

            // Check materials
            const hasMats = await canBrew(userId, potion.ingredients);
            if (!hasMats) {
                const ingList = Object.entries(potion.ingredients).map(([m,q]) => `${m}×${q}`).join(', ');
                const mats    = await getMaterials(userId);
                const matMap  = Object.fromEntries(mats.map(m => [m.material, m.quantity]));

                let missingText = '';
                for (const [mat, qty] of Object.entries(potion.ingredients)) {
                    const have = matMap[mat] || 0;
                    const ok   = have >= qty;
                    missingText += `┃◆ ${ok ? '✅' : '❌'} ${mat}: ${have}/${qty}\n`;
                }

                return msg.reply(
                    `╔══〘 ⚗️ BREW FAILED 〙══╗\n` +
                    `┃◆ *${potName}*\n` +
                    `┃◆\n` +
                    `┃◆ MATERIALS:\n` +
                    missingText +
                    `┃◆\n` +
                    `┃◆ !explore to find more.\n` +
                    `╚═══════════════════════════╝`
                );
            }

            await consumeMaterials(userId, potion.ingredients);
            await db.execute(
                `INSERT INTO potion_inventory (player_id, potion_name, quantity)
                 VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE quantity = quantity + 1`,
                [userId, potName]
            );

            return msg.reply(
                `╔══〘 ⚗️ BREWED 〙══╗\n` +
                `┃◆\n` +
                `┃◆ *${potName}*\n` +
                `┃◆ ${potion.desc}\n` +
                `┃◆\n` +
                `┃◆ 〝${potion.lore}〞\n` +
                `┃◆\n` +
                `┃◆ !potionmarket list <name> <price>\n` +
                `┃◆ to sell it or !usepotion to use.\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error('brew error:', err);
            msg.reply('❌ Brewing failed.');
        }
    }
};