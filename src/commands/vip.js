// VIP management. Owner-only grant/revoke (owner verifies payment first);
// players can check their own status with plain !vip.
const db = require('../database/db');
const { isOwner, normalizeId } = require('../utils/identity');
const {
    isVip, grantVip, revokeVip, listVips,
    GRANT_GOLD, GRANT_XP, SUB_DAYS, PRICE_GHS, PRICE_NGN
} = require('../systems/subscriberSystem');
const { generateVipCard } = require('../systems/vipCard');

function resolveTarget(msg, args) {
    const mentioned = (msg.mentionedIds || [])[0];
    if (mentioned) return normalizeId(mentioned);
    const raw = (args.find(a => /\d{6,}/.test(a)) || '').replace(/\D/g, '');
    return raw || null;
}

function daysLeft(expiresAt) {
    if (!expiresAt) return '∞';
    return Math.max(0, Math.ceil((new Date(expiresAt) - Date.now()) / 86400000));
}

module.exports = {
    name: 'vip',
    aliases: ['subscriber'],
    async execute(msg, args, { userId }) {
        const sub = (args[0] || '').toLowerCase();

        // ── Owner actions ─────────────────────────────────────────────
        if (['grant', 'revoke', 'list'].includes(sub)) {
            if (!isOwner(userId)) return msg.reply('❌ Only the owner can manage VIP access.');

            if (sub === 'list') {
                const vips = await listVips();
                if (!vips.length) return msg.reply('👑 No active VIPs yet.');
                const lines = vips.map((v, i) =>
                    `┃◈ ${i + 1}. ${v.nickname || v.player_id} — ${daysLeft(v.expires_at)}d left`).join('\n');
                return msg.reply(`◆═══〘 👑 VIP LIST 〙═══◆\n${lines}\n◆═════════════════════◆`);
            }

            const target = resolveTarget(msg, args.slice(1));
            if (!target) return msg.reply(`❌ Tag the player or give their number.\nUse: !vip ${sub} @player`);

            const [reg] = await db.execute('SELECT nickname FROM players WHERE id=? LIMIT 1', [target]);
            if (!reg.length) return msg.reply('❌ That player is not registered.');
            const nick = reg[0].nickname;

            if (sub === 'grant') {
                const r = await grantVip(target, userId);
                if (!r.ok) return msg.reply(`👑 *${nick}* is already an active VIP.`);

                const confirmation =
                    `◆═══〘 👑 VIP ACTIVATED 〙═══◆\n` +
                    `┃◈ Welcome to the inner circle,\n` +
                    `┃◈ *${nick}*.\n` +
                    `┃◈━━━━━━━━━━━━━━━━━━━\n` +
                    `┃◈ 💰 +${GRANT_GOLD.toLocaleString()} Lumens\n` +
                    `┃◈ ⭐ +${GRANT_XP.toLocaleString()} XP\n` +
                    `┃◈ 🧪 +6× Fatigue Potion\n` +
                    `┃◈ 🧪 +2× Fracture Potion\n` +
                    (r.bonusPotion ? `┃◈ 🎁 +1× ${r.bonusPotion}\n` : '') +
                    `┃◈━━━━━━━━━━━━━━━━━━━\n` +
                    `┃◈ ⏳ Valid ${r.days} days\n` +
                    `┃◈ 🖼️ Photo + caption *!vipimage*\n` +
                    `┃◈    sets your card image.\n` +
                    `◆═════════════════════════◆`;

                // "CONGRATULATIONS — VIP PASS unlocked" poster with the
                // confirmation underneath; falls back to the jimp card, then text.
                try {
                    const fs = require('fs');
                    const path = require('path');
                    const congrats = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'vip-congrats.jpg'));
                    return await msg.reply({ image: congrats, caption: confirmation, mimetype: 'image/jpeg' });
                } catch (e) { console.error('[VIP] congrats image missing:', e.message); }
                const cardImg = await generateVipCard({ nickname: nick, bonusPotion: r.bonusPotion, days: r.days });
                if (cardImg) {
                    return msg.reply({ image: cardImg, caption: confirmation, mimetype: 'image/jpeg' });
                }
                return msg.reply(confirmation);
            }

            const done = await revokeVip(target);
            return msg.reply(done ? `👑 VIP revoked for *${nick}*.` : `❌ *${nick}* is not an active VIP.`);
        }

        // ── Player: own status ────────────────────────────────────────
        const { getVip } = require('../systems/subscriberSystem');
        const mine = await getVip(userId);
        if (mine) {
            return msg.reply(
                `◆═══〘 👑 VIP STATUS 〙═══◆\n` +
                `┃◈ Status: *ACTIVE* ✅\n` +
                `┃◈ ⏳ ${daysLeft(mine.expires_at)} days left\n` +
                `┃◈ 🖼️ Photo + caption *!vipimage*\n` +
                `┃◈    sets your card image.\n` +
                `◆════════════════════════◆`
            );
        }
        const pitch =
            `◆═══〘 👑 VIP 〙═══◆\n` +
            `┃◈ 💵 GH₵${PRICE_GHS} (~₦${PRICE_NGN}) • ${SUB_DAYS} days\n` +
            `┃◈ Everything on the pass —\n` +
            `┃◈ plus the golden interface. 👑\n` +
            `◆══════════════════◆`;
        // Send the official VIP PASS poster (price + payment number on it).
        try {
            const fs = require('fs');
            const path = require('path');
            const pass = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'vip-pass.jpg'));
            return await msg.reply({ image: pass, caption: pitch, mimetype: 'image/jpeg' });
        } catch (e) {}
        return msg.reply(pitch);
    }
};
