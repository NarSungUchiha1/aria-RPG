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
                    `┃◈ 💰 +${GRANT_GOLD.toLocaleString()} Gold\n` +
                    `┃◈ ⭐ +${GRANT_XP.toLocaleString()} XP\n` +
                    `┃◈ 🧪 +6× Fatigue Potion\n` +
                    `┃◈ 🧪 +2× Fracture Potion\n` +
                    (r.bonusPotion ? `┃◈ 🎁 +1× ${r.bonusPotion}\n` : '') +
                    `┃◈━━━━━━━━━━━━━━━━━━━\n` +
                    `┃◈ ⏳ Valid ${r.days} days\n` +
                    `┃◈ 🖼️ Photo + caption *!vipimage*\n` +
                    `┃◈    sets your card image.\n` +
                    `◆═════════════════════════◆`;

                // Membership-card image with the confirmation underneath it.
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
        return msg.reply(
            `◆═══〘 👑 VIP 〙═══◆\n` +
            `┃◈ Not a VIP yet.\n` +
            `┃◈━━━━━━━━━━━━━━━\n` +
            `┃◈ 💰 1,000,000 Gold\n` +
            `┃◈ ⭐ 1,000,000 XP\n` +
            `┃◈ 🧪 6× Fatigue Potion\n` +
            `┃◈ 🧪 2× Fracture Potion\n` +
            `┃◈ 🎁 1× random explorer potion\n` +
            `┃◈ 🖼️ Custom card image + VIP card\n` +
            `┃◈━━━━━━━━━━━━━━━\n` +
            `┃◈ 💵 Price: GH₵${PRICE_GHS} (~₦${PRICE_NGN})\n` +
            `┃◈ ⏳ Lasts ${SUB_DAYS} days\n` +
            `┃◈ Contact the owner to subscribe.\n` +
            `◆══════════════════◆`
        );
    }
};
