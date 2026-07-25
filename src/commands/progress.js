// !progress — owner/admin world dashboard: story position, milestone countdown,
// population, live activity, factions, territories and subscriptions in one card.
const db = require('../database/db');
const { isOwner } = require('../utils/identity');

const q = async (sql, params = []) => {
    try { const [rows] = await db.execute(sql, params); return rows; }
    catch (e) { return []; }
};
const num = (rows, key = 'cnt') => Number(rows[0]?.[key] || 0);

function bar(current, target, len = 10) {
    const pct = target > 0 ? Math.min(1, current / target) : 1;
    const filled = Math.round(pct * len);
    return '█'.repeat(filled) + '░'.repeat(len - filled) + ` ${Math.round(pct * 100)}%`;
}

module.exports = {
    name: 'progress',
    aliases: ['worldstatus'],
    async execute(msg, args, { userId, isAdmin }) {
        if (!isOwner(userId) && !isAdmin) return msg.reply('❌ Admin only.');
        try {
            const { getCurrentChapter, CHAPTERS } = require('../systems/loreSystem');
            const { CHAPTER_EVENTS, countTotalClears } = require('../systems/storyEvents');
            const { getFlag } = require('../systems/gameFlags');

            // ── Story position ────────────────────────────────────────────
            const chapter = await getCurrentChapter().catch(() => 1);
            const chapterInfo = (CHAPTERS || []).find(c => c.id === chapter);
            // Literally the same helper the milestone engine gates on, so the
            // countdown here can never disagree with when events actually fire.
            const totalClears = await countTotalClears().catch(() => 0);
            const events = CHAPTER_EVENTS[chapter] || [];

            let storyLines = '';
            for (const ev of events) {
                const done = (await getFlag(ev.flag)) === '1';
                storyLines += `┃◈ ${done ? '✅' : '⏳'} ${ev.title || ev.flag} (${ev.at})\n`;
            }
            const next = [];
            for (const ev of events) {
                if ((await getFlag(ev.flag)) !== '1') { next.push(ev); break; }
            }
            const bossReady = (await getFlag(`storyboss_${chapter}_ready`)) === '1';

            let nextLine;
            if (next.length) {
                const ev = next[0];
                nextLine =
                    `┃◈ ➡️ Next: *${ev.title || ev.flag}*\n` +
                    `┃◈ ${bar(totalClears, ev.at)}\n` +
                    `┃◈ ${totalClears}/${ev.at} clears — ${Math.max(0, ev.at - totalClears)} to go\n`;
            } else {
                nextLine = bossReady
                    ? `┃◈ 🗡️ All events fired — BOSS READY\n┃◈ Use *!spawn <BOSS>* to call the hunt.\n`
                    : `┃◈ ✅ All chapter events complete.\n`;
            }

            // ── Population ────────────────────────────────────────────────
            const players    = num(await q("SELECT COUNT(*) as cnt FROM players"));
            const prestige   = num(await q("SELECT COUNT(*) as cnt FROM players WHERE COALESCE(prestige_level,0) > 0"));
            const ascendants = num(await q("SELECT COUNT(*) as cnt FROM players WHERE `rank`='ASCENDANT'"));
            const active24   = num(await q("SELECT COUNT(*) as cnt FROM players WHERE last_active > DATE_SUB(NOW(), INTERVAL 24 HOUR)"));
            const newbies    = num(await q("SELECT COUNT(*) as cnt FROM players WHERE registered_at > DATE_SUB(NOW(), INTERVAL 3 DAY)"));

            // ── Live activity ─────────────────────────────────────────────
            const liveDungeons = await q("SELECT id, dungeon_rank, stage, max_stage, modifier, locked FROM dungeon WHERE is_active=1 ORDER BY id DESC LIMIT 3");
            const inDungeon    = num(await q("SELECT COUNT(*) as cnt FROM dungeon_players WHERE is_alive=1"));
            const mirrors      = num(await q("SELECT COUNT(*) as cnt FROM dungeon_reflections WHERE defeated=0"));
            const clears24     = await countTotalClears(24).catch(() => 0);

            let liveLines = liveDungeons.length
                ? liveDungeons.map(dg =>
                    `┃◈ ⚔️ #${dg.id} ${dg.dungeon_rank} — stage ${dg.stage}/${dg.max_stage}` +
                    `${dg.modifier ? ` [${dg.modifier}]` : ''}${dg.locked ? '' : ' (lobby)'}`).join('\n') + '\n'
                : `┃◈ 💤 No dungeon running.\n`;

            // ── Factions / territories / subs ─────────────────────────────
            let factionLine = '';
            try {
                const { getStandings } = require('../systems/factionSystem');
                const standings = await getStandings();
                factionLine = standings.map((s, i) =>
                    `┃◈ ${i === 0 && s.points > 0 ? '👑' : '  '} ${s.emoji} ${s.name}: ${s.points.toLocaleString()}`).join('\n') + '\n';
            } catch (e) {}

            let terrLine = '';
            try {
                const terr = await q(
                    `SELECT vt.territory_id, c.name FROM void_territories vt
                     LEFT JOIN clans c ON c.id = vt.clan_id`);
                terrLine = terr.length
                    ? terr.map(t => `┃◈ 🏰 ${t.territory_id}: ${t.name || '— unclaimed'}`).join('\n') + '\n'
                    : '';
            } catch (e) {}

            const vips  = num(await q("SELECT COUNT(*) as cnt FROM vip_subscribers WHERE active=1 AND tier='VIP'  AND (expires_at IS NULL OR expires_at > NOW())"));
            const vvips = num(await q("SELECT COUNT(*) as cnt FROM vip_subscribers WHERE active=1 AND tier='VVIP' AND (expires_at IS NULL OR expires_at > NOW())"));

            const eraLive = (await getFlag('hollow_sun_active')) === '1';

            return msg.reply(
                `◆═══〘 🌑 WORLD PROGRESS 〙═══◆\n` +
                `┃◈ 📖 Chapter ${chapter}${chapterInfo ? ` — *${chapterInfo.title}*` : ''}\n` +
                `┃◈ ${eraLive ? '✅ Hollow Sun ACTIVE' : '⚠️ Era not launched (!hollowsun)'}\n` +
                `┃◈━━━━━━━━━━━━━\n` +
                `┃◈ 🏆 Total clears: *${totalClears.toLocaleString()}*\n` +
                `┃◈ 📈 Last 24h: ${clears24}\n` +
                storyLines +
                nextLine +
                `┃◈━━━━━━━━━━━━━\n` +
                `┃◈ 👥 Players: ${players} (${active24} active 24h)\n` +
                `┃◈ 🌱 New (3d): ${newbies}  ✦ Prestige: ${prestige}  👁️ Ascendant: ${ascendants}\n` +
                `┃◈━━━━━━━━━━━━━\n` +
                liveLines +
                `┃◈ 🧍 In dungeon: ${inDungeon}${mirrors ? `  🪞 Mirrors alive: ${mirrors}` : ''}\n` +
                (factionLine ? `┃◈━━━━━━━━━━━━━\n┃◈ ⚔️ Faction war (this week)\n` + factionLine : '') +
                (terrLine ? `┃◈━━━━━━━━━━━━━\n` + terrLine : '') +
                `┃◈━━━━━━━━━━━━━\n` +
                `┃◈ 👑 VIP: ${vips}   💎 VVIP: ${vvips}\n` +
                `◆═══════════════════════◆`
            );
        } catch (err) {
            console.error('progress error:', err);
            return msg.reply('❌ Could not build the progress report: ' + err.message);
        }
    }
};
