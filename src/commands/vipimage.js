// VIP card image upload — send a PHOTO with the caption "!vipimage".
// The image caption arrives as the command text, and the raw message carries
// the image itself. Reuses the resonance blur-widening so the card caption
// gets full width.
const { isVip, setVipImage } = require('../systems/subscriberSystem');
const { widenResonanceImage } = require('../systems/ascendantSystem');

module.exports = {
    name: 'vipimage',
    aliases: ['setvipimage'],
    async execute(msg, args, { userId }) {
        if (!await isVip(userId)) {
            return msg.reply('❌ VIP only. Use !vip to see the perks.');
        }

        const rawMsg = msg.rawMsg;
        const imageMsg = rawMsg?.message?.imageMessage;
        if (!imageMsg) {
            return msg.reply(
                `◆═══〘 👑 VIP IMAGE 〙═══◆\n` +
                `┃◈ Send a *photo* (not a file)\n` +
                `┃◈ with the caption *!vipimage*\n` +
                `◆═══════════════════════◆`
            );
        }

        try {
            const { downloadMediaMessage } = require('@whiskeysockets/baileys');
            const buffer = await downloadMediaMessage(rawMsg, 'buffer', {});
            const raw64 = buffer.toString('base64');
            if (raw64.length > 900000) {
                return msg.reply('⚠️ Image too large — keep it under 600KB.');
            }
            // Ack FIRST — image processing is CPU work; if anything hiccups
            // after this, the user still got feedback.
            await msg.reply('👑 Got it — forging your card image...').catch(() => {});
            const base64 = await widenResonanceImage(raw64);
            await setVipImage(userId, base64);
            return msg.reply(
                `◆═══〘 👑 VIP IMAGE 〙═══◆\n` +
                `┃◈ ✅ Card image saved.\n` +
                `┃◈ Check it with *!me*\n` +
                `◆═══════════════════════◆`
            );
        } catch (e) {
            console.error('[VIP] image error:', e.message);
            return msg.reply('❌ Failed to save the image — try sending it again.');
        }
    }
};
