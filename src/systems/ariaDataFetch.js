/**
 * ARIA Real Data Fetcher
 * Before ARIA answers any game-related question, she fetches real data.
 * She never guesses stats, XP, gold, PvP records, or clan info.
 */

const db = require('../database/db');

// ── Detect what kind of data the question needs ───────────────────────────────
function detectDataNeeds(question) {
    const q = question.toLowerCase();
    const needs = [];

    if (/\b(pvp|duel|win|loss|fight|battle|record)\b/.test(q))         needs.push('pvp');
    if (/\b(clan|guild|group|team|blessing)\b/.test(q))                  needs.push('clan');
    if (/\b(dungeon|raid|stage|clear|boss)\b/.test(q))                   needs.push('dungeon');
    if (/\b(xp|experience|level|rank|progress)\b/.test(q))              needs.push('xp');
    if (/\b(gold|money|currency|rich|broke|wealth)\b/.test(q))          needs.push('gold');
    if (/\b(fatigue|tired|energy|stamina)\b/.test(q))                    needs.push('fatigue');
    if (/\b(stats?|profile|info|status|hp|health|strength|agility)\b/.test(q)) needs.push('stats');
    if (/\b(leaderboard|top|best|strongest|richest|most)\b/.test(q))    needs.push('leaderboard');
    if (/\b(quest|mission|task|daily)\b/.test(q))                        needs.push('quests');

    return needs;
}

// ── Extract a player name from the question ───────────────────────────────────
async function findMentionedPlayer(question) {
    // Look for capitalized words that might be player names
    const candidates = question.match(/\b[A-Z][a-z]{1,15}\b/g) || [];
    const skipWords = new Set(['What','Who','How','When','Where','Show','Tell',
        'Give','Check','Pull','Get','The','His','Her','Their','Does','Did']);

    for (const word of candidates) {
        if (skipWords.has(word)) continue;
        try {
            const [rows] = await db.execute(
                "SELECT id FROM players WHERE LOWER(nickname) LIKE ? LIMIT 1",
                [`%${word.toLowerCase()}%`]
            );
            if (rows[0]) return { name: word, id: rows[0].id };
        } catch {}
    }
    return null;
}

// ── Fetch full player data ────────────────────────────────────────────────────
async function fetchPlayerData(identifier) {
    try {
        const byId   = typeof identifier === 'string' && identifier.length > 8;
        const clause = byId ? 'p.id = ?' : 'LOWER(p.nickname) LIKE ?';
        const param  = byId ? identifier : `%${identifier.toLowerCase()}%`;

        const [rows] = await db.execute(`
            SELECT p.nickname, p.role, p.\`rank\`, p.prestige_level,
                   p.hp, p.max_hp, p.strength, p.agility, p.intelligence, p.stamina,
                   p.fatigue, p.sp, p.pvp_wins, p.pvp_losses, p.title,
                   c.gold, x.xp, cl.name as clan_name
            FROM players p
            LEFT JOIN currency c ON c.player_id = p.id
            LEFT JOIN xp x ON x.player_id = p.id
            LEFT JOIN clan_members cm ON cm.player_id = p.id
            LEFT JOIN clans cl ON cl.id = cm.clan_id
            WHERE ${clause} LIMIT 1`, [param]
        );
        if (!rows[0]) return null;
        const p = rows[0];
        return `${p.nickname} — ${p.role} | Rank ${p.rank}${p.prestige_level > 0 ? ` (Prestige ${p.prestige_level})` : ''} | ` +
               `HP ${p.hp}/${p.max_hp} | Fatigue ${p.fatigue}/100 | ` +
               `STR ${p.strength} AGI ${p.agility} INT ${p.intelligence} STA ${p.stamina} | ` +
               `Lumens ${Number(p.gold||0).toLocaleString()} | XP ${Number(p.xp||0).toLocaleString()} | ` +
               `PvP ${p.pvp_wins}W-${p.pvp_losses}L | Clan: ${p.clan_name || 'None'} | Title: ${p.title || 'None'}`;
    } catch { return null; }
}

// ── Fetch clan data ───────────────────────────────────────────────────────────
async function fetchClanData(clanName) {
    try {
        const clause = clanName ? 'WHERE LOWER(c.name) LIKE ?' : '';
        const param  = clanName ? [`%${clanName.toLowerCase()}%`] : [];
        const [rows] = await db.execute(`
            SELECT c.name, c.blessing_type, p.nickname as leader,
                   COUNT(cm.player_id) as members
            FROM clans c
            LEFT JOIN players p ON p.id = c.leader_id
            LEFT JOIN clan_members cm ON cm.clan_id = c.id
            ${clause}
            GROUP BY c.id ORDER BY members DESC LIMIT 5`, param
        );
        if (!rows.length) return null;
        return rows.map(r =>
            `Clan "${r.name}" — Leader: ${r.leader || '?'} | Members: ${r.members} | Blessing: ${r.blessing_type || 'None'}`
        ).join('\n');
    } catch { return null; }
}

// ── Fetch leaderboard ─────────────────────────────────────────────────────────
async function fetchLeaderboard(type = 'xp') {
    try {
        const orderBy = {
            xp:   'x.xp DESC',
            gold: 'c.gold DESC',
            pvp:  'p.pvp_wins DESC'
        }[type] || 'x.xp DESC';

        const [rows] = await db.execute(`
            SELECT p.nickname, p.\`rank\`, p.prestige_level,
                   p.pvp_wins, c.gold, x.xp
            FROM players p
            LEFT JOIN currency c ON c.player_id = p.id
            LEFT JOIN xp x ON x.player_id = p.id
            ORDER BY ${orderBy} LIMIT 10`
        );
        return rows.map((r, i) =>
            `${i+1}. ${r.nickname} [${r.rank}]${r.prestige_level > 0 ? '⭐' : ''} — ` +
            `XP: ${Number(r.xp||0).toLocaleString()} | Lumens: ${Number(r.gold||0).toLocaleString()} | PvP: ${r.pvp_wins}W`
        ).join('\n');
    } catch { return null; }
}

// ── Fetch recent dungeon activity ─────────────────────────────────────────────
async function fetchRecentDungeons() {
    try {
        const [rows] = await db.execute(`
            SELECT d.dungeon_rank, d.stage, d.max_stage, d.created_at,
                   GROUP_CONCAT(p.nickname SEPARATOR ', ') as players
            FROM dungeon d
            LEFT JOIN dungeon_players dp ON dp.dungeon_id = d.id
            LEFT JOIN players p ON p.id = dp.player_id
            WHERE d.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            GROUP BY d.id ORDER BY d.created_at DESC LIMIT 5`
        );
        if (!rows.length) return 'No dungeon runs in the last 24 hours.';
        return rows.map(r =>
            `Rank ${r.dungeon_rank} dungeon — Stage ${r.stage}/${r.max_stage} | Players: ${r.players || 'none'} | ${new Date(r.created_at).toLocaleTimeString()}`
        ).join('\n');
    } catch { return null; }
}

// ── Main: build a real data context for ARIA's response ──────────────────────
async function buildGameContext(question, askingUserId) {
    const needs  = detectDataNeeds(question);
    if (!needs.length) return '';

    const sections = [];

    // Always try to find if they're asking about a specific player
    const mentioned = await findMentionedPlayer(question);
    const targetId  = mentioned?.id || askingUserId;

    if (needs.includes('stats') || needs.includes('fatigue') ||
        needs.includes('xp')    || needs.includes('gold')    ||
        needs.includes('pvp')) {
        const data = await fetchPlayerData(targetId);
        if (data) sections.push(`REAL PLAYER DATA:\n${data}`);
    }

    if (needs.includes('clan')) {
        // Try to extract clan name from question
        const clanMatch = question.match(/clan\s+["""']?([A-Za-z]+)["""']?/i);
        const data = await fetchClanData(clanMatch?.[1] || null);
        if (data) sections.push(`REAL CLAN DATA:\n${data}`);
    }

    if (needs.includes('leaderboard')) {
        const type = /gold|rich|wealth/.test(question.toLowerCase()) ? 'gold'
                   : /pvp|duel|win/.test(question.toLowerCase()) ? 'pvp' : 'xp';
        const data = await fetchLeaderboard(type);
        if (data) sections.push(`REAL LEADERBOARD (${type}):\n${data}`);
    }

    if (needs.includes('dungeon')) {
        const data = await fetchRecentDungeons();
        if (data) sections.push(`REAL DUNGEON ACTIVITY (last 24h):\n${data}`);
    }

    if (!sections.length) return '';
    return `\n\n--- REAL GAME DATA (use this exactly, never modify or invent) ---\n${sections.join('\n\n')}\n---`;
}

module.exports = { buildGameContext, buildArenaContext };

// ── Arena-only: fetch both fighters' full profiles + moves ───────────────────
// Called ONLY by the arena/duel system — never during normal Aria conversations
async function buildArenaContext(player1Id, player2Id) {
    const { getResonanceProfile, formatGenesisDate } = require('./ascendantSystem');

    async function buildFighterBlock(playerId) {
        const stats = await fetchPlayerData(playerId);
        const res = await getResonanceProfile(playerId).catch(() => null);
        if (!stats) return null;

        let block = stats;
        if (res && res.moves && res.moves.length) {
            const moveText = res.moves.map((m, i) => `  ${i+1}. ${m.name} — ${m.desc}`).join('\n');
            block += `\nResonance Name: ${res.res_name}` +
                     `\nSoulbound Genesis: ${formatGenesisDate(res.genesis_date)}` +
                     `\nAuthority: ${res.authority}` +
                     `\nSIGNATURE MOVES:\n${moveText}`;
        }
        return block;
    }

    const [f1, f2] = await Promise.all([
        buildFighterBlock(player1Id),
        buildFighterBlock(player2Id)
    ]);

    return `--- ARENA DUEL DATA (use exactly, never invent stats or moves) ---\n` +
           `FIGHTER 1:\n${f1 || 'Unknown'}\n\n` +
           `FIGHTER 2:\n${f2 || 'Unknown'}\n---`;
}