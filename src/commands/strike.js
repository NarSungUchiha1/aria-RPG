// !strike — swing at Vesperion. Every 5th blow across the whole group, it
// answers on someone chosen at random.
const db = require('../database/db');
const { attack, getActiveRaid, distributeRewards, hpBar } = require('../systems/vesperionRaid');
const { getRaidGroup } = require('../utils/raidContext');

module.exports = {
    name: 'strike',
    aliases: ['swing'],
    async execute(msg, args, { userId, client }) {
        try {
            const r = await attack(userId, client);

            if (r.error === 'no_raid')        return msg.reply('❌ Nothing to strike. Vesperion sleeps.');
            if (r.error === 'not_registered') return msg.reply('❌ You are not registered. Use !register <name>.');
            if (r.error === 'dead')           return msg.reply('☠️ You are down. You cannot swing again.');
            if (r.error === 'cooldown')       return msg.reply(`⏳ Catch your breath — ${r.wait}s.`);
            if (r.error)                      return msg.reply('❌ Could not strike.');

            const pct = Math.round((r.bossHp / r.bossMax) * 100);

            // ── It falls ──────────────────────────────────────────────────
            if (r.defeated) {
                const groupJid = process.env.RAID_GROUP_JID || getRaidGroup();
                const rewards = await distributeRewards(r.raidId, client, groupJid);

                const top = rewards.lines.slice(0, 10).join('\n');
                await client.sendMessage(groupJid, {
                    text:
                        `╔══〘 🌑 VESPERION HAS FALLEN 〙══╗\n` +
                        `┃★\n` +
                        `┃★ The Firstborn Dusk goes down\n` +
                        `┃★ under ${r.totalAttacks} blows.\n` +
                        `┃★ *${r.nickname}* struck it last.\n` +
                        `┃★\n` +
                        `┃★ 🏆 *${rewards.count} hunters* share the kill.\n` +
                        `┃★ Every one of them is healed and paid.\n` +
                        `┃★\n` +
                        (top ? top + '\n' : '') +
                        (rewards.lines.length > 10 ? `┃★ …and ${rewards.lines.length - 10} more.\n` : '') +
                        `┃★\n` +
                        `╚═══════════════════════════════╝`
                }).catch(() => {});

                // Chapter 1 closes — post the epilogue and roll into Shardfall.
                try {
                    const { setChapter, getCurrentChapter } = require('../systems/loreSystem');
                    const { CHAPTER_EPILOGUE } = require('../systems/storyEvents');
                    if ((await getCurrentChapter()) < 2) {
                        await setChapter(2);
                        if (CHAPTER_EPILOGUE[1]) {
                            await client.sendMessage(groupJid, { text: CHAPTER_EPILOGUE[1] }).catch(() => {});
                        }
                        console.log('📖 Vesperion slain — story advanced to chapter 2.');
                    }
                } catch (e) { console.error('[Vesperion] story advance:', e.message); }

                return msg.reply(`🌑 *${r.damage.toLocaleString()}* — and it drops. You killed it.`);
            }

            // ── Normal swing ──────────────────────────────────────────────
            let out =
                `╔══〘 🗡️ STRIKE 〙══╗\n` +
                `┃★ ${r.nickname} hits for *${r.damage.toLocaleString()}*\n` +
                `┃★ ${r.bar}\n` +
                `┃★ ${r.bossHp.toLocaleString()} / ${r.bossMax.toLocaleString()} (${pct}%)\n`;

            if (r.retaliation) {
                const t = r.retaliation;
                out +=
                    `┃★━━━━━━━━━━━━━\n` +
                    `┃★ 👁️ *IT TURNS.*\n` +
                    `┃★ Vesperion goes for *${t.nickname}*.\n` +
                    `┃★ ${t.note}\n` +
                    (t.killed
                        ? `┃★ ☠️ *${t.nickname} IS DEAD.* (strike ${t.strike}/3)\n`
                        : `┃★ ❤️ ${t.hp.toLocaleString()} HP left · strike ${t.strike}/3\n`);

                // Everyone should see who just got hit.
                try {
                    const groupJid = process.env.RAID_GROUP_JID || getRaidGroup();
                    await client.sendMessage(groupJid, {
                        text:
                            `╔══〘 👁️ VESPERION STRIKES 〙══╗\n` +
                            `┃★ It picks *${t.nickname}* out of the pack.\n` +
                            `┃★ ${t.note}\n` +
                            (t.killed
                                ? `┃★ ☠️ *${t.nickname} has fallen.* (3/3)\n`
                                : `┃★ ❤️ ${t.hp.toLocaleString()} HP · strike ${t.strike}/3\n`) +
                            `╚═══════════════════════════╝`,
                        mentions: [`${t.playerId}@s.whatsapp.net`]
                    }).catch(() => {});

                    // Last hunter down — the hunt failed.
                    if (t.wipe) {
                        await client.sendMessage(groupJid, {
                            text:
                                `╔══〘 ☠️ THE HUNT IS OVER 〙══╗\n` +
                                `┃★\n` +
                                `┃★ The last of you goes down.\n` +
                                `┃★ Vesperion stands in the quiet\n` +
                                `┃★ with ${r.bossHp.toLocaleString()} HP left,\n` +
                                `┃★ and walks back to the nest.\n` +
                                `┃★\n` +
                                `┃★ It will have to be called again.\n` +
                                `╚═══════════════════════════╝`
                        }).catch(() => {});
                        console.log(`☠️ Vesperion raid ${r.raidId} wiped the party — raid closed.`);
                    }
                } catch (e) {}
            }

            out += `╚═══════════════════╝`;
            return msg.reply(out);
        } catch (err) {
            console.error('strike error:', err);
            return msg.reply('❌ Strike failed: ' + err.message);
        }
    }
};
