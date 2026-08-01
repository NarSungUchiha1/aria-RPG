// !vesperion — owner spawns the Chapter 1 finale from AriA's DMs.
// Everyone in the raid group is conscripted automatically; no !enter needed.
// Anyone can use plain !vesperion to see the fight's status.
const { isOwner } = require('../utils/identity');
const { getRaidGroup } = require('../utils/raidContext');
const {
    spawnVesperion, getActiveRaid, hpBar, VESPERION_HP, STRIKES_PER_HIT
} = require('../systems/vesperionRaid');

module.exports = {
    name: 'vesperion',
    aliases: ['firstborn'],
    async execute(msg, args, { userId, client }) {
        try {
            const sub = (args[0] || '').toLowerCase();

            // ── Status (anyone) ───────────────────────────────────────────
            if (sub !== 'spawn' && sub !== 'summon') {
                const raid = await getActiveRaid();
                if (!raid) return msg.reply(
                    `══〘 🌑 VESPERION 〙══╮\n┃◆ The nest is quiet. For now.\n╰═══════════════════════╯`
                );
                const pct = Math.round((Number(raid.current_hp) / Number(raid.max_hp)) * 100);
                return msg.reply(
                    `╔══〘 🌑 VESPERION 〙══╗\n` +
                    `┃★ ${hpBar(raid.current_hp, raid.max_hp)}\n` +
                    `┃★ ${Number(raid.current_hp).toLocaleString()} / ${Number(raid.max_hp).toLocaleString()} (${pct}%)\n` +
                    `┃★ ⚔️ Blows landed: ${raid.total_attacks}\n` +
                    `┃★ Use *!strike* to attack.\n` +
                    `╚═══════════════════════╝`
                );
            }

            // ── Spawn (owner only) ────────────────────────────────────────
            if (!isOwner(userId)) return msg.reply('❌ Owner only.');

            const groupJid = process.env.RAID_GROUP_JID || getRaidGroup();
            const r = await spawnVesperion(client, groupJid);
            if (!r.ok) return msg.reply('❌ Vesperion is already awake.');

            // The hunt is called in the raid group, everyone tagged.
            const mentions = r.enrolled.map(p => `${p.player_id || p.id}@s.whatsapp.net`);
            await client.sendMessage(groupJid, {
                text:
                    `╔══〘 🌑 THE FIRSTBORN RISES 〙══╗\n` +
                    `┃★\n` +
                    `┃★ The nest is empty. It came out.\n` +
                    `┃★\n` +
                    `┃★ 👁️ *VESPERION, THE FIRSTBORN DUSK*\n` +
                    `┃★ ${hpBar(VESPERION_HP, VESPERION_HP)}\n` +
                    `┃★ ${VESPERION_HP.toLocaleString()} HP\n` +
                    `┃★\n` +
                    `┃★ ⚔️ *${r.enrolled.length} hunters* have been\n` +
                    `┃★ called to arms. No one signs up.\n` +
                    `┃★ You are already in this.\n` +
                    `┃★\n` +
                    `┃★ Every *${STRIKES_PER_HIT}* blows it answers —\n` +
                    `┃★ one of you, chosen at random.\n` +
                    `┃★ Twice and you are barely standing.\n` +
                    `┃★ A third time and you are gone.\n` +
                    `┃★\n` +
                    `┃★ 🗡️ *!strike* — swing.\n` +
                    `┃★ 📊 *!vesperion* — check its blood.\n` +
                    `╚═══════════════════════════╝`,
                mentions
            }).catch(() => {});

            return msg.reply(`🌑 Vesperion is awake. ${r.enrolled.length} hunters conscripted.`);
        } catch (err) {
            console.error('vesperion error:', err);
            return msg.reply('❌ Vesperion failed: ' + err.message);
        }
    }
};
