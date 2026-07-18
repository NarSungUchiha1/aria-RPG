// VIP / VVIP management. Owner-only grant/revoke (owner verifies payment
// first); players check their own status with plain !vip.
//   !vip grant @player   → 👑 VIP  (GH₵10)
//   !vip vvip @player    → 💎 VVIP (GH₵25, daily supply drip)
//   !vip revoke @player  · !vip list
const db = require('../database/db');
const fs = require('fs');
const path = require('path');
const { isOwner, normalizeId } = require('../utils/identity');
const {
    TIERS, SUB_DAYS, isVip, getVip, grantVip, revokeVip, listVips
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

function loadAsset(name) {
    try { return fs.readFileSync(path.join(__dirname, '..', '..', 'assets', name)); }
    catch (e) { return null; }
}

module.exports = {
    name: 'vip',
    aliases: ['subscriber', 'vvip'],
    async execute(msg, args, { userId }) {
        const sub = (args[0] || '').toLowerCase();

        // ── Owner actions ─────────────────────────────────────────────
        if (['grant', 'vvip', 'revoke', 'list'].includes(sub)) {
            if (!isOwner(userId)) return msg.reply('❌ Only the owner can manage VIP access.');

            if (sub === 'list') {
                const vips = await listVips();
                if (!vips.length) return msg.reply('👑 No active subscribers yet.');
                const lines = vips.map((v, i) =>
                    `┃◈ ${i + 1}. ${v.tier === 'VVIP' ? '💎' : '👑'} ${v.nickname || v.player_id} — ${daysLeft(v.expires_at)}d left`).join('\n');
                return msg.reply(`◆═══〘 👑 SUBSCRIBERS 〙═══◆\n${lines}\n◆═════════════════════◆`);
            }

            const target = resolveTarget(msg, args.slice(1));
            if (!target) return msg.reply(`❌ Tag the player or give their number.\nUse: !vip ${sub} @player`);

            const [reg] = await db.execute('SELECT nickname FROM players WHERE id=? LIMIT 1', [target]);
            if (!reg.length) return msg.reply('❌ That player is not registered.');
            const nick = reg[0].nickname;

            if (sub === 'grant' || sub === 'vvip') {
                const tier = sub === 'vvip' ? 'VVIP' : 'VIP';
                const r = await grantVip(target, userId, tier);
                if (!r.ok) return msg.reply(`👑 *${nick}* already has an active ${r.tier || 'VIP'} subscription.`);

                const gem = tier === 'VVIP' ? '💎' : '👑';
                const confirmation =
                    `◆═══〘 ${gem} ${tier} ACTIVATED 〙═══◆\n` +
                    `┃◈ Welcome to the inner circle,\n` +
                    `┃◈ *${nick}*.\n` +
                    `┃◈━━━━━━━━━━━━━\n` +
                    `┃◈ ✨ +${r.lumens.toLocaleString()} Lumens\n` +
                    `┃◈ ⭐ +${r.xp.toLocaleString()} XP\n` +
                    (tier === 'VVIP'
                        ? `┃◈ 📦 DAILY SUPPLY — every day:\n` +
                          `┃◈ 🧪 2× Fatigue + 1× Fracture Potion\n` +
                          `┃◈ 🎁 2 explorer potions every 2nd day\n` +
                          `┃◈ (today's drop just landed)\n`
                        : `┃◈ 🧪 +6× Fatigue Potion\n` +
                          `┃◈ 🧪 +2× Fracture Potion\n` +
                          (r.bonusPotion ? `┃◈ 🎁 +1× ${r.bonusPotion}\n` : '')) +
                    `┃◈━━━━━━━━━━━━━\n` +
                    `┃◈ ⏳ Valid ${r.days} days\n` +
                    `┃◈ 🖼️ Photo + caption *!vipimage*\n` +
                    `┃◈    sets your card image.\n` +
                    `◆═════════════════════════◆`;

                // Tier poster (vvip-congrats.jpg for VVIP when provided), then
                // the VIP congrats, then generated card, then plain text.
                const poster = (tier === 'VVIP' && loadAsset('vvip-congrats.jpg')) || loadAsset('vip-congrats.jpg');
                if (poster) return msg.reply({ image: poster, caption: confirmation, mimetype: 'image/jpeg' });
                const cardImg = await generateVipCard({ nickname: nick, bonusPotion: r.bonusPotion, days: r.days });
                if (cardImg) return msg.reply({ image: cardImg, caption: confirmation, mimetype: 'image/jpeg' });
                return msg.reply(confirmation);
            }

            const done = await revokeVip(target);
            return msg.reply(done ? `👑 Subscription revoked for *${nick}*.` : `❌ *${nick}* has no active subscription.`);
        }

        // ── Player: own status ────────────────────────────────────────
        const mine = await getVip(userId);
        if (mine) {
            const gem = mine.tier === 'VVIP' ? '💎' : '👑';
            return msg.reply(
                `◆═══〘 ${gem} ${mine.tier || 'VIP'} STATUS 〙═══◆\n` +
                `┃◈ Status: *ACTIVE* ✅\n` +
                `┃◈ ⏳ ${daysLeft(mine.expires_at)} days left\n` +
                (mine.tier === 'VVIP' ? `┃◈ 📦 Daily supply drip: ON\n` : '') +
                `┃◈ 🖼️ Photo + caption *!vipimage*\n` +
                `┃◈    sets your card image.\n` +
                `◆════════════════════════◆`
            );
        }

        const pitch =
            `◆═══〘 👑 VIP • 💎 VVIP 〙═══◆\n` +
            `┃◈ 👑 *VIP — GH₵${TIERS.VIP.priceGhs}* (~₦${TIERS.VIP.priceNgn})\n` +
            `┃◈ ✨ 500k Lumens + ⭐ 500k XP\n` +
            `┃◈ 🧪 6× Fatigue, 2× Fracture Potion\n` +
            `┃◈ 🎁 1 explorer potion + card image\n` +
            `┃◈━━━━━━━━━━━━━\n` +
            `┃◈ 💎 *VVIP — GH₵${TIERS.VVIP.priceGhs}* (~₦${TIERS.VVIP.priceNgn})\n` +
            `┃◈ ✨ 1M Lumens + ⭐ 1M XP\n` +
            `┃◈ 📦 DAILY: 2× Fatigue + 1× Fracture\n` +
            `┃◈ 🎁 2 explorer potions every 2nd day\n` +
            `┃◈ 🖼️ Custom card image\n` +
            `┃◈━━━━━━━━━━━━━\n` +
            `┃◈ ✨ Golden interface on everything\n` +
            `┃◈ ⏳ ${SUB_DAYS} days · Contact the owner.\n` +
            `◆══════════════════════════◆`;
        const pass = loadAsset('vvip-pass.jpg') || loadAsset('vip-pass.jpg');
        if (pass) return msg.reply({ image: pass, caption: pitch, mimetype: 'image/jpeg' });
        return msg.reply(pitch);
    }
};
