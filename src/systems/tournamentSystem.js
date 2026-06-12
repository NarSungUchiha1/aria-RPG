/**
 * VOID TOURNAMENT SYSTEM
 *
 * 3-phase week-long tournament:
 *   Phase 1 (Day 1-2): BATTLE ROYALE  — FFA, most wins advance
 *   Phase 2 (Day 3-4): DUO GAUNTLET   — paired teams, last 4 duos advance
 *   Phase 3 (Day 5-6): GRAND FINALS   — single elimination bracket, top 8
 *   Day 7:             AWARDS          — prizes distributed
 *
 * Prize Pool:
 *   🥇 Champion:     200,000G + 50,000 XP + Void Crown weapon + 20 Void Crystals
 *   🥈 Runner-up:    100,000G + 25,000 XP + Fracture Blade weapon + 10 Void Crystals
 *   🥉 Semi-finals:  50,000G  + 15,000 XP + 5 Void Crystals each
 *   ⚔️ Top 8:        25,000G  + 10,000 XP
 *   🎖️ Participation: 5,000G  + 2,000 XP
 */

const db = require('../database/db');

const PHASES = {
    REGISTRATION: 'registration',
    BATTLE_ROYALE: 'battle_royale',
    DUO_GAUNTLET: 'duo_gauntlet',
    GRAND_FINALS: 'grand_finals',
    AWARDS: 'awards',
    ENDED: 'ended'
};

const PRIZE_POOL = {
    champion:      { gold: 1500000, xp: 1500000, materials: { 'Void Crystal': 50, 'Ancient Tome Fragment': 10 }, weapon: 'Void Crown' },
    runner_up:     { gold: 750000,  xp: 750000,  materials: { 'Void Crystal': 30, 'Ancient Tome Fragment': 5  }, weapon: 'Fracture Sovereign' },
    semi_finalist: { gold: 350000,  xp: 350000,  materials: { 'Void Crystal': 15 }, weapon: null },
    top_8:         { gold: 150000,  xp: 150000,  materials: { 'Void Crystal': 5, 'Malachar Fragment': 3 }, weapon: null },
    participant:   { gold: 25000,   xp: 25000,   materials: { 'Void Dust': 5     }, weapon: null },
};

async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS tournaments (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            name         VARCHAR(100) NOT NULL,
            phase        VARCHAR(30) DEFAULT 'registration',
            phase_ends_at DATETIME,
            started_at   DATETIME DEFAULT NOW(),
            ended_at     DATETIME DEFAULT NULL,
            is_active    TINYINT DEFAULT 1
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS tournament_players (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            tournament_id INT NOT NULL,
            player_id     VARCHAR(60) NOT NULL,
            duo_partner   VARCHAR(60) DEFAULT NULL,
            wins          INT DEFAULT 0,
            losses        INT DEFAULT 0,
            eliminated    TINYINT DEFAULT 0,
            phase_joined  VARCHAR(30) DEFAULT 'battle_royale',
            prize_claimed TINYINT DEFAULT 0,
            UNIQUE KEY unique_entry (tournament_id, player_id)
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS tournament_matches (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            tournament_id INT NOT NULL,
            phase         VARCHAR(30) NOT NULL,
            player1_id    VARCHAR(60) NOT NULL,
            player2_id    VARCHAR(60) NOT NULL,
            winner_id     VARCHAR(60) DEFAULT NULL,
            status        ENUM('pending','active','completed') DEFAULT 'pending',
            round         INT DEFAULT 1,
            scheduled_at  DATETIME DEFAULT NOW(),
            completed_at  DATETIME DEFAULT NULL,
            INDEX (tournament_id, phase)
        )
    `).catch(() => {});
}

async function getActiveTournament() {
    await ensureTables();
    const [rows] = await db.execute(
        "SELECT * FROM tournaments WHERE is_active=1 ORDER BY id DESC LIMIT 1"
    );
    return rows[0] || null;
}

async function getParticipant(tournamentId, playerId) {
    const [rows] = await db.execute(
        "SELECT * FROM tournament_players WHERE tournament_id=? AND player_id=?",
        [tournamentId, playerId]
    );
    return rows[0] || null;
}

async function getActivePlayers(tournamentId) {
    const [rows] = await db.execute(
        "SELECT tp.*, p.nickname, p.rank, p.role, p.prestige_level FROM tournament_players tp JOIN players p ON p.id=tp.player_id WHERE tp.tournament_id=? AND tp.eliminated=0 ORDER BY tp.wins DESC",
        [tournamentId]
    );
    return rows;
}

async function advancePhase(tournament, client, raidGroup) {
    const phases = [PHASES.REGISTRATION, PHASES.BATTLE_ROYALE, PHASES.DUO_GAUNTLET, PHASES.GRAND_FINALS, PHASES.AWARDS, PHASES.ENDED];
    const nextIdx = phases.indexOf(tournament.phase) + 1;
    const nextPhase = phases[nextIdx] || PHASES.ENDED;

    // Phase end time
    const phaseDays = {
        [PHASES.BATTLE_ROYALE]: 2,
        [PHASES.DUO_GAUNTLET]:  2,
        [PHASES.GRAND_FINALS]:  2,
        [PHASES.AWARDS]:        1,
    };
    const daysForNext = phaseDays[nextPhase] || 1;
    const phaseEnds = new Date(Date.now() + daysForNext * 24 * 60 * 60 * 1000);

    await db.execute(
        "UPDATE tournaments SET phase=?, phase_ends_at=? WHERE id=?",
        [nextPhase, phaseEnds, tournament.id]
    );

    // When leaving BATTLE_ROYALE: eliminate bottom half by wins
    if (tournament.phase === PHASES.BATTLE_ROYALE) {
        const active = await getActivePlayers(tournament.id);
        if (active.length > 1) {
            const cutLine = Math.ceil(active.length / 2);
            const toEliminate = active.slice(cutLine); // sorted by wins DESC, so bottom half
            for (const p of toEliminate) {
                await db.execute(
                    "UPDATE tournament_players SET eliminated=1 WHERE tournament_id=? AND player_id=?",
                    [tournament.id, p.player_id]
                );
            }
            console.log(`[TOURNAMENT] Cut ${toEliminate.length} players after Battle Royale.`);
        }
    }

    // When leaving DUO_GAUNTLET: keep only top 4 duos (8 players)
    if (tournament.phase === PHASES.DUO_GAUNTLET) {
        const active = await getActivePlayers(tournament.id);
        const cutLine = 8;
        if (active.length > cutLine) {
            const toEliminate = active.slice(cutLine);
            for (const p of toEliminate) {
                await db.execute(
                    "UPDATE tournament_players SET eliminated=1 WHERE tournament_id=? AND player_id=?",
                    [tournament.id, p.player_id]
                );
            }
        }
    }

    await handlePhaseStart(nextPhase, tournament.id, client, raidGroup);
    return nextPhase;
}

async function handlePhaseStart(phase, tournamentId, client, raidGroup) {
    if (phase === PHASES.BATTLE_ROYALE) {
        const players = await getActivePlayers(tournamentId);
        await client.sendMessage(raidGroup, {
            text:
                `╔══〘 ⚔️ BATTLE ROYALE BEGINS 〙══╗\n` +
                `┃★\n` +
                `┃★ ${players.length} hunters enter.\n` +
                `┃★ Only the strong advance.\n` +
                `┃★\n` +
                `┃★ ARIA will call matchups.\n` +
                `┃★ Win your fights. Survive.\n` +
                `┃★ Bottom half will be cut.\n` +
                `┃★\n` +
                `┃★ Use *!tournament status* to\n` +
                `┃★ see your standing.\n` +
                `╚═══════════════════════════╝`
        }).catch(() => {});

    } else if (phase === PHASES.DUO_GAUNTLET) {
        await client.sendMessage(raidGroup, {
            text:
                `╔══〘 🤝 DUO GAUNTLET BEGINS 〙══╗\n` +
                `┃★\n` +
                `┃★ The lone wolves fall.\n` +
                `┃★ Now you need a partner.\n` +
                `┃★\n` +
                `┃★ Register your duo:\n` +
                `┃★ *!tournament duo @partner*\n` +
                `┃★\n` +
                `┃★ Last 4 duos standing\n` +
                `┃★ enter the Grand Finals.\n` +
                `╚═══════════════════════════╝`
        }).catch(() => {});

    } else if (phase === PHASES.GRAND_FINALS) {
        const survivors = await getActivePlayers(tournamentId);
        const top8 = survivors.slice(0, 8);

        let bracket = `╔══〘 🏆 GRAND FINALS BRACKET 〙══╗\n┃★\n`;
        for (let i = 0; i < top8.length; i += 2) {
            const p1 = top8[i];
            const p2 = top8[i + 1];
            if (p1 && p2) {
                bracket += `┃★ ⚔️ *${p1.nickname}* [${p1.rank}] vs *${p2.nickname}* [${p2.rank}]\n`;
            } else if (p1) {
                // Bye — auto-advance with a win
                bracket += `┃★ ✅ *${p1.nickname}* — bye (auto-advances)\n`;
                await db.execute(
                    "UPDATE tournament_players SET wins=wins+1 WHERE tournament_id=? AND player_id=?",
                    [tournamentId, p1.player_id]
                );
            }
        }
        bracket += `┃★\n┃★ *!attack <move>* to fight!\n╚═══════════════════════════╝`;

        await client.sendMessage(raidGroup, { text: bracket }).catch(() => {});

    } else if (phase === PHASES.AWARDS) {
        await distributePrizes(tournamentId, client, raidGroup);

    } else if (phase === PHASES.ENDED) {
        await db.execute("UPDATE tournaments SET is_active=0, ended_at=NOW() WHERE id=?", [tournamentId]);
    }
}

async function distributePrizes(tournamentId, client, raidGroup) {
    const players = await getActivePlayers(tournamentId);
    const all = await db.execute(
        "SELECT tp.*, p.nickname FROM tournament_players tp JOIN players p ON p.id=tp.player_id WHERE tp.tournament_id=? ORDER BY tp.wins DESC, tp.losses ASC",
        [tournamentId]
    );
    const ranked = all[0];

    let text = `╔══〘 🏆 VOID TOURNAMENT RESULTS 〙══╗\n┃★\n`;

    for (let i = 0; i < ranked.length; i++) {
        const p = ranked[i];
        let tier = i === 0 ? 'champion' : i === 1 ? 'runner_up' : i < 4 ? 'semi_finalist' : i < 8 ? 'top_8' : 'participant';
        const prize = PRIZE_POOL[tier];

        await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [prize.gold, p.player_id]).catch(() => {});
        await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [prize.xp, p.player_id]).catch(() => {});

        // Give materials
        for (const [mat, qty] of Object.entries(prize.materials || {})) {
            await db.execute(
                "INSERT INTO inventory (player_id, item_name, item_type, quantity) VALUES (?,?,'material',?) ON DUPLICATE KEY UPDATE quantity=quantity+?",
                [p.player_id, mat, qty, qty]
            ).catch(() => {});
        }

        // Give exclusive weapon to top 2
        if (prize.weapon) {
            await db.execute(
                "INSERT INTO inventory (player_id, item_name, item_type, quantity, grade) VALUES (?,?,'weapon',1,'P')",
                [p.player_id, prize.weapon]
            ).catch(() => {});
        }

        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 || i === 3 ? '🥉' : i < 8 ? '⚔️' : '🎖️';
        text += `┃★ ${medal} *${p.nickname}* — ${prize.gold.toLocaleString()}G + ${prize.xp.toLocaleString()} XP`;
        if (prize.weapon) text += ` + ${prize.weapon}`;
        text += `\n`;
    }

    text += `┃★\n┃★ Thank you for competing.\n┃★ The void remembers.\n╚═══════════════════════════╝`;
    await client.sendMessage(raidGroup, { text }).catch(() => {});
}

async function recordMatchResult(tournamentId, winnerId, loserId, phase) {
    await db.execute(
        "UPDATE tournament_players SET wins=wins+1 WHERE tournament_id=? AND player_id=?",
        [tournamentId, winnerId]
    );
    await db.execute(
        "UPDATE tournament_players SET losses=losses+1 WHERE tournament_id=? AND player_id=?",
        [tournamentId, loserId]
    );

    // In Grand Finals — loser is eliminated
    if (phase === PHASES.GRAND_FINALS) {
        await db.execute(
            "UPDATE tournament_players SET eliminated=1 WHERE tournament_id=? AND player_id=?",
            [tournamentId, loserId]
        );
    }
}

module.exports = {
    PHASES, PRIZE_POOL,
    ensureTables, getActiveTournament, getParticipant,
    getActivePlayers, advancePhase, recordMatchResult,
    distributePrizes, handlePhaseStart
};