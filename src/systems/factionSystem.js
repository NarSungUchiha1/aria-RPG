/**
 * FACTION WAR SYSTEM (Chapter 6)
 * Individual allegiance to one of the three Chapter-5 factions. Every dungeon
 * clear (+10) and duel win (+5) scores points for your faction's weekly total.
 * A Sunday cron crowns the week's champion faction — its members earn +10% XP
 * on dungeon clears for the following week (flag: faction_champion).
 */
const db = require('../database/db');
const { getFlag, setFlag } = require('./gameFlags');

// THE HOLLOW SUN era factions. Internal ids unchanged (they key territories,
// member rows, and points) — names/mottos re-themed.
const FACTIONS = {
    ASSEMBLY:   { id: 'ASSEMBLY',   name: 'The Dawnwatch',    emoji: '🌅', motto: 'The sun will rise because we will drag it back.' },
    WRATHBORNE: { id: 'WRATHBORNE', name: 'The Umbral Court', emoji: '🌑', motto: 'Why mourn the sun? The dark crowns its own.' },
    REMNANTS:   { id: 'REMNANTS',   name: 'The Last Light',   emoji: '🕯️', motto: 'The sun was taken. Find the thief.' }
};

const SWITCH_COST = 50000; // gold, only when leaving an existing faction

let tablesReady = false;
async function ensureFactionTables() {
    if (tablesReady) return;
    await db.execute(`
        CREATE TABLE IF NOT EXISTS faction_members (
            player_id VARCHAR(50) PRIMARY KEY,
            faction   VARCHAR(20) NOT NULL,
            joined_at DATETIME DEFAULT NOW()
        )
    `).catch(() => {});
    await db.execute(`
        CREATE TABLE IF NOT EXISTS faction_points (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            faction    VARCHAR(20) NOT NULL,
            week_start DATE NOT NULL,
            points     INT DEFAULT 0,
            UNIQUE KEY uniq_faction_week (faction, week_start)
        )
    `).catch(() => {});
    tablesReady = true;
}

// Monday of the current week (UTC) as YYYY-MM-DD.
function weekStart() {
    const d = new Date();
    const day = (d.getUTCDay() + 6) % 7; // Mon=0
    d.setUTCDate(d.getUTCDate() - day);
    return d.toISOString().slice(0, 10);
}

// Member lookup, cached — this sits on the dungeon-clear hot path.
const memberCache = new Map(); // playerId -> { f, ts }
const MEMBER_TTL = 5 * 60 * 1000;
async function getFaction(playerId) {
    const hit = memberCache.get(playerId);
    if (hit && Date.now() - hit.ts < MEMBER_TTL) return hit.f;
    await ensureFactionTables();
    const [rows] = await db.execute('SELECT faction FROM faction_members WHERE player_id=?', [playerId]).catch(() => [[]]);
    const f = rows[0]?.faction || null;
    memberCache.set(playerId, { f, ts: Date.now() });
    return f;
}

async function joinFaction(playerId, factionId) {
    await ensureFactionTables();
    const fid = String(factionId || '').toUpperCase();
    if (!FACTIONS[fid]) return { ok: false, reason: 'unknown_faction' };

    const current = await getFaction(playerId);
    if (current === fid) return { ok: false, reason: 'already_in' };

    if (current) {
        // Switching sides costs gold — allegiance should mean something.
        const [cur] = await db.execute('SELECT gold FROM currency WHERE player_id=?', [playerId]);
        if ((cur[0]?.gold || 0) < SWITCH_COST) return { ok: false, reason: 'cant_afford', cost: SWITCH_COST };
        await db.execute('UPDATE currency SET gold = gold - ? WHERE player_id=?', [SWITCH_COST, playerId]);
    }

    await db.execute(
        'INSERT INTO faction_members (player_id, faction) VALUES (?, ?) ON DUPLICATE KEY UPDATE faction=?, joined_at=NOW()',
        [playerId, fid, fid]
    );
    memberCache.set(playerId, { f: fid, ts: Date.now() });
    return { ok: true, switched: !!current, faction: FACTIONS[fid] };
}

// Score points for the player's faction this week. Fire-and-forget safe.
async function addFactionPoints(playerId, pts) {
    try {
        const f = await getFaction(playerId);
        if (!f) return;
        await ensureFactionTables();
        await db.execute(
            'INSERT INTO faction_points (faction, week_start, points) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE points = points + ?',
            [f, weekStart(), pts, pts]
        );
    } catch (e) {}
}

async function getStandings() {
    await ensureFactionTables();
    const [rows] = await db.execute(
        'SELECT faction, points FROM faction_points WHERE week_start=? ORDER BY points DESC',
        [weekStart()]
    ).catch(() => [[]]);
    const standings = Object.keys(FACTIONS).map(fid => ({
        ...FACTIONS[fid],
        points: rows.find(r => r.faction === fid)?.points || 0
    }));
    standings.sort((a, b) => b.points - a.points);
    return standings;
}

// +10% XP on dungeon clears for last week's champion faction members.
async function championXpBonus(playerId, baseXp) {
    try {
        const champion = await getFlag('faction_champion');
        if (!champion) return 0;
        const f = await getFaction(playerId);
        if (f !== champion) return 0;
        const bonus = Math.floor(baseXp * 0.10);
        if (bonus > 0) await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [bonus, playerId]).catch(() => {});
        return bonus;
    } catch (e) { return 0; }
}

// Sunday cron: crown this week's champion, announce, set the buff flag.
async function resolveWeeklyFactionWar(client, jid) {
    const standings = await getStandings();
    if (!standings.length || standings[0].points === 0) return; // dead week — no champion
    const winner = standings[0];
    await setFlag('faction_champion', winner.id);
    const lines = standings.map((s, i) =>
        `┃★ ${i === 0 ? '👑' : ` ${i + 1}.`} ${s.emoji} ${s.name} — ${s.points.toLocaleString()} pts`).join('\n');
    if (client && jid) {
        await client.sendMessage(jid, {
            text:
                '╔══〘 ⚔️ FACTION WAR — WEEKLY RESULT 〙══╗\n' +
                '┃★\n' +
                lines + '\n' +
                '┃★\n' +
                `┃★ ${winner.emoji} *${winner.name}* takes the week!\n` +
                '┃★ 🎁 Members earn *+10% XP* on all\n' +
                '┃★ dungeon clears until next Sunday.\n' +
                '┃★\n' +
                '┃★ New week starts NOW. Fight for it.\n' +
                '╚═══════════════════════════════╝'
        }).catch(() => {});
    }
    console.log(`⚔️ Faction week resolved: ${winner.id} (${winner.points} pts)`);
}

module.exports = {
    FACTIONS, SWITCH_COST,
    getFaction, joinFaction, addFactionPoints, getStandings,
    championXpBonus, resolveWeeklyFactionWar
};
