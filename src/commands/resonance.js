const db = require('../database/db');
const { canResonate, isInResFlow, startResFlow, endResFlow, RESONANCE_REQUIRED_CLEARS } = require('../systems/ascendantSystem');

module.exports = {
    name: 'resonance',
    aliases: [],
    async execute(msg, args, { userId }) {
        try {
            if (isInResFlow(userId)) {
                endResFlow(userId);
                return msg.reply(
                    `╭══〘 ✦ RESONANCE 〙══╮\n` +
                    `┃✧ Previous session cleared.\n` +
                    `┃✧ Use *!resonance* again to restart.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const check = await canResonate(userId);
            if (!check.ok) {
                if (check.reason === 'not_registered')
                    return msg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ❌ Not registered. Use !awaken.\n╰═══════════════════════╯`);
                if (check.reason === 'already_resonated')
                    return msg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ✅ You have already resonated.\n┃✧ Use !me to view your card.\n╰═══════════════════════╯`);
                if (check.reason === 'not_prestige')
                    return msg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ❌ Only Prestige Hunters can resonate.\n╰═══════════════════════╯`);
                if (check.reason === 'not_enough_clears')
                    return msg.reply(
                        `╭══〘 ✦ RESONANCE 〙══╮\n` +
                        `┃✧ ❌ Not enough dungeons cleared.\n` +
                        `┃✧ 🏰 ${check.current} / ${check.required}\n` +
                        `┃✧\n` +
                        `┃✧ Keep clearing dungeons to\n` +
                        `┃✧ unlock Resonance.\n` +
                        `╰═══════════════════════╯`
                    );
            }

            startResFlow(userId);
            return msg.reply(
                `╭══〘 ⚡ RESONANCE RITUAL 〙══╮\n` +
                `┃✧\n` +
                `┃✧ 〝You have walked through fire,\n` +
                `┃✧  through void, through death itself.\n` +
                `┃✧  What remains is not a hunter.\n` +
                `┃✧  What remains... is something more.〞\n` +
                `┃✧\n` +
                `┃✧ ━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `┃✧ ⚡ STAGE 1 — NAME\n` +
                `┃✧ ━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `┃✧\n` +
                `┃✧ Choose the name you will be\n` +
                `┃✧ known by from now on.\n` +
                `┃✧ It *cannot be changed* after this.\n` +
                `┃✧\n` +
                `┃✧ Type your name now:\n` +
                `┃✧\n` +
                `┃✧ (Type *!cancel* to abort)\n` +
                `╰═══════════════════════════════╯`
            );
        } catch (err) {
            console.error('resonate error:', err);
            msg.reply('❌ Resonance failed.');
        }
    }
};