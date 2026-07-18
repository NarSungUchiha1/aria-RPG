const { getMaterials, EXPLORATION_GC } = require('../systems/explorationSystem');

const RARITY_EMOJI = {
    legendary: '🌌',
    rare: '💜',
    uncommon: '💙',
    common: '⬜'
};

const MATERIAL_RARITIES = {
    // Common
    'Healing Moss': 'common', 'Purified Water': 'common', 'Root Extract': 'common',
    'Ember Root': 'common', 'Void Water': 'common', 'Iron Root': 'common',
    // Uncommon
    'Life Essence': 'uncommon', 'Ancient Herb': 'uncommon', 'Shadow Moss': 'uncommon',
    'Shadow Fragment': 'uncommon', 'Spell Component': 'uncommon',
    // Rare
    'Twilight Crystal': 'rare', 'Blood Root': 'rare', 'Umbral Essence': 'rare',
    'Void Ink': 'rare',
    // Legendary
    'Ancient Tome Fragment': 'legendary', 'the Hollow King Fragment': 'legendary'
};

module.exports = {
    name: 'expmaterials',
    async execute(msg, args, { userId }) {
        try {
            const mats = await getMaterials(userId);

            if (!mats.length) return msg.reply(
                `╔══〘 🌿 EXPLORER MATERIALS 〙══╗\n` +
                `┃◆\n` +
                `┃◆ No exploration materials yet.\n` +
                `┃◆ Use !explore to enter a rift.
┃◆ Explorer role required.\n` +
                `┃◆\n` +
                `╚═══════════════════════════╝`
            );

            const byRarity = { legendary: [], rare: [], uncommon: [], common: [] };
            for (const m of mats) {
                const rarity = MATERIAL_RARITIES[m.material] || 'common';
                byRarity[rarity].push(m);
            }

            let text = `╔══〘 🌿 EXPLORER MATERIALS 〙══╗\n┃◆\n`;
            let first = true;
            for (const rarity of ['legendary','rare','uncommon','common']) {
                const items = byRarity[rarity];
                if (!items.length) continue;
                if (!first) text += `┃◆\n`;
                first = false;
                text += `┃◆ ${RARITY_EMOJI[rarity]} ${rarity.toUpperCase()}\n`;
                items.forEach(m => { text += `┃◆   ${m.material} ×${m.quantity}\n`; });
            }

            const total = mats.reduce((s, m) => s + m.quantity, 0);
            text +=
                `┃◆\n` +
                `┃◆ Total: ${total} item${total !== 1 ? 's' : ''}\n` +
                `┃◆ !brew — craft potions\n` +
                `╚═══════════════════════════╝`;

            return msg.reply(text);
        } catch (err) {
            console.error('expmaterials error:', err);
            msg.reply('❌ Failed to load materials.');
        }
    }
};