/**
 * !tournament               — view current tournament info
 * !tournament join          — register for battle royale
 * !tournament duo @player   — register duo partner
 * !tournament status        — your personal standing
 * !tournament bracket       — current bracket/standings
 * !tournament start         — [admin] start tournament
 * !tournament next          — [admin] advance to next phase
 * !tournament matchup       — [admin] call a battle royale matchup
 */

const db = require('../database/db');
const {
    PHASES, PRIZE_POOL,
    ensureTables, getActiveTournament, getParticipant,
    getActivePlayers, advancePhase, recordMatchResult
} = require('../systems/tournamentSystem');

const LIVE_RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
function getAnnouncementGroup(msgFrom, tournament) {
    if (msgFrom && msgFrom.endsWith('@g.us')) return msgFrom;
    if (tournament?.group_jid) return tournament.group_jid;
    return LIVE_RAID_GROUP;
}

module.exports = {
    name: 'tournament',
    async execute(msg, args, { userId, isAdmin, client }) {
        await ensureTables();
        const sub = args[0]?.toLowerCase();

        // ── ADMIN: start tournament ────────────────────────────────────────
        if (sub === 'start') {
            if (!isAdmin) return msg.reply('❌ Admin only.');

            const existing = await getActiveTournament(msg.from);
            if (existing) return msg.reply('❌ A tournament is already active. Use !tournament next to advance phases.');

            // Registration stays open until admin manually advances with !tournament next
            const groupJid = msg.from && msg.from.endsWith('@g.us') ? msg.from : LIVE_RAID_GROUP;
            const [result] = await db.execute(
                "INSERT INTO tournaments (name, phase, phase_ends_at, group_jid) VALUES ('The Void Tournament', 'registration', NULL, ?)",
                [groupJid]
            );
            const tourId = result.insertId;

            await client.sendMessage(groupJid, {
                text:
                    `╔══〘 🏆 VOID TOURNAMENT 〙══╗\n` +
                    `┃★\n` +
                    `┃★ The gates are open.\n` +
                    `┃★\n` +
                    `┃★ 📅 SCHEDULE:\n` +
                    `┃★ Day 1-2: Battle Royale\n` +
                    `┃★ Day 3-4: Duo Gauntlet\n` +
                    `┃★ Day 5-6: Grand Finals\n` +
                    `┃★ Day 7:   Awards\n` +
                    `┃★\n` +
                    `┃★ 💰 PRIZE POOL:\n` +
                    `┃★ 🥇 1,500,000G + Void Crown\n` +
                    `┃★ 🥈 750,000G + Fracture Sovereign\n` +
                    `┃★ 🥉 350,000G (×2)\n` +
                    `┃★ ⚔️ 150,000G (Top 8)\n` +
                    `┃★ 🎖️ 25,000G (All participants)\n` +
                    `┃★ + XP and Void Crystals\n` +
                    `┃★\n` +
                    `┃★ Register: *!tournament join*\n` +
                    `┃★\n` +
                    `╚═══════════════════════════╝`
            }).catch(() => {});

            return msg.reply(`✅ Tournament started! ID: ${tourId}`);
        }

        // ── ADMIN: advance phase ───────────────────────────────────────────
        if (sub === 'next') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply('❌ No active tournament.');

            // Snapshot before advancing to show who got cut
            const beforePlayers = await getActivePlayers(t.id);

            const next = await advancePhase(t, client, getAnnouncementGroup(msg.from, t));

            // Duo phase — announce survivors and who got cut
            if (next === 'duo_gauntlet') {
                const afterPlayers = await getActivePlayers(t.id);
                const survivorIds = new Set(afterPlayers.map(p => p.player_id));
                const cut = beforePlayers.filter(p => !survivorIds.has(p.player_id));
                const survivors = [...afterPlayers].sort((a, b) => {
                    const aF = Number(a.wins)+Number(a.losses), bF = Number(b.wins)+Number(b.losses);
                    const aR = aF > 0 ? Number(a.wins)/aF : 0, bR = bF > 0 ? Number(b.wins)/bF : 0;
                    return bR - aR || Number(b.wins)-Number(a.wins);
                });
                const survivorLines = survivors.map((p, i) => {
                    const fights = Number(p.wins)+Number(p.losses);
                    const ratio = fights > 0 ? Math.round((Number(p.wins)/fights)*100) : 0;
                    return `┃★ ${i+1}. *${p.nickname}* — ${p.wins}W ${p.losses}L · ${ratio}%`;
                }).join('\n');
                const cutLines = cut.length
                    ? cut.map(p => `┃★ ❌ *${p.nickname}* — ${p.wins}W ${p.losses}L`).join('\n')
                    : '┃★ None';
                const announceTo = process.env.PVP_GROUP_JID || getAnnouncementGroup(msg.from, t);
                await client.sendMessage(announceTo, {
                    text:
                        `╔══〘 🤝 DUO GAUNTLET BEGINS 〙══╗\n` +
                        `┃★\n` +
                        `┃★ The Battle Royale is over.\n` +
                        `┃★\n` +
                        `┃★ ✅ SURVIVORS (${survivors.length}):\n` +
                        `${survivorLines}\n` +
                        `┃★\n` +
                        `┃★ ❌ ELIMINATED:\n` +
                        `${cutLines}\n` +
                        `┃★\n` +
                        `┃★ Register your duo:\n` +
                        `┃★ *!tournament duo @partner*\n` +
                        `┃★\n` +
                        `╚═══════════════════════════╝`
                }).catch(() => {});
            }

            return msg.reply(`✅ Advanced to phase: *${next}*`);
        }

        // ── ADMIN: call matchup ────────────────────────────────────────────
        if (sub === 'matchup') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament(msg.from);
            if (!t || t.phase !== PHASES.BATTLE_ROYALE) return msg.reply('❌ Only during Battle Royale phase.');

            const players = await getActivePlayers(t.id);

// Exclude anyone who has already played 7 or more matches
const eligiblePlayers = players.filter(
    p => (Number(p.wins) + Number(p.losses)) < 7 && !p.eliminated
);

if (eligiblePlayers.length < 2) {
    return msg.reply('❌ No eligible players remaining for Battle Royale.');
}

// Randomize remaining eligible players
const shuffled = [...eligiblePlayers].sort(() => Math.random() - 0.5);
            let p1 = null, p2 = null;
            outer: for (let i = 0; i < shuffled.length; i++) {
                for (let j = i + 1; j < shuffled.length; j++) {
                    const [prev] = await db.execute(
                        `SELECT COUNT(*) as cnt FROM tournament_matches WHERE tournament_id=? AND phase='battle_royale'
                         AND ((player1_id=? AND player2_id=?) OR (player1_id=? AND player2_id=?))`,
                        [t.id, shuffled[i].player_id, shuffled[j].player_id, shuffled[j].player_id, shuffled[i].player_id]
                    );
                    if (prev[0].cnt < 3) { p1 = shuffled[i]; p2 = shuffled[j]; break outer; }
                }
            }
if (!p1 || !p2) {
    return msg.reply(
        '✅ No valid matchups remain. All eligible players have either completed 7 matches or already fought each other the maximum number of times.'
    );
            }

            // Route matchup to PvP group for live, or stay in current GC for testers
            const TEST_GC_T = process.env.TEST_GROUP_JID || '120363408323584748@g.us';
            const isTestCtx = msg.from === TEST_GC_T;
            const pvpGrpJid = isTestCtx
                ? TEST_GC_T
                : (process.env.PVP_GROUP_JID || getAnnouncementGroup(msg.from, t));
            try {
                const pvpMeta = await client.groupMetadata(pvpGrpJid);
                const pvpMentions = pvpMeta.participants
                    .filter(p => {
                        const n = String(p.id).replace(/@[^@]+$/,'').split(':')[0];
                        return n === p1.player_id || n === p2.player_id;
                    }).map(p => p.id);
                await client.sendMessage(pvpGrpJid, {
                    text:
                        `╔══〘 ⚔️ BATTLE ROYALE MATCHUP 〙══╗\n` +
                        `┃★\n` +
                        `┃★ ARIA calls the next fight:\n` +
                        `┃★\n` +
                        `┃★ ⚔️ *${p1.nickname}* [${p1.rank}]\n` +
                        `┃★       VS\n` +
                        `┃★ ⚔️ *${p2.nickname}* [${p2.rank}]\n` +
                        `┃★\n` +
                        `┃★ Both players type *!startduel* to begin.\n` +
                        `┃★ Winner gets +1 win recorded.\n` +
                        `┃★\n` +
                        `╚═══════════════════════════╝`,
                    mentions: pvpMentions.length ? pvpMentions : [p1.player_id + '@s.whatsapp.net', p2.player_id + '@s.whatsapp.net']
                });
            } catch(muErr) {
                console.error('[matchup send]', muErr.message);
                await client.sendMessage(pvpGrpJid, {
                    text: `⚔️ Next fight: *${p1.nickname}* vs *${p2.nickname}* — both type !startduel`
                }).catch(() => {});
            }
            // Promote both players in PvP group
            try {
                const { promoteForDuel } = require('../systems/pvpsystem');
                setTimeout(() => promoteForDuel(client, [p1.player_id, p2.player_id], pvpGrpJid).catch(() => {}), 800);
            } catch(e) {}

            if (p1 && p2) {
                await db.execute(
                    "INSERT INTO tournament_matches (tournament_id, phase, player1_id, player2_id, status) VALUES (?,?,?,?,'active')",
                    [t.id, 'battle_royale', p1.player_id, p2.player_id]
                ).catch(() => {});
                // Register both players for a direct tournament duel (no party assembly needed)
                try {
                    const { setTournamentDuelPending } = require('../systems/pvpsystem');
                    setTournamentDuelPending(p1.player_id, p2.player_id, t.id, t.phase, client, pvpGrpJid);
                } catch(e) {}
            }
            return msg.reply('✅ Matchup called.');
        }

        // ── ADMIN: record win ──────────────────────────────────────────────
        if (sub === 'recordwin') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply('❌ No active tournament.');
            const winnerId = msg.mentionedIds?.[0];
            const loserId  = msg.mentionedIds?.[1];
            if (!winnerId || !loserId) return msg.reply('❌ !tournament recordwin @winner @loser');
            const normW = String(winnerId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g,'').split(':')[0];
            const normL = String(loserId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g,'').split(':')[0];
            await recordMatchResult(t.id, normW, normL, t.phase);
            const [wRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [normW]);
            const [lRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [normL]);
            return msg.reply(`✅ Recorded: *${wRow[0]?.nickname}* beat *${lRow[0]?.nickname}*`);
        }

        // ── JOIN ───────────────────────────────────────────────────────────
        if (sub === 'join') {
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply(
                `══〘 🏆 TOURNAMENT 〙══╮\n┃★ No active tournament.\n╰═══════════════════════╯`
            );
            if (t.phase !== PHASES.REGISTRATION && t.phase !== PHASES.BATTLE_ROYALE) return msg.reply(
                `══〘 🏆 TOURNAMENT 〙══╮\n┃★ Registration is closed.\n╰═══════════════════════╯`
            );

            const existing = await getParticipant(t.id, userId);
            if (existing) return msg.reply(`══〘 🏆 TOURNAMENT 〙══╮\n┃★ ✅ Already registered.\n╰═══════════════════════╯`);

            const [player] = await db.execute('SELECT nickname, `rank` FROM players WHERE id=?', [userId]);
            if (!player.length) return msg.reply('❌ Not registered.');

            await db.execute(
                "INSERT IGNORE INTO tournament_players (tournament_id, player_id, phase_joined) VALUES (?,?,'battle_royale')",
                [t.id, userId]
            );

            const [count] = await db.execute('SELECT COUNT(*) as cnt FROM tournament_players WHERE tournament_id=?', [t.id]);

            return msg.reply(
                `╔══〘 🏆 TOURNAMENT 〙══╗\n` +
                `┃★\n` +
                `┃★ *${player[0].nickname}* enters the arena.\n` +
                `┃★ Rank: ${player[0].rank}\n` +
                `┃★\n` +
                `┃★ Hunters registered: ${count[0].cnt}\n` +
                `┃★\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── DUO REQUEST / CONFIRM ─────────────────────────────────────────
        // Both players type !tournament duo @otherplayer
        // First = sends request. Second (pointing back) = confirms & locks pair.
        if (sub === 'duo') {
            const t = await getActiveTournament(msg.from);
            if (!t || t.phase !== PHASES.DUO_GAUNTLET) return msg.reply(
                `══〘 🏆 TOURNAMENT 〙══╮\n┃★ Duo registration not open yet.\n╰═══════════════════════╯`
            );
            const rawPid = msg.mentionedIds?.[0];
            if (!rawPid) return msg.reply('❌ !tournament duo @partner');
            const partnerId = String(rawPid).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g,'').split(':')[0];
            if (partnerId === userId) return msg.reply('❌ You cannot duo with yourself.');

            const [player] = await db.execute('SELECT nickname FROM players WHERE id=?', [userId]);
            const [partner] = await db.execute('SELECT nickname FROM players WHERE id=?', [partnerId]);
            if (!partner.length) return msg.reply('❌ Partner not found.');
            const myNick = player[0]?.nickname;
            const partnerNick = partner[0]?.nickname;

            const selfEntry = await getParticipant(t.id, userId);
            if (!selfEntry || selfEntry.eliminated)
                return msg.reply(`══〘 🏆 TOURNAMENT 〙══╮\n┃★ ❌ You are not active in the tournament.\n╰═══════════════════════╯`);
            if (selfEntry.duo_partner)
                return msg.reply(`══〘 🏆 TOURNAMENT 〙══╮\n┃★ ❌ You already have a duo partner.\n╰═══════════════════════╯`);
            const partnerEntry = await getParticipant(t.id, partnerId);
            if (!partnerEntry || partnerEntry.eliminated)
                return msg.reply(`══〘 🏆 TOURNAMENT 〙══╮\n┃★ ❌ *${partnerNick}* is not active in the tournament.\n╰═══════════════════════╯`);
            if (partnerEntry.duo_partner)
                return msg.reply(`══〘 🏆 TOURNAMENT 〙══╮\n┃★ ❌ *${partnerNick}* already has a duo partner.\n╰═══════════════════════╯`);

            if (!global.duoRequests) global.duoRequests = new Map();

            // Check if the target already sent a request to me — if so, confirm
            const incoming = global.duoRequests.get(`${partnerId}→${userId}_${t.id}`);
            if (incoming) {
                if (Date.now() > incoming.expires) {
                    global.duoRequests.delete(`${partnerId}→${userId}_${t.id}`);
                    return msg.reply('❌ Their duo request expired. Ask them to send it again.');
                }
                // Both pointed at each other — CONFIRM
                global.duoRequests.delete(`${partnerId}→${userId}_${t.id}`);

                await db.execute(
                    "UPDATE tournament_players SET duo_partner=? WHERE tournament_id=? AND player_id=?",
                    [partnerId, t.id, userId]
                );
                await db.execute(
                    "UPDATE tournament_players SET duo_partner=? WHERE tournament_id=? AND player_id=?",
                    [userId, t.id, partnerId]
                );

                const announceTo = process.env.PVP_GROUP_JID || getAnnouncementGroup(msg.from, t);
                await client.sendMessage(announceTo, {
                    text:
                        `╔══〘 🤝 DUO CONFIRMED 〙══╗\n` +
                        `┃★\n` +
                        `┃★ *${partnerNick}* + *${myNick}*\n` +
                        `┃★ are now a duo.\n` +
                        `┃★\n` +
                        `┃★ Fight together. Fall together.\n` +
                        `┃★\n` +
                        `╚═══════════════════════════╝`
                }).catch(() => {});
                return msg.reply(`✅ Duo locked in! You and *${partnerNick}* are partners.`);
            }

            // No incoming request — send a request
            global.duoRequests.set(`${userId}→${partnerId}_${t.id}`, {
                requesterNick: myNick,
                expires: Date.now() + 10 * 60 * 1000 // 10 min window
            });

            return msg.reply(
                `╔══〘 🤝 DUO REQUEST SENT 〙══╗\n` +
                `┃★\n` +
                `┃★ You sent a duo request to *${partnerNick}*.\n` +
                `┃★\n` +
                `┃★ They must type:\n` +
                `┃★ *!tournament duo @${myNick}*\n` +
                `┃★ to confirm. Expires in 10 mins.\n` +
                `┃★\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── DUO MATCHUP ───────────────────────────────────────────────────
        if (sub === 'duomatchup') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament(msg.from);
            if (!t || t.phase !== PHASES.DUO_GAUNTLET) return msg.reply('❌ Only during Duo Gauntlet phase.');

            // Get all registered duos (players with duo_partner set)
            const [duoRows] = await db.execute(
                `SELECT tp.player_id, tp.duo_partner, tp.wins, tp.losses, p.nickname, p.rank
                 FROM tournament_players tp JOIN players p ON p.id=tp.player_id
                 WHERE tp.tournament_id=? AND tp.eliminated=0 AND tp.duo_partner IS NOT NULL
                 ORDER BY RAND()`,
                [t.id]
            );

            // Build unique duo pairs (avoid duplicates since each duo has 2 rows)
            const seen = new Set();
            const duos = [];
            for (const row of duoRows) {
                const pairKey = [row.player_id, row.duo_partner].sort().join('_');
                if (!seen.has(pairKey)) {
                    seen.add(pairKey);
                    // Get partner info
                    const partner = duoRows.find(r => r.player_id === row.duo_partner);
                    if (partner) duos.push([row, partner]);
                }
            }

            if (duos.length < 2) return msg.reply('❌ Need at least 2 registered duos to call a matchup.');

            // Per-duo fight cap — total matches fought by either partner (combined)
            const MAX_DUO_FIGHTS = 3;
            // Count matches per duo from the dedicated table
            const getDuoMatchCount = async (p1Id, p2Id) => {
                const [rows] = await db.execute(
                    `SELECT COUNT(*) as cnt FROM duo_gauntlet_matches
                     WHERE tournament_id=?
                     AND ((team_a1=? AND team_a2=?) OR (team_a1=? AND team_a2=?)
                       OR (team_b1=? AND team_b2=?) OR (team_b1=? AND team_b2=?))`,
                    [t.id, p1Id, p2Id, p2Id, p1Id, p1Id, p2Id, p2Id, p1Id]
                );
                return rows[0].cnt;
            };
            const eligibleDuos = [];
            for (const duo of duos) {
                const [p1, p2] = duo;
                const fightCount = await getDuoMatchCount(p1.player_id, p2.player_id);
                if (fightCount < MAX_DUO_FIGHTS) eligibleDuos.push(duo);
            }

            if (eligibleDuos.length < 2) {
                return msg.reply(`✅ Duo Gauntlet matchups complete — every duo has reached the ${MAX_DUO_FIGHTS}-fight limit. Use !tournament next to advance.`);
            }

            // Pick 2 eligible duos that haven't fought 2+ times against each other
            let teamA = null, teamB = null;
            const shuffledDuos = [...eligibleDuos].sort(() => Math.random() - 0.5);
            outer2: for (let i = 0; i < shuffledDuos.length; i++) {
                for (let j = i + 1; j < shuffledDuos.length; j++) {
                    const [a1, a2] = shuffledDuos[i];
                    const [b1, b2] = shuffledDuos[j];
                    const [prev] = await db.execute(
                        `SELECT COUNT(*) as cnt FROM duo_gauntlet_matches WHERE tournament_id=?
                         AND ((team_a1 IN (?,?) AND team_b1 IN (?,?))
                           OR (team_a1 IN (?,?) AND team_b1 IN (?,?)))`,
                        [t.id, a1.player_id, a2.player_id, b1.player_id, b2.player_id,
                              b1.player_id, b2.player_id, a1.player_id, a2.player_id]
                    );
                    if (prev[0].cnt < 2) { teamA = shuffledDuos[i]; teamB = shuffledDuos[j]; break outer2; }
                }
            }
            if (!teamA || !teamB) return msg.reply('✅ No valid duo matchups remain — all eligible pairs have fought each other twice. Use !tournament next to advance.');

            const [a1, a2] = teamA;
            const [b1, b2] = teamB;

            // Route to PvP group
            const TEST_GC_D = process.env.TEST_GROUP_JID || '120363408323584748@g.us';
            const pvpGrpD = msg.from === TEST_GC_D ? TEST_GC_D : (process.env.PVP_GROUP_JID || getAnnouncementGroup(msg.from, t));

            // Get mentions for all 4 players
            let mentions = [a1.player_id, a2.player_id, b1.player_id, b2.player_id].map(id => id + '@s.whatsapp.net');
            try {
                const pvpMeta = await client.groupMetadata(pvpGrpD);
                const pids = new Set([a1.player_id, a2.player_id, b1.player_id, b2.player_id]);
                const found = pvpMeta.participants
                    .filter(p => pids.has(String(p.id).replace(/@[^@]+$/,'').split(':')[0]))
                    .map(p => p.id);
                if (found.length) mentions = found;
            } catch(e) {}

            await client.sendMessage(pvpGrpD, {
                text:
                    `╔══〘 🤝 DUO GAUNTLET MATCHUP 〙══╗\n` +
                    `┃★\n` +
                    `┃★ 🔵 *${a1.nickname}* + *${a2.nickname}*\n` +
                    `┃★       VS\n` +
                    `┃★ 🔴 *${b1.nickname}* + *${b2.nickname}*\n` +
                    `┃★\n` +
                    `┃★ Team leaders type *!startduel* to begin.\n` +
                    `┃★ Partners type *!joinparty @leader* to join.\n` +
                    `┃★\n` +
                    `╚═══════════════════════════╝`,
                mentions
            }).catch(() => {});

            // Promote all 4 in PvP group
            try {
                const { promoteForDuel } = require('../systems/pvpsystem');
                setTimeout(() => promoteForDuel(client, [a1.player_id, a2.player_id, b1.player_id, b2.player_id], pvpGrpD).catch(() => {}), 800);
            } catch(e) {}

            // Log matchup to dedicated duo table
            await db.execute(
                "INSERT INTO duo_gauntlet_matches (tournament_id, team_a1, team_a2, team_b1, team_b2) VALUES (?,?,?,?,?)",
                [t.id, a1.player_id, a2.player_id, b1.player_id, b2.player_id]
            ).catch(() => {});

            // Pre-create party assembly so leaders just type !startduel
            // Team A leader = a1, Team B leader = b1
            // Partners (a2, b2) join via !joinparty @leader
            try {
                const { startPartyAssembly } = require('../systems/pvpsystem');
                const assemblyKey = `duo_${a1.player_id}_${b1.player_id}_${t.id}`;
                const pvpChat = {
                    client,
                    sendMessage: async (text) => {
                        await client.sendMessage(pvpGrpD,
                            typeof text === 'string' ? { text } : text
                        ).catch(() => {});
                    }
                };
                await startPartyAssembly(
                    a1.player_id,   // Team A leader
                    [b1.player_id], // Team B leader
                    0,              // no bet
                    pvpChat,
                    assemblyKey
                );
                // Also pre-add the partners to their respective teams
                const { getAssemblyByPlayer } = require('../systems/pvpsystem');
                // Small delay to let assembly register
                setTimeout(async () => {
                    try {
                        const { joinPartyAssembly } = require('../systems/pvpsystem');
                        await joinPartyAssembly(a2.player_id, a1.player_id); // partner joins team A
                        await joinPartyAssembly(b2.player_id, b1.player_id); // partner joins team B
                    } catch(e) { console.error('[duo auto-join]', e.message); }
                }, 500);
            } catch(e) { console.error('[duomatchup assembly]', e.message); }

            return msg.reply(`✅ Duo matchup called: *${a1.nickname}* + *${a2.nickname}* vs *${b1.nickname}* + *${b2.nickname}*\nBoth leaders type *!startduel* to begin.`);
        }

        // ── STATUS ─────────────────────────────────────────────────────────
        if (sub === 'status') {
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply(`══〘 🏆 TOURNAMENT 〙══╮\n┃★ No active tournament.\n╰═══════════════════════╯`);

            const me = await getParticipant(t.id, userId);
            if (!me) return msg.reply(`══〘 🏆 TOURNAMENT 〙══╮\n┃★ You are not registered.\n┃★ !tournament join\n╰═══════════════════════╯`);

            const players = await getActivePlayers(t.id);
            const rankIdx = players.findIndex(p => p.player_id === userId);
            const myRank = rankIdx >= 0 ? rankIdx + 1 : null;

            return msg.reply(
                `╔══〘 🏆 YOUR STANDING 〙══╗\n` +
                `┃★\n` +
                `┃★ Phase: *${t.phase.replace(/_/g,' ').toUpperCase()}*\n` +
                `┃★\n` +
                `┃★ Wins:   ${me.wins}\n` +
                `┃★ Losses: ${me.losses}\n` +
                `┃★ Fights: ${Number(me.wins) + Number(me.losses)}/7\n` +
                `┃★ Rank:   ${me.eliminated ? '❌ Eliminated' : myRank ? `#${myRank} of ${players.length} active` : 'Unranked'}\n` +
                `┃★ Status: ${me.eliminated ? '❌ Eliminated' : '✅ Active'}\n` +
                (me.duo_partner ? `┃★ Duo:    ✅ Paired\n` : '') +
                `┃★\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── BRACKET ───────────────────────────────────────────────────────
        if (sub === 'bracket') {
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply(`══〘 🏆 TOURNAMENT 〙══╮\n┃★ No active tournament.\n╰═══════════════════════╯`);

            // During Duo Gauntlet — show paired duos with combined records
            if (t.phase === PHASES.DUO_GAUNTLET) {
                const [duoRows] = await db.execute(
                    `SELECT tp.player_id, tp.duo_partner, tp.wins, tp.losses, p.nickname
                     FROM tournament_players tp JOIN players p ON p.id=tp.player_id
                     WHERE tp.tournament_id=? AND tp.eliminated=0
                     ORDER BY tp.wins DESC`,
                    [t.id]
                );
                const seen = new Set();
                const pairs = [];
                const solo = [];
                for (const row of duoRows) {
                    if (!row.duo_partner) { solo.push(row); continue; }
                    const pairKey = [row.player_id, row.duo_partner].sort().join('_');
                    if (seen.has(pairKey)) continue;
                    seen.add(pairKey);
                    const partner = duoRows.find(r => r.player_id === row.duo_partner);
                    if (partner) pairs.push([row, partner]);
                }
                // Fetch from dedicated duo_gauntlet_matches table
                const duoStats = {};
                for (const [p1, p2] of pairs) {
                    const [matchRows] = await db.execute(
                        `SELECT winner_team, team_a1, team_a2, team_b1, team_b2
                         FROM duo_gauntlet_matches WHERE tournament_id=?
                         AND ((team_a1 IN (?,?) AND team_a2 IN (?,?))
                           OR (team_b1 IN (?,?) AND team_b2 IN (?,?)))`,
                        [t.id, p1.player_id, p2.player_id, p1.player_id, p2.player_id,
                              p1.player_id, p2.player_id, p1.player_id, p2.player_id]
                    );
                    let dW = 0, dL = 0;
                    for (const m of matchRows) {
                        if (!m.winner_team) continue;
                        const onTeamA = m.team_a1 === p1.player_id || m.team_a1 === p2.player_id
                                     || m.team_a2 === p1.player_id || m.team_a2 === p2.player_id;
                        const weWon = (onTeamA && m.winner_team === 'a') || (!onTeamA && m.winner_team === 'b');
                        if (weWon) dW++; else dL++;
                    }
                    const key = [p1.player_id, p2.player_id].sort().join('_');
                    duoStats[key] = { w: dW, l: dL, total: matchRows.length };
                }

                // Sort pairs by duo-phase win ratio
                pairs.sort((a, b) => {
                    const aKey = [a[0].player_id, a[1].player_id].sort().join('_');
                    const bKey = [b[0].player_id, b[1].player_id].sort().join('_');
                    const aS = duoStats[aKey] || { w:0, l:0, total:0 };
                    const bS = duoStats[bKey] || { w:0, l:0, total:0 };
                    const aR = aS.total > 0 ? aS.w/aS.total : 0;
                    const bR = bS.total > 0 ? bS.w/bS.total : 0;
                    return bR - aR || bS.w - aS.w;
                });

                let dText = `╔══〘 🤝 DUO STANDINGS 〙══╗\n┃★\n`;
                pairs.forEach(([p1, p2], i) => {
                    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
                    const key = [p1.player_id, p2.player_id].sort().join('_');
                    const s = duoStats[key] || { w:0, l:0, total:0 };
                    const ratio = s.total > 0 ? Math.round((s.w/s.total)*100) : 0;
                    dText += `┃★ ${medal} *${p1.nickname}* + *${p2.nickname}*\n`;
                    dText += `┃★    ${s.w}W ${s.l}L · ${ratio}% (${s.total}/3 matches)\n`;
                });
                if (solo.length) {
                    dText += `┃★\n┃★ ⏳ UNPAIRED (${solo.length}):\n`;
                    solo.forEach(p => { dText += `┃★ • ${p.nickname}\n`; });
                }
                dText += `┃★\n┃★ ${pairs.length} duos standing\n╚═══════════════════════════╝`;
                return msg.reply(dText);
            }

            // All active players sorted: wins DESC, losses ASC, nickname ASC
            const players = await getActivePlayers(t.id);
            const sorted = [...players].sort((a, b) => {
                const aF = Number(a.wins) + Number(a.losses);
                const bF = Number(b.wins) + Number(b.losses);
                const aR = aF > 0 ? Number(a.wins) / aF : 0;
                const bR = bF > 0 ? Number(b.wins) / bF : 0;
                if (bR !== aR) return bR - aR;
                if (Number(b.wins) !== Number(a.wins)) return Number(b.wins) - Number(a.wins);
                if (Number(a.losses) !== Number(b.losses)) return Number(a.losses) - Number(b.losses);
                return a.nickname.localeCompare(b.nickname);
            });

            let text = `╔══〘 🏆 STANDINGS 〙══╗\n┃★ Phase: ${t.phase.replace(/_/g,' ').toUpperCase()}\n┃★\n`;
            sorted.forEach((p, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
                const fights = Number(p.wins) + Number(p.losses);
                const ratio = fights > 0 ? Math.round((Number(p.wins) / fights) * 100) : 0;
                text += `┃★ ${medal} *${p.nickname}* — ${p.wins}W ${p.losses}L · ${ratio}%\n`;
            });
            text += `┃★\n┃★ ${sorted.length} hunters still standing\n╚═══════════════════════════╝`;
            return msg.reply(text);
        }

        // ── ADMIN: force phase ────────────────────────────────────────────
        if (sub === 'forcephase') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply('❌ No active tournament. Use !tournament start first.');
            const phase = args[1]?.toLowerCase();
            const validPhases = ['registration','battle_royale','duo_gauntlet','grand_finals','awards','ended'];
            if (!phase || !validPhases.includes(phase)) {
                return msg.reply(`❌ Valid phases: ${validPhases.join(', ')}`);
            }
            await db.execute("UPDATE tournaments SET phase=?, phase_ends_at=DATE_ADD(NOW(), INTERVAL 2 DAY) WHERE id=?", [phase, t.id]);
            const { handlePhaseStart } = require('../systems/tournamentSystem');
            await handlePhaseStart(phase, t.id, client, getAnnouncementGroup(msg.from, t));
            return msg.reply(`✅ Forced phase: *${phase}*`);
        }

        // ── ADMIN: add test players ────────────────────────────────────────
        if (sub === 'addtest') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply('❌ No active tournament.');
            // Add all mentioned players or self
            const targets = msg.mentionedIds?.length ? msg.mentionedIds : [userId];
            for (const pid of targets) {
                await db.execute(
                    "INSERT IGNORE INTO tournament_players (tournament_id, player_id, phase_joined) VALUES (?,?,'battle_royale')",
                    [t.id, pid]
                );
            }
            return msg.reply(`✅ Added ${targets.length} player(s) to tournament.`);
        }

        // ── ADMIN: force wins ──────────────────────────────────────────────
        if (sub === 'setwins') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply('❌ No active tournament.');
            const targetId = msg.mentionedIds?.[0] || userId;
            const wins = parseInt(args.find(a => /^\d+$/.test(a))) || 3;
            await db.execute(
                "UPDATE tournament_players SET wins=? WHERE tournament_id=? AND player_id=?",
                [wins, t.id, targetId]
            );
            return msg.reply(`✅ Set wins to ${wins} for player.`);
        }

        // ── ADMIN: eliminate player (mark as out, keep record) ───────────
        if (sub === 'eliminate' || sub === 'disqualify' || sub === 'dq') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply('❌ No active tournament.');
            const rawId = msg.mentionedIds?.[0];
            if (!rawId) return msg.reply('❌ Usage: !tournament eliminate @player');
            const targetId = String(rawId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g,'').split(':')[0];
            const [pRows] = await db.execute('SELECT nickname FROM players WHERE id=?', [targetId]);
            if (!pRows.length) return msg.reply('❌ Player not found.');
            const nick = pRows[0].nickname;
            await db.execute(
                "UPDATE tournament_players SET eliminated=1 WHERE tournament_id=? AND player_id=?",
                [t.id, targetId]
            );
            // Demote from PvP group if promoted
            try {
                const { demoteAfterDuel } = require('../systems/pvpsystem');
                await demoteAfterDuel(client, [targetId]);
            } catch(e) {}
            // Cancel any pending duel they're in
            try {
                const { setTournamentDuelPending } = require('../systems/pvpsystem');
                // Clear from pending map by looking up their opponent
            } catch(e) {}
            const pvpGrp = process.env.PVP_GROUP_JID || getAnnouncementGroup(msg.from, t);
            await client.sendMessage(pvpGrp, {
                text:
                    `╔══〘 ❌ PLAYER ELIMINATED 〙══╗\n` +
                    `┃★\n` +
                    `┃★ *${nick}* has been eliminated\n` +
                    `┃★ from the tournament by admin.\n` +
                    `┃★\n` +
                    `┃★ Use *!tournament bracket* for\n` +
                    `┃★ updated standings.\n` +
                    `╚═══════════════════════════╝`
            }).catch(() => {});
            return msg.reply(`✅ *${nick}* eliminated from tournament.`);
        }

        // ── ADMIN: remove player (fully delete from tournament) ──────────
        if (sub === 'remove') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply('❌ No active tournament.');
            const rawId = msg.mentionedIds?.[0];
            if (!rawId) return msg.reply('❌ Usage: !tournament remove @player');
            const targetId = String(rawId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g,'').split(':')[0];
            const [pRows] = await db.execute('SELECT nickname FROM players WHERE id=?', [targetId]);
            if (!pRows.length) return msg.reply('❌ Player not found.');
            const nick = pRows[0].nickname;
            // Fully delete — wins/losses wiped, as if they never joined
            await db.execute(
                "DELETE FROM tournament_players WHERE tournament_id=? AND player_id=?",
                [t.id, targetId]
            );
            await db.execute(
                "DELETE FROM tournament_matches WHERE tournament_id=? AND (player1_id=? OR player2_id=?)",
                [t.id, targetId, targetId]
            );
            // Demote from PvP group
            try {
                const { demoteAfterDuel } = require('../systems/pvpsystem');
                await demoteAfterDuel(client, [targetId]);
            } catch(e) {}
            const pvpGrp = process.env.PVP_GROUP_JID || getAnnouncementGroup(msg.from, t);
            await client.sendMessage(pvpGrp, {
                text:
                    `╔══〘 🚫 PLAYER REMOVED 〙══╗\n` +
                    `┃★\n` +
                    `┃★ *${nick}* has been removed\n` +
                    `┃★ from the tournament entirely.\n` +
                    `┃★ All match records wiped.\n` +
                    `┃★\n` +
                    `╚═══════════════════════════╝`
            }).catch(() => {});
            return msg.reply(`✅ *${nick}* fully removed from tournament.`);
        }

        // ── ADMIN: reset tournament ────────────────────────────────────────
        if (sub === 'reset') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply('❌ No active tournament.');
            await db.execute("DELETE FROM tournament_players WHERE tournament_id=?", [t.id]);
            await db.execute("DELETE FROM tournament_matches WHERE tournament_id=?", [t.id]);
            await db.execute("UPDATE tournaments SET phase='registration', phase_ends_at=DATE_ADD(NOW(), INTERVAL 1 DAY) WHERE id=?", [t.id]);
            return msg.reply(`✅ Tournament reset to registration phase. All players removed.`);
        }

        // ── ADMIN: end tournament ──────────────────────────────────────────
        if (sub === 'end') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply('❌ No active tournament.');
            await db.execute("UPDATE tournaments SET is_active=0, ended_at=NOW() WHERE id=?", [t.id]);
            return msg.reply(`✅ Tournament ended.`);
        }

        // ── ADMIN: force prizes now ────────────────────────────────────────
        if (sub === 'testprizes') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply('❌ No active tournament.');
            const { distributePrizes } = require('../systems/tournamentSystem');
            await distributePrizes(t.id, client, getAnnouncementGroup(msg.from, t));
            return msg.reply('✅ Prize distribution triggered.');
        }

        // ── PLAYERS LIST ──────────────────────────────────────────────────
        if (sub === 'players') {
            const t = await getActiveTournament(msg.from);
            if (!t) return msg.reply(`══〘 🏆 TOURNAMENT 〙══╮
┃★ No active tournament.
╰═══════════════════════╯`);

            const [all] = await db.execute(
                `SELECT tp.player_id, tp.wins, tp.losses, tp.eliminated, tp.duo_partner,
                        p.nickname, p.rank as playerRank, p.role
                 FROM tournament_players tp
                 JOIN players p ON p.id = tp.player_id
                 WHERE tp.tournament_id=?
                 ORDER BY tp.eliminated ASC, tp.wins DESC, p.nickname ASC`,
                [t.id]
            );

            if (!all.length) return msg.reply(
                `══〘 🏆 TOURNAMENT 〙══╮
┃★ No players registered yet.
╰═══════════════════════╯`
            );

            const active = all.filter(p => !p.eliminated);
            const eliminated = all.filter(p => p.eliminated);

            let text = `╔══〘 🏆 REGISTERED PLAYERS 〙══╗
┃★ Phase: ${t.phase.replace(/_/g,' ').toUpperCase()}
┃★ Total: ${all.length} | Active: ${active.length}
┃★
`;

            active.forEach((p, i) => {
                text += `┃★ ${i+1}. *${p.nickname}* [${p.playerRank}] ${p.role}
`;
                text += `┃★    ${p.wins}W ${p.losses}L${p.duo_partner ? ' 🤝' : ''}
`;
            });

            if (eliminated.length) {
                text += `┃★
┃★ ❌ ELIMINATED (${eliminated.length}):
`;
                eliminated.forEach(p => {
                    text += `┃★ • ${p.nickname}
`;
                });
            }

            text += `╚═══════════════════════════╝`;
            return msg.reply(text);
        }

        // ── DEFAULT VIEW ───────────────────────────────────────────────────
        const t = await getActiveTournament(msg.from);
        if (!t) return msg.reply(
            `══〘 🏆 TOURNAMENT 〙══╮\n` +
            `┃★ No active tournament.\n` +
            `┃★ Watch the announcement group.\n` +
            `╰═══════════════════════╯`
        );

        const players = await getActivePlayers(t.id);
        const [total] = await db.execute('SELECT COUNT(*) as cnt FROM tournament_players WHERE tournament_id=?', [t.id]);

        return msg.reply(
            `╔══〘 🏆 VOID TOURNAMENT 〙══╗\n` +
            `┃★\n` +
            `┃★ Phase: *${t.phase.replace(/_/g,' ').toUpperCase()}*\n` +
            `┃★ Ends:  ${t.phase_ends_at ? new Date(t.phase_ends_at).toDateString() : 'TBD'}\n` +
            `┃★\n` +
            `┃★ Registered: ${total[0].cnt}\n` +
            `┃★ Active:     ${players.length}\n` +
            `┃★\n` +
            `┃★ Commands:\n` +
            `┃★ !tournament join — enter\n` +
            `┃★ !tournament status — your rank\n` +
            `┃★ !tournament bracket — standings\n` +
            `┃★ !tournament duo @player — Duo phase\n` +
            `┃★\n` +
            `╚═══════════════════════════╝`
        );
    }
};