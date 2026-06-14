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

            const existing = await getActiveTournament();
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
            const t = await getActiveTournament();
            if (!t) return msg.reply('❌ No active tournament.');
            const next = await advancePhase(t, client, getAnnouncementGroup(msg.from, t));
            return msg.reply(`✅ Advanced to phase: *${next}*`);
        }

        // ── ADMIN: call matchup ────────────────────────────────────────────
        if (sub === 'matchup') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament();
            if (!t || t.phase !== PHASES.BATTLE_ROYALE) return msg.reply('❌ Only during Battle Royale phase.');

            const players = await getActivePlayers(t.id);
            if (players.length < 2) return msg.reply('❌ Not enough active players.');

            // Pick 2 players — avoid pairs who've already fought 3+ times
            const shuffled = [...players].sort(() => Math.random() - 0.5);
            let p1 = null, p2 = null;
            for (let i = 0; i < shuffled.length && !p2; i++) {
                for (let j = i + 1; j < shuffled.length && !p2; j++) {
                    const [prev] = await db.execute(
                        `SELECT COUNT(*) as cnt FROM tournament_matches WHERE tournament_id=? AND phase='battle_royale'
                         AND ((player1_id=? AND player2_id=?) OR (player1_id=? AND player2_id=?))`,
                        [t.id, shuffled[i].player_id, shuffled[j].player_id, shuffled[j].player_id, shuffled[i].player_id]
                    );
                    if (prev[0].cnt < 3) { p1 = shuffled[i]; p2 = shuffled[j]; }
                }
            }
            // Fallback: just pick first two if all pairs exhausted
            if (!p1) { p1 = shuffled[0]; p2 = shuffled[1]; }

            await client.sendMessage(getAnnouncementGroup(msg.from, t), {
                text:
                    `╔══〘 ⚔️ BATTLE ROYALE MATCHUP 〙══╗\n` +
                    `┃★\n` +
                    `┃★ ARIA calls the next fight:\n` +
                    `┃★\n` +
                    `┃★ ⚔️ *${p1.nickname}* [${p1.rank}]\n` +
                    `┃★       VS\n` +
                    `┃★ ⚔️ *${p2.nickname}* [${p2.rank}]\n` +
                    `┃★\n` +
                    `┃★ Use *!startduel @opponent*\n` +
                    `┃★ to begin. Winner gets +1 win.\n` +
                    `┃★\n` +
                    `╚═══════════════════════════╝`,
                mentions: [p1.player_id + '@s.whatsapp.net', p2.player_id + '@s.whatsapp.net']
            }).catch(() => {});

            // Record this matchup to prevent repeat pairing
            if (p1 && p2) {
                await db.execute(
                    "INSERT INTO tournament_matches (tournament_id, phase, player1_id, player2_id, status) VALUES (?,?,?,?,'active')",
                    [t.id, 'battle_royale', p1.player_id, p2.player_id]
                ).catch(() => {});
            }
            return msg.reply('✅ Matchup called.');
        }

        // ── ADMIN: record win ──────────────────────────────────────────────
        if (sub === 'recordwin') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament();
            if (!t) return msg.reply('❌ No active tournament.');
            const winnerId = msg.mentionedIds?.[0];
            const loserId  = msg.mentionedIds?.[1];
            if (!winnerId || !loserId) return msg.reply('❌ !tournament recordwin @winner @loser');
            await recordMatchResult(t.id, winnerId, loserId, t.phase);
            const [wRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [winnerId]);
            const [lRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [loserId]);
            return msg.reply(`✅ Recorded: *${wRow[0]?.nickname}* beat *${lRow[0]?.nickname}*`);
        }

        // ── JOIN ───────────────────────────────────────────────────────────
        if (sub === 'join') {
            const t = await getActiveTournament();
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

        // ── DUO ───────────────────────────────────────────────────────────
        if (sub === 'duo') {
            const t = await getActiveTournament();
            if (!t || t.phase !== PHASES.DUO_GAUNTLET) return msg.reply(
                `══〘 🏆 TOURNAMENT 〙══╮\n┃★ Duo registration not open yet.\n╰═══════════════════════╯`
            );

            const partnerId = msg.mentionedIds?.[0];
            if (!partnerId) return msg.reply('❌ !tournament duo @partner');
            if (partnerId === userId) return msg.reply('❌ You cannot duo with yourself.');

            const [player] = await db.execute('SELECT nickname FROM players WHERE id=?', [userId]);
            const [partner] = await db.execute('SELECT nickname FROM players WHERE id=?', [partnerId]);
            if (!partner.length) return msg.reply('❌ Partner not found.');

            // Both players must be active tournament participants
            const selfEntry = await getParticipant(t.id, userId);
            if (!selfEntry || selfEntry.eliminated || selfEntry.duo_partner) return msg.reply(
                `══〘 🏆 TOURNAMENT 〙══╮\n┃★ ❌ You are not in the tournament or have been eliminated.\n╰═══════════════════════╯`
            );
            const partnerEntry = await getParticipant(t.id, partnerId);
            if (!partnerEntry || partnerEntry.eliminated) return msg.reply(
                `══〘 🏆 TOURNAMENT 〙══╮\n┃★ ❌ *${partner[0].nickname}* is not in the tournament or has been eliminated.\n╰═══════════════════════╯`
            );
            if (partnerEntry.duo_partner) return msg.reply(
                `══〘 🏆 TOURNAMENT 〙══╮\n┃★ ❌ *${partner[0].nickname}* already has a duo partner.\n╰═══════════════════════╯`
            );

            // Set duo_partner for self
            await db.execute(
                "UPDATE tournament_players SET duo_partner=? WHERE tournament_id=? AND player_id=?",
                [partnerId, t.id, userId]
            );
            // Set duo_partner for partner (upsert handles existing or new entry)
            await db.execute(
                "INSERT INTO tournament_players (tournament_id, player_id, duo_partner, phase_joined) VALUES (?,?,?,'duo_gauntlet') ON DUPLICATE KEY UPDATE duo_partner=?",
                [t.id, partnerId, userId, userId]
            );

            return msg.reply(
                `╔══〘 🤝 DUO REGISTERED 〙══╗\n` +
                `┃★\n` +
                `┃★ *${player[0]?.nickname}* + *${partner[0].nickname}*\n` +
                `┃★ entered as a duo.\n` +
                `┃★\n` +
                `┃★ Fight together. Fall together.\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── STATUS ─────────────────────────────────────────────────────────
        if (sub === 'status') {
            const t = await getActiveTournament();
            if (!t) return msg.reply(`══〘 🏆 TOURNAMENT 〙══╮\n┃★ No active tournament.\n╰═══════════════════════╯`);

            const me = await getParticipant(t.id, userId);
            if (!me) return msg.reply(`══〘 🏆 TOURNAMENT 〙══╮\n┃★ You are not registered.\n┃★ !tournament join\n╰═══════════════════════╯`);

            const players = await getActivePlayers(t.id);
            const myRank = players.findIndex(p => p.player_id === userId) + 1;

            return msg.reply(
                `╔══〘 🏆 YOUR STANDING 〙══╗\n` +
                `┃★\n` +
                `┃★ Phase: *${t.phase.replace(/_/g,' ').toUpperCase()}*\n` +
                `┃★\n` +
                `┃★ Wins:   ${me.wins}\n` +
                `┃★ Losses: ${me.losses}\n` +
                `┃★ Rank:   #${myRank} of ${players.length} active\n` +
                `┃★ Status: ${me.eliminated ? '❌ Eliminated' : '✅ Active'}\n` +
                `┃★\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── BRACKET ───────────────────────────────────────────────────────
        if (sub === 'bracket') {
            const t = await getActiveTournament();
            if (!t) return msg.reply(`══〘 🏆 TOURNAMENT 〙══╮\n┃★ No active tournament.\n╰═══════════════════════╯`);

            const players = await getActivePlayers(t.id);
            const top = players.slice(0, 15);

            let text = `╔══〘 🏆 STANDINGS 〙══╗\n┃★ Phase: ${t.phase.replace(/_/g,' ').toUpperCase()}\n┃★\n`;
            top.forEach((p, i) => {
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
                text += `┃★ ${medal} *${p.nickname}* — ${p.wins}W ${p.losses}L\n`;
            });
            const totalActive = players.length;
            text += `┃★\n┃★ ${totalActive} hunters still standing\n╚═══════════════════════════╝`;
            return msg.reply(text);
        }

        // ── ADMIN: force phase ────────────────────────────────────────────
        if (sub === 'forcephase') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament();
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
            const t = await getActiveTournament();
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
            const t = await getActiveTournament();
            if (!t) return msg.reply('❌ No active tournament.');
            const targetId = msg.mentionedIds?.[0] || userId;
            const wins = parseInt(args[1]) || 3;
            await db.execute(
                "UPDATE tournament_players SET wins=? WHERE tournament_id=? AND player_id=?",
                [wins, t.id, targetId]
            );
            return msg.reply(`✅ Set wins to ${wins} for player.`);
        }

        // ── ADMIN: eliminate player ────────────────────────────────────────
        if (sub === 'eliminate') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament();
            if (!t) return msg.reply('❌ No active tournament.');
            const targetId = msg.mentionedIds?.[0];
            if (!targetId) return msg.reply('❌ !tournament eliminate @player');
            await db.execute(
                "UPDATE tournament_players SET eliminated=1 WHERE tournament_id=? AND player_id=?",
                [t.id, targetId]
            );
            const [p] = await db.execute('SELECT nickname FROM players WHERE id=?', [targetId]);
            return msg.reply(`✅ *${p[0]?.nickname}* eliminated from tournament.`);
        }

        // ── ADMIN: reset tournament ────────────────────────────────────────
        if (sub === 'reset') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament();
            if (!t) return msg.reply('❌ No active tournament.');
            await db.execute("DELETE FROM tournament_players WHERE tournament_id=?", [t.id]);
            await db.execute("DELETE FROM tournament_matches WHERE tournament_id=?", [t.id]);
            await db.execute("UPDATE tournaments SET phase='registration', phase_ends_at=DATE_ADD(NOW(), INTERVAL 1 DAY) WHERE id=?", [t.id]);
            return msg.reply(`✅ Tournament reset to registration phase. All players removed.`);
        }

        // ── ADMIN: end tournament ──────────────────────────────────────────
        if (sub === 'end') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament();
            if (!t) return msg.reply('❌ No active tournament.');
            await db.execute("UPDATE tournaments SET is_active=0, ended_at=NOW() WHERE id=?", [t.id]);
            return msg.reply(`✅ Tournament ended.`);
        }

        // ── ADMIN: force prizes now ────────────────────────────────────────
        if (sub === 'testprizes') {
            if (!isAdmin) return msg.reply('❌ Admin only.');
            const t = await getActiveTournament();
            if (!t) return msg.reply('❌ No active tournament.');
            const { distributePrizes } = require('../systems/tournamentSystem');
            await distributePrizes(t.id, client, getAnnouncementGroup(msg.from, t));
            return msg.reply('✅ Prize distribution triggered.');
        }

        // ── PLAYERS LIST ──────────────────────────────────────────────────
        if (sub === 'players') {
            const t = await getActiveTournament();
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
        const t = await getActiveTournament();
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