// !cindermaw — Chapter 2 finale.
//   owner (anywhere): !cindermaw open   → starts the server-wide hunt
//                     !cindermaw close  → ends it early
//   player (in DMs):  !cindermaw        → summons YOUR beast, then !skill it
//   player (in GC):   !cindermaw        → hunt status
const { isOwner } = require('../utils/identity');
const { getRaidGroup } = require('../utils/raidContext');
const {
    openHunt, getHunt, summon, getInstance, closeHunt, huntStatus,
    emberBar, KILLS_TO_ADVANCE
} = require('../systems/cindermawHunt');

module.exports = {
    name: 'cindermaw',
    aliases: ['swallowedstar'],
    async execute(msg, args, { userId, client, isDM }) {
        try {
            const sub = (args[0] || '').toLowerCase();
            const groupJid = process.env.RAID_GROUP_JID || getRaidGroup();

            // ── Owner: open the hunt ──────────────────────────────────────
            if (sub === 'open' || sub === 'start') {
                if (!isOwner(userId)) return msg.reply('❌ Owner only.');
                const r = await openHunt(groupJid);
                if (!r.ok) return msg.reply('❌ The hunt is already open.');

                let mentions = [];
                try {
                    const { tagAll } = require('../utils/tagAll');
                    mentions = (await tagAll(client, groupJid)).mentions || [];
                } catch (e) {}

                await client.sendMessage(groupJid, {
                    mentions,
                    text:
                        `╔══〘 🔥 SHARDFALL 〙══╗\n` +
                        `┃★\n` +
                        `┃★ Vesperion had eaten a piece of\n` +
                        `┃★ the sun. It was not the only one.\n` +
                        `┃★\n` +
                        `┃★ 🔥 *CINDERMAW, THE SWALLOWED STAR*\n` +
                        `┃★ There is not one of them.\n` +
                        `┃★ There is one for each of you.\n` +
                        `┃★\n` +
                        `┃★ ⚠️ This one you face ALONE.\n` +
                        `┃★ No party. No rescue.\n` +
                        `┃★\n` +
                        `┃★ 📩 DM AriA *!cindermaw* to find yours.\n` +
                        `┃★ ⚔️ Then *!skill <move>* — it bites back\n` +
                        `┃★ every single time.\n` +
                        `┃★\n` +
                        `┃★ 🎯 ${KILLS_TO_ADVANCE} must fall before the\n` +
                        `┃★ sky changes again.\n` +
                        `╚═══════════════════════════╝`
                }).catch(() => {});

                return msg.reply(`🔥 Shardfall is open. ${KILLS_TO_ADVANCE} kills needed to close Chapter 2.`);
            }

            // ── Owner: close it early ─────────────────────────────────────
            if (sub === 'close' || sub === 'end') {
                if (!isOwner(userId)) return msg.reply('❌ Owner only.');
                const hunt = await getHunt();
                if (!hunt) return msg.reply('❌ No hunt is open.');
                await closeHunt(hunt.id);
                return msg.reply('🔥 Shardfall closed.');
            }

            const st = await huntStatus();
            if (!st) return msg.reply(
                `══〘 🔥 CINDERMAW 〙══╮\n┃◆ Nothing is burning. Not yet.\n╰═══════════════════════╯`
            );

            // ── In DMs: this is your fight ────────────────────────────────
            if (isDM) {
                const mine = await getInstance(st.hunt.id, userId);

                if (mine?.defeated) return msg.reply(
                    `╔══〘 🔥 CINDERMAW 〙══╗\n` +
                    `┃★ Yours is already dead.\n` +
                    `┃★ You killed it in ${mine.exchanges} exchanges.\n` +
                    `┃★ 🎯 ${st.kills}/${st.needed} slain worldwide.\n` +
                    `╚═══════════════════════╝`
                );

                if (mine) {
                    return msg.reply(
                        `╔══〘 🔥 CINDERMAW 〙══╗\n` +
                        `┃★ ${emberBar(mine.current_hp, mine.max_hp)}\n` +
                        `┃★ ${Number(mine.current_hp).toLocaleString()} / ${Number(mine.max_hp).toLocaleString()}\n` +
                        `┃★ Exchanges: ${mine.exchanges}\n` +
                        `┃★ ⚔️ *!skill <move>* to keep swinging.\n` +
                        `╚═══════════════════════╝`
                    );
                }

                const s = await summon(st.hunt.id, userId);
                if (s.error === 'not_registered') return msg.reply('❌ You are not registered. Use !register <name>.');
                if (s.error === 'already_slain')  return msg.reply('🔥 Yours is already dead.');
                if (!s.ok) return msg.reply('❌ Could not find your beast.');

                const i = s.instance;
                return msg.reply(
                    `╔══〘 🔥 IT FINDS YOU 〙══╗\n` +
                    `┃★\n` +
                    `┃★ Something comes out of the dark\n` +
                    `┃★ with a star burning in its gut.\n` +
                    `┃★\n` +
                    `┃★ 🔥 *CINDERMAW*\n` +
                    `┃★ ${emberBar(i.max_hp, i.max_hp)}\n` +
                    `┃★ ${Number(i.max_hp).toLocaleString()} HP\n` +
                    `┃★\n` +
                    `┃★ It is yours alone. Nobody is coming.\n` +
                    `┃★ ⚔️ *!skill <move>* — and mind your HP,\n` +
                    `┃★ it answers every blow.\n` +
                    `╚═══════════════════════════╝`
                );
            }

            // ── In the group: world status ────────────────────────────────
            return msg.reply(
                `╔══〘 🔥 SHARDFALL 〙══╗\n` +
                `┃★ 🎯 Slain: *${st.kills}* / ${st.needed}\n` +
                `┃★ 🔥 Beasts summoned: ${st.summoned}\n` +
                (st.lost ? `┃★ ☠️ Hunters down: ${st.lost}\n` : '') +
                `┃★ 📩 DM AriA *!cindermaw* to face yours.\n` +
                `╚═══════════════════════╝`
            );
        } catch (err) {
            console.error('cindermaw error:', err);
            return msg.reply('❌ Cindermaw failed: ' + err.message);
        }
    }
};
