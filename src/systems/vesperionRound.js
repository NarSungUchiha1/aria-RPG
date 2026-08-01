/**
 * Shared resolution for one blow against Vesperion.
 *
 * Both !skill (full movesets) and !strike (basic swing) end up here, so the
 * kill, the retaliation, the wipe and the chapter roll-over are written once
 * and can't drift apart between the two entry points.
 */
const { distributeRewards } = require('./vesperionRaid');
const { getRaidGroup } = require('../utils/raidContext');

function raidGroup() {
    return process.env.RAID_GROUP_JID || getRaidGroup();
}

async function announceKill(client, r) {
    const groupJid = raidGroup();
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

    // Chapter 1 closes — epilogue, then Shardfall.
    try {
        const { setChapter, getCurrentChapter } = require('./loreSystem');
        const { CHAPTER_EPILOGUE } = require('./storyEvents');
        if ((await getCurrentChapter()) < 2) {
            await setChapter(2);
            if (CHAPTER_EPILOGUE[1]) {
                await client.sendMessage(groupJid, { text: CHAPTER_EPILOGUE[1] }).catch(() => {});
            }
            console.log('📖 Vesperion slain — story advanced to chapter 2.');
        }
    } catch (e) { console.error('[Vesperion] story advance:', e.message); }
}

async function announceRetaliation(client, t, bossHp, raidId) {
    const groupJid = raidGroup();
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

    if (t.wipe) {
        await client.sendMessage(groupJid, {
            text:
                `╔══〘 ☠️ THE HUNT IS OVER 〙══╗\n` +
                `┃★\n` +
                `┃★ The last of you goes down.\n` +
                `┃★ Vesperion stands in the quiet\n` +
                `┃★ with ${Number(bossHp).toLocaleString()} HP left,\n` +
                `┃★ and walks back to the nest.\n` +
                `┃★\n` +
                `┃★ It will have to be called again.\n` +
                `╚═══════════════════════════╝`
        }).catch(() => {});
        console.log(`☠️ Vesperion raid ${raidId} wiped the party — raid closed.`);
    }
}

/**
 * Format + broadcast one resolved blow. `moveName` is null for a basic swing.
 */
async function finishVesperionRound(msg, client, r, move, player, cooldown) {
    if (r.defeated) {
        await announceKill(client, r);
        return msg.reply(
            move
                ? `🌑 *${move.name}* lands for *${r.damage.toLocaleString()}* — and it drops. You killed it.`
                : `🌑 *${r.damage.toLocaleString()}* — and it drops. You killed it.`
        );
    }

    const pct = Math.round((r.bossHp / r.bossMax) * 100);
    let out =
        `╔══〘 🌑 VESPERION 〙══╗\n` +
        `┃★ ${r.nickname}${move ? ` used *${move.name}*` : ' swings'}\n` +
        `┃★ 💥 *${r.damage.toLocaleString()}* damage\n` +
        `┃★ ${r.bar}\n` +
        `┃★ ${r.bossHp.toLocaleString()} / ${r.bossMax.toLocaleString()} (${pct}%)\n`;

    if (r.retaliation) {
        const t = r.retaliation;
        out +=
            `┃★━━━━━━━━━━━━━\n` +
            `┃★ 👁️ *IT TURNS.*\n` +
            `┃★ Vesperion goes for *${t.nickname}*.\n` +
            (t.killed
                ? `┃★ ☠️ *${t.nickname} IS DEAD.* (${t.strike}/3)\n`
                : `┃★ ❤️ ${t.hp.toLocaleString()} HP left · strike ${t.strike}/3\n`);
        await announceRetaliation(client, t, r.bossHp, r.raidId);
    }

    if (cooldown) out += `┃★ Cooldown: ${cooldown}s\n`;
    out += `╚═══════════════════╝`;
    return msg.reply(out);
}

module.exports = { finishVesperionRound, announceKill, announceRetaliation };
