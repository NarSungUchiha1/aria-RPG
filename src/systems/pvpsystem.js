const db = require('../database/db');
const { narrate } = require('../utils/narrator');
const { calculateMoveDamage, calculateHeal } = require('./skillSystem');
const { applyBuff } = require('./activeBuffs');

const activeDuels = new Map();

function setDuelActive(player1Id, player2Id, chat) {
    activeDuels.set(player1Id, { opponentId: player2Id, turn: player1Id, chat });
    activeDuels.set(player2Id, { opponentId: player1Id, turn: player1Id, chat });
}

function clearDuelActive(player1Id, player2Id) {
    activeDuels.delete(player1Id);
    activeDuels.delete(player2Id);
}

function getDuelOpponent(playerId) {
    const duel = activeDuels.get(playerId);
    return duel ? duel.opponentId : null;
}

function isPlayerInDuel(playerId) {
    return activeDuels.has(playerId);
}

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
    // Grant title at 5 wins, and then every 5 additional wins upgrade (optional)
    if (wins >= 5 && (!currentTitle || wins % 5 === 0)) {
        const newTitle = coolTitles[Math.floor(Math.random() * coolTitles.length)];
        await db.execute("UPDATE players SET title = ? WHERE id=?", [newTitle, playerId]);
        return newTitle;
    }
    return null;
}

async function startPvPDuel(player1Id, player2Id, betAmount, client, msg) {
    const [p1] = await db.execute(
        "SELECT id, nickname, strength, agility, intelligence, stamina, hp, max_hp FROM players WHERE id=?",
        [player1Id]
    );
    const [p2] = await db.execute(
        "SELECT id, nickname, strength, agility, intelligence, stamina, hp, max_hp FROM players WHERE id=?",
        [player2Id]
    );
    if (!p1.length || !p2.length) return { error: "Player not found." };

    const player1 = p1[0];
    const player2 = p2[0];

    const [items1] = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [player1Id]);
    const [items2] = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [player2Id]);

    let currentTurn = (player1.agility >= player2.agility) ? player1Id : player2Id;
    let otherPlayer = currentTurn === player1Id ? player2Id : player1Id;

    const chat = await msg.getChat();
    setDuelActive(player1Id, player2Id, chat);

    const turnMsg = narrate('pvpTurn', { player: currentTurn === player1Id ? player1.nickname : player2.nickname });
    await chat.sendMessage(`══〘 ⚔️ PVP DUEL START 〙══╮
┃◆ ${player1.nickname} vs ${player2.nickname}
┃◆ Bet: ${betAmount} gold
┃◆ ${turnMsg}
┃◆ Use !attack <move> on your turn.
╰═══════════════════════╯`);

    return { active: true, player1, player2, currentTurn };
}

async function handlePvPAttack(attackerId) {
    const duel = activeDuels.get(attackerId);
    if (!duel) return { error: "You are not in a duel." };
    if (duel.turn !== attackerId) return { error: "It's not your turn!" };

    const opponentId = duel.opponentId;
    const chat = duel.chat;

    const [attacker] = await db.execute("SELECT * FROM players WHERE id=?", [attackerId]);
    const [defender] = await db.execute("SELECT * FROM players WHERE id=?", [opponentId]);
    if (!attacker.length || !defender.length) return { error: "Player not found." };

    const [items] = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [attackerId]);

    let weaponBonus = 0;
    items.forEach(item => weaponBonus += Number(item.attack_bonus || 0) + Number(item.strength_bonus || 0));

    const baseDamage = Number(attacker[0].strength) + Math.floor(weaponBonus * 0.5);
    const defense = Number(defender[0].stamina) || 0;
    const damage = Math.max(1, Math.floor(baseDamage - defense / 2));

    await db.execute("UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?", [damage, opponentId]);

    const [updatedDefender] = await db.execute("SELECT hp, max_hp, nickname FROM players WHERE id=?", [opponentId]);
    const defenderHp = updatedDefender[0].hp;

    const attackMsg = narrate('attack', { attacker: attacker[0].nickname, weapon: 'their weapon', target: defender[0].nickname, damage });
    let message = `══〘 ⚔️ PVP ATTACK 〙══╮\n┃◆ ${attackMsg}\n`;

    if (defenderHp <= 0) {
        const victoryMsg = narrate('pvpVictory', { winner: attacker[0].nickname, loser: defender[0].nickname });
        message += `┃◆ ${victoryMsg}\n╰═══════════════════════╯`;
        clearDuelActive(attackerId, opponentId);
        await db.execute("UPDATE players SET pvp_wins = pvp_wins + 1 WHERE id=?", [attackerId]);
        await db.execute("UPDATE players SET pvp_losses = pvp_losses + 1 WHERE id=?", [opponentId]);
        const newTitle = await checkAndGrantTitle(attackerId);
        if (newTitle) {
            message += `\n🏆 ${attacker[0].nickname} has earned the title: **${newTitle}**!`;
        }
        await chat.sendMessage(message);
        return { winner: attackerId };
    } else {
        message += `┃◆ ${defender[0].nickname} HP: ${defenderHp}/${updatedDefender[0].max_hp}\n╰═══════════════════════╯`;
        duel.turn = opponentId;
        activeDuels.set(attackerId, duel);
        activeDuels.set(opponentId, { opponentId: attackerId, turn: opponentId, chat });
        await chat.sendMessage(message);
        return { success: true, nextTurn: opponentId };
    }
}

async function handlePvPSkill(attackerId, move, targetId) {
    const duel = activeDuels.get(attackerId);
    if (!duel) return { error: "You are not in a duel." };
    if (duel.turn !== attackerId) return { error: "It's not your turn!" };

    const opponentId = duel.opponentId;
    const chat = duel.chat;

    const [attacker] = await db.execute("SELECT * FROM players WHERE id=?", [attackerId]);
    const [defender] = await db.execute("SELECT * FROM players WHERE id=?", [opponentId]);
    if (!attacker.length || !defender.length) return { error: "Player not found." };

    const [items] = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [attackerId]);
    
    let resultMessage = "";
    if (move.type === 'damage') {
        if (targetId && targetId !== opponentId) return { error: "You can only target your opponent in a duel." };
        const damage = calculateMoveDamage(attacker[0], move, defender[0], items);
        await db.execute("UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?", [damage, opponentId]);
        const [updatedDefender] = await db.execute("SELECT hp, nickname, max_hp FROM players WHERE id=?", [opponentId]);
        const defenderHp = updatedDefender[0].hp;
        const skillMsg = narrate('skillDamage', { attacker: attacker[0].nickname, move: move.name, target: defender[0].nickname, damage });
        resultMessage = `══〘 ⚔️ PVP SKILL 〙══╮\n┃◆ ${skillMsg}\n`;
        if (defenderHp <= 0) {
            const victoryMsg = narrate('pvpVictory', { winner: attacker[0].nickname, loser: defender[0].nickname });
            resultMessage += `┃◆ ${victoryMsg}\n╰═══════════════════════╯`;
            clearDuelActive(attackerId, opponentId);
            await db.execute("UPDATE players SET pvp_wins = pvp_wins + 1 WHERE id=?", [attackerId]);
            await db.execute("UPDATE players SET pvp_losses = pvp_losses + 1 WHERE id=?", [opponentId]);
            const newTitle = await checkAndGrantTitle(attackerId);
            if (newTitle) {
                resultMessage += `\n🏆 ${attacker[0].nickname} has earned the title: **${newTitle}**!`;
            }
            await chat.sendMessage(resultMessage);
            return { winner: attackerId };
        } else {
            resultMessage += `┃◆ ${defender[0].nickname} HP: ${defenderHp}/${updatedDefender[0].max_hp}\n╰═══════════════════════╯`;
        }
    } else if (move.type === 'heal') {
        if (targetId && targetId !== attackerId) return { error: "You can only heal yourself in a duel." };
        const heal = calculateHeal(attacker[0], move);
        await db.execute("UPDATE players SET hp = LEAST(max_hp, hp + ?) WHERE id=?", [heal, attackerId]);
        const [updatedAttacker] = await db.execute("SELECT hp, max_hp, nickname FROM players WHERE id=?", [attackerId]);
        const healMsg = narrate('heal', { healer: attacker[0].nickname, target: attacker[0].nickname, heal });
        resultMessage = `══〘 💚 PVP HEAL 〙══╮\n┃◆ ${healMsg}\n┃◆ HP: ${updatedAttacker[0].hp}/${updatedAttacker[0].max_hp}\n╰═══════════════════════╯`;
    } else if (move.type === 'buff') {
        if (targetId && targetId !== attackerId) return { error: "You can only buff yourself in a duel." };
        applyBuff('player', attackerId, { type: 'buff', stat: move.effect, value: move.value, duration: move.duration });
        const buffMsg = narrate('buff', { caster: attacker[0].nickname, target: attacker[0].nickname, move: move.name, stat: move.effect, value: move.value, duration: move.duration });
        resultMessage = `══〘 ⬆️ PVP BUFF 〙══╮\n┃◆ ${buffMsg}\n╰═══════════════════════╯`;
    } else {
        return { error: "That move cannot be used in a duel." };
    }

    duel.turn = opponentId;
    activeDuels.set(attackerId, duel);
    activeDuels.set(opponentId, { opponentId: attackerId, turn: opponentId, chat });
    await chat.sendMessage(resultMessage);
    return { success: true, nextTurn: opponentId };
}

module.exports = {
    startPvPDuel,
    handlePvPAttack,
    handlePvPSkill,
    isPlayerInDuel,
    getDuelOpponent,
    clearDuelActive
};