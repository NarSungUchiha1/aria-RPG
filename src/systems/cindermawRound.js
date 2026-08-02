/**
 * One exchange with your own Cindermaw. Kept out of skill.js so the kill, the
 * bite, the death and the chapter roll-over live in one place — the same
 * mistake that caused drift between Vesperion's two entry points.
 */
const { rewardKill, huntStatus, closeHunt, KILLS_TO_ADVANCE } = require('./cindermawHunt');
const { getRaidGroup } = require('../utils/raidContext');

function raidGroup() {
    return process.env.RAID_GROUP_JID || getRaidGroup();
}

async function tagEveryone(client, groupJid) {
    try {
        const { tagAll } = require('../utils/tagAll');
        return (await tagAll(client, groupJid)).mentions || [];
    } catch (e) { return []; }
}

async function finishCindermawRound(msg, client, r, move, cooldown, userId) {
    const groupJid = raidGroup();

    // ── The beast dies ────────────────────────────────────────────────
    if (r.slain) {
        const reward = await rewardKill(userId, r.exchanges);
        const total = r.totalKills || 0;

        // The world hears about it.
        const mentions = await tagEveryone(client, groupJid);
        await client.sendMessage(groupJid, {
            mentions,
            text:
                `╔══〘 🔥 A STAR GOES OUT 〙══╗\n` +
                `┃★ *${r.nickname}* has killed their Cindermaw.\n` +
                `┃★ ${r.exchanges} exchanges, alone.\n` +
                `┃★ 🎯 ${total}/${KILLS_TO_ADVANCE} slain worldwide.\n` +
                `╚═══════════════════════════╝`
        }).catch(() => {});

        // Enough of them are dead — Chapter 3 begins.
        if (total >= KILLS_TO_ADVANCE) {
            try {
                const st = await huntStatus();
                if (st?.hunt) await closeHunt(st.hunt.id);

                const { setChapter, getCurrentChapter } = require('./loreSystem');
                const { CHAPTER_EPILOGUE } = require('./storyEvents');
                if ((await getCurrentChapter()) < 3) {
                    await setChapter(3);
                    if (CHAPTER_EPILOGUE[2]) {
                        await client.sendMessage(groupJid, { text: CHAPTER_EPILOGUE[2], mentions }).catch(() => {});
                    }
                    console.log('📖 Shardfall complete — story advanced to chapter 3.');
                }
            } catch (e) { console.error('[Cindermaw] chapter advance:', e.message); }
        }

        return msg.reply(
            `╔══〘 🔥 IT DIES 〙══╗\n` +
            `┃★ *${move.name}* finishes it.\n` +
            `┃★ 💥 ${r.damage.toLocaleString()} damage\n` +
            `┃★\n` +
            `┃★ The star in its gut goes dark.\n` +
            `┃★ ${r.exchanges} exchanges. No one helped you.\n` +
            `┃★\n` +
            `┃★ ✨ +${reward.lumens.toLocaleString()} Lumens\n` +
            `┃★ ⭐ +${reward.xp.toLocaleString()} XP\n` +
            `┃★ ❤️ Fully healed.\n` +
            `╚═══════════════════════╝`
        );
    }

    // ── Trading blows ─────────────────────────────────────────────────
    const pct = Math.round((r.bossHp / r.bossMax) * 100);
    let out =
        `╔══〘 🔥 CINDERMAW 〙══╗\n` +
        `┃★ ${r.nickname} used *${move.name}*\n` +
        `┃★ 💥 *${r.damage.toLocaleString()}* damage\n` +
        `┃★ ${r.bar}\n` +
        `┃★ ${r.bossHp.toLocaleString()} / ${r.bossMax.toLocaleString()} (${pct}%)\n`;

    if (r.bite) {
        out +=
            `┃★━━━━━━━━━━━━━\n` +
            `┃★ 🔥 It bites back — *${r.bite.damage.toLocaleString()}*\n` +
            `┃★ ❤️ ${r.bite.hp.toLocaleString()} / ${r.bite.maxHp.toLocaleString()}\n`;

        if (r.bite.killed) {
            out += `┃★ ☠️ *It has killed you.* Use !respawn.\n`;
            const mentions = await tagEveryone(client, groupJid);
            await client.sendMessage(groupJid, {
                mentions,
                text:
                    `╔══〘 ☠️ TAKEN 〙══╗\n` +
                    `┃★ *${r.nickname}* went out alone\n` +
                    `┃★ against their Cindermaw\n` +
                    `┃★ and did not come back.\n` +
                    `╚═══════════════════════╝`
            }).catch(() => {});
        }
    }

    if (cooldown) out += `┃★ Cooldown: ${cooldown}s\n`;
    out += `╚═══════════════════════╝`;
    return msg.reply(out);
}

module.exports = { finishCindermawRound };
