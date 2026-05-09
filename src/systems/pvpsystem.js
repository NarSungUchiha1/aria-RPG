const db = require('../database/db');
const { narrate } = require('../utils/narrator');
const { calculateMoveDamage, calculateHeal } = require('./skillSystem');
const { applyBuff, getBuffModifiers } = require('./activeBuffs');
const { increasePlayerFatigue } = require('./fatigueSystem');
const { getPlayerClan, CLAN_BLESSINGS } = require('./clanSystem');

// ── Duel State ────────────────────────────────────────────────────────────────
// activeDuels: playerId -> { teamA, teamB, turn, chat, duelKey }
// duelPool:    duelKey  -> { hp, bet, round, teamA, teamB, turnOrder, type }
const activeDuels = new Map();
const duelPool    = new Map();
const turnTimers  = new Map(); // duelKey -> timeout
const duelBlessingStates = new Map();

const DUEL_HP       = 1500;

// Get effective duel HP for a player — prestige players use their real HP
async function getDuelHp(playerId) {
    const [rows] = await db.execute('SELECT max_hp, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?', [playerId]);
    if (!rows.length) return DUEL_HP;
    return rows[0].prestige_level > 0 ? Number(rows[0].max_hp) : DUEL_HP;
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

function getDuelOpponent(playerId) {
    const duel = activeDuels.get(playerId);
    if (!duel) return null;
    const opponentTeam = duel.teamA.includes(playerId) ? duel.teamB : duel.teamA;
    return opponentTeam.length ? opponentTeam[0] : null;
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
    await data.chat.sendMessage(blessingMsg).catch(() => {});
    return blessingMsg;
}

// ── Duel Start ────────────────────────────────────────────────────────────────
async function startPvPDuel(teamAIds, teamBIds, betAmount, client, msg) {
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
    const chat = await msg.getChat();

    await setDuelActive(teamA, teamB, chat, betAmount, turnOrder);
    const duelKey = getDuelKey(teamA, teamB);
    setTurn(duelKey, firstTurn);

    const opponentTeam = getOpponentTeam(duelKey, firstTurn);
    const firstOpponent = opponentTeam.find(id => duelPool.get(duelKey).hp[id] > 0);

    // Start turn timer for first player
    await startTurnTimer(duelKey, firstTurn, firstOpponent || opponentTeam[0], chat, 1);

    const betLine = betAmount > 0
        ? `┃◆ 💰 Bet: ${betAmount} Gold each (pot: ${betAmount * 2})\n`
        : `┃◆ 💰 No bet — honour duel\n`;

    const formatMember = p => `┃◆ • ${p.nickname} [${p.rank}] • ${p.role} • STR:${p.strength} AGI:${p.agility} INT:${p.intelligence} STA:${p.stamina}\n`;
    const teamAInfo = teamAPlayers.map(formatMember).join('');
    const teamBInfo = teamBPlayers.map(formatMember).join('');

    await chat.sendMessage(
        `╭══〘 ⚔️ DUEL BEGINS 〙══╮\n` +
        `┃◆ ${teamA.length > 1 ? '*Team A*' : teamAPlayers[0].nickname} vs ${teamB.length > 1 ? '*Team B*' : teamBPlayers[0].nickname}\n` +
        `┃◆ \n` +
        `${teamAInfo}` +
        `┃◆ ━━━━ ⚔️ VS ⚔️ ━━━━\n` +
        `${teamBInfo}` +
        `┃◆ \n` +
        `${betLine}` +
        `┃◆ ━━━━━━━━━━━━\n` +
        `┃◆ ⚡ ${firstPlayer.nickname} goes first!\n` +
        `┃◆ ⏰ Each turn: 20 seconds to act\n` +
        `┃◆ Miss your turn = forfeit the duel!\n` +
        `┃◆ Use !attack <move> to fight.\n` +
        `┃◆ \n` +
        `╰═══════════════════════════╯`
    );

    return { active: true, firstTurn, teamAPlayers, teamBPlayers };
}

// ── Victory Handler ───────────────────────────────────────────────────────────
async function handleVictory(winnerId, loserId, chat, duelData, winnerNick, loserNick, winnerHp) {
    const duelKey = duelData?.duelKey || getDuelKey(winnerId, loserId);
    clearTurnTimer(duelKey);
    clearDuelActiveByKey(duelKey);

    if (duelData.type === 'party') {
        const winners = duelData.teamA.includes(String(winnerId)) ? duelData.teamA : duelData.teamB;
        const losers = duelData.teamA.includes(String(winnerId)) ? duelData.teamB : duelData.teamA;
        const aliveWinners = winners.filter(id => duelData.hp[id] > 0);
        const titleLines = [];
        const survivorText = aliveWinners.map(id => `┃◆ • ${id}`).join('\n');

        await db.execute(
            `UPDATE players SET pvp_wins = pvp_wins + 1 WHERE id IN (${winners.map(() => '?').join(',')})`,
            winners
        );
        await db.execute(
            `UPDATE players SET pvp_losses = pvp_losses + 1 WHERE id IN (${losers.map(() => '?').join(',')})`,
            losers
        );

        await Promise.all(aliveWinners.map(async id => {
            const newTitle = await checkAndGrantTitle(id);
            if (newTitle) titleLines.push(`┃◆ 🎖️ ${id} earned: "${newTitle}"`);
        }));

        await chat.sendMessage(
            `╭══〘 🏆 TEAM DUEL OVER 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ Team victory for ${winnerNick}'s side!\n` +
            `┃◆ \n` +
            `${titleLines.length ? titleLines.join('\n') + '\n' : ''}` +
            `┃◆ \n` +
            `┃◆ ━━ SURVIVORS ━━\n` +
            `${aliveWinners.map(id => `┃◆ • ${id}`).join('\n')}\n` +
            `┃◆ \n` +
            `╰═══════════════════════════╯`
        );

        return { winner: winners };
    }

    await db.execute("UPDATE players SET pvp_wins   = pvp_wins   + 1 WHERE id=?", [winnerId]);
    await db.execute("UPDATE players SET pvp_losses = pvp_losses + 1 WHERE id=?", [loserId]);

    // Bet payout — winner gets the full pot
    let betLine = '';
    if (duelData.bet > 0) {
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [duelData.bet * 2, winnerId]);
        betLine = `┃◆ 💰 Winnings: ${duelData.bet * 2} Gold\n`;
    }

    await trackPvPWin(winnerId);
    const newTitle = await checkAndGrantTitle(winnerId);
    const titleLine = newTitle ? `┃◆ 🎖️ Title earned: "${newTitle}"\n` : '';

    await chat.sendMessage(
        `╭══〘 🏆 DUEL OVER 〙══╮\n` +
        `┃◆ \n` +
        `┃◆ ${narrate('pvpVictory', { winner: winnerNick, loser: loserNick })}\n` +
        `┃◆ \n` +
        `┃◆ 🏆 Winner: ${winnerNick}\n` +
        `${betLine}` +
        `${titleLine}` +
        `┃◆ \n` +
        `┃◆ ━━ 📊 FINAL HP ━━\n` +
        `┃◆ ${winnerNick}: ${winnerHp}/${DUEL_HP}\n` +
        `┃◆ ${loserNick}: 0/${DUEL_HP}\n` +
        `┃◆ \n` +
        `╰═══════════════════════════╯`
    );

    return { winner: winnerId };
}

// ── Shared combat message ─────────────────────────────────────────────────────
async function sendCombatMessage(chat, attackerNick, opponentNick, moveName, damage, attackerHp, opponentHp, nextTurnNick, roundNum, extra = '') {
    await chat.sendMessage(
        `══〘 ⚔️ DUEL — ROUND ${roundNum} 〙══╮\n` +
        `┃◆ ${narrate('skillDamage', { attacker: attackerNick, move: moveName, target: opponentNick, damage })}\n` +
        `┃◆ 💥 Damage: ${damage}\n` +
        `${extra}` +
        `┃◆────────────\n` +
        `┃◆ ❤️ ${attackerNick}: ${attackerHp}/${DUEL_HP}\n` +
        `┃◆ ❤️ ${opponentNick}: ${opponentHp}/${DUEL_HP}\n` +
        `┃◆────────────\n` +
        `┃◆ ⚡ ${nextTurnNick}'s turn! ⏰ 20 seconds!\n` +
        `╰═══════════════════════╯`
    );
}

// ── Handle Skill in Duel ──────────────────────────────────────────────────────
async function handlePvPSkill(attackerId, move, targetId) {
    const duel = activeDuels.get(attackerId);
    if (!duel) return { error: "You are not in a duel." };
    if (duel.turn !== attackerId) return { error: "It's not your turn!" };

    const chat = duel.chat;
    const data = duelPool.get(duel.duelKey);
    if (!data) return { error: "Duel data missing." };

    targetId = targetId ? String(targetId) : getCurrentOpponentId(duel.duelKey, attackerId);
    const opponentTeam = getOpponentTeam(duel.duelKey, attackerId);
    if (!targetId) return { error: "No living opponent found." };
    if (!opponentTeam || !opponentTeam.includes(targetId)) return { error: "You can only target your opponent in a duel." };
    if (data.hp[targetId] <= 0) return { error: "That target is already defeated." };

    const [aRows] = await db.execute("SELECT * FROM players WHERE id=?", [attackerId]);
    const [dRows] = await db.execute("SELECT * FROM players WHERE id=?", [targetId]);
    if (!aRows.length || !dRows.length) return { error: "Player not found." };

    const attacker = aRows[0];
    const defender = dRows[0];
    const [items]  = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [attackerId]);

    const attackerHp = data.hp[attackerId];
    const defenderHp = data.hp[targetId];
    const round = data.round;

    const nextTurnAfterMove = async () => {
        const nextTurn = findNextAlivePlayer(duel.duelKey, attackerId);
        if (!nextTurn) return null;
        setTurn(duel.duelKey, nextTurn);
        await startTurnTimer(duel.duelKey, nextTurn, getCurrentOpponentId(duel.duelKey, nextTurn), chat, data.round);
        return nextTurn;
    };

    const trackBlessings = async () => {
        await triggerBlessingIfReadyInDuel('every_5_skills', attacker, data).catch(() => {});
        await triggerBlessingIfReadyInDuel('all_allies_below_50', attacker, data).catch(() => {});
    };

    // ── DAMAGE ────────────────────────────────────────────────────────────────
    if (move.type === 'damage') {
        const defenderForCalc = { ...defender, hp: defenderHp, max_hp: DUEL_HP };
        let damage = calculateMoveDamage(attacker, move, defenderForCalc, items);
        const startHp = await getDuelHp(targetId);
        const maxDuelDamage = Math.floor(startHp * 0.15);
        damage = Math.min(damage, maxDuelDamage);
        const newDefenderHp = Math.max(0, defenderHp - damage);
        data.hp[targetId] = newDefenderHp;

        const fatigueGain = Math.max(2, Math.ceil(damage / 15));
        await increasePlayerFatigue(attackerId, fatigueGain, attacker);

        if (newDefenderHp <= 0) {
            await triggerBlessingIfReadyInDuel('on_death', defender, data, { attackerId }).catch(() => {});
            if (data.hp[targetId] > 0) {
                data.round++;
                const nextTurn = await nextTurnAfterMove();
                await chat.sendMessage(
                    `╭══〘 👻 PHANTOM SHIFT 〙══╮\n` +
                    `┃◆ ${defender.nickname} refuses to fall and returns with vengeance!\n` +
                    `┃◆ ⚡ Next turn: ${nextTurn || defender.nickname}\n` +
                    `╰═══════════════════════╯`
                ).catch(() => {});
                return { success: true, nextTurn };
            }

            const remainingOpponents = opponentTeam.filter(id => data.hp[id] > 0);
            if (remainingOpponents.length > 0) {
                await triggerBlessingIfReadyInDuel('on_kill', attacker, data).catch(() => {});
                data.round++;
                const nextTurn = await nextTurnAfterMove();
                const [nextRows] = await db.execute("SELECT nickname FROM players WHERE id=?", [nextTurn]);
                const nextName = nextRows[0]?.nickname || nextTurn;
                await chat.sendMessage(
                    `╭══〘 ☠️ DUEL KILL 〙══╮\n` +
                    `┃◆ ${attacker.nickname} slays ${defender.nickname}!\n` +
                    `┃◆ ⚡ Next turn: ${nextName}\n` +
                    `╰═══════════════════════╯`
                ).catch(() => {});
                return { success: true, nextTurn };
            }

            await triggerBlessingIfReadyInDuel('on_kill', attacker, data).catch(() => {});
            return await handleVictory(attackerId, targetId, chat, data,
                attacker.nickname, defender.nickname, attackerHp);
        }

        await triggerBlessingIfReadyInDuel('enemy_below_25', attacker, data, { targetId, targetName: defender.nickname }).catch(() => {});
        await triggerBlessingIfReadyInDuel('hp_below_30', defender, data).catch(() => {});
        await trackBlessings();

        data.round++;
        const nextTurn = await nextTurnAfterMove();
        const [nextRows] = nextTurn ? await db.execute("SELECT nickname FROM players WHERE id=?", [nextTurn]) : [null];
        const nextTurnName = nextRows?.[0]?.nickname || defender.nickname;
        await sendCombatMessage(chat,
            attacker.nickname, defender.nickname, move.name, damage,
            attackerHp, newDefenderHp, nextTurnName, round
        );
        return { success: true, nextTurn };
    }

    // ── HEAL ──────────────────────────────────────────────────────────────────
    if (move.type === 'heal') {
        if (targetId && targetId !== attackerId) return { error: "You can only heal yourself in a duel." };
        const heal = calculateHeal(attacker, move);
        const newHp = Math.min(DUEL_HP, attackerHp + heal);
        data.hp[attackerId] = newHp;
        await triggerBlessingIfReadyInDuel('on_healed', attacker, data, { healAmount: heal }).catch(() => {});
        await trackBlessings();

        data.round++;
        const nextTurn = await nextTurnAfterMove();
        const [nextRows] = nextTurn ? await db.execute("SELECT nickname FROM players WHERE id=?", [nextTurn]) : [null];
        const nextTurnName = nextRows?.[0]?.nickname || defender.nickname;

        await chat.sendMessage(
            `══〘 💚 DUEL HEAL — ROUND ${round} 〙══╮\n` +
            `┃◆ ${narrate('heal', { healer: attacker.nickname, target: attacker.nickname, heal })}\n` +
            `┃◆────────────\n` +
            `┃◆ ❤️ ${attacker.nickname}: ${newHp}/${DUEL_HP}\n` +
            `┃◆ ❤️ ${defender.nickname}: ${defenderHp}/${DUEL_HP}\n` +
            `┃◆────────────\n` +
            `┃◆ ⚡ ${nextTurnName}'s turn! ⏰ 20 seconds!\n` +
            `╰═══════════════════════╯`
        );
        return { success: true, nextTurn };
    }

    // ── BUFF ──────────────────────────────────────────────────────────────────
    if (move.type === 'buff') {
        if (targetId && targetId !== attackerId) return { error: "You can only buff yourself in a duel." };
        applyBuff('player', attackerId, { type: 'buff', stat: move.effect, value: move.value, duration: move.duration });
        await trackBlessings();

        data.round++;
        const nextTurn = await nextTurnAfterMove();
        const [nextRows] = nextTurn ? await db.execute("SELECT nickname FROM players WHERE id=?", [nextTurn]) : [null];
        const nextTurnName = nextRows?.[0]?.nickname || defender.nickname;

        await chat.sendMessage(
            `══〘 ⬆️ DUEL BUFF — ROUND ${round} 〙══╮\n` +
            `┃◆ ${narrate('buff', { caster: attacker.nickname, target: attacker.nickname, move: move.name, stat: move.effect, value: move.value, duration: move.duration })}\n` +
            `┃◆────────────\n` +
            `┃◆ ❤️ ${attacker.nickname}: ${attackerHp}/${DUEL_HP}\n` +
            `┃◆ ❤️ ${defender.nickname}: ${defenderHp}/${DUEL_HP}\n` +
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
    const damage   = Math.max(1, Math.floor(baseDmg - defence / 2));
    const round    = data.round;

    const attackerHp = data.hp[attackerId];
    const newDefHp   = Math.max(0, data.hp[targetId] - damage);
    data.hp[targetId] = newDefHp;

    const nextTurnAfterMove = async () => {
        const nextTurn = findNextAlivePlayer(duel.duelKey, attackerId);
        if (!nextTurn) return null;
        setTurn(duel.duelKey, nextTurn);
        await startTurnTimer(duel.duelKey, nextTurn, getCurrentOpponentId(duel.duelKey, nextTurn), chat, data.round);
        return nextTurn;
    };

    if (newDefHp <= 0) {
        await triggerBlessingIfReadyInDuel('on_death', defender, data, { attackerId }).catch(() => {});
        if (data.hp[targetId] > 0) {
            data.round++;
            const nextTurn = await nextTurnAfterMove();
            await chat.sendMessage(
                `╭══〘 👻 PHANTOM SHIFT 〙══╮\n` +
                `┃◆ ${defender.nickname} refuses to fall and returns with vengeance!\n` +
                `┃◆ ⚡ Next turn: ${nextTurn || defender.nickname}\n` +
                `╰═══════════════════════╯`
            ).catch(() => {});
            return { success: true, nextTurn };
        }

        const opponentTeam = getOpponentTeam(duel.duelKey, attackerId);
        const remainingOpponents = opponentTeam ? opponentTeam.filter(id => data.hp[id] > 0) : [];
        if (remainingOpponents.length > 0) {
            await triggerBlessingIfReadyInDuel('on_kill', attacker, data).catch(() => {});
            data.round++;
            const nextTurn = await nextTurnAfterMove();
            const [nextRows] = nextTurn ? await db.execute("SELECT nickname FROM players WHERE id=?", [nextTurn]) : [null];
            const nextName = nextRows?.[0]?.nickname || nextTurn;
            await chat.sendMessage(
                `╭══〘 ☠️ DUEL KILL 〙══╮\n` +
                `┃◆ ${attacker.nickname} slays ${defender.nickname}!\n` +
                `┃◆ ⚡ Next turn: ${nextName}\n` +
                `╰═══════════════════════╯`
            ).catch(() => {});
            return { success: true, nextTurn };
        }

        await triggerBlessingIfReadyInDuel('on_kill', attacker, data).catch(() => {});
        return await handleVictory(attackerId, targetId, chat, data,
            attacker.nickname, defender.nickname, attackerHp);
    }

    await triggerBlessingIfReadyInDuel('enemy_below_25', attacker, data, { targetId, targetName: defender.nickname }).catch(() => {});
    await triggerBlessingIfReadyInDuel('hp_below_30', defender, data).catch(() => {});
    await triggerBlessingIfReadyInDuel('every_5_skills', attacker, data).catch(() => {});
    await triggerBlessingIfReadyInDuel('all_allies_below_50', attacker, data).catch(() => {});

    data.round++;
    const nextTurn = await nextTurnAfterMove();
    await sendCombatMessage(chat,
        attacker.nickname, defender.nickname, 'Basic Attack', damage,
        attackerHp, newDefHp, defender.nickname, round
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
    DUEL_HP
};