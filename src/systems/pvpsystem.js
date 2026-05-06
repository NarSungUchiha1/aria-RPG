const db = require('../database/db');
const { narrate } = require('../utils/narrator');
const { calculateMoveDamage, calculateHeal } = require('./skillSystem');
const { applyBuff, getBuffModifiers } = require('./activeBuffs');

// ── Duel State ────────────────────────────────────────────────────────────────
// activeDuels: playerId -> { opponentId, turn, chat, duelKey }
// duelPool:    duelKey  -> { hp, bet, round, p1Id, p2Id }
const activeDuels = new Map();
const duelPool    = new Map();
const turnTimers  = new Map(); // duelKey -> timeout

const DUEL_HP       = 1500;

// Get effective duel HP for a player — prestige players use their real HP
async function getDuelHp(playerId) {
    const [rows] = await db.execute('SELECT max_hp, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?', [playerId]);
    if (!rows.length) return DUEL_HP;
    return rows[0].prestige_level > 0 ? Number(rows[0].max_hp) : DUEL_HP;
}
const TURN_LIMIT_MS = 20000; // 20 seconds per turn

function getDuelKey(p1, p2) {
    return [p1, p2].sort().join('_vs_');
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
            clearDuelActive(currentTurnId, opponentId);

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

async function setDuelActive(p1Id, p2Id, chat, betAmount) {
    const key = getDuelKey(p1Id, p2Id);
    const p1Hp = await getDuelHp(p1Id);
    const p2Hp = await getDuelHp(p2Id);
    duelPool.set(key, {
        hp:     { [p1Id]: p1Hp, [p2Id]: p2Hp },
        maxHp:  { [p1Id]: p1Hp, [p2Id]: p2Hp },
        bet:    betAmount,
        round:  1,
        p1Id, p2Id
    });
    activeDuels.set(p1Id, { opponentId: p2Id, turn: null, chat, duelKey: key });
    activeDuels.set(p2Id, { opponentId: p1Id, turn: null, chat, duelKey: key });
}

function clearDuelActive(p1Id, p2Id) {
    const key = getDuelKey(p1Id, p2Id);
    clearTurnTimer(key);
    duelPool.delete(key);
    activeDuels.delete(p1Id);
    activeDuels.delete(p2Id);
}

function setTurn(p1Id, p2Id, turnId) {
    const d1 = activeDuels.get(p1Id);
    const d2 = activeDuels.get(p2Id);
    if (d1) d1.turn = turnId;
    if (d2) d2.turn = turnId;
}

function getDuelOpponent(playerId) {
    return activeDuels.get(playerId)?.opponentId || null;
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

// ── Duel Start ────────────────────────────────────────────────────────────────
async function startPvPDuel(p1Id, p2Id, betAmount, client, msg) {
    const [p1rows] = await db.execute(
        "SELECT id, nickname, `rank`, role, strength, agility, intelligence, stamina FROM players WHERE id=?",
        [p1Id]
    );
    const [p2rows] = await db.execute(
        "SELECT id, nickname, `rank`, role, strength, agility, intelligence, stamina FROM players WHERE id=?",
        [p2Id]
    );
    if (!p1rows.length || !p2rows.length) return { error: "Player not found." };

    const p1 = p1rows[0];
    const p2 = p2rows[0];

    // First turn: higher agility goes first
    const firstTurn = (p1.agility >= p2.agility) ? p1Id : p2Id;
    const firstNick = firstTurn === p1Id ? p1.nickname : p2.nickname;

    const chat = await msg.getChat();
    await setDuelActive(p1Id, p2Id, chat, betAmount);
    setTurn(p1Id, p2Id, firstTurn);

    const secondTurn = firstTurn === p1Id ? p2Id : p1Id;

    // Start 10-second turn timer for first player
    await startTurnTimer(getDuelKey(p1Id, p2Id), firstTurn, secondTurn, chat, 1);

    const betLine = betAmount > 0
        ? `┃◆ 💰 Bet: ${betAmount} Gold each (pot: ${betAmount * 2})\n`
        : `┃◆ 💰 No bet — honour duel\n`;

    await chat.sendMessage(
        `╭══〘 ⚔️ DUEL BEGINS 〙══╮\n` +
        `┃◆ \n` +
        `┃◆ ── ${p1.nickname} [${p1.rank}] ──\n` +
        `┃◆ 🎭 ${p1.role}\n` +
        `┃◆ 💪 STR: ${p1.strength}  ⚡ AGI: ${p1.agility}\n` +
        `┃◆ 🧠 INT: ${p1.intelligence}  🛡️ STA: ${p1.stamina}\n` +
        `┃◆ ❤️ HP: ${p1Hp}/${p1Hp}\n` +
        `┃◆ \n` +
        `┃◆ ━━━━ ⚔️ VS ⚔️ ━━━━\n` +
        `┃◆ \n` +
        `┃◆ ── ${p2.nickname} [${p2.rank}] ──\n` +
        `┃◆ 🎭 ${p2.role}\n` +
        `┃◆ 💪 STR: ${p2.strength}  ⚡ AGI: ${p2.agility}\n` +
        `┃◆ 🧠 INT: ${p2.intelligence}  🛡️ STA: ${p2.stamina}\n` +
        `┃◆ ❤️ HP: ${p2Hp}/${p2Hp}\n` +
        `┃◆ \n` +
        `${betLine}` +
        `┃◆ ━━━━━━━━━━━━\n` +
        `┃◆ ⚡ ${firstNick} goes first!\n` +
        `┃◆ ⏰ Each turn: 20 seconds to act\n` +
        `┃◆ Miss your turn = forfeit the duel!\n` +
        `┃◆ Use !attack <move> to fight.\n` +
        `┃◆ \n` +
        `╰═══════════════════════════╯`
    );

    return { active: true, p1, p2, firstTurn };
}

// ── Victory Handler ───────────────────────────────────────────────────────────
async function handleVictory(winnerId, loserId, chat, duelData, winnerNick, loserNick, winnerHp) {
    clearTurnTimer(getDuelKey(winnerId, loserId));
    clearDuelActive(winnerId, loserId);

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

    const opponentId = duel.opponentId;
    const chat       = duel.chat;
    const data       = duelPool.get(duel.duelKey);
    if (!data) return { error: "Duel data missing." };

    const [aRows] = await db.execute("SELECT * FROM players WHERE id=?", [attackerId]);
    const [dRows] = await db.execute("SELECT * FROM players WHERE id=?", [opponentId]);
    if (!aRows.length || !dRows.length) return { error: "Player not found." };

    const attacker = aRows[0];
    const defender = dRows[0];
    const [items]  = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [attackerId]);

    // Use duel HP pool (not DB HP)
    const attackerHp  = data.hp[attackerId];
    const defenderHp  = data.hp[opponentId];
    const round       = data.round;

    // ── DAMAGE ────────────────────────────────────────────────────────────────
    if (move.type === 'damage') {
        if (targetId && targetId !== opponentId) return { error: "You can only target your opponent in a duel." };

        // Use a duel-specific defender object with duel HP for calculation context
        const defenderForCalc = { ...defender, hp: defenderHp, max_hp: DUEL_HP };
        let damage = calculateMoveDamage(attacker, move, defenderForCalc, items);
        // Cap per hit: 15% of defender's duel HP — scales with prestige
        const defDuelHp = data.hp[opponentId] || DUEL_HP;
        const startHp   = await getDuelHp(opponentId);
        const maxDuelDamage = Math.floor(startHp * 0.15);
        damage = Math.min(damage, maxDuelDamage);
        const newDefenderHp = Math.max(0, defenderHp - damage);
        data.hp[opponentId] = newDefenderHp;

        if (newDefenderHp <= 0) {
            return await handleVictory(attackerId, opponentId, chat, data,
                attacker.nickname, defender.nickname, attackerHp);
        }

        // Switch turn
        data.round++;
        setTurn(attackerId, opponentId, opponentId);
        await sendCombatMessage(chat,
            attacker.nickname, defender.nickname, move.name, damage,
            attackerHp, newDefenderHp, defender.nickname, round
        );
        // ✅ Start timer for opponent's turn
        await startTurnTimer(duel.duelKey, opponentId, attackerId, chat, data.round);
        return { success: true, nextTurn: opponentId };
    }

    // ── HEAL ──────────────────────────────────────────────────────────────────
    if (move.type === 'heal') {
        if (targetId && targetId !== attackerId) return { error: "You can only heal yourself in a duel." };
        const heal = calculateHeal(attacker, move);
        const newHp = Math.min(DUEL_HP, attackerHp + heal);
        data.hp[attackerId] = newHp;
        data.round++;
        setTurn(attackerId, opponentId, opponentId);

        await chat.sendMessage(
            `══〘 💚 DUEL HEAL — ROUND ${round} 〙══╮\n` +
            `┃◆ ${narrate('heal', { healer: attacker.nickname, target: attacker.nickname, heal })}\n` +
            `┃◆────────────\n` +
            `┃◆ ❤️ ${attacker.nickname}: ${newHp}/${DUEL_HP}\n` +
            `┃◆ ❤️ ${defender.nickname}: ${defenderHp}/${DUEL_HP}\n` +
            `┃◆────────────\n` +
            `┃◆ ⚡ ${defender.nickname}'s turn! ⏰ 20 seconds!\n` +
            `╰═══════════════════════╯`
        );
        // ✅ Start timer for opponent's turn
        await startTurnTimer(duel.duelKey, opponentId, attackerId, chat, data.round);
        return { success: true, nextTurn: opponentId };
    }

    // ── BUFF ──────────────────────────────────────────────────────────────────
    if (move.type === 'buff') {
        if (targetId && targetId !== attackerId) return { error: "You can only buff yourself in a duel." };
        applyBuff('player', attackerId, { type: 'buff', stat: move.effect, value: move.value, duration: move.duration });
        data.round++;
        setTurn(attackerId, opponentId, opponentId);

        await chat.sendMessage(
            `══〘 ⬆️ DUEL BUFF — ROUND ${round} 〙══╮\n` +
            `┃◆ ${narrate('buff', { caster: attacker.nickname, target: attacker.nickname, move: move.name, stat: move.effect, value: move.value, duration: move.duration })}\n` +
            `┃◆────────────\n` +
            `┃◆ ❤️ ${attacker.nickname}: ${attackerHp}/${DUEL_HP}\n` +
            `┃◆ ❤️ ${defender.nickname}: ${defenderHp}/${DUEL_HP}\n` +
            `┃◆────────────\n` +
            `┃◆ ⚡ ${defender.nickname}'s turn! ⏰ 20 seconds!\n` +
            `╰═══════════════════════╯`
        );
        // ✅ Start timer for opponent's turn
        await startTurnTimer(duel.duelKey, opponentId, attackerId, chat, data.round);
        return { success: true, nextTurn: opponentId };
    }

    return { error: "That move cannot be used in a duel." };
}

// ── Legacy handlePvPAttack (basic attack fallback) ────────────────────────────
async function handlePvPAttack(attackerId) {
    const duel = activeDuels.get(attackerId);
    if (!duel) return { error: "You are not in a duel." };
    if (duel.turn !== attackerId) return { error: "It's not your turn!" };

    const opponentId = duel.opponentId;
    const chat       = duel.chat;
    const data       = duelPool.get(duel.duelKey);
    if (!data) return { error: "Duel data missing." };

    const [aRows] = await db.execute("SELECT * FROM players WHERE id=?", [attackerId]);
    const [dRows] = await db.execute("SELECT * FROM players WHERE id=?", [opponentId]);
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
    const newDefHp   = Math.max(0, data.hp[opponentId] - damage);
    data.hp[opponentId] = newDefHp;

    if (newDefHp <= 0) {
        return await handleVictory(attackerId, opponentId, chat, data,
            attacker.nickname, defender.nickname, attackerHp);
    }

    data.round++;
    setTurn(attackerId, opponentId, opponentId);
    await sendCombatMessage(chat,
        attacker.nickname, defender.nickname, 'Basic Attack', damage,
        attackerHp, newDefHp, defender.nickname, round
    );
    // ✅ Start timer for opponent's turn
    await startTurnTimer(duel.duelKey, opponentId, attackerId, chat, data.round);
    return { success: true, nextTurn: opponentId };
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