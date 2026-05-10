const db = require('../database/db');
const { narrate } = require('../utils/narrator');
const { calculateMoveDamage, calculateHeal } = require('./skillSystem');
const { applyBuff, getBuffModifiers } = require('./activeBuffs');
const { increasePlayerFatigue, getFatigueMultiplier, formatFatigueBar, clampFatigue } = require('./fatigueSystem');
const { getPlayerClan, CLAN_BLESSINGS } = require('./clanSystem');

// ── Duel State ────────────────────────────────────────────────────────────────
// activeDuels: playerId -> { teamA, teamB, turn, chat, duelKey }
// duelPool:    duelKey  -> { hp, bet, round, teamA, teamB, turnOrder, type }
const activeDuels = new Map();
const duelPool    = new Map();
const turnTimers  = new Map(); // duelKey -> timeout
const duelBlessingStates = new Map();

// ── Party Assembly State ──────────────────────────────────────────────────────
// Holds both teams during the 2-minute assembly window before a party duel starts.
// assemblyKey (= pvp_challenges.team_key) → { teamA, teamB, teamALeader, teamBLeader,
//   teamAReady, teamBReady, bet, chat, timer }
const partyAssembly = new Map();
const ASSEMBLY_TIMEOUT_MS = 120000; // 2 minutes

const DUEL_HP = 1500; // fallback only

// Normal player duel HP scales with rank — S rank has more HP than F rank
const RANK_DUEL_HP = {
    F: 800,  E: 1000, D: 1350, C: 1750,
    B: 2300, A: 2900, S: 3600
};

// PvP damage multiplier — stacks on top of calculateMoveDamage's stat-based output.
// Creates a real power gap between ranks and an enormous gap between normal and prestige.
const PVP_DMG_MULT = {
    F: 1.0,  E: 1.1,  D: 1.25, C: 1.45,
    B: 1.7,  A: 2.0,  S: 2.4,
    PF: 3.2, PE: 3.6, PD: 4.0, PC: 4.4,
    PB: 4.8, PA: 5.2, PS: 5.8
};

// Get effective duel HP — prestige players use their real max_hp, normal players use rank-scaled HP
async function getDuelHp(playerId) {
    const [rows] = await db.execute(
        'SELECT max_hp, COALESCE(prestige_level,0) as prestige_level, `rank` FROM players WHERE id=?',
        [playerId]
    );
    if (!rows.length) return DUEL_HP;
    if (rows[0].prestige_level > 0) return Number(rows[0].max_hp);
    return RANK_DUEL_HP[rows[0].rank] || DUEL_HP;
}

function normalizeIds(ids) {
    return Array.isArray(ids) ? ids.map(id => String(id)) : [];
}

function getDuelKeyFromTeams(teamA, teamB) {
    const allIds = [...normalizeIds(teamA), ...normalizeIds(teamB)];
    return allIds.sort().join('_vs_');
}

function createTurnOrder(teamAPlayers, teamBPlayers) {
    const sortByAgility = arr => [...arr].sort((a, b) => (b.agility || 0) - (a.agility || 0));
    const teamA = sortByAgility(teamAPlayers);
    const teamB = sortByAgility(teamBPlayers);
    const maxLen = Math.max(teamA.length, teamB.length);
    const order = [];
    for (let i = 0; i < maxLen; i++) {
        if (teamA[i]) order.push(teamA[i].id);
        if (teamB[i]) order.push(teamB[i].id);
    }
    return order;
}

function getDuelBlessingState(playerId) {
    const key = String(playerId);
    if (!duelBlessingStates.has(key)) {
        duelBlessingStates.set(key, { hit_count: 0, skill_count: 0, blessing_used: 0, last_triggered: null });
    }
    return duelBlessingStates.get(key);
}

function updateDuelBlessingState(playerId, updates) {
    const state = getDuelBlessingState(playerId);
    Object.assign(state, updates);
    duelBlessingStates.set(String(playerId), state);
}

function clearDuelBlessingState(playerId) {
    duelBlessingStates.delete(String(playerId));
}

function findNextAlivePlayer(duelKey, currentId) {
    const data = duelPool.get(duelKey);
    if (!data || !Array.isArray(data.turnOrder)) return null;
    const order = data.turnOrder;
    const startIndex = order.indexOf(currentId);
    if (startIndex === -1) return null;
    for (let i = 1; i < order.length; i++) {
        const nextId = order[(startIndex + i) % order.length];
        if (data.hp[nextId] > 0) return nextId;
    }
    return null;
}

function getTeamForPlayer(duelKey, playerId) {
    const data = duelPool.get(duelKey);
    if (!data) return null;
    const pid = String(playerId);
    if (data.teamA.includes(pid)) return data.teamA;
    if (data.teamB.includes(pid)) return data.teamB;
    return null;
}

function getOpponentTeam(duelKey, playerId) {
    const data = duelPool.get(duelKey);
    if (!data) return null;
    const pid = String(playerId);
    if (data.teamA.includes(pid)) return data.teamB;
    if (data.teamB.includes(pid)) return data.teamA;
    return null;
}

function getCurrentOpponentId(duelKey, playerId) {
    const enemies = getOpponentTeam(duelKey, playerId);
    if (!enemies || !enemies.length) return null;
    const data = duelPool.get(duelKey);
    if (!data) return null;
    return enemies.find(id => data.hp[id] > 0) || enemies[0];
}

function getDuelOpponent(playerId) {
    const duel = activeDuels.get(playerId);
    if (!duel) return null;
    return getCurrentOpponentId(duel.duelKey, playerId);
}

function clearDuelActiveByKey(duelKey) {
    const data = duelPool.get(duelKey);
    if (!data) return;
    clearTurnTimer(duelKey);
    [...data.teamA, ...data.teamB].forEach(id => activeDuels.delete(id));
    duelPool.delete(duelKey);
    [...data.teamA, ...data.teamB].forEach(id => clearDuelBlessingState(id));
}

const TURN_LIMIT_MS = 20000; // 20 seconds per turn

function getDuelKey(p1, p2) {
    if (Array.isArray(p1) || Array.isArray(p2)) {
        return getDuelKeyFromTeams(p1, p2);
    }
    return [String(p1), String(p2)].sort().join('_vs_');
}

function clearTurnTimer(duelKey) {
    if (turnTimers.has(duelKey)) {
        clearTimeout(turnTimers.get(duelKey));
        turnTimers.delete(duelKey);
    }
}

async function startTurnTimer(duelKey, currentTurnId, opponentId, chat, round) {
    clearTurnTimer(duelKey);

    const timer = setTimeout(async () => {
        // Check duel still active and it's still the same player's turn
        const duel = activeDuels.get(currentTurnId);
        if (!duel || duel.turn !== currentTurnId) return;

        const data = duelPool.get(duelKey);
        if (!data) return;

        try {
            const [pRows] = await db.execute("SELECT nickname FROM players WHERE id=?", [currentTurnId]);
            const [oRows] = await db.execute("SELECT nickname FROM players WHERE id=?", [opponentId]);
            const pNick = pRows[0]?.nickname || currentTurnId;
            const oNick = oRows[0]?.nickname || opponentId;

            // Time out = forfeit, opponent wins
            clearDuelActiveByKey(duelKey);

            // Return bets if any
            if (data.bet > 0) {
                await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [data.bet, currentTurnId]);
                await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [data.bet, opponentId]);
            }

            await chat.sendMessage(
                `══〘 ⏰ DUEL TIMEOUT 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ *${pNick}* ran out of time!\n` +
                `┃◆ They had 20 seconds to act.\n` +
                `┃◆ \n` +
                `┃◆ 🏳️ *${pNick}* forfeits the duel.\n` +
                `┃◆ 🏆 *${oNick}* wins by default!\n` +
                `${data.bet > 0 ? '┃◆ 💰 Bets refunded to both players.\n' : ''}` +
                `┃◆ \n` +
                `╰═══════════════════════╯`
            );

            await db.execute("UPDATE players SET pvp_losses = pvp_losses + 1 WHERE id=?", [currentTurnId]);
            await db.execute("UPDATE players SET pvp_wins   = pvp_wins   + 1 WHERE id=?", [opponentId]);
            await trackPvPWin(opponentId);
        } catch (e) {
            console.error("Turn timer error:", e.message);
        }
    }, TURN_LIMIT_MS);

    turnTimers.set(duelKey, timer);
}

async function setDuelActive(teamAIds, teamBIds, chat, betAmount, turnOrder) {
    const key = getDuelKey(teamAIds, teamBIds);
    const normalizedA = normalizeIds(teamAIds);
    const normalizedB = normalizeIds(teamBIds);
    const hp = {};
    const maxHp = {};
    for (const id of [...normalizedA, ...normalizedB]) {
        const playerHp = await getDuelHp(id);
        hp[id] = playerHp;
        maxHp[id] = playerHp;
    }

    duelPool.set(key, {
        hp,
        maxHp,
        bet: betAmount,
        round: 1,
        teamA: normalizedA,
        teamB: normalizedB,
        turnOrder,
        type: (normalizedA.length > 1 || normalizedB.length > 1) ? 'party' : 'solo'
    });

    for (const id of [...normalizedA, ...normalizedB]) {
        activeDuels.set(id, { teamA: normalizedA, teamB: normalizedB, turn: null, chat, duelKey: key });
    }
}

function clearDuelActive(p1Id, p2Id) {
    const key = getDuelKey(p1Id, p2Id);
    clearDuelActiveByKey(key);
}

function setTurn(duelKey, turnId) {
    const data = duelPool.get(duelKey);
    if (!data) return;
    for (const id of [...data.teamA, ...data.teamB]) {
        const duel = activeDuels.get(id);
        if (duel) duel.turn = turnId;
    }
}


function isPlayerInDuel(playerId) {
    return activeDuels.has(playerId);
}

// ── Title System ──────────────────────────────────────────────────────────────
const coolTitles = [
    "Duelist", "Gladiator", "Champion", "Vanquisher", "Warlord",
    "Executioner", "Blade Master", "Arena Legend", "Skullcrusher",
    "Blood Champion", "Iron Fist", "Stormbringer", "Shadow Stalker",
    "Void Walker", "Soul Reaper", "Doom Herald", "Eternal Victor"
];

async function checkAndGrantTitle(playerId) {
    const [rows] = await db.execute("SELECT pvp_wins, title FROM players WHERE id=?", [playerId]);
    if (!rows.length) return null;
    const wins = rows[0].pvp_wins || 0;
    const currentTitle = rows[0].title;
    if (wins >= 5 && (!currentTitle || wins % 5 === 0)) {
        const newTitle = coolTitles[Math.floor(Math.random() * coolTitles.length)];
        await db.execute("UPDATE players SET title=? WHERE id=?", [newTitle, playerId]);
        return newTitle;
    }
    return null;
}

// ── Quest tracking ────────────────────────────────────────────────────────────
async function trackPvPWin(winnerId) {
    try {
        const { updateQuestProgress } = require('./questSystem');
        await updateQuestProgress(winnerId, 'pvp_win', 1, null);
    } catch (e) {}
}

async function triggerBlessingIfReadyInDuel(trigger, player, data, extraData = {}) {
    const clan = await getPlayerClan(player.id);
    if (!clan) return null;
    const blessing = CLAN_BLESSINGS[clan.blessing_id];
    if (!blessing || blessing.trigger !== trigger) return null;
    if (blessing.prestige_only && !(player.prestige_level > 0)) return null;

    const state = getDuelBlessingState(player.id);
    if (['hp_below_30','on_death','final_stage','all_allies_below_50'].includes(trigger) && state.blessing_used) return null;

    const enemies = data.teamA.includes(String(player.id)) ? data.teamB : data.teamA;
    const allies = data.teamA.includes(String(player.id)) ? data.teamA : data.teamB;
    const aliveEnemies = enemies.filter(id => data.hp[id] > 0);
    const primaryStatKey = {
        Berserker: 'strength', Assassin: 'agility', Mage: 'intelligence', Healer: 'intelligence', Tank: 'stamina'
    }[player.role] || 'strength';
    const primaryStat = Number(player[primaryStatKey]) || 100;
    let blessingMsg = null;

    if (trigger === 'hp_below_30') {
        const damage = Math.max(1, Math.floor(primaryStat * (blessing.multiplier || 5.0)));
        aliveEnemies.forEach(id => {
            data.hp[id] = Math.max(0, data.hp[id] - damage);
        });
        blessingMsg = `╔══〘 🐉 DRAGON'S BREATH 〙══╗\n┃◆ ${player.nickname} explodes in draconic fury!\n┃◆ ${damage} damage dealt to all enemies!\n╚═══════════════════════════╝`;
        updateDuelBlessingState(player.id, { blessing_used: 1 });
    }

    if (trigger === 'on_kill') {
        const damage = Math.max(1, Math.floor(primaryStat * (blessing.multiplier || 3.0)));
        aliveEnemies.forEach(id => {
            data.hp[id] = Math.max(0, data.hp[id] - damage);
        });
        blessingMsg = `╔══〘 🌑 VOID COLLAPSE 〙══╗\n┃◆ ${player.nickname} collapses the arena!\n┃◆ ${damage} damage to all remaining enemies!\n╚═══════════════════════════╝`;
        updateDuelBlessingState(player.id, { blessing_used: 1 });
    }

    if (trigger === 'enemy_below_25' && extraData.targetId) {
        const targetId = String(extraData.targetId);
        if (data.hp[targetId] > 0 && data.hp[targetId] <= Math.floor(data.maxHp[targetId] * 0.25)) {
            data.hp[targetId] = 0;
            blessingMsg = `╔══〘 💀 REAPER'S MARK 〙══╗\n┃◆ ${player.nickname} finishes off ${extraData.targetName}!\n┃◆ Execution completed.\n╚═══════════════════════════╝`;
            updateDuelBlessingState(player.id, { blessing_used: 1 });
        }
    }

    if (trigger === 'every_5_skills') {
        const newCount = (state.skill_count || 0) + 1;
        updateDuelBlessingState(player.id, { skill_count: newCount });
        if (newCount % 5 === 0) {
            const damage = Math.max(1, Math.floor((player.intelligence || 100) * (blessing.multiplier || 4.5)));
            aliveEnemies.forEach(id => {
                data.hp[id] = Math.max(0, data.hp[id] - damage);
            });
            blessingMsg = `╔══〘 ☄️ HEAVEN'S FALL 〙══╗\n┃◆ ${player.nickname} calls down celestial fire!\n┃◆ ${damage} damage to all enemies!\n╚═══════════════════════════╝`;
        }
    }

    if (trigger === 'on_healed') {
        const healAmt = extraData.healAmount || 0;
        if (aliveEnemies.length) {
            const targetId = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
            const dmg = Math.max(1, Math.floor(healAmt * (blessing.heal_multiplier || 2.0)));
            data.hp[targetId] = Math.max(0, data.hp[targetId] - dmg);
            blessingMsg = `╔══〘 🕳️ ABYSSAL HUNGER 〙══╗\n┃◆ ${player.nickname} turns healing into void strike!\n┃◆ ${dmg} damage to an enemy!\n╚═══════════════════════════╝`;
        }
    }

    if (trigger === 'on_death') {
        const reviveHp = Math.max(1, Math.floor(data.maxHp[player.id] * (blessing.heal_percent || 0.6)));
        data.hp[player.id] = reviveHp;
        applyBuff('player', player.id, {
            type: 'buff',
            stat: 'all',
            value: Math.floor((blessing.stat_boost_percent || 6.0) * 100),
            duration: blessing.stat_boost_duration || 3,
            source: 'clan_blessing'
        });
        if (extraData.attackerId) {
            const counterDamage = Math.max(1, Math.floor((player.strength || 100) * (blessing.multiplier || 6.0)));
            data.hp[extraData.attackerId] = Math.max(0, data.hp[extraData.attackerId] - counterDamage);
        }
        blessingMsg = `╔══〘 👻 PHANTOM SHIFT 〙══╗\n┃◆ ${player.nickname} refuses to fall!\n┃◆ Revived at ${reviveHp} HP.\n┃◆ All stats empowered for ${blessing.stat_boost_duration || 3} turns.\n╚═══════════════════════════╝`;
        updateDuelBlessingState(player.id, { blessing_used: 1 });
    }

    if (trigger === 'all_allies_below_50') {
        const allLow = allies.length > 0 && allies.every(id => data.hp[id] > 0 && data.hp[id] <= Math.floor(data.maxHp[id] * 0.5));
        if (allLow) {
            applyBuff('player', player.id, {
                type: 'buff',
                stat: 'all',
                value: 200,
                duration: 2,
                source: 'clan_blessing'
            });
            blessingMsg = `╔══〘 👁️ MALACHAR'S WILL 〙══╗\n┃◆ ${player.nickname} channels desperation into might!\n┃◆ Power surges for 2 turns!\n╚═══════════════════════════╝`;
            updateDuelBlessingState(player.id, { blessing_used: 1 });
        }
    }

    if (!blessingMsg) return null;
    // Return the message — caller sends it in the correct sequence (AFTER the attack message)
    return { message: blessingMsg, killedIds: aliveEnemies.filter(id => data.hp[id] <= 0) };
}

// ── PARTY ASSEMBLY ────────────────────────────────────────────────────────────

async function startPartyAssembly(challengerId, enemyIds, bet, chat, assemblyKey) {
    if (partyAssembly.has(assemblyKey)) return;

    const teamALeader = String(challengerId);
    const teamBLeader = String(enemyIds[0]);

    const state = {
        assemblyKey,
        teamA:      [teamALeader],
        teamB:      enemyIds.map(String),
        teamALeader,
        teamBLeader,
        teamAReady: false,
        teamBReady: false,
        bet,
        chat
    };

    // Auto-start after 2 minutes with whoever joined
    state.timer = setTimeout(async () => {
        if (!partyAssembly.has(assemblyKey)) return;
        const s = partyAssembly.get(assemblyKey);
        partyAssembly.delete(assemblyKey);
        const rosterMsg = await buildRosterMessage(s);
        await chat.sendMessage(
            `╭══〘 ⏰ TIME'S UP — DUEL STARTING 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ 2 minutes passed — starting with current rosters!\n` +
            `┃◆ \n` +
            `${rosterMsg}` +
            `╰═══════════════════════════════════╯`
        ).catch(() => {});
        await startPvPDuel(s.teamA, s.teamB, s.bet, null, null, chat);
    }, ASSEMBLY_TIMEOUT_MS);

    partyAssembly.set(assemblyKey, state);

    // Fetch leader nicknames + ranks
    const [cRows] = await db.execute('SELECT nickname, `rank` FROM players WHERE id=?', [teamALeader]);
    const [eRows] = await db.execute(
        `SELECT id, nickname, \`rank\` FROM players WHERE id IN (${enemyIds.map(() => '?').join(',')})`,
        enemyIds
    );
    const cNick  = cRows[0]?.nickname || teamALeader;
    const cRank  = cRows[0]?.rank     || '?';
    const eNickMap = Object.fromEntries(eRows.map(r => [String(r.id), { nick: r.nickname, rank: r.rank }]));

    const teamBLines = enemyIds.map(id => {
        const p = eNickMap[String(id)];
        return `┃◆    • ${p?.nick || id} [${p?.rank || '?'}]`;
    }).join('\n');

    const betLine = bet > 0 ? `┃◆ 💰 Bet: ${bet} Gold per side\n┃◆ \n` : '';

    await chat.sendMessage(
        `╭══〘 ⚔️  PARTY DUEL — ASSEMBLY PHASE 〙══╮\n` +
        `┃◆ \n` +
        `┃◆ All challenges accepted! Both sides now have\n` +
        `┃◆ *2 minutes* to assemble their full team.\n` +
        `┃◆ Max *5 players* per side.\n` +
        `┃◆ \n` +
        `${betLine}` +
        `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `┃◆ 📋  HOW TO JOIN\n` +
        `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `┃◆ \n` +
        `┃◆ Join *${cNick}*'s side:\n` +
        `┃◆    !joinparty @${cNick}\n` +
        `┃◆ \n` +
        `┃◆ Join *${eRows[0]?.nickname || teamBLeader}*'s side:\n` +
        `┃◆    !joinparty @${eRows[0]?.nickname || teamBLeader}\n` +
        `┃◆ \n` +
        `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `┃◆ 🏁  STARTING THE DUEL\n` +
        `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `┃◆ \n` +
        `┃◆ When your team is set, the *leader* types:\n` +
        `┃◆    !startduel\n` +
        `┃◆ Duel begins once *both* leaders confirm.\n` +
        `┃◆ \n` +
        `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `┃◆ 🔵  Team ${cNick} (1/5)\n` +
        `┃◆    • ${cNick} [${cRank}] 👑 Leader\n` +
        `┃◆ \n` +
        `┃◆ 🔴  Team ${eRows[0]?.nickname || teamBLeader} (${enemyIds.length}/5)\n` +
        `${teamBLines}\n` +
        `┃◆ \n` +
        `┃◆ ⏳ Auto-starts in 2 min if leaders don't confirm.\n` +
        `╰════════════════════════════════════════╯`
    ).catch(() => {});
}

// ── Build a live roster display for both teams ────────────────────────────────
async function buildRosterMessage(state) {
    const fetchTeam = async (ids, leaderId) => {
        if (!ids.length) return [];
        const [rows] = await db.execute(
            `SELECT id, nickname, \`rank\` FROM players WHERE id IN (${ids.map(() => '?').join(',')})`,
            ids
        );
        const map = Object.fromEntries(rows.map(r => [String(r.id), r]));
        return ids.map(id => {
            const p = map[id];
            const isLeader = String(id) === String(leaderId);
            return `┃◆    • ${p?.nickname || id} [${p?.rank || '?'}]${isLeader ? ' 👑' : ''}`;
        });
    };

    const [aRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [state.teamALeader]);
    const [bRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [state.teamBLeader]);
    const aNick = aRow[0]?.nickname || state.teamALeader;
    const bNick = bRow[0]?.nickname || state.teamBLeader;

    const aLines = await fetchTeam(state.teamA, state.teamALeader);
    const bLines = await fetchTeam(state.teamB, state.teamBLeader);

    return (
        `┃◆ 🔵  Team ${aNick} (${state.teamA.length}/5)${state.teamAReady ? ' ✅ Ready' : ''}\n` +
        `${aLines.join('\n')}\n` +
        `┃◆ \n` +
        `┃◆ 🔴  Team ${bNick} (${state.teamB.length}/5)${state.teamBReady ? ' ✅ Ready' : ''}\n` +
        `${bLines.join('\n')}\n` +
        `┃◆ \n`
    );
}

function getAssemblyByLeader(leaderId) {
    const lid = String(leaderId);
    for (const [key, state] of partyAssembly) {
        if (state.teamALeader === lid || state.teamBLeader === lid) return state;
    }
    return null;
}

function getAssemblyByPlayer(playerId) {
    const pid = String(playerId);
    for (const [key, state] of partyAssembly) {
        if (state.teamA.includes(pid) || state.teamB.includes(pid)) return state;
    }
    return null;
}

async function joinPartyAssembly(joinerId, leaderTag) {
    const jid = String(joinerId);
    let state = null;
    let joiningA = false;

    for (const [, s] of partyAssembly) {
        const [aRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [s.teamALeader]);
        const [bRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [s.teamBLeader]);
        const aNick = (aRow[0]?.nickname || '').toLowerCase();
        const bNick = (bRow[0]?.nickname || '').toLowerCase();
        const tag   = leaderTag.replace(/@/g, '').toLowerCase();
        if (aNick === tag || s.teamALeader === leaderTag) { state = s; joiningA = true;  break; }
        if (bNick === tag || s.teamBLeader === leaderTag) { state = s; joiningA = false; break; }
    }
    if (!state) return { error: "No active party assembly found for that leader.\nMake sure you spell the nickname exactly as it appears." };

    if (state.teamA.includes(jid) || state.teamB.includes(jid))
        return { error: "You are already in this party duel." };
    if (isPlayerInDuel(jid))
        return { error: "You are already in an active duel." };

    const targetTeam = joiningA ? state.teamA : state.teamB;
    if (targetTeam.length >= 5)
        return { error: `That side is full (max 5 players).` };

    targetTeam.push(jid);

    // Build full roster to return for display
    const rosterMsg = await buildRosterMessage(state);
    const [jRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [jid]);
    const jNick  = jRow[0]?.nickname || jid;

    const [lRow] = await db.execute('SELECT nickname FROM players WHERE id=?',
        [joiningA ? state.teamALeader : state.teamBLeader]);
    const leaderNick = lRow[0]?.nickname || (joiningA ? state.teamALeader : state.teamBLeader);

    return { success: true, jNick, leaderNick, rosterMsg };
}

async function readyPartyDuel(leaderId, chat) {
    const lid = String(leaderId);
    const state = getAssemblyByLeader(lid);
    if (!state) return { error: "You are not a party leader in any active assembly.\nOnly the challenger and the first enemy to accept can use !startduel." };

    if (state.teamALeader === lid) state.teamAReady = true;
    if (state.teamBLeader === lid) state.teamBReady = true;

    if (!state.teamAReady || !state.teamBReady) {
        // Show who is still waiting
        const waitingLeaderId  = !state.teamAReady ? state.teamALeader : state.teamBLeader;
        const [wRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [waitingLeaderId]);
        const waitingNick = wRow[0]?.nickname || waitingLeaderId;
        const rosterMsg = await buildRosterMessage(state);
        return { success: true, waiting: waitingNick, rosterMsg };
    }

    // Both ready — launch
    clearTimeout(state.timer);
    partyAssembly.delete(state.assemblyKey);
    await startPvPDuel(state.teamA, state.teamB, state.bet, null, null, chat);
    return { success: true, started: true };
}

// ── Duel Start ────────────────────────────────────────────────────────────────
async function startPvPDuel(teamAIds, teamBIds, betAmount, client, msg, chatOverride = null) {
    const teamA = Array.isArray(teamAIds) ? normalizeIds(teamAIds) : [String(teamAIds)];
    const teamB = Array.isArray(teamBIds) ? normalizeIds(teamBIds) : [String(teamBIds)];
    const allIds = [...new Set([...teamA, ...teamB])];
    const placeholders = allIds.map(() => '?').join(',');
    const [rows] = await db.execute(
        `SELECT id, nickname, ` +
        "`rank`, role, strength, agility, intelligence, stamina, prestige_level FROM players WHERE id IN (" + placeholders + ")",
        allIds
    );
    if (rows.length !== allIds.length) return { error: "Player not found." };

    const playersById = Object.fromEntries(rows.map(p => [String(p.id), p]));
    const teamAPlayers = teamA.map(id => playersById[id]);
    const teamBPlayers = teamB.map(id => playersById[id]);

    const turnOrder = createTurnOrder(teamAPlayers, teamBPlayers);
    const firstTurn = turnOrder[0];
    const firstPlayer = playersById[firstTurn];
    const chat = chatOverride || (msg ? await msg.getChat() : null);
    if (!chat) return { error: "No chat context — duel could not start." };

    await setDuelActive(teamA, teamB, chat, betAmount, turnOrder);
    const duelKey = getDuelKey(teamA, teamB);
    setTurn(duelKey, firstTurn);

    const opponentTeam = getOpponentTeam(duelKey, firstTurn);
    const firstOpponent = opponentTeam.find(id => duelPool.get(duelKey).hp[id] > 0);

    // Start turn timer for first player
    await startTurnTimer(duelKey, firstTurn, firstOpponent || opponentTeam[0], chat, 1);

    const betLine = betAmount > 0
        ? `┃◆ 💰 Bet: ${betAmount} Gold each — Pot: ${betAmount * 2} Gold\n`
        : ``;

    const formatMember = p =>
        `┃◆  • ${p.nickname} [${p.rank}] ${p.role} — 💪${p.strength} ⚡${p.agility} 🧠${p.intelligence} 🛡️${p.stamina}`;
    const teamAInfo = teamAPlayers.map(formatMember).join('\n');
    const teamBInfo = teamBPlayers.map(formatMember).join('\n');

    const teamALabel = teamA.length > 1 ? `🔵 Team ${teamAPlayers[0].nickname}` : `🔵 ${teamAPlayers[0].nickname}`;
    const teamBLabel = teamB.length > 1 ? `🔴 Team ${teamBPlayers[0].nickname}` : `🔴 ${teamBPlayers[0].nickname}`;

    await chat.sendMessage(
        `╭══〘 ⚔️ DUEL BEGINS 〙══╮\n` +
        `┃◆ ${teamALabel}\n` +
        `${teamAInfo}\n` +
        `┃◆ ━━━━ ⚔️ VS ⚔️ ━━━━\n` +
        `┃◆ ${teamBLabel}\n` +
        `${teamBInfo}\n` +
        `┃◆ ━━━━━━━━━━━━\n` +
        `${betLine}` +
        `┃◆ ⚡ ${firstPlayer.nickname} goes first!\n` +
        `┃◆ ⏰ 20s per turn — miss it and you forfeit.\n` +
        `┃◆ Use !attack <move> to fight.\n` +
        `╰═══════════════════════════╯`
    );

    return { active: true, firstTurn, teamAPlayers, teamBPlayers };
}

// ── Victory Handler ───────────────────────────────────────────────────────────
async function handleVictory(winnerId, loserId, chat, duelData, winnerNick, loserNick, winnerHp) {
    const duelKey = duelData?.duelKey || getDuelKey(winnerId, loserId);
    clearTurnTimer(duelKey);
    clearDuelActiveByKey(duelKey);

    // ── PARTY VICTORY ─────────────────────────────────────────────────────────
    if (duelData.type === 'party') {
        const winners = duelData.teamA.includes(String(winnerId)) ? duelData.teamA : duelData.teamB;
        const losers  = duelData.teamA.includes(String(winnerId)) ? duelData.teamB : duelData.teamA;
        const aliveWinners = winners.filter(id => duelData.hp[id] > 0);

        const [winnerRows] = await db.execute(
            `SELECT id, nickname, \`rank\` FROM players WHERE id IN (${winners.map(() => '?').join(',')})`,
            winners
        ).catch(() => [[]]);
        const nicknameMap = Object.fromEntries(winnerRows.map(r => [String(r.id), r]));

        await db.execute(`UPDATE players SET pvp_wins   = pvp_wins   + 1 WHERE id IN (${winners.map(() => '?').join(',')})`, winners);
        await db.execute(`UPDATE players SET pvp_losses = pvp_losses + 1 WHERE id IN (${losers.map(() => '?').join(',')})`, losers);

        const titleLines = [];
        await Promise.all(aliveWinners.map(async id => {
            const newTitle = await checkAndGrantTitle(id);
            const p = nicknameMap[String(id)];
            if (newTitle) titleLines.push(`┃◆ 🎖️ ${p?.nickname || id} earned: "${newTitle}"`);
        }));

        const survivorLines = aliveWinners.map(id => {
            const p = nicknameMap[String(id)];
            return `┃◆  • ${p?.nickname || id} [${p?.rank || '?'}] — ❤️ ${duelData.hp[id]}/${duelData.maxHp[id]}`;
        }).join('\n');

        await chat.sendMessage(
            `╭══〘 🏆 PARTY DUEL OVER 〙══╮\n` +
            `┃◆ ⚔️ ${winnerNick}'s team stands victorious!\n` +
            `┃◆ ━━━━━━━━━━━━━━━━\n` +
            `┃◆ 🟢 Survivors\n` +
            `${survivorLines}\n` +
            `${titleLines.length ? `┃◆ ━━━━━━━━━━━━━━━━\n${titleLines.join('\n')}\n` : ''}` +
            `╰═══════════════════════════╯`
        );
        return { winner: winners };
    }

    // ── SOLO VICTORY ──────────────────────────────────────────────────────────
    await db.execute("UPDATE players SET pvp_wins   = pvp_wins   + 1 WHERE id=?", [winnerId]);
    await db.execute("UPDATE players SET pvp_losses = pvp_losses + 1 WHERE id=?", [loserId]);

    const [wRow] = await db.execute("SELECT `rank`, prestige_level FROM players WHERE id=?", [winnerId]);
    const [lRow] = await db.execute("SELECT `rank`, prestige_level FROM players WHERE id=?", [loserId]);
    const wRank  = wRow[0]?.rank || '?';
    const lRank  = lRow[0]?.rank || '?';

    let betLine = '';
    if (duelData.bet > 0) {
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [duelData.bet * 2, winnerId]);
        betLine = `┃◆ 💰 Prize: ${duelData.bet * 2} Gold claimed\n`;
    }

    await trackPvPWin(winnerId);
    const newTitle = await checkAndGrantTitle(winnerId);
    const titleLine = newTitle ? `┃◆ 🎖️ New title: "${newTitle}"\n` : '';

    await chat.sendMessage(
        `╭══〘 🏆 DUEL OVER 〙══╮\n` +
        `┃◆ ${narrate('pvpVictory', { winner: winnerNick, loser: loserNick })}\n` +
        `┃◆ ━━━━━━━━━━━━━━━━\n` +
        `┃◆ 🥇 *${winnerNick}* [${wRank}] WINS\n` +
        `┃◆ 💀 ${loserNick} [${lRank}] defeated\n` +
        `┃◆ ━━━━━━━━━━━━━━━━\n` +
        `┃◆ ❤️ ${winnerNick}: ${winnerHp}/${duelData.maxHp[winnerId] || DUEL_HP}\n` +
        `┃◆ 💀 ${loserNick}: 0/${duelData.maxHp[loserId] || DUEL_HP}\n` +
        `${betLine}` +
        `${titleLine}` +
        `╰═══════════════════════════╯`
    );

    return { winner: winnerId };
}

// ── Shared combat message ─────────────────────────────────────────────────────
async function sendCombatMessage(chat, attackerNick, opponentNick, moveName, damage, attackerHp, opponentHp, nextTurnNick, roundNum, extra = '', attackerMaxHp = DUEL_HP, opponentMaxHp = DUEL_HP) {
    await chat.sendMessage(
        `══〘 ⚔️ DUEL — ROUND ${roundNum} 〙══╮\n` +
        `┃◆ ${narrate('skillDamage', { attacker: attackerNick, move: moveName, target: opponentNick, damage })}\n` +
        `┃◆ 💥 Damage: ${damage}\n` +
        `${extra}` +
        `┃◆────────────\n` +
        `┃◆ ❤️ ${attackerNick}: ${attackerHp}/${attackerMaxHp}\n` +
        `┃◆ ❤️ ${opponentNick}: ${opponentHp}/${opponentMaxHp}\n` +
        `┃◆────────────\n` +
        `┃◆ ⚡ ${nextTurnNick}'s turn! ⏰ 20 seconds!\n` +
        `╰═══════════════════════╯`
    );
}

// ── Handle Skill in Duel ──────────────────────────────────────────────────────
// ── Multi-target fatigue cost — hits 2 enemies? You'll feel it. ──────────────
// 1 target: ×1  |  2: ×3  |  3: ×6  |  4: ×10  |  5: ×15
const MULTI_FATIGUE_MULT = [0, 1, 3, 6, 10, 15];

function multiTargetFatigue(baseFatigue, numTargets) {
    const mult = MULTI_FATIGUE_MULT[Math.min(numTargets, 5)] || numTargets * 3;
    return Math.ceil(baseFatigue * mult);
}

function fatigueWarning(fatigue) {
    const f = clampFatigue(fatigue);
    if (f >= 90) return `┃◆ ⚠️ ${formatFatigueBar(f)} (${f}%) — *BREAKING POINT. Attacks deal 1 damage!*\n`;
    if (f >= 75) return `┃◆ ⚠️ ${formatFatigueBar(f)} (${f}%) — *The strain is overwhelming!*\n`;
    if (f >= 50) return `┃◆ ⚠️ ${formatFatigueBar(f)} (${f}%) — *You're pushing your limits!*\n`;
    if (f >= 25) return `┃◆ 🔥 ${formatFatigueBar(f)} (${f}%) — you're getting tired.\n`;
    return '';
}

async function handlePvPSkill(attackerId, move, targetIds) {
    const duel = activeDuels.get(attackerId);
    if (!duel) return { error: "You are not in a duel." };
    if (duel.turn !== attackerId) return { error: "It's not your turn!" };

    const chat = duel.chat;
    const data = duelPool.get(duel.duelKey);
    if (!data) return { error: "Duel data missing." };

    const [aRows] = await db.execute("SELECT * FROM players WHERE id=?", [attackerId]);
    if (!aRows.length) return { error: "Player not found." };
    const attacker  = aRows[0];
    const [items]   = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [attackerId]);
    const attackerHp = data.hp[attackerId];
    const round = data.round;

    const myTeam  = getTeamForPlayer(duel.duelKey, attackerId);
    const oppTeam = getOpponentTeam(duel.duelKey, attackerId);

    const nextTurnAfterMove = async () => {
        const nextTurn = findNextAlivePlayer(duel.duelKey, attackerId);
        if (!nextTurn) return null;
        setTurn(duel.duelKey, nextTurn);
        await startTurnTimer(duel.duelKey, nextTurn, getCurrentOpponentId(duel.duelKey, nextTurn), chat, data.round);
        return nextTurn;
    };
    const trackBlessings = async () => {
        const b1 = await triggerBlessingIfReadyInDuel('every_5_skills', attacker, data).catch(() => null);
        if (b1) await chat.sendMessage(b1.message).catch(() => {});
        const b2 = await triggerBlessingIfReadyInDuel('all_allies_below_50', attacker, data).catch(() => null);
        if (b2) await chat.sendMessage(b2.message).catch(() => {});
    };

    // ── Normalise requested targets into arrays ───────────────────────────────
    // rawTargets = null (auto), string (single), or string[] (multi)
    const rawTargets = !targetIds
        ? null
        : Array.isArray(targetIds) ? targetIds.map(String) : [String(targetIds)];

    // ── DAMAGE ────────────────────────────────────────────────────────────────
    if (move.type === 'damage') {
        // Build valid enemy targets
        let enemyTargets;
        if (!rawTargets) {
            const auto = getCurrentOpponentId(duel.duelKey, attackerId);
            if (!auto) return { error: "No living opponent found." };
            enemyTargets = [auto];
        } else {
            enemyTargets = rawTargets.filter(id => oppTeam?.includes(id) && data.hp[id] > 0);
            if (!enemyTargets.length) return { error: "None of those targets are living opponents." };
        }

        const numTargets = enemyTargets.length;
        const pvpMult = PVP_DMG_MULT[attacker.rank] || 1.0;
        const results = [];
        let allDefeated = [];

        for (const tid of enemyTargets) {
            const [dRows] = await db.execute("SELECT * FROM players WHERE id=?", [tid]);
            if (!dRows.length) continue;
            const def = dRows[0];
            const defHp = data.hp[tid];
            const defForCalc = { ...def, hp: defHp, max_hp: data.maxHp[tid] };
            let dmg = calculateMoveDamage(attacker, move, defForCalc, items);
            dmg = Math.max(1, Math.floor(dmg * pvpMult));
            const newHp = Math.max(0, defHp - dmg);
            data.hp[tid] = newHp;
            results.push({ tid, nick: def.nickname, rank: def.rank, dmg, newHp, maxHp: data.maxHp[tid], defeated: newHp <= 0 });
            if (newHp <= 0) allDefeated.push({ tid, nick: def.nickname, rank: def.rank, def });
        }

        const totalDmg = results.reduce((s, r) => s + r.dmg, 0);
        const baseFatigue = Math.min(4, Math.max(1, Math.ceil(totalDmg / 120)));
        const fatigue = multiTargetFatigue(baseFatigue, numTargets);
        await increasePlayerFatigue(attackerId, fatigue, attacker);
        const [freshAttacker] = await db.execute("SELECT fatigue FROM players WHERE id=?", [attackerId]);
        const currentFatigue = freshAttacker[0]?.fatigue || 0;

        // ── 1. SEND ATTACK MESSAGE ────────────────────────────────────────────
        const dmgLines = results.map(r =>
            `┃◆ 💥 ${r.nick} [${r.rank}]: -${r.dmg} HP  (${r.newHp <= 0 ? '💀 0' : r.newHp}/${r.maxHp})`
        ).join('\n');
        const totalLine = numTargets > 1 ? `┃◆ ━━ Total: ${totalDmg} across ${numTargets} targets\n` : '';
        const fatigueWarn = fatigueWarning(currentFatigue);
        const narrateLine = narrate('skillDamage', { attacker: attacker.nickname, move: move.name, target: results[0]?.nick, damage: totalDmg });

        await chat.sendMessage(
            `╭══〘 ⚔️ ROUND ${round} 〙══╮\n` +
            `┃◆ ${narrateLine}\n` +
            `┃◆ ━━━━━━━━━━━━━━━━\n` +
            `${dmgLines}\n` +
            `${totalLine}` +
            `┃◆ ❤️ ${attacker.nickname}: ${attackerHp}/${data.maxHp[attackerId]}\n` +
            `${fatigueWarn}` +
            `╰═══════════════════════════╯`
        );

        // ── 2. CLAN BLESSING (fires AFTER attack message) ─────────────────────
        // Check on_death for each defeated enemy first
        for (const { tid, def } of allDefeated) {
            const bl = await triggerBlessingIfReadyInDuel('on_death', def, data, { attackerId }).catch(() => null);
            if (bl) await chat.sendMessage(bl.message).catch(() => {});
        }

        // Check on_kill blessing for attacker after eliminating someone
        if (allDefeated.length > 0) {
            const bl = await triggerBlessingIfReadyInDuel('on_kill', attacker, data).catch(() => null);
            if (bl) {
                // Show blessing effect on remaining enemies
                const fieldLines = data.teamA.includes(String(attackerId))
                    ? data.teamB.map(id => `┃◆  • ${results.find(r=>r.tid===id)?.nick || id}: ❤️ ${data.hp[id]}/${data.maxHp[id]}`)
                    : data.teamA.map(id => `┃◆  • ${results.find(r=>r.tid===id)?.nick || id}: ❤️ ${data.hp[id]}/${data.maxHp[id]}`);
                const blessingKilled = (bl.killedIds || []);
                await chat.sendMessage(
                    `${bl.message}\n` +
                    `┃◆ ━━ Field State ━━\n` +
                    `${fieldLines.join('\n')}\n` +
                    `${blessingKilled.length ? `┃◆ ☠️ ${blessingKilled.length} more fell to the blessing!\n` : ''}` +
                    `╰═══════════════════════════╯`
                ).catch(() => {});
                // Recompute defeated after blessing
                blessingKilled.forEach(id => {
                    if (!allDefeated.find(d => d.tid === id)) {
                        allDefeated.push({ tid: id, nick: id, rank: '?', def: {} });
                    }
                });
            }
        }

        // enemy_below_25 blessing
        const bl25 = await triggerBlessingIfReadyInDuel('enemy_below_25', attacker, data, { targetId: enemyTargets[0], targetName: results[0]?.nick }).catch(() => null);
        if (bl25) await chat.sendMessage(bl25.message).catch(() => {});

        // ── 3. CHECK VICTORY ──────────────────────────────────────────────────
        const survivingOpponents = (data.teamA.includes(String(attackerId)) ? data.teamB : data.teamA).filter(id => data.hp[id] > 0);

        if (survivingOpponents.length === 0) {
            const loserNick = allDefeated.map(d => d.nick).join(' & ');
            return await handleVictory(attackerId, allDefeated[0]?.tid || enemyTargets[0], chat, data,
                attacker.nickname, loserNick, attackerHp);
        }

        // ── 4. KILL ANNOUNCEMENTS (mid-fight, opponents remain) ───────────────
        if (allDefeated.length > 0) {
            await chat.sendMessage(
                `╭══〘 ☠️ ELIMINATED 〙══╮\n` +
                `${allDefeated.map(d => `┃◆ 💀 ${d.nick} [${d.rank}] has been defeated!`).join('\n')}\n` +
                `┃◆ ${survivingOpponents.length} opponent(s) remain.\n` +
                `╰═══════════════════════════╯`
            ).catch(() => {});
        }

        await trackBlessings();
        data.round++;
        const nextTurn = await nextTurnAfterMove();
        const [nRows] = nextTurn ? await db.execute("SELECT nickname FROM players WHERE id=?", [nextTurn]) : [[]];
        const nextTurnName = nRows[0]?.nickname || 'next player';

        await chat.sendMessage(`┃◆ ⚡ *${nextTurnName}'s turn!*  ⏰ 20 seconds — use !attack <move>`);
        return { success: true, nextTurn };
    }

    // ── HEAL ──────────────────────────────────────────────────────────────────
    if (move.type === 'heal') {
        // Targets must be alive allies (or self if none specified)
        let healTargets;
        if (!rawTargets) {
            healTargets = [attackerId]; // self-heal by default
        } else {
            healTargets = rawTargets.filter(id => myTeam?.includes(id) && data.hp[id] > 0);
            if (!healTargets.length) return { error: "Heal targets must be alive allies." };
        }

        const numTargets = healTargets.length;
        const results = [];
        let totalHealed = 0;

        for (const tid of healTargets) {
            const [tRows] = await db.execute("SELECT * FROM players WHERE id=?", [tid]);
            if (!tRows.length) continue;
            const tPlayer = tRows[0];
            const healAmt = calculateHeal(attacker, move);
            const oldHp   = data.hp[tid];
            const newHp   = Math.min(data.maxHp[tid], oldHp + healAmt);
            data.hp[tid]  = newHp;
            results.push({ tid, nick: tPlayer.nickname, healAmt: newHp - oldHp, newHp, maxHp: data.maxHp[tid] });
            totalHealed += newHp - oldHp;
            if (tid === attackerId) {
                const bl = await triggerBlessingIfReadyInDuel('on_healed', attacker, data, { healAmount: healAmt }).catch(() => null);
                if (bl) await chat.sendMessage(bl.message).catch(() => {});
            }
        }

        const baseFatigue = Math.max(1, Math.ceil(totalHealed / 15));
        const fatigue = multiTargetFatigue(baseFatigue, numTargets);
        await increasePlayerFatigue(attackerId, fatigue, attacker);
        const [freshA] = await db.execute("SELECT fatigue FROM players WHERE id=?", [attackerId]);
        const currentFatigue = freshA[0]?.fatigue || 0;

        const healLines = results.map(r => `┃◆ 💚 ${r.nick}: +${r.healAmt} HP  ❤️ ${r.newHp}/${r.maxHp}`).join('\n');
        const fatigueWarn = numTargets > 1 ? fatigueWarning(currentFatigue) : (currentFatigue >= 25 ? fatigueWarning(currentFatigue) : '');

        await trackBlessings();
        data.round++;
        const nextTurn = await nextTurnAfterMove();
        const [nRows] = nextTurn ? await db.execute("SELECT nickname FROM players WHERE id=?", [nextTurn]) : [[]];
        const nextTurnName = nRows[0]?.nickname || 'next player';

        await chat.sendMessage(
            `══〘 💚 DUEL HEAL — ROUND ${round} 〙══╮\n` +
            `┃◆ ${narrate('heal', { healer: attacker.nickname, target: results.map(r => r.nick).join(' & '), heal: totalHealed })}\n` +
            `${healLines}\n` +
            `${numTargets > 1 ? `┃◆ ━━ Total healed: ${totalHealed}\n` : ''}` +
            `${fatigueWarn}` +
            `┃◆────────────\n` +
            `┃◆ ⚡ ${nextTurnName}'s turn! ⏰ 20 seconds!\n` +
            `╰═══════════════════════╯`
        );
        return { success: true, nextTurn };
    }

    // ── BUFF ──────────────────────────────────────────────────────────────────
    if (move.type === 'buff') {
        let buffTargets;
        if (!rawTargets) {
            buffTargets = [attackerId]; // self-buff
        } else {
            buffTargets = rawTargets.filter(id => myTeam?.includes(id) && data.hp[id] > 0);
            if (!buffTargets.length) return { error: "Buff targets must be alive allies." };
        }

        const numTargets = buffTargets.length;
        const statName = (move.effect || '').toLowerCase().replace(/_up$/, '');
        const pctLabel = move.percent ? `${move.value}%` : `+${move.value}`;
        const results = [];

        for (const tid of buffTargets) {
            const [tRows] = await db.execute("SELECT nickname FROM players WHERE id=?", [tid]);
            applyBuff('player', tid, {
                type: 'buff',
                stat: statName,
                value: move.value,
                percent: move.percent || false,
                duration: move.duration || 3
            });
            results.push(tRows[0]?.nickname || tid);
        }

        const baseFatigue = 8 * numTargets;
        const fatigue = multiTargetFatigue(baseFatigue, numTargets);
        await increasePlayerFatigue(attackerId, fatigue, attacker);
        const [freshA] = await db.execute("SELECT fatigue FROM players WHERE id=?", [attackerId]);
        const currentFatigue = freshA[0]?.fatigue || 0;
        const fatigueWarn = numTargets > 1 ? fatigueWarning(currentFatigue) : '';

        await trackBlessings();
        data.round++;
        const nextTurn = await nextTurnAfterMove();
        const [nRows] = nextTurn ? await db.execute("SELECT nickname FROM players WHERE id=?", [nextTurn]) : [[]];
        const nextTurnName = nRows[0]?.nickname || 'next player';

        await chat.sendMessage(
            `══〘 ⬆️ DUEL BUFF — ROUND ${round} 〙══╮\n` +
            `┃◆ ${narrate('buff', { caster: attacker.nickname, target: results.join(' & '), move: move.name, stat: move.effect, value: move.value, duration: move.duration || 3 })}\n` +
            `┃◆ ${pctLabel} ${statName.toUpperCase()} → ${results.join(', ')} for ${move.duration || 3} turns\n` +
            `${fatigueWarn}` +
            `┃◆────────────\n` +
            `┃◆ ⚡ ${nextTurnName}'s turn! ⏰ 20 seconds!\n` +
            `╰═══════════════════════╯`
        );
        return { success: true, nextTurn };
    }

    // ── DEBUFF ────────────────────────────────────────────────────────────────
    if (move.type === 'debuff') {
        let debuffTargets;
        if (!rawTargets) {
            const auto = getCurrentOpponentId(duel.duelKey, attackerId);
            if (!auto) return { error: "No living opponent found." };
            debuffTargets = [auto];
        } else {
            debuffTargets = rawTargets.filter(id => oppTeam?.includes(id) && data.hp[id] > 0);
            if (!debuffTargets.length) return { error: "Debuff targets must be living opponents." };
        }

        const numTargets = debuffTargets.length;
        const statName = (move.effect || '').toLowerCase();
        const results = [];

        for (const tid of debuffTargets) {
            const [tRows] = await db.execute("SELECT nickname FROM players WHERE id=?", [tid]);
            applyBuff('player', tid, {
                type: 'debuff',
                stat: statName,
                value: move.value,   // already negative
                percent: move.percent || false,
                duration: move.duration || 2
            });
            results.push(tRows[0]?.nickname || tid);
        }

        const baseFatigue = 6 * numTargets;
        const fatigue = multiTargetFatigue(baseFatigue, numTargets);
        await increasePlayerFatigue(attackerId, fatigue, attacker);
        const [freshA] = await db.execute("SELECT fatigue FROM players WHERE id=?", [attackerId]);
        const currentFatigue = freshA[0]?.fatigue || 0;
        const fatigueWarn = numTargets > 1 ? fatigueWarning(currentFatigue) : '';

        await trackBlessings();
        data.round++;
        const nextTurn = await nextTurnAfterMove();
        const [nRows] = nextTurn ? await db.execute("SELECT nickname FROM players WHERE id=?", [nextTurn]) : [[]];
        const nextTurnName = nRows[0]?.nickname || 'next player';
        const pctLabel = move.percent ? `${Math.abs(move.value)}%` : Math.abs(move.value);

        await chat.sendMessage(
            `══〘 ⬇️ DUEL DEBUFF — ROUND ${round} 〙══╮\n` +
            `┃◆ ${narrate('debuff', { caster: attacker.nickname, target: results.join(' & '), move: move.name, stat: move.effect, value: Math.abs(move.value), duration: move.duration || 2 })}\n` +
            `┃◆ -${pctLabel} ${statName.toUpperCase()} → ${results.join(', ')} for ${move.duration || 2} turns\n` +
            `${fatigueWarn}` +
            `┃◆────────────\n` +
            `┃◆ ⚡ ${nextTurnName}'s turn! ⏰ 20 seconds!\n` +
            `╰═══════════════════════╯`
        );
        return { success: true, nextTurn };
    }

    return { error: "That move cannot be used in a duel." };
}

// ── Legacy handlePvPAttack (basic attack fallback) ────────────────────────────
async function handlePvPAttack(attackerId) {
    const duel = activeDuels.get(attackerId);
    if (!duel) return { error: "You are not in a duel." };
    if (duel.turn !== attackerId) return { error: "It's not your turn!" };

    const chat = duel.chat;
    const data = duelPool.get(duel.duelKey);
    if (!data) return { error: "Duel data missing." };

    const targetId = getCurrentOpponentId(duel.duelKey, attackerId);
    if (!targetId) return { error: "No living opponent found." };
    const [aRows] = await db.execute("SELECT * FROM players WHERE id=?", [attackerId]);
    const [dRows] = await db.execute("SELECT * FROM players WHERE id=?", [targetId]);
    if (!aRows.length || !dRows.length) return { error: "Player not found." };

    const attacker = aRows[0];
    const defender = dRows[0];

    const [items] = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [attackerId]);
    let weaponBonus = 0;
    items.forEach(i => weaponBonus += Number(i.attack_bonus || 0) + Number(i.strength_bonus || 0));

    const baseDmg  = Number(attacker.strength) + Math.floor(weaponBonus * 0.5);
    const defence  = Number(defender.stamina) || 0;
    const fatigueMultiplier = getFatigueMultiplier(attacker);
    const pvpMult  = PVP_DMG_MULT[attacker.rank] || 1.0;
    const damage   = Math.max(1, Math.floor((baseDmg - defence / 2) * fatigueMultiplier * pvpMult));
    const round    = data.round;

    const attackerHp = data.hp[attackerId];
    const newDefHp   = Math.max(0, data.hp[targetId] - damage);
    data.hp[targetId] = newDefHp;

    const fatigueGain = Math.min(4, Math.max(1, Math.ceil(damage / 120)));
    await increasePlayerFatigue(attackerId, fatigueGain, attacker);

    const nextTurnAfterMove = async () => {
        const nextTurn = findNextAlivePlayer(duel.duelKey, attackerId);
        if (!nextTurn) return null;
        setTurn(duel.duelKey, nextTurn);
        await startTurnTimer(duel.duelKey, nextTurn, getCurrentOpponentId(duel.duelKey, nextTurn), chat, data.round);
        return nextTurn;
    };

    if (newDefHp <= 0) {
        const blDeath = await triggerBlessingIfReadyInDuel('on_death', defender, data, { attackerId }).catch(() => null);
        if (blDeath) await chat.sendMessage(blDeath.message).catch(() => {});
        if (data.hp[targetId] > 0) {
            data.round++;
            const nextTurn = await nextTurnAfterMove();
            await chat.sendMessage(
                `╭══〘 👻 PHANTOM SHIFT 〙══╮\n` +
                `┃◆ ${defender.nickname} refuses to fall and returns with vengeance!\n` +
                `┃◆ ❤️ Revived — next: ${nextTurn || defender.nickname}\n` +
                `╰═══════════════════════╯`
            ).catch(() => {});
            return { success: true, nextTurn };
        }

        const opponentTeam = getOpponentTeam(duel.duelKey, attackerId);
        const remainingOpponents = opponentTeam ? opponentTeam.filter(id => data.hp[id] > 0) : [];
        if (remainingOpponents.length > 0) {
            const blKill = await triggerBlessingIfReadyInDuel('on_kill', attacker, data).catch(() => null);
            if (blKill) await chat.sendMessage(blKill.message).catch(() => {});
            data.round++;
            const nextTurn = await nextTurnAfterMove();
            const [nextRows] = nextTurn ? await db.execute("SELECT nickname FROM players WHERE id=?", [nextTurn]) : [null];
            const nextName = nextRows?.[0]?.nickname || nextTurn;
            await chat.sendMessage(
                `╭══〘 ☠️ ELIMINATED 〙══╮\n` +
                `┃◆ 💀 ${defender.nickname} has been defeated!\n` +
                `┃◆ ${remainingOpponents.length} opponent(s) remain.\n` +
                `┃◆ ⚡ Next: ${nextName}\n` +
                `╰═══════════════════════╯`
            ).catch(() => {});
            return { success: true, nextTurn };
        }

        const blKill = await triggerBlessingIfReadyInDuel('on_kill', attacker, data).catch(() => null);
        if (blKill) await chat.sendMessage(blKill.message).catch(() => {});
        return await handleVictory(attackerId, targetId, chat, data,
            attacker.nickname, defender.nickname, attackerHp);
    }

    const bl25 = await triggerBlessingIfReadyInDuel('enemy_below_25', attacker, data, { targetId, targetName: defender.nickname }).catch(() => null);
    if (bl25) await chat.sendMessage(bl25.message).catch(() => {});
    const blLow = await triggerBlessingIfReadyInDuel('hp_below_30', defender, data).catch(() => null);
    if (blLow) await chat.sendMessage(blLow.message).catch(() => {});
    const bl5 = await triggerBlessingIfReadyInDuel('every_5_skills', attacker, data).catch(() => null);
    if (bl5) await chat.sendMessage(bl5.message).catch(() => {});
    const blAll = await triggerBlessingIfReadyInDuel('all_allies_below_50', attacker, data).catch(() => null);
    if (blAll) await chat.sendMessage(blAll.message).catch(() => {});

    data.round++;
    const nextTurn = await nextTurnAfterMove();
    await sendCombatMessage(chat,
        attacker.nickname, defender.nickname, 'Basic Attack', damage,
        attackerHp, newDefHp, defender.nickname, round, '',
        data.maxHp[attackerId], data.maxHp[targetId]
    );
    return { success: true, nextTurn };
}

module.exports = {
    startPvPDuel,
    handlePvPAttack,
    handlePvPSkill,
    isPlayerInDuel,
    getDuelOpponent,
    clearDuelActive,
    DUEL_HP,
    startPartyAssembly,
    joinPartyAssembly,
    readyPartyDuel,
    getAssemblyByPlayer
};