const db = require('../database/db');
const { getResonanceProgress, isInResFlow, startResFlow, resFlowStage } = require('../systems/ascendantSystem');

const STAGE_HINT = {
    name:  '⚡ STAGE 1 — send *Name: <your new name>*',
    image: '⚡ STAGE 2 — send your photo with caption *Pic*',
    moves: '⚡ STAGE 3 — send your 5 signature moves',
};

module.exports = {
    name: 'resonance',
    aliases: [],
    async execute(msg, args, { userId }) {
        try {
            // Already mid-flow: DON'T wipe it — remind them where they are.
            if (isInResFlow(userId)) {
                const stage = resFlowStage(userId);
                return msg.reply(
                    `╭══〘 ✦ RESONANCE 〙══╮\n` +
                    `┃✧ You are already resonating.\n` +
                    `┃✧ Continue where you left off:\n` +
                    `┃✧\n` +
                    `┃✧ ${STAGE_HINT[stage] || 'Continue the ritual.'}\n` +
                    `┃✧\n` +
                    `┃✧ (Type *!cancel* to abort)\n` +
                    `╰═══════════════════════╯`
                );
            }

            const prog = await getResonanceProgress(userId);
            if (!prog.registered)
                return msg.reply(`╭══〘 ✦ RESONANCE 〙══╮\n┃✧ ❌ Not registered. Use !awaken.\n╰═══════════════════════╯`);

            if (prog.resonated)
                return msg.reply(
                    `╔══〘 👁️ ASCENDANT 〙══╗\n` +
                    `┃★\n` +
                    `┃★ *${prog.nickname}*\n` +
                    `┃★ You have already broken through.\n` +
                    `┃★\n` +
                    `┃★ There is nothing left to measure.\n` +
                    `┃★ Use *!me* to view your card.\n` +
                    `╚═══════════════════════════╝`
                );

            const tick = (b) => (b ? '✅' : '❌');
            const checklist =
                `┃★ ${tick(prog.isPrestige)} Be a Prestige hunter\n` +
                `┃★ ${tick(prog.isPS)} Rank PS required (you: ${prog.rank})\n` +
                `┃★ ${tick(prog.hasPsClear)} Clear at least 1 PS dungeon\n` +
                `┃★ ${tick(prog.hasClears)} 200 dungeon clears (${prog.totalClears}/${prog.requiredClears})`;

            // ── NOT ELIGIBLE: show lore + requirements + progress ──────────
            if (!prog.eligible) {
                return msg.reply(
                    `╔══〘 👁️ VOID RESONANCE 〙══╗\n` +
                    `┃★\n` +
                    `┃★ *${prog.nickname}* — ${prog.rank}\n` +
                    `┃★\n` +
                    `┃★ 〝You have walked through fire,\n` +
                    `┃★  through void, through death itself.\n` +
                    `┃★  But you are not yet ready to\n` +
                    `┃★  shed what you were.〞\n` +
                    `┃★\n` +
                    `┃★ These conditions must be met:\n` +
                    `┃★\n` +
                    `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃★ REQUIREMENTS\n` +
                    `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    checklist + `\n` +
                    `┃★\n` +
                    `┃★ Return when all are met.\n` +
                    `╚═══════════════════════════╝`
                );
            }

            // ── ELIGIBLE: show all-clear, then begin the ritual ────────────
            startResFlow(userId);
            return msg.reply(
                `╔══〘 👁️ VOID RESONANCE 〙══╗\n` +
                `┃★\n` +
                `┃★ *${prog.nickname}* — ${prog.rank}\n` +
                `┃★\n` +
                `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃★ REQUIREMENTS\n` +
                `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                checklist + `\n` +
                `┃★\n` +
                `┃★ ✨ All conditions met.\n` +
                `╚═══════════════════════════╝\n\n` +
                `╭══〘 ⚡ RESONANCE RITUAL 〙══╮\n` +
                `┃✧\n` +
                `┃✧ 〝What remains is not a hunter.\n` +
                `┃✧  What remains... is something more.〞\n` +
                `┃✧\n` +
                `┃✧ ━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `┃✧ ⚡ STAGE 1 — NAME\n` +
                `┃✧ ━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
                `┃✧\n` +
                `┃✧ Declare the name you will carry.\n` +
                `┃✧ Send it in this exact format:\n` +
                `┃✧\n` +
                `┃✧    *Name: <your new name>*\n` +
                `┃✧\n` +
                `┃✧ It *cannot be changed* after this.\n` +
                `┃✧ (Type *!cancel* to abort)\n` +
                `╰═══════════════════════════════╯`
            );
        } catch (err) {
            console.error('resonance error:', err);
            msg.reply('❌ Resonance failed.');
        }
    }
};
