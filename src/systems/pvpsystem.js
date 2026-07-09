const db = require('../database/db');
const { narrate } = require('../utils/narrator');
const { narrateAI } = require('./aiSystems');
const { initMvpTracking, recordDamage, recordHeal, recordKill, calculateMvp, mvpStats } = require('./mvpSystem');
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
const territoryWars = new Map(); // duelKey -> { tid, attackerClan, defenderClan, attackers, defenders, dungeonId }

// ── Party Assembly State ──────────────────────────────────────────────────────
// Holds both teams during the 2-minute assembly window before a party duel starts.
// assemblyKey (= pvp_challenges.team_key) → { teamA, teamB, teamALeader, teamBLeader,
//   teamAReady, teamBReady, bet, chat, timer }
const partyAssembly = new Map();
// Tournament duel pending: playerId → { opponentId, tournamentId, phase }
const tournamentDuelPending = new Map();
const ASSEMBLY_TIMEOUT_MS = 120000; // 2 minutes

const DUEL_HP = 10000; // normal players fixed duel HP

// ── PvP damage is 95% of the move's base output ───────────────────────────────
const PVP_DAMAGE_SCALE = 0.99;

// PvP Arena group — tournament duels are announced and conducted here
const getPvpGroup = () => {
    const TEST_GC  = process.env.TEST_GROUP_JID  || '120363408323584748@g.us';
    const raidCtx  = global.overrideRaidGroup;
    // In test GC context — duels stay inside the test GC (no separate PvP group)
    if (raidCtx && raidCtx === TEST_GC) return TEST_GC;
    // Live context — use dedicated PvP arena group
    return process.env.PVP_GROUP_JID || process.env.RAID_GROUP_JID || '120363213735662100@g.us';
};

async function promoteForDuel(client, playerIds, groupOverride) {
    const group = groupOverride || getPvpGroup();
    if (!client || !group) return;
    try {
        const meta = await client.groupMetadata(group);
        for (const pid of playerIds) {
            const norm = String(pid).replace(/@[^@]+$/,'').split(':')[0];
            const participant = meta.participants.find(p =>
                String(p.id).replace(/@[^@]+$/,'').split(':')[0] === norm
            );
            if (participant && participant.admin !== 'admin') {
                await client.groupParticipantsUpdate(group, [participant.id], 'promote').catch(() => {});
            }
        }
    } catch(e) { console.error('[PvP promote]', e.message); }
}

async function demoteAfterDuel(client, playerIds, groupOverride) {
    const group = groupOverride || getPvpGroup();
    if (!client || !group) return;
    try {
        const meta = await client.groupMetadata(group);
        for (const pid of playerIds) {
            const norm = String(pid).replace(/@[^@]+$/,'').split(':')[0];
            const participant = meta.participants.find(p =>
                String(p.id).replace(/@[^@]+$/,'').split(':')[0] === norm
            );
            if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
                await client.groupParticipantsUpdate(group, [participant.id], 'demote').catch(() => {});
            }
        }
    } catch(e) { console.error('[PvP demote]', e.message); }
}

// getDuelHp — 10k for normal players, 70k for prestige
async function getDuelHp(playerId) {
    try {
        const [rows] = await db.execute(
            'SELECT COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?',
            [playerId]
        );
        if (rows[0]?.prestige_level > 0) return 100000;
    } catch {}
    return DUEL_HP;
}

const { normalizeId, normalizeIds } = require('../utils/identity');

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

function normBlessKey(playerId) {
    // Normalize to match how ids are stored in activeDuels
    return String(playerId || '').replace(/@s\.whatsapp\.net|@c\.us|@g\.us|@lid/g, '').split(':')[0].trim();
}

function getDuelBlessingState(playerId) {
    const key = normBlessKey(playerId);
    if (!duelBlessingStates.has(key)) {
        duelBlessingStates.set(key, { hit_count: 0, skill_count: 0, blessing_used: 0, last_triggered: null });
    }
    return duelBlessingStates.get(key);
}

function updateDuelBlessingState(playerId, updates) {
    const key = normBlessKey(playerId);
    const state = getDuelBlessingState(key);
    Object.assign(state, updates);
    duelBlessingStates.set(key, state);
}

function clearDuelBlessingState(playerId) {
    duelBlessingStates.delete(normBlessKey(playerId));
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

const TURN_LIMIT_MS       = 45000;  // 45 seconds — normal duels
const TERRITORY_TURN_MS   = 120000; // 2 minutes  — territory wars

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

    // Territory wars get 2 minutes, normal duels get 45 seconds
    const isTerritory = territoryWars.has(duelKey);
    const timerMs = isTerritory ? TERRITORY_TURN_MS : TURN_LIMIT_MS;
    const timerLabel = isTerritory ? '2 minutes' : '45 seconds';

    const timer = setTimeout(async () => {
        const duel = activeDuels.get(currentTurnId);
        if (!duel || duel.turn !== currentTurnId) return;

        const data = duelPool.get(duelKey);
        if (!data) return;

        try {
            const [pRows] = await db.execute("SELECT nickname FROM players WHERE id=?", [currentTurnId]);
            const [oRows] = await db.execute("SELECT nickname FROM players WHERE id=?", [opponentId]);
            const pNick = pRows[0]?.nickname || currentTurnId;
            const oNick = oRows[0]?.nickname || opponentId;

            clearDuelActiveByKey(duelKey);

            if (data.bet > 0) {
                await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [data.bet, currentTurnId]);
                await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [data.bet, opponentId]);
            }

            // Territory war forfeit — winning clan claims the territory
            if (isTerritory) {
                const warData = territoryWars.get(duelKey);
                if (warData) {
                    const { claimTerritory } = require('../systems/voidTerritories');
                    const forfeitingClan = data.teamA?.includes(String(currentTurnId)) ? data.clanB : data.clanA;
                    const winningClan   = data.teamA?.includes(String(currentTurnId)) ? data.clanA : data.clanB;
                    if (winningClan) await claimTerritory(warData.territoryId, winningClan).catch(() => {});
                    await db.execute(
                        "UPDATE territory_wars SET status='completed' WHERE territory_id=? AND status='active'",
                        [warData.territoryId]
                    ).catch(() => {});
                    territoryWars.delete(duelKey);
                }

                await chat.sendMessage(
                    `╔══〘 ⏰ TERRITORY FORFEIT 〙══╗
` +
                    `┃★
` +
                    `┃★ *${pNick}* failed to act in time.
` +
                    `┃★ Their clan forfeits the war.
` +
                    `┃★
` +
                    `┃★ 🏆 *${oNick}*'s clan wins!
` +
                    `┃★ Territory claimed by default.
` +
                    `┃★
` +
                    `╚═══════════════════════════╝`
                );
            } else {
                await chat.sendMessage(
                    `══〘 ⏰ DUEL TIMEOUT 〙══╮
` +
                    `┃◆ 
` +
                    `┃◆ *${pNick}* ran out of time!
` +
                    `┃◆ They had ${timerLabel} to act.
` +
                    `┃◆ 
` +
                    `┃◆ 🏳️ *${pNick}* forfeits the duel.
` +
                    `┃◆ 🏆 *${oNick}* wins by default!
` +
                    `${data.bet > 0 ? '┃◆ 💰 Bets refunded to both players.\n' : ''}` +
                    `┃◆ 
` +
                    `╰═══════════════════════╯`
                );
            }

            await db.execute("UPDATE players SET pvp_losses = pvp_losses + 1 WHERE id=?", [currentTurnId]);
            await db.execute("UPDATE players SET pvp_wins   = pvp_wins   + 1 WHERE id=?", [opponentId]);
            await trackPvPWin(opponentId);
            // Record tournament result if a tournament is active
            try {
                const { getActiveTournament, recordMatchResult, PHASES } = require('../systems/tournamentSystem');
                // Use stored groupJid from duel data so timeout fires in correct tournament context
                const duelData = duelPool.get(getDuelKey([currentTurnId], [opponentId]))
                    || duelPool.get(getDuelKey([opponentId], [currentTurnId]))
                    || [...duelPool.values()].find(d =>
                        d.teamA?.includes(String(currentTurnId)) || d.teamB?.includes(String(currentTurnId))
                    );
                const duelGrpJid = duelData?.groupJid || getPvpGroup();
                const tourney = await getActiveTournament(duelGrpJid);
                if (tourney && [PHASES.BATTLE_ROYALE, PHASES.DUO_GAUNTLET, PHASES.GRAND_FINALS].includes(tourney.phase)) {
                    const norm = id => String(id).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g,'').split(':')[0];
                    // For party/duo duels — record for all team members
                    const winTeam = duelData?.teamB?.includes(String(currentTurnId))
                        ? (duelData?.teamA || [opponentId])
                        : (duelData?.teamB || [opponentId]);
                    const loseTeam = duelData?.teamA?.includes(String(currentTurnId))
                        ? (duelData?.teamA || [currentTurnId])
                        : (duelData?.teamB || [currentTurnId]);
                    for (const wId of winTeam) {
                        for (const lId of loseTeam) {
                            await recordMatchResult(tourney.id, norm(wId), norm(lId), tourney.phase).catch(() => {});
                        }
                    }
                    // Grand announcement to tournament group
                    const wNames = winTeam.map(id => nicknameMap?.[String(id)]?.nickname || id).join(' + ');
                    const lNames = loseTeam.map(id => nicknameMap?.[String(id)]?.nickname || id).join(' + ');
                    const tourneyGroup = tourney.group_jid || duelGrpJid;
                    await chat.client?.sendMessage(tourneyGroup, {
                        text:
                            `╔══〘 🏆 ${tourney.phase === PHASES.DUO_GAUNTLET ? 'DUO GAUNTLET' : 'TOURNAMENT'} RESULT 〙══╗
` +
                            `┃★
` +
                            `┃★ 🏳️ *${pNick}* forfeited (timeout)
` +
                            `┃★
` +
                            `┃★ 🥇 *${wNames}* — WINNER
` +
                            `┃★ 💀 *${lNames}* — forfeited
` +
                            `┃★
` +
                            `┃★ *!tournament bracket* for standings
` +
                            `╚═══════════════════════════╝`
                    }).catch(() => {});
                }
            } catch(te) { console.error('[Tournament timeout record]', te.message); }
            // Demote both players from PvP group after timeout
            try {
                await demoteAfterDuel(chat?.client, [currentTurnId, opponentId]);
            } catch(e) {}
        } catch (e) {
            console.error("Turn timer error:", e.message);
        }
    }, timerMs);

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
        duelKey: key,
        type: (normalizedA.length > 1 || normalizedB.length > 1) ? 'party' : 'solo',
        groupJid: getPvpGroup() // store which group this duel belongs to
    });

    // Init MVP tracking for party duels only
    const isParty = normalizedA.length > 1 || normalizedB.length > 1;
    if (isParty) {
        initMvpTracking(key, [...normalizedA, ...normalizedB]);
    }

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
        await updateQuestProgress(winnerId, 'pvp_win', 1, chat || null);
        if (data?.type === 'party') {
            const winTeam = data.teamA.includes(String(winnerId)) ? data.teamA : data.teamB;
            for (const pid of winTeam) { updateQuestProgress(pid, 'party_duel', 1, chat || null).catch(() => {}); }
        }
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
        blessingMsg = `╔══〘 🐉 DRAGON'S BREATH 〙══╗
┃◆ ${player.nickname} explodes in draconic fury!
┃◆ ${damage} damage dealt to all enemies!
╚═══════════════════════════╝`;
        updateDuelBlessingState(player.id, { blessing_used: 1 });
    }

    if (trigger === 'on_kill') {
        const damage = Math.max(1, Math.floor(primaryStat * (blessing.multiplier || 3.0)));
        aliveEnemies.forEach(id => {
            data.hp[id] = Math.max(0, data.hp[id] - damage);
            // DEF -50% debuff on surviving enemies for 3 turns
            if (data.hp[id] > 0) {
                applyBuff('player', id, {
                    type: 'debuff', stat: 'stamina',
                    value: -(Math.floor((blessing.def_reduction || 50) / 100 * 100)),
                    percent: true, duration: 3, source: 'void_collapse'
                });
            }
        });
        const defLine = aliveEnemies.filter(id => data.hp[id] > 0).length > 0
            ? `
┃◆ 🛡️ Surviving enemies: DEF -${blessing.def_reduction || 50}% for 3 turns!` : '';
        blessingMsg = `╔══〘 🌑 VOID COLLAPSE 〙══╗
┃◆ ${player.nickname} collapses the arena!
┃◆ 💥 ${damage} damage to ALL remaining enemies!${defLine}
╚═══════════════════════════╝`;
        // on_kill is a REPEAT trigger — do NOT set blessing_used
        // Instead use last_triggered cooldown (30s) from state
    }

    if (trigger === 'enemy_below_25' && extraData.targetId) {
        const targetId = String(extraData.targetId);
        if (data.hp[targetId] > 0 && data.hp[targetId] <= Math.floor(data.maxHp[targetId] * 0.25)) {
            data.hp[targetId] = 0;
            blessingMsg = `╔══〘 💀 REAPER'S MARK 〙══╗
┃◆ ${player.nickname} finishes off ${extraData.targetName}!
┃◆ Execution completed.
╚═══════════════════════════╝`;
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
            blessingMsg = `╔══〘 ☄️ HEAVEN'S FALL 〙══╗
┃◆ ${player.nickname} calls down celestial fire!
┃◆ ${damage} damage to all enemies!
╚═══════════════════════════╝`;
        }
    }

    if (trigger === 'on_healed') {
        const healAmt = extraData.healAmount || 0;
        if (aliveEnemies.length) {
            const targetId = aliveEnemies[Math.floor(Math.random() * aliveEnemies.length)];
            const dmg = Math.max(1, Math.floor(healAmt * (blessing.heal_multiplier || 2.0)));
            data.hp[targetId] = Math.max(0, data.hp[targetId] - dmg);
            blessingMsg = `╔══〘 🕳️ ABYSSAL HUNGER 〙══╗
┃◆ ${player.nickname} turns healing into void strike!
┃◆ ${dmg} damage to an enemy!
╚═══════════════════════════╝`;
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
        blessingMsg = `╔══〘 👻 PHANTOM SHIFT 〙══╗
┃◆ ${player.nickname} refuses to fall!
┃◆ Revived at ${reviveHp} HP.
┃◆ All stats empowered for ${blessing.stat_boost_duration || 3} turns.
╚═══════════════════════════╝`;
        updateDuelBlessingState(player.id, { blessing_used: 1 });
    }

    if (trigger === 'all_allies_below_50') {
        const allLow = allies.length > 0 && allies.every(id => data.hp[id] > 0 && data.hp[id] <= Math.floor(data.maxHp[id] * 0.5));
        if (allLow) {
            updateDuelBlessingState(player.id, { damage_boost: 10.0, skill_count: 3, blessing_used: 1 });
            blessingMsg = `╔══〘 👁️ MALACHAR'S WILL 〙══╗
┃◆ ${player.nickname} channels Malachar.
┃◆ Next 3 attacks deal 1000% damage.
┃◆ Cannot be evaded.
╚═══════════════════════════╝`;
        }
    }

    if (trigger === 'three_consecutive_hits') {
        const newHits = (state.hit_count || 0) + 1;
        if (newHits >= 3) {
            updateDuelBlessingState(player.id, { hit_count: 0, invincible: 2, damage_boost: 4.0 });
            blessingMsg = `╔══〘 ⚡ TITAN'S ROAR 〙══╗
┃◆ 3 hits taken.
┃◆ ${player.nickname} erupts in fury!
┃◆ 🛡️ Invincible 2 turns.
┃◆ ⚡ Next hit: 400% damage.
╚═══════════════════════════╝`;
        } else {
            updateDuelBlessingState(player.id, { hit_count: newHits });
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
            `╭══〘 ⏰ TIME'S UP — DUEL STARTING 〙══╮
` +
            `┃◆ 
` +
            `┃◆ 2 minutes passed — starting with current rosters!
` +
            `┃◆ 
` +
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

    const betLine = bet > 0 ? `┃◆ 💰 Bet: ${bet} Gold per side
┃◆ 
` : '';

    await chat.sendMessage(
        `╭══〘 ⚔️  PARTY DUEL — ASSEMBLY PHASE 〙══╮
` +
        `┃◆ 
` +
        `┃◆ All challenges accepted! Both sides now have
` +
        `┃◆ *2 minutes* to assemble their full team.
` +
        `┃◆ Max *5 players* per side.
` +
        `┃◆ 
` +
        `${betLine}` +
        `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━
` +
        `┃◆ 📋  HOW TO JOIN
` +
        `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━
` +
        `┃◆ 
` +
        `┃◆ Join *${cNick}*'s side:
` +
        `┃◆    !joinparty @${cNick}
` +
        `┃◆ 
` +
        `┃◆ Join *${eRows[0]?.nickname || teamBLeader}*'s side:
` +
        `┃◆    !joinparty @${eRows[0]?.nickname || teamBLeader}
` +
        `┃◆ 
` +
        `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━
` +
        `┃◆ 🏁  STARTING THE DUEL
` +
        `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━
` +
        `┃◆ 
` +
        `┃◆ When your team is set, the *leader* types:
` +
        `┃◆    !startduel
` +
        `┃◆ Duel begins once *both* leaders confirm.
` +
        `┃◆ 
` +
        `┃◆ ━━━━━━━━━━━━━━━━━━━━━━━
` +
        `┃◆ 🔵  Team ${cNick} (1/5)
` +
        `┃◆    • ${cNick} [${cRank}] 👑 Leader
` +
        `┃◆ 
` +
        `┃◆ 🔴  Team ${eRows[0]?.nickname || teamBLeader} (${enemyIds.length}/5)
` +
        `${teamBLines}
` +
        `┃◆ 
` +
        `┃◆ ⏳ Auto-starts in 2 min if leaders don't confirm.
` +
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
        `┃◆ 🔵  Team ${aNick} (${state.teamA.length}/5)${state.teamAReady ? ' ✅ Ready' : ''}
` +
        `${aLines.join('\n')}
` +
        `┃◆ 
` +
        `┃◆ 🔴  Team ${bNick} (${state.teamB.length}/5)${state.teamBReady ? ' ✅ Ready' : ''}
` +
        `${bLines.join('\n')}
` +
        `┃◆ 
`
    );
}

// (normalizeId now comes from utils/identity — the old local copy here didn't
// strip the ':device' suffix, a latent identity-mismatch bug in PvP.)

function getAssemblyByLeader(leaderId) {
    const lid = normalizeId(leaderId);
    for (const [, state] of partyAssembly) {
        if (normalizeId(state.teamALeader) === lid || normalizeId(state.teamBLeader) === lid) return state;
    }
    return null;
}

function getAssemblyByPlayer(playerId) {
    const pid = normalizeId(playerId);
    for (const [, state] of partyAssembly) {
        if (state.teamA.map(normalizeId).includes(pid) || state.teamB.map(normalizeId).includes(pid)) return state;
    }
    return null;
}

async function joinPartyAssembly(joinerId, leaderTag) {
    const jid = normalizeId(joinerId);
    let state = null;
    let joiningA = false;

    for (const [, s] of partyAssembly) {
        const [aRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [s.teamALeader]);
        const [bRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [s.teamBLeader]);
        const aNick = (aRow[0]?.nickname || '').toLowerCase();
        const bNick = (bRow[0]?.nickname || '').toLowerCase();
        const tag   = normalizeId(leaderTag).toLowerCase();
        if (aNick === tag || normalizeId(s.teamALeader) === normalizeId(leaderTag)) { state = s; joiningA = true;  break; }
        if (bNick === tag || normalizeId(s.teamBLeader) === normalizeId(leaderTag)) { state = s; joiningA = false; break; }
    }
    if (!state) return { error: "No active party assembly found for that leader.\nMake sure you spell the nickname exactly as it appears." };

    if (state.teamA.map(normalizeId).includes(jid) || state.teamB.map(normalizeId).includes(jid))
        return { error: "You are already in this party duel." };
    if (isPlayerInDuel(jid))
        return { error: "You are already in an active duel." };

    const targetTeam = joiningA ? state.teamA : state.teamB;
    if (targetTeam.length >= 5)
        return { error: `That side is full (max 5 players).` };

    targetTeam.push(jid);

    const rosterMsg = await buildRosterMessage(state);
    const [jRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [jid]);
    const jNick  = jRow[0]?.nickname || jid;
    const [lRow] = await db.execute('SELECT nickname FROM players WHERE id=?',
        [joiningA ? state.teamALeader : state.teamBLeader]);
    const leaderNick = lRow[0]?.nickname || (joiningA ? state.teamALeader : state.teamBLeader);

    return { success: true, jNick, leaderNick, rosterMsg };
}

async function readyPartyDuel(leaderId, chat) {
    // Normalize ID to strip :0 suffix and @s.whatsapp.net that Baileys adds
    const lid = normalizeId(String(leaderId));
    const state = getAssemblyByLeader(lid);
    if (!state) {
        // Check if there's a pending tournament duel for this player
        // Try both normalized and raw form in case of key format mismatch
        const pendingTD = tournamentDuelPending.get(lid) ||
            [...tournamentDuelPending.entries()].find(([k]) => normalizeId(k) === lid)?.[1];
        if (pendingTD) {
            const opponentId = pendingTD.opponentId;
            const pvpGroup = getPvpGroup();
            // Build a chat object that sends to the PvP group
            const pvpClient = chat?.client || (chat?.sendMessage ? null : null);
            const pvpChat = {
                sendMessage: async (text) => {
                    const client = chat?.client;
                    if (client && pvpGroup) {
                        await client.sendMessage(pvpGroup, typeof text === 'string' ? { text } : text).catch(() => {});
                    } else if (chat?.reply) {
                        await chat.reply(typeof text === 'string' ? text : text.text).catch(() => {});
                    }
                }
            };
            const oppEntry = tournamentDuelPending.get(opponentId) ||
                [...tournamentDuelPending.entries()].find(([k]) => normalizeId(k) === normalizeId(opponentId))?.[1];
            if (oppEntry?.opponentId && normalizeId(oppEntry.opponentId) === lid) {
                // Both sides ready — start the duel in PvP group
                // Delete by actual map key (may differ from normalized form)
                for (const [k] of tournamentDuelPending) {
                    if (normalizeId(k) === lid || normalizeId(k) === normalizeId(opponentId))
                        tournamentDuelPending.delete(k);
                }
                // Promote both players in PvP group
                const client = chat?.client;
                if (client) await promoteForDuel(client, [lid, opponentId]);
                await startPvPDuel([lid], [opponentId], 0, client, null, pvpChat);
                return { success: true, started: true };
            }
            // First side ready — wait for opponent
            const [oppRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [opponentId]);
            return { success: true, waiting: oppRow[0]?.nickname || opponentId, rosterMsg: '' };
        }
        return { error: "You are not a party leader in any active assembly.\nOnly the challenger and the first enemy to accept can use !startduel." };
    }

    if (state.teamALeader === lid) state.teamAReady = true;
    if (state.teamBLeader === lid) state.teamBReady = true;

    if (!state.teamAReady || !state.teamBReady) {
        const waitingLeaderId = !state.teamAReady ? state.teamALeader : state.teamBLeader;
        const [wRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [waitingLeaderId]);
        const waitingNick = wRow[0]?.nickname || waitingLeaderId;
        const rosterMsg = await buildRosterMessage(state);
        return { success: true, waiting: waitingNick, rosterMsg };
    }

    // Both ready — use state.chat which was properly resolved via msg.getChat() in accept.js
    clearTimeout(state.timer);
    partyAssembly.delete(state.assemblyKey);
    await startPvPDuel(state.teamA, state.teamB, state.bet, null, null, state.chat);
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
        ? `┃◆ 💰 Bet: ${betAmount} Gold each — Pot: ${betAmount * 2} Gold
`
        : ``;

    const formatMember = p =>
        `┃◆  • ${p.nickname} [${p.rank}] ${p.role} — 💪${p.strength} ⚡${p.agility} 🧠${p.intelligence} 🛡️${p.stamina}`;
    const teamAInfo = teamAPlayers.map(formatMember).join('\n');
    const teamBInfo = teamBPlayers.map(formatMember).join('\n');

    const teamALabel = teamA.length > 1 ? `🔵 Team ${teamAPlayers[0].nickname}` : `🔵 ${teamAPlayers[0].nickname}`;
    const teamBLabel = teamB.length > 1 ? `🔴 Team ${teamBPlayers[0].nickname}` : `🔴 ${teamBPlayers[0].nickname}`;

    await chat.sendMessage(
        `╭══〘 ⚔️ DUEL BEGINS 〙══╮
` +
        `┃◆ ${teamALabel}
` +
        `${teamAInfo}
` +
        `┃◆ ━━━━ ⚔️ VS ⚔️ ━━━━
` +
        `┃◆ ${teamBLabel}
` +
        `${teamBInfo}
` +
        `┃◆ ━━━━━━━━━━━━
` +
        `${betLine}` +
        `┃◆ ⚡ ${firstPlayer.nickname} goes first!
` +
        `┃◆ ⏰ ${territoryWars.has(getDuelKey(teamAPlayers[0], teamBPlayers[0])) ? '2 min' : '45s'} per turn — miss it and you forfeit.
` +
        `┃◆ Use !attack <move> to fight.
` +
        `╰═══════════════════════════╯`
    );

    return { active: true, firstTurn, teamAPlayers, teamBPlayers };
}

// ── Victory Handler ───────────────────────────────────────────────────────────
async function handleVictory(winnerId, loserId, chat, duelData, winnerNick, loserNick, winnerHp) {
    const duelKey = duelData?.duelKey || getDuelKey(winnerId, loserId);
    clearTurnTimer(duelKey);
    // Demote both players from PvP group after duel
    try {
        const allPlayers = [...(duelData.teamA || [winnerId]), ...(duelData.teamB || [loserId])];
        const client = chat?.client;
        if (client) await demoteAfterDuel(client, allPlayers);
    } catch(e) {}
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

        // Record in active tournament (use team leaders — first member of each team)
        try {
            const { getActiveTournament, recordMatchResult, PHASES } = require('../systems/tournamentSystem');
            const duelGroupJidP = duelData?.groupJid || getPvpGroup();
            const tourney = await getActiveTournament(duelGroupJidP);
            if (tourney && [PHASES.BATTLE_ROYALE, PHASES.DUO_GAUNTLET, PHASES.GRAND_FINALS].includes(tourney.phase)) {
                const norm = id => String(id).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g,'').split(':')[0];
                for (const wId of winners) {
                    for (const lId of losers) {
                        await recordMatchResult(tourney.id, norm(wId), norm(lId), tourney.phase).catch(() => {});
                    }
                }

                // Grand announcement to tournament GC for duo/party results
                const tourneyGroup = tourney.group_jid || process.env.RAID_GROUP_JID;
                const pvpGrpP = getPvpGroup();
                const announceTargetP = (tourneyGroup && tourneyGroup !== pvpGrpP) ? tourneyGroup : pvpGrpP;
                if (announceTargetP && chat?.client) {
                    const winnerNames = winners.map(id => nicknameMap[String(id)]?.nickname || id).join(' + ');
                    const [loserRows] = await db.execute(
                        `SELECT id, nickname FROM players WHERE id IN (${losers.map(() => '?').join(',')})`,
                        losers
                    ).catch(() => [[]]);
                    const loserNickMap = Object.fromEntries(loserRows.map(r => [String(r.id), r.nickname]));
                    const loserNames = losers.map(id => loserNickMap[String(id)] || id).join(' + ');
                    const isDuo = tourney.phase === PHASES.DUO_GAUNTLET;
                    await chat.client.sendMessage(announceTargetP, {
                        text:
                            `╔══〘 🏆 ${isDuo ? 'DUO GAUNTLET' : 'GRAND FINALS'} RESULT 〙══╗
` +
                            `┃★
` +
                            `┃★ ⚔️ Match complete!
` +
                            `┃★
` +
                            `┃★ 🥇 *${winnerNames}* — WINNER${isDuo ? 'S' : ''}
` +
                            `┃★ 💀 *${loserNames}* — defeated
` +
                            `┃★
` +
                            `┃★ *!tournament bracket* for standings
` +
                            `╚═══════════════════════════╝`
                    }).catch(() => {});
                }
            }
        } catch(e) { console.error('[TOURNAMENT record party]', e.message); }

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
            `╭══〘 🏆 PARTY DUEL OVER 〙══╮
` +
            `┃◆ ⚔️ ${winnerNick}'s team stands victorious!
` +
            `┃◆ ━━━━━━━━━━━━━━━━
` +
            `┃◆ 🟢 Survivors
` +
            `${survivorLines}
` +
            `${titleLines.length ? `┃◆ ━━━━━━━━━━━━━━━━
${titleLines.join('\n')}
` : ''}` +
            `╰═══════════════════════════╯`
        );
        // Territory war resolution
        try {
            const warCtx = territoryWars.get(duelKey);
            if (warCtx) {
                territoryWars.delete(duelKey);
                const { claimTerritory, TERRITORIES } = require('./voidTerritories');
                const { addVoidResonance } = require('./ascendantSystem');
                const getRaidGroup = () => (global.overrideRaidGroup || process.env.RAID_GROUP_JID) || (global.overrideRaidGroup || '120363213735662100@g.us');
                const terr = TERRITORIES[warCtx.tid];
                const attackersWon = winners.some(id => warCtx.attackers.includes(String(id)));

                if (attackersWon) {
                    await claimTerritory(warCtx.tid, warCtx.attackerClan);
                    await db.execute("UPDATE territory_wars SET status='completed', winner_clan=? WHERE territory_id=? AND attacker_clan=? AND status IN ('pending','active')", [warCtx.attackerClan, warCtx.tid, warCtx.attackerClan]);
                    for (const pid of warCtx.attackers) { addVoidResonance(pid, 'territory_war_win', chat).catch(() => {}); }
                    const [aClan] = await db.execute('SELECT name FROM clans WHERE id=?', [warCtx.attackerClan]);
                    await chat.sendMessage({
                        text: '╔══〘 🌑 TERRITORY SEIZED 〙══╗\n┃★\n┃★ ' + (terr?.emoji || '') + ' *' + (terr?.name || warCtx.tid) + '*\n┃★ now belongs to *' + (aClan[0]?.name || 'Attackers') + '*.\n┃★\n┃★ Bonus: ' + (terr?.bonus?.description || '') + '\n┃★\n╚═══════════════════════════╝'
                    }).catch(() => {});
                } else {
                    await db.execute("UPDATE territory_wars SET status='completed', winner_clan=? WHERE territory_id=? AND defender_clan=? AND status IN ('pending','active')", [warCtx.defenderClan, warCtx.tid, warCtx.defenderClan]);
                    const [dClan] = await db.execute('SELECT name FROM clans WHERE id=?', [warCtx.defenderClan]);
                    await chat.sendMessage({
                        text: '╔══〘 🛡️ TERRITORY HELD 〙══╗\n┃★\n┃★ ' + (terr?.emoji || '') + ' *' + (terr?.name || warCtx.tid) + '*\n┃★ stands firm for *' + (dClan[0]?.name || 'Defenders') + '*.\n┃★\n┃★ The assault has been repelled.\n┃★\n╚═══════════════════════════╝'
                    }).catch(() => {});
                }
                // Clean up dungeon
                await db.execute('UPDATE dungeon SET is_active=0, locked=0 WHERE id=?', [warCtx.dungeonId]).catch(() => {});
                await db.execute('DELETE FROM dungeon_players WHERE dungeon_id=?', [warCtx.dungeonId]).catch(() => {});
            }
        } catch(terrErr) { console.error('[TerritoryWar victory]', terrErr.message); }

        return { winner: winners };
    }

    // ── SOLO VICTORY ──────────────────────────────────────────────────────────
    await db.execute("UPDATE players SET pvp_wins   = pvp_wins   + 1 WHERE id=?", [winnerId]);
    await db.execute("UPDATE players SET pvp_losses = pvp_losses + 1 WHERE id=?", [loserId]);

    // ── BOUNTY TRACKING — record win against bounty target ────────────────────
    try {
        const { getActiveBounty, ensureTables: ensureBountyTables } = require('../commands/bounty');
        await ensureBountyTables();
        const activeBounty = await getActiveBounty();
        if (activeBounty && String(loserId) === String(activeBounty.target_id) && String(winnerId) !== String(activeBounty.target_id)) {
            await db.execute(
                'INSERT INTO bounty_duels (bounty_id, winner_id, target_id) VALUES (?, ?, ?)',
                [activeBounty.id, String(winnerId), String(loserId)]
            );
        }
    } catch(e) { console.log('[BOUNTY] tracking error:', e.message); }

    const [wRow] = await db.execute("SELECT `rank`, prestige_level FROM players WHERE id=?", [winnerId]);
    const [lRow] = await db.execute("SELECT `rank`, prestige_level FROM players WHERE id=?", [loserId]);
    const wRank  = wRow[0]?.rank || '?';
    const lRank  = lRow[0]?.rank || '?';

    let betLine = '';
    if (duelData.bet > 0) {
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [duelData.bet * 2, winnerId]);
        betLine = `┃◆ 💰 Prize: ${duelData.bet * 2} Gold claimed
`;
    }

    await trackPvPWin(winnerId);
    const newTitle = await checkAndGrantTitle(winnerId);
    const titleLine = newTitle ? `┃◆ 🎖️ New title: "${newTitle}"
` : '';

    // Record result in active tournament + grand announcement to tournament GC
    try {
        const { getActiveTournament, recordMatchResult, PHASES } = require('../systems/tournamentSystem');
        // Use the group the duel was started in to scope tournament lookup
        const duelGroupJid = duelData?.groupJid || getPvpGroup();
        const tourney = await getActiveTournament(duelGroupJid);
        if (tourney && [PHASES.BATTLE_ROYALE, PHASES.DUO_GAUNTLET, PHASES.GRAND_FINALS].includes(tourney.phase)) {
            const normWin = String(winnerId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g,'').split(':')[0];
            const normLos = String(loserId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g,'').split(':')[0];
            await recordMatchResult(tourney.id, normWin, normLos, tourney.phase);

            // Grand announcement to tournament GC (different from pvp duel chat)
            const tourneyGroup = tourney.group_jid || process.env.RAID_GROUP_JID;
            const pvpGrp = getPvpGroup();
            const announceTarget = (tourneyGroup && tourneyGroup !== pvpGrp) ? tourneyGroup : pvpGrp;
            if (announceTarget && chat?.client) {
                await chat.client.sendMessage(announceTarget, {
                    text:
                        `╔══〘 🏆 BATTLE ROYALE RESULT 〙══╗
` +
                        `┃★
` +
                        `┃★ ⚔️ Match complete!
` +
                        `┃★
` +
                        `┃★ 🥇 *${winnerNick}* [${wRank}] — WINNER
` +
                        `┃★ 💀 *${loserNick}* [${lRank}] — defeated
` +
                        `┃★
` +
                        `┃★ *!tournament bracket* for standings
` +
                        `╚═══════════════════════════╝`
                }).catch(() => {});
            }
        }
    } catch(e) { console.error('[TOURNAMENT record]', e.message); }

    // Announce duel result in PvP group
    await chat.sendMessage(
        `╭══〘 🏆 DUEL OVER 〙══╮
` +
        `┃◆ ${await narrateAI('pvpVictory', { winner: winnerNick, loser: loserNick })}
` +
        `┃◆ ━━━━━━━━━━━━━━━━
` +
        `┃◆ 🥇 *${winnerNick}* [${wRank}] WINS
` +
        `┃◆ 💀 ${loserNick} [${lRank}] defeated
` +
        `┃◆ ━━━━━━━━━━━━━━━━
` +
        `┃◆ ❤️ ${winnerNick}: ${winnerHp}/${duelData.maxHp[winnerId] || DUEL_HP}
` +
        `┃◆ 💀 ${loserNick}: 0/${duelData.maxHp[loserId] || DUEL_HP}
` +
        `${betLine}` +
        `${titleLine}` +
        `╰═══════════════════════════╯`
    );

    // ARIA witnesses the duel outcome
    const { witnessDuelResult } = require('./ariaAwareness');
    witnessDuelResult(winnerId, winnerNick, loserId, loserNick, duelData.type || 'solo').catch(() => {});

    // FIX: MVP announcement for ALL duel types (solo + party)
    try {
        const allPlayers = [
            ...(duelData.teamA || [winnerId]),
            ...(duelData.teamB || [loserId])
        ].map(id => String(id).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '').split(':')[0]);
        const duelKey   = duelData.duelKey || getDuelKey(winnerId, loserId);
        const mvpResult = await calculateMvp(duelKey, allPlayers, 'duel');
        if (mvpResult?.message) {
            await chat.sendMessage(mvpResult.message).catch(() => {});
        }
    } catch (e) { console.error('[MVP duel]', e.message); }

    return { winner: winnerId };
}

// ── Shared combat message ─────────────────────────────────────────────────────
async function sendCombatMessage(chat, attackerNick, opponentNick, moveName, damage, attackerHp, opponentHp, nextTurnNick, roundNum, extra = '', attackerMaxHp = DUEL_HP, opponentMaxHp = DUEL_HP, isWar = false) {
    const header = isWar
        ? `╔══〘 ⚔️ TERRITORY WAR — ROUND ${roundNum} 〙══╗`
        : `══〘 ⚔️ DUEL — ROUND ${roundNum} 〙══╮`;
    const footer = isWar ? `╚═══════════════════════════╝` : `╰═══════════════════════╯`;
    const bul = isWar ? '┃★' : '┃◆';

    const narration = await narrateAI('skillDamage', { attacker: attackerNick, move: moveName, target: opponentNick, damage }).catch(() => '');

    // HP bars
    const hpBar = (hp, max) => {
        const pct = Math.max(0, Math.min(10, Math.floor((hp / max) * 10)));
        return '🟥'.repeat(pct) + '⬛'.repeat(10 - pct);
    };

    await chat.sendMessage(
        `${header}
` +
        `${bul}
` +
        (narration ? `${bul} 〝${narration}〞
${bul}
` : '') +
        `${bul} 💥 *${moveName}* — ${damage.toLocaleString()} damage
` +
        `${extra}` +
        `${bul}────────────
` +
        `${bul} ❤️ ${attackerNick}: ${hpBar(attackerHp, attackerMaxHp)} ${attackerHp.toLocaleString()}/${attackerMaxHp.toLocaleString()}
` +
        `${bul} ❤️ ${opponentNick}: ${hpBar(opponentHp, opponentMaxHp)} ${opponentHp.toLocaleString()}/${opponentMaxHp.toLocaleString()}
` +
        `${bul}────────────
` +
        `${bul} ⚡ *${nextTurnNick}'s turn!* ⏰ 45s
` +
        `${footer}`
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
    if (f >= 90) return `┃◆ ⚠️ ${formatFatigueBar(f)} (${f}%) — *BREAKING POINT. Attacks deal 1 damage!*
`;
    if (f >= 75) return `┃◆ ⚠️ ${formatFatigueBar(f)} (${f}%) — *The strain is overwhelming!*
`;
    if (f >= 50) return `┃◆ ⚠️ ${formatFatigueBar(f)} (${f}%) — *You're pushing your limits!*
`;
    if (f >= 25) return `┃◆ 🔥 ${formatFatigueBar(f)} (${f}%) — you're getting tired.
`;
    return '';
}

async function handlePvPSkill(attackerId, move, targetIds) {
    const duel = activeDuels.get(attackerId);
    if (!duel) return { error: "You are not in a duel." };

    const chat = duel.chat;
    const data = duelPool.get(duel.duelKey);
    if (!data) return { error: "Duel data missing." };

    // Party duels — any member of the current team can act
    const isPartyDuel = data.teamA.length > 1 || data.teamB.length > 1;
    if (!isPartyDuel) {
        if (duel.turn !== attackerId) return { error: "It's not your turn!" };
    } else {
        const myTeam = data.teamA.map(String).includes(String(attackerId)) ? 'A' : 'B';
        const currentTeam = data.teamA.map(String).includes(String(duel.turn)) ? 'A' : 'B';
        if (myTeam !== currentTeam) return { error: "It's not your team's turn!" };
    }

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
        // PvP caps at 98% — applied last after all multipliers
        const results = [];
        let allDefeated = [];

        for (const tid of enemyTargets) {
            const [dRows] = await db.execute("SELECT * FROM players WHERE id=?", [tid]);
            if (!dRows.length) continue;
            const def = dRows[0];
            const defHp = data.hp[tid];
            const defForCalc = { ...def, hp: defHp, max_hp: data.maxHp[tid] };
            // Fetch fresh fatigue for attacker
            let attackerWithFatigue = attacker;
            try {
                const [fRow] = await db.execute('SELECT fatigue FROM players WHERE id=?', [attacker.id]);
                if (fRow.length) attackerWithFatigue = { ...attacker, fatigue: Number(fRow[0].fatigue) || 0 };
            } catch(e) {}
            let dmg = calculateMoveDamage(attackerWithFatigue, move, defForCalc, items);

    // Apply damage_boost from Titan's Roar (#4) or Malachar's Will (#10)
    const atkBlessState = getDuelBlessingState(attackerId);
    const pvpBoost = Number(atkBlessState.damage_boost || 0);
    if (pvpBoost >= 1) {
        dmg = Math.floor(dmg * pvpBoost);
        // Consume charge
        const newCharges = (atkBlessState.skill_count || 0) - 1;
        updateDuelBlessingState(attackerId, {
            skill_count: Math.max(0, newCharges),
            damage_boost: newCharges > 0 ? pvpBoost : 0
        });
    }
            // Apply attacker potion buffs
            try {
                const { getTurnEffectByName } = require('./potionEffects');
                const bFxP = getTurnEffectByName(String(attackerId), 'berserk');
                if (bFxP) dmg = Math.floor(dmg * (bFxP.data.mult || 3.0));
                const sFxP = getTurnEffectByName(String(attackerId), 'stat_boost');
                if (sFxP) dmg = Math.floor(dmg * (sFxP.data.mult || 1.25));
                const cFxP = getTurnEffectByName(String(attackerId), 'chaos_mode');
                if (cFxP) dmg = Math.floor(dmg * (1 + (cFxP.data.amp || 0.5)));
            } catch(e) {}

            // Apply defender shield absorption
            try {
                const { getBuffModifiers, consumeShield } = require('./activeBuffs');
                const defMods = getBuffModifiers('player', String(tid));
                if (defMods?.shield > 0) {
                    const absorbed = Math.min(defMods.shield, dmg);
                    if (absorbed > 0) {
                        consumeShield('player', String(tid), absorbed);
                        dmg = Math.max(0, dmg - absorbed);
                    }
                }
            } catch(e) {}

            // 98% PvP cap — applied LAST so no multiplier can bypass it
            dmg = Math.max(1, Math.floor(dmg * PVP_DAMAGE_SCALE));

            const newHp = Math.max(0, defHp - dmg);
            data.hp[tid] = newHp;
            results.push({ tid, nick: def.nickname, rank: def.rank, dmg, newHp, maxHp: data.maxHp[tid], defeated: newHp <= 0 });
            if (newHp <= 0) {
                // Check Mirror Toxin (death_reflect) — killer takes the hit instead
                try {
                    const { getEffectByName, consumeCharge } = require('./potionEffects');
                    const mirror = getEffectByName(String(tid), 'death_reflect', null);
                    if (mirror) {
                        // Reflect — kill the attacker instead, revive defender
                        data.hp[tid] = 1;
                        data.hp[String(attackerId)] = 0;
                        consumeCharge(String(tid));
                        results.push({ tid: String(attackerId), nick: attacker.nickname, rank: attacker.rank, dmg: 0, newHp: 0, maxHp: data.maxHp[String(attackerId)], defeated: true });
                        allDefeated.push({ tid: String(attackerId), nick: attacker.nickname, rank: attacker.rank, def: attacker });
                        await chat.sendMessage(`🪞 *Mirror Toxin!*
┃★ ${def.nickname}'s death rebounds!
┃★ ${attacker.nickname} is destroyed instead!`);
                    } else {
                        allDefeated.push({ tid, nick: def.nickname, rank: def.rank, def });
                    }
                } catch(e) {
                    allDefeated.push({ tid, nick: def.nickname, rank: def.rank, def });
                }
            }
        }

        const totalDmg = results.reduce((s, r) => s + r.dmg, 0);
        const baseFatigue = Math.min(4, Math.max(1, Math.ceil(totalDmg / 120)));
        const fatigue = multiTargetFatigue(baseFatigue, numTargets);
        await increasePlayerFatigue(attackerId, fatigue, attacker);
        const [freshAttacker] = await db.execute("SELECT fatigue FROM players WHERE id=?", [attackerId]);
        const currentFatigue = freshAttacker[0]?.fatigue || 0;

        // ── Build display lines ────────────────────────────────────────────
        const dmgLines   = results.map(r =>
            `┃◆ 💥 ${r.nick} [${r.rank}]: -${r.dmg} HP  (${r.newHp <= 0 ? '💀 0' : r.newHp}/${r.maxHp})`
        ).join('\n');
        const totalLine  = numTargets > 1 ? `┃◆ ━━ Total: ${totalDmg} across ${numTargets} targets
` : '';
        const fatigueWarn = fatigueWarning(currentFatigue);
        const narrative  = await narrateAI('skillDamage', { attacker: attacker.nickname, move: move.name, target: results[0]?.nick, damage: totalDmg });

        // ── Collect blessings (don't send yet) ────────────────────────────
        const pendingBlMsgs = [];
        for (const { tid, def } of allDefeated) {
            // Demote defeated player from admin in raid GC
            try {
                const RAID_GROUP_JID = (global.overrideRaidGroup || process.env.RAID_GROUP_JID) || (global.overrideRaidGroup || '120363213735662100@g.us');
                if (chat.client) {
                    const metadata = await chat.client.groupMetadata(RAID_GROUP_JID).catch(() => null);
                    if (metadata) {
                        const participant = metadata.participants.find(p =>
                            String(p.id).replace(/@[^@]+$/,'').split(':')[0] === String(tid)
                        );
                        if (participant) {
                            await chat.client.groupParticipantsUpdate(RAID_GROUP_JID, [participant.id], 'demote').catch(() => {});
                        }
                    }
                }
            } catch(e) {}
            const bl = await triggerBlessingIfReadyInDuel('on_death', def, data, { attackerId }).catch(() => null);
            if (bl?.message) pendingBlMsgs.push(bl.message);
        }
        if (allDefeated.length > 0) {
            const bl = await triggerBlessingIfReadyInDuel('on_kill', attacker, data).catch(() => null);
            if (bl?.message) {
                const oppIds = data.teamA.includes(String(attackerId)) ? data.teamB : data.teamA;
                const fieldLines = oppIds.map(id => {
                    const r = results.find(r => r.tid === id);
                    return `┃◆  • ${r?.nick || id}: ❤️ ${data.hp[id]}/${data.maxHp[id]}`;
                }).join('\n');
                const extra = (bl.killedIds || []).length ? `┃◆ ☠️ ${bl.killedIds.length} more fell!
` : '';
                pendingBlMsgs.push(`${bl.message}
┃◆ ━━ Field ━━
${fieldLines}
${extra}╰════════════════╯`);
                (bl.killedIds || []).forEach(id => {
                    if (!allDefeated.find(d => d.tid === id))
                        allDefeated.push({ tid: id, nick: id, rank: '?', def: {} });
                });
            }
        }
        const bl25 = await triggerBlessingIfReadyInDuel('enemy_below_25', attacker, data, { targetId: enemyTargets[0], targetName: results[0]?.nick }).catch(() => null);
        if (bl25?.message) pendingBlMsgs.push(bl25.message);
        await trackBlessings();

        // Re-filter allDefeated — Phantom Shift may have revived someone
        allDefeated = allDefeated.filter(d => (data.hp[d.tid] || 0) <= 0);

        // ── Check surviving opponents AFTER all blessings ─────────────────
        const oppSide = data.teamA.includes(String(attackerId)) ? data.teamB : data.teamA;
        const survivingOpponents = oppSide.filter(id => data.hp[id] > 0);
        const duelOver = survivingOpponents.length === 0;

        // ── Advance turn ONLY if duel continues ────────────────────────────
        let nextTurn     = null;
        let nextTurnLine = '';
        if (!duelOver) {
            data.round++;
            nextTurn = await nextTurnAfterMove();
            const [nRow] = nextTurn ? await db.execute("SELECT nickname FROM players WHERE id=?", [nextTurn]) : [[]];
            const nextNick = nRow[0]?.nickname || 'next player';
            nextTurnLine = `┃◆ ━━━━━━━━━━━━━━━━
┃◆ ⚡ *${nextNick}'s turn!*  ⏰ 45 seconds
`;
        }

        // ── 1. ATTACK MESSAGE ──────────────────────────────────────────────
        await chat.sendMessage(
            `╭══〘 ⚔️ ROUND ${round} 〙══╮
` +
            `┃◆ ${narrative}
` +
            `┃◆ ━━━━━━━━━━━━━━━━
` +
            `${dmgLines}
` +
            `${totalLine}` +
            `┃◆ ❤️ ${attacker.nickname}: ${attackerHp}/${data.maxHp[attackerId]}
` +
            `${fatigueWarn}` +
            `${nextTurnLine}` +
            `╰═══════════════════════════╯`
        );

        // ── 2. BLESSING MESSAGES ───────────────────────────────────────────
        for (const bMsg of pendingBlMsgs) {
            await chat.sendMessage(bMsg).catch(() => {});
        }

        // ── 3. VICTORY ─────────────────────────────────────────────────────
        if (duelOver) {
            const loserNick = allDefeated.map(d => d.nick).join(' & ');
            return await handleVictory(attackerId, allDefeated[0]?.tid || enemyTargets[0], chat, data,
                attacker.nickname, loserNick, attackerHp);
        }

        // ── 4. KILL ANNOUNCEMENTS (mid-fight, opponents remain) ───────────
        if (allDefeated.length > 0) {
            await chat.sendMessage(
                `╭══〘 ☠️ ELIMINATED 〙══╮
` +
                `${allDefeated.map(d => `┃◆ 💀 ${d.nick} [${d.rank}] defeated!`).join('\n')}
` +
                `┃◆ ${survivingOpponents.length} opponent(s) remain.
` +
                `╰═══════════════════════════╯`
            ).catch(() => {});
        }

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
            // Record heal for MVP
            if (data.type === 'party') recordHeal(duel.duelKey, attackerId, newHp - oldHp);
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
            `══〘 💚 DUEL HEAL — ROUND ${round} 〙══╮
` +
            `┃◆ ${await narrateAI('heal', { healer: attacker.nickname, target: results.map(r => r.nick).join(' & '), heal: totalHealed })}
` +
            `${healLines}
` +
            `${numTargets > 1 ? `┃◆ ━━ Total healed: ${totalHealed}
` : ''}` +
            `${fatigueWarn}` +
            `┃◆────────────
` +
            `┃◆ ⚡ ${nextTurnName}'s turn! ⏰ 45 seconds!
` +
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
            `══〘 ⬆️ DUEL BUFF — ROUND ${round} 〙══╮
` +
            `┃◆ ${await narrateAI('buff', { caster: attacker.nickname, target: results.join(' & '), move: move.name, stat: move.effect, value: move.value, duration: move.duration || 3 })}
` +
            `┃◆ ${pctLabel} ${statName.toUpperCase()} → ${results.join(', ')} for ${move.duration || 3} turns
` +
            `${fatigueWarn}` +
            `┃◆────────────
` +
            `┃◆ ⚡ ${nextTurnName}'s turn! ⏰ 45 seconds!
` +
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
            `══〘 ⬇️ DUEL DEBUFF — ROUND ${round} 〙══╮
` +
            `┃◆ ${await narrateAI('debuff', { caster: attacker.nickname, target: results.join(' & '), move: move.name, stat: move.effect, value: Math.abs(move.value), duration: move.duration || 2 })}
` +
            `┃◆ -${pctLabel} ${statName.toUpperCase()} → ${results.join(', ')} for ${move.duration || 2} turns
` +
            `${fatigueWarn}` +
            `┃◆────────────
` +
            `┃◆ ⚡ ${nextTurnName}'s turn! ⏰ 45 seconds!
` +
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

    const chat = duel.chat;
    const data = duelPool.get(duel.duelKey);
    if (!data) return { error: "Duel data missing." };

    // Party duels — any member of the current team can act
    const isPartyDuel2 = data.teamA.length > 1 || data.teamB.length > 1;
    if (!isPartyDuel2) {
        if (duel.turn !== attackerId) return { error: "It's not your turn!" };
    } else {
        const myTeam2 = data.teamA.map(String).includes(String(attackerId)) ? 'A' : 'B';
        const currentTeam2 = data.teamA.map(String).includes(String(duel.turn)) ? 'A' : 'B';
        if (myTeam2 !== currentTeam2) return { error: "It's not your team's turn!" };
    }

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
    // Defense = stamina stat + defense_bonus from equipped weapons
    let defWeaponBonus = 0;
    items.forEach(i => defWeaponBonus += Number(i.defense_bonus || 0));
    const defence  = (Number(defender.stamina) || 0) + defWeaponBonus;
    const fatigueMultiplier = getFatigueMultiplier(attacker);
    const baseDamage = Math.max(1, Math.floor((baseDmg - defence / 2) * fatigueMultiplier));
    const round    = data.round;

    const attackerHp = data.hp[attackerId];

    // Apply attacker potion buffs in solo duel
    let finalDamage = baseDamage;
    try {
        const { getTurnEffectByName } = require('./potionEffects');
        const bFxS = getTurnEffectByName(String(attackerId), 'berserk');
        if (bFxS) finalDamage = Math.floor(finalDamage * (bFxS.data.mult || 3.0));
        const sFxS = getTurnEffectByName(String(attackerId), 'stat_boost');
        if (sFxS) finalDamage = Math.floor(finalDamage * (sFxS.data.mult || 1.25));
        const cFxS = getTurnEffectByName(String(attackerId), 'chaos_mode');
        if (cFxS) finalDamage = Math.floor(finalDamage * (1 + (cFxS.data.amp || 0.5)));
    } catch(e) {}

    // Apply defender shield absorption in solo duel
    try {
        const { getBuffModifiers, consumeShield } = require('./activeBuffs');
        const defMods = getBuffModifiers('player', String(targetId));
        if (defMods?.shield > 0) {
            const absorbed = Math.min(defMods.shield, finalDamage);
            if (absorbed > 0) {
                consumeShield('player', String(targetId), absorbed);
                finalDamage = Math.max(0, finalDamage - absorbed);
            }
        }
    } catch(e) {}

    // 98% PvP cap — applied LAST after all multipliers and shield
    finalDamage = Math.max(1, Math.floor(finalDamage * PVP_DAMAGE_SCALE));

    const newDefHp = Math.max(0, data.hp[targetId] - finalDamage);
    data.hp[targetId] = newDefHp;

    // FIX: Record for MVP for ALL duel types (solo + party)
    try {
        if (!mvpStats.has(duel.duelKey)) {
            // Late-init MVP tracking if not already done (e.g. solo duels)
            const allIds = [...(data.teamA || []), ...(data.teamB || [])];
            initMvpTracking(duel.duelKey, allIds);
        }
        recordDamage(duel.duelKey, attackerId, targetId, damage, damage);
        if (newDefHp <= 0) recordKill(duel.duelKey, attackerId);
    } catch(e) { console.error('[MVP record]', e.message); }

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
                `╭══〘 👻 PHANTOM SHIFT 〙══╮
` +
                `┃◆ ${defender.nickname} refuses to fall and returns with vengeance!
` +
                `┃◆ ❤️ Revived — next: ${nextTurn || defender.nickname}
` +
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
                `╭══〘 ☠️ ELIMINATED 〙══╮
` +
                `┃◆ 💀 ${defender.nickname} has been defeated!
` +
                `┃◆ ${remainingOpponents.length} opponent(s) remain.
` +
                `┃◆ ⚡ Next: ${nextName}
` +
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
    // hp_below_30 fires when DEFENDER'S HP drops below 30%
    const blLow = await triggerBlessingIfReadyInDuel('hp_below_30', defender, data).catch(() => null);
    if (blLow) await chat.sendMessage(blLow.message).catch(() => {});
    const bl5 = await triggerBlessingIfReadyInDuel('every_5_skills', attacker, data).catch(() => null);
    if (bl5) await chat.sendMessage(bl5.message).catch(() => {});
    const blAll = await triggerBlessingIfReadyInDuel('all_allies_below_50', attacker, data).catch(() => null);
    if (blAll) await chat.sendMessage(blAll.message).catch(() => {});
    // Titan's Roar — defender took a hit, track consecutive hits
    const blTitan = await triggerBlessingIfReadyInDuel('three_consecutive_hits', defender, data).catch(() => null);
    if (blTitan) await chat.sendMessage(blTitan.message).catch(() => {});
    // Reset attacker's consecutive hit counter (they attacked = break streak)
    const atkState = getDuelBlessingState(attackerId);
    if (atkState.hit_count > 0) updateDuelBlessingState(attackerId, { hit_count: 0 });

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
    setDuelActive,
    setTurn,
    getDuelKey,
    territoryWars,
    handlePvPAttack,
    handlePvPSkill,
    isPlayerInDuel,
    getDuelOpponent,
    clearDuelActive,
    DUEL_HP,
    startPartyAssembly,
    joinPartyAssembly,
    buildRosterMessage,
    readyPartyDuel,
    promoteForDuel,
    demoteAfterDuel,
    setTournamentDuelPending: (p1, p2, tournamentId, phase, client, pvpGroupJid) => {
        const n1 = normalizeId(String(p1));
        const n2 = normalizeId(String(p2));
        tournamentDuelPending.set(n1, { opponentId: n2, tournamentId, phase });
        tournamentDuelPending.set(n2, { opponentId: n1, tournamentId, phase });
        console.log(`[Tournament] Duel pending: ${n1} vs ${n2}`);

        // 3-minute no-show timeout — if neither starts the duel, auto-forfeit both
        // and give the win to whoever typed !startduel first (or random if neither)
        const noShowTimer = setTimeout(async () => {
            const p1Pending = tournamentDuelPending.get(n1);
            const p2Pending = tournamentDuelPending.get(n2);
            // If still pending after 3 min — neither started it
            if (p1Pending || p2Pending) {
                tournamentDuelPending.delete(n1);
                tournamentDuelPending.delete(n2);
                console.log(`[Tournament] No-show: ${n1} vs ${n2} — auto-recording forfeit`);
                try {
                    const { recordMatchResult } = require('../systems/tournamentSystem');
                    // Random winner if neither showed — give win to p2 (challenger advantage)
                    await recordMatchResult(tournamentId, n2, n1, phase);
                } catch(e) {}
                // Announce no-show in PvP group
                if (client && pvpGroupJid) {
                    const [r1] = await db.execute('SELECT nickname FROM players WHERE id=?', [n1]).catch(() => [[]]);
                    const [r2] = await db.execute('SELECT nickname FROM players WHERE id=?', [n2]).catch(() => [[]]);
                    await client.sendMessage(pvpGroupJid, {
                        text:
                            `╔══〘 ⏰ NO-SHOW — MATCH VOIDED 〙══╗
` +
                            `┃★
` +
                            `┃★ *${r1[0]?.nickname || n1}* vs *${r2[0]?.nickname || n2}*
` +
                            `┃★ Neither player started the duel.
` +
                            `┃★ Match skipped. Admin can re-call.
` +
                            `┃★
` +
                            `╚═══════════════════════════╝`
                    }).catch(() => {});
                    await demoteAfterDuel(client, [n1, n2]);
                }
            }
        }, 3 * 60 * 1000); // 3 minutes
        noShowTimer.unref?.(); // Don't block process exit
    },
    getAssemblyByPlayer,
    startTurnTimer,
    duelPool
};