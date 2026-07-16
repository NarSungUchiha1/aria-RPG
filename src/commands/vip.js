// VIP management. Owner-only grant/revoke (owner verifies payment first);
// players can check their own status with plain !vip.
const db = require('../database/db');
const { isOwner, normalizeId } = require('../utils/identity');
const { isVip, grantVip, revokeVip, listVips, GRANT_GOLD, GRANT_XP } = require('../systems/subscriberSystem');

function resolveTarget(msg, args) {
    // @mention first, else a raw number argument
    const mentioned = (msg.mentionedIds || [])[0];
    if (mentioned) return normalizeId(mentioned);
    const raw = (args.find(a => /\d{6,}/.test(a)) || '').replace(/\D/g, '');
    return raw || null;
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
                const lines = vips.map((v, i) => `┃◈ ${i + 1}. ${v.nickname || v.player_id}`).join('\n');
                return msg.reply(`◆═══〘 👑 VIP LIST 〙═══◆\n${lines}\n◆═════════════════════◆`);
            }

            const target = resolveTarget(msg, args.slice(1));
            if (!target) return msg.reply(`❌ Tag the player or give their number.\nUse: !vip ${sub} @player`);

            const [reg] = await db.execute('SELECT nickname FROM players WHERE id=? LIMIT 1', [target]);
            if (!reg.length) return msg.reply('❌ That player is not registered.');
            const nick = reg[0].nickname;

            if (sub === 'grant') {
                const r = await grantVip(target, userId);
                if (!r.ok) return msg.reply(`👑 *${nick}* is already a VIP.`);
                return msg.reply(
                    `◆═══〘 👑 VIP GRANTED 〙═══◆\n` +
                    `┃◈\n` +
                    `┃◈ Welcome to the inner circle,\n` +
                    `┃◈ *${nick}*.\n` +
                    `┃◈\n` +
                    (r.firstGrant
                        ? `┃◈ 💰 +${GRANT_GOLD.toLocaleString()} Gold\n` +
                          `┃◈ ⭐ +${GRANT_XP.toLocaleString()} XP\n`
                        : `┃◈ (welcome bonus already claimed)\n`) +
                    `┃◈ 🖼️ Send a photo with the caption\n` +
                    `┃◈    *!vipimage* to set your card image.\n` +
                    `┃◈\n` +
                    `◆═════════════════════════◆`
                );
            }

            // revoke
            const done = await revokeVip(target);
            return msg.reply(done ? `👑 VIP revoked for *${nick}*.` : `❌ *${nick}* is not an active VIP.`);
        }

        // ── Player: own status ────────────────────────────────────────
        const vip = await isVip(userId);
        if (vip) {
            return msg.reply(
                `◆═══〘 👑 VIP STATUS 〙═══◆\n` +
                `┃◈ Status: *ACTIVE* ✅\n` +
                `┃◈ 🖼️ Photo + caption *!vipimage*\n` +
                `┃◈    sets your card image.\n` +
                `◆════════════════════════◆`
            );
        }
        return msg.reply(
            `◆═══〘 👑 VIP 〙═══◆\n` +
            `┃◈ Not a VIP yet.\n` +
            `┃◈ Perks: 💰 1M gold, ⭐ 1M XP,\n` +
            `┃◈ custom card image + VIP card.\n` +
            `┃◈ Contact the owner to subscribe.\n` +
            `◆══════════════════◆`
        );
    }
};
