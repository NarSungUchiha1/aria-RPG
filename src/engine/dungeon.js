const db = require('../database/db');
const enemiesData = require('../data/enemies');
const { calculateMoveDamage } = require('../systems/skillSystem');
const { tickBuffs, getBuffModifiers, consumeShield } = require('../systems/activeBuffs');
const { clearDungeonTimers } = require('./dungeonTimer');

const dungeonLocks = new Map();

// Auto-start timers (used by enter.js)
const autoStartTimers = new Map();

// =======================
//  SPAWN DUNGEON
// =======================
async function spawnDungeon(rank, client = null, targetJid = null) {
    await db.execute("UPDATE dungeon SET is_active=0, locked=0");
    
    const boss = enemiesData[rank]?.boss?.name || "Unknown Boss";
    const maxStage = { F:3, E:4, D:5, C:6, B:7, A:8, S:10 }[rank] || 3;
    
    const [result] = await db.execute(
        `INSERT INTO dungeon (dungeon_rank, stage, max_stage, boss_name, is_active, stage_cleared, in_combat, locked)
         VALUES (?, 1, ?, ?, 1, 0, 0, 0)`,
        [rank, maxStage, boss]
    );
    
    await db.execute("DELETE FROM dungeon_players");
    await db.execute("DELETE FROM dungeon_enemies");
    
    console.log(`🏰 Dungeon ${rank} spawned.`);
    
    if (client && targetJid) {
        await sendDungeonAnnouncement(client, rank, boss, maxStage, targetJid);
    }
    
    return { id: result.insertId, rank, maxStage, boss };
}

// Fixed for Baileys — no getContactById, uses JIDs directly
async function sendDungeonAnnouncement(client, rank, boss, maxStage, targetJid) {
    const [players] = await db.execute(
        "SELECT id, nickname FROM players WHERE `rank` >= ?",
        [rank]
    );

    // Build mention JIDs for Baileys
async function sendDungeonAnnouncement(sock, rank, boss, maxStage, targetJid) {
    const [players] = await db.execute(
        "SELECT id, nickname FROM players WHERE `rank` >= ?",
        [rank]
    );
    
    // Build mentions array with proper JIDs
    const mentions = players.map(p => `${p.id}@s.whatsapp.net`);
    
    const announceMsg = `╭══〘 📢 ANNOUNCEMENT 〙══╮
┃◆ 
┃◆   *DUNGEON HAS OPENED*
┃◆ 
┃◆   Rank: ${rank}
┃◆   Max Stage: ${maxStage}
┃◆   Boss: ${boss}
┃◆ 
┃◆   Use !enter to join the raid!
┃◆ 
╰═══════════════════════════╯`;
    
    try {
        await sock.sendMessage(targetJid, { 
            text: announceMsg, 
            mentions 
        });
        console.log(`✅ Announcement sent to ${targetJid}`);
    } catch (e) {
        console.error("Failed to send dungeon announcement:", e);
    }
}
    try {
        await client.sendMessage(targetJid, {
            text: announceMsg,
            mentions: mentionJids
        });
        console.log(`📢 Dungeon announcement sent to ${targetJid}`);
    } catch (e) {
        console.error("Failed to send dungeon announcement:", e.message);
    }
}

// =======================
//  ACTIVE DUNGEON
// =======================
async function getActiveDungeon() {
    const [rows] = await db.execute("SELECT * FROM dungeon WHERE is_active=1 LIMIT 1");
    return rows[0] || null;
}

function isDungeonLocked(dungeonId) {
    return dungeonLocks.get(dungeonId) || false;
}

async function lockDungeon(dungeonId) {
    dungeonLocks.set(dungeonId, true);
    await db.execute("UPDATE dungeon SET locked=1 WHERE id=?", [dungeonId]);
}

async function getMaxStageForDungeon(dungeonId) {
    const [rows] = await db.execute("SELECT max_stage FROM dungeon WHERE id=?", [dungeonId]);
    return rows[0].max_stage;
}

// =======================
//  ENEMY MANAGEMENT
// =======================
async function spawnStageEnemies(dungeonId, rank, stage) {
    const data = enemiesData[rank];
    if (!data) return;
    
    const isBoss = (stage === (await getMaxStageForDungeon(dungeonId)));
    let enemiesToSpawn = [];
    
    if (isBoss) {
        enemiesToSpawn = [data.boss];
    } else {
        const count = Math.floor(Math.random() * 2) + 1;
        for (let i = 0; i < count; i++) {
            const template = data.miniBosses[Math.floor(Math.random() * data.miniBosses.length)];
            enemiesToSpawn.push({ ...template });
        }
    }
    
    for (const e of enemiesToSpawn) {
        const name = e.name || 'Unknown Enemy';
        const hp = Number(e.hp) || 50;
        const atk = Number(e.atk) || 5;
        const def = Number(e.def) || 2;
        const exp = Number(e.exp) || 10;
        const gold = Number(e.gold) || 5;
        const moves = e.moves ? JSON.stringify(e.moves) : JSON.stringify([{ name: 'Attack', damage: 1.0 }]);
        
        await db.execute(
            `INSERT INTO dungeon_enemies (dungeon_id, name, max_hp, current_hp, atk, def, exp, gold, moves)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [dungeonId, name, hp, hp, atk, def, exp, gold, moves]
        );
    }
}

async function getCurrentEnemies(dungeonId) {
    const [rows] = await db.execute(
        "SELECT * FROM dungeon_enemies WHERE dungeon_id=? AND current_hp > 0",
        [dungeonId]
    );
    return rows;
}

// =======================
//  COMBAT CALCULATIONS
// =======================
function calculatePlayerDamage(player, enemy, weaponBonus = 0) {
    const enemyDef = Number(enemy.def) || 0;
    const reduction = Math.min(0.5, enemyDef / 100);
    const baseAttack = (Number(player.strength) || 0) + Math.floor((Number(weaponBonus) || 0) * 0.5);
    let damage = Math.floor(baseAttack * (1 - reduction));
    return Math.max(1, damage);
}

function calculateEnemyRetaliation(enemy, player) {
    let buffMods = { defense: 0, shield: 0 };
    try {
        if (player && player.id) {
            const mods = getBuffModifiers('player', player.id);
            if (mods) buffMods = mods;
        }
    } catch (e) {}
    
    const playerDef = Number(buffMods.defense) || 0;
    const reduction = Math.min(0.5, playerDef / 100);
    const rawDamage = Number(enemy.atk) || 0;
    let damage = Math.floor(rawDamage * (1 - reduction));
    
    const playerShield = Number(buffMods.shield) || 0;
    let shieldAbsorbed = 0;
    if (playerShield > 0) {
        shieldAbsorbed = Math.min(damage, playerShield);
        damage -= shieldAbsorbed;
    }
    
    return { damage, shieldAbsorbed, defenseBlocked: Math.floor(rawDamage * reduction) };
}

function evasionCheck(player, enemy) {
    const evadeChance = Math.min(0.3, (Number(player.agility) || 0) / 100);
    return Math.random() < evadeChance;
}

// =======================
//  COMBAT ACTIONS
// =======================
async function playerAttack(playerId, dungeonId, enemyId, weaponBonus) {
    const [player] = await db.execute("SELECT * FROM players WHERE id=?", [playerId]);
    const [enemy] = await db.execute("SELECT * FROM dungeon_enemies WHERE id=?", [enemyId]);
    const p = player[0];
    const e = enemy[0];
    
    let evaded = false;
    let damage = calculatePlayerDamage(p, e, weaponBonus);
    if (evasionCheck(p, e)) {
        damage = Math.floor(damage * 0.5);
        evaded = true;
    }
    
    await db.execute("UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?", [damage, enemyId]);
    const [updatedEnemy] = await db.execute("SELECT * FROM dungeon_enemies WHERE id=?", [enemyId]);
    const defeated = updatedEnemy[0].current_hp <= 0;
    
    let exp = 0, gold = 0;
    let rewardDistribution = null;
    if (defeated) {
        const result = await distributeEnemyRewards(dungeonId, enemyId);
        rewardDistribution = result;
        exp = result.contributors.find(c => c.playerId === playerId)?.exp || 0;
        gold = result.contributors.find(c => c.playerId === playerId)?.gold || 0;
    }
    
    let retaliation = 0;
    let playerHp = Number(p.hp);
    let retaliationMessage = '';
    let shieldAbsorbed = 0;
    let defenseBlocked = 0;
    if (!defeated) {
        const retResult = calculateEnemyRetaliation(e, p);
        retaliation = retResult.damage;
        shieldAbsorbed = retResult.shieldAbsorbed;
        defenseBlocked = retResult.defenseBlocked;
        if (shieldAbsorbed > 0) {
            consumeShield('player', playerId, shieldAbsorbed);
        }
        await db.execute("UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?", [retaliation, playerId]);
        const [pUpdated] = await db.execute("SELECT hp FROM players WHERE id=?", [playerId]);
        playerHp = Number(pUpdated[0].hp);
        retaliationMessage = `⚡ ${e.name} snarls and prepares to retaliate with ${e.moves?.[0]?.name || 'a vicious strike'}!`;
        if (defenseBlocked > 0) retaliationMessage += ` 🛡️ Your defense blocked ${defenseBlocked} damage.`;
        if (shieldAbsorbed > 0) retaliationMessage += ` 🛡️ Your shield absorbed ${shieldAbsorbed} damage.`;
    }
    
    const [remaining] = await db.execute(
        "SELECT COUNT(*) as cnt FROM dungeon_enemies WHERE dungeon_id=? AND current_hp > 0",
        [dungeonId]
    );
    if (remaining[0].cnt === 0) {
        await db.execute("UPDATE dungeon SET stage_cleared=1 WHERE id=?", [dungeonId]);
    }
    
    tickBuffs('player', playerId);
    
    return {
        enemyDefeated: defeated,
        enemyHp: defeated ? 0 : Number(updatedEnemy[0].current_hp),
        damage, exp, gold, rewardDistribution,
        retaliation, playerHp, retaliationMessage,
        enemyName: e.name,
        enemyMaxHp: Number(e.max_hp),
        evaded
    };
}

async function playerSkill(playerId, dungeonId, enemyId, move, player, equippedItems) {
    const [enemy] = await db.execute("SELECT * FROM dungeon_enemies WHERE id=?", [enemyId]);
    const p = player;
    const e = enemy[0];
    
    let evaded = false;
    let damage = calculateMoveDamage(p, move, e, equippedItems);
    
    if (move.stat !== 'intelligence' && evasionCheck(p, e)) {
        damage = Math.floor(damage * 0.5);
        evaded = true;
    }
    
    await db.execute("UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?", [damage, enemyId]);
    const [updatedEnemy] = await db.execute("SELECT * FROM dungeon_enemies WHERE id=?", [enemyId]);
    const defeated = updatedEnemy[0].current_hp <= 0;
    
    let exp = 0, gold = 0;
    let rewardDistribution = null;
    if (defeated) {
        const result = await distributeEnemyRewards(dungeonId, enemyId);
        rewardDistribution = result;
        exp = result.contributors.find(c => c.playerId === playerId)?.exp || 0;
        gold = result.contributors.find(c => c.playerId === playerId)?.gold || 0;
    }
    
    let retaliation = 0;
    let playerHp = Number(p.hp);
    let retaliationMessage = '';
    let shieldAbsorbed = 0;
    let defenseBlocked = 0;
    if (!defeated) {
        const retResult = calculateEnemyRetaliation(e, p);
        retaliation = retResult.damage;
        shieldAbsorbed = retResult.shieldAbsorbed;
        defenseBlocked = retResult.defenseBlocked;
        if (shieldAbsorbed > 0) {
            consumeShield('player', playerId, shieldAbsorbed);
        }
        await db.execute("UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?", [retaliation, playerId]);
        const [pUpdated] = await db.execute("SELECT hp FROM players WHERE id=?", [playerId]);
        playerHp = Number(pUpdated[0].hp);
        retaliationMessage = `⚡ ${e.name} snarls and prepares to retaliate with ${e.moves?.[0]?.name || 'a vicious strike'}!`;
        if (defenseBlocked > 0) retaliationMessage += ` 🛡️ Your defense blocked ${defenseBlocked} damage.`;
        if (shieldAbsorbed > 0) retaliationMessage += ` 🛡️ Your shield absorbed ${shieldAbsorbed} damage.`;
    }
    
    const [remaining] = await db.execute(
        "SELECT COUNT(*) as cnt FROM dungeon_enemies WHERE dungeon_id=? AND current_hp > 0",
        [dungeonId]
    );
    if (remaining[0].cnt === 0) {
        await db.execute("UPDATE dungeon SET stage_cleared=1 WHERE id=?", [dungeonId]);
    }
    
    tickBuffs('player', playerId);
    
    return {
        damage, defeated, exp, gold, rewardDistribution,
        retaliation, playerHp, retaliationMessage,
        enemyHp: defeated ? 0 : Number(updatedEnemy[0].current_hp),
        enemyMaxHp: Number(e.max_hp),
        enemyName: e.name,
        evaded
    };
}

// =======================
//  REWARD DISTRIBUTION
// =======================
async function distributeEnemyRewards(dungeonId, enemyId) {
    const [enemy] = await db.execute("SELECT exp, gold, name FROM dungeon_enemies WHERE id=?", [enemyId]);
    if (!enemy.length) return { contributors: [] };
    
    const totalExp = Number(enemy[0].exp);
    const totalGold = Number(enemy[0].gold);
    
    const [contributors] = await db.execute(
        "SELECT player_id, damage_dealt FROM dungeon_damage WHERE dungeon_id=? AND enemy_id=?",
        [dungeonId, enemyId]
    );
    
    if (contributors.length === 0) return { contributors: [] };
    
    const totalDamage = contributors.reduce((sum, c) => sum + Number(c.damage_dealt), 0);
    const rewards = [];
    
    for (const c of contributors) {
        const share = totalDamage > 0 ? Number(c.damage_dealt) / totalDamage : 0;
        const expEarned = Math.floor(totalExp * share);
        const goldEarned = Math.floor(totalGold * share);
        
        await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [expEarned, c.player_id]);
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [goldEarned, c.player_id]);
        
        const [player] = await db.execute("SELECT nickname FROM players WHERE id=?", [c.player_id]);
        rewards.push({
            playerId: c.player_id,
            nickname: player[0].nickname,
            damage: Number(c.damage_dealt),
            exp: expEarned,
            gold: goldEarned
        });
    }
    
    await db.execute("DELETE FROM dungeon_damage WHERE dungeon_id=? AND enemy_id=?", [dungeonId, enemyId]);
    
    return { enemyName: enemy[0].name, contributors: rewards };
}

async function addDamageContribution(dungeonId, enemyId, playerId, damage) {
    await db.execute(
        `INSERT INTO dungeon_damage (dungeon_id, enemy_id, player_id, damage_dealt)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE damage_dealt = damage_dealt + ?`,
        [dungeonId, enemyId, playerId, damage, damage]
    );
}

// =======================
//  STAGE PROGRESSION
// =======================
async function advanceStage(dungeonId, nextStage) {
    await db.execute("UPDATE dungeon SET stage=?, stage_cleared=0 WHERE id=?", [nextStage, dungeonId]);
    const [dungeon] = await db.execute("SELECT dungeon_rank FROM dungeon WHERE id=?", [dungeonId]);
    await spawnStageEnemies(dungeonId, dungeon[0].dungeon_rank, nextStage);
}

// =======================
//  PLAYER DUNGEON ACTIONS
// =======================
async function addPlayerToDungeon(playerId, dungeonId) {
    await db.execute(
        "INSERT INTO dungeon_players (player_id, dungeon_id, is_alive) VALUES (?, ?, 1)",
        [playerId, dungeonId]
    );
}

async function removePlayerFromDungeon(playerId, dungeonId) {
    await db.execute(
        "DELETE FROM dungeon_players WHERE player_id=? AND dungeon_id=?",
        [playerId, dungeonId]
    );
    await checkAndCloseEmptyDungeon(dungeonId);
}

async function isPlayerInDungeon(playerId, dungeonId) {
    const [rows] = await db.execute(
        "SELECT * FROM dungeon_players WHERE player_id=? AND dungeon_id=? AND is_alive=1",
        [playerId, dungeonId]
    );
    return rows.length > 0;
}

async function checkAndCloseEmptyDungeon(dungeonId) {
    const [rows] = await db.execute(
        "SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
        [dungeonId]
    );
    if (rows[0].cnt === 0) {
        await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [dungeonId]);
        dungeonLocks.delete(dungeonId);
        clearDungeonTimers(dungeonId);
        
        if (autoStartTimers.has(dungeonId)) {
            clearTimeout(autoStartTimers.get(dungeonId));
            autoStartTimers.delete(dungeonId);
        }
        
        console.log(`🏰 Dungeon ${dungeonId} closed (empty).`);
        return true;
    }
    return false;
}

async function isPlayerInAnyDungeon(playerId) {
    const [rows] = await db.execute(
        "SELECT dungeon_id FROM dungeon_players WHERE player_id=? AND is_alive=1",
        [playerId]
    );
}
async function checkAndCloseEmptyDungeon(dungeonId) {
    const [rows] = await db.execute(
        "SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
        [dungeonId]
    );
    if (rows[0].cnt === 0) {
        await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [dungeonId]);
        dungeonLocks.delete(dungeonId);
        clearDungeonTimers(dungeonId);
        
        // Clean up any pending auto-start timer
        if (autoStartTimers.has(dungeonId)) {
            clearTimeout(autoStartTimers.get(dungeonId));
            autoStartTimers.delete(dungeonId);
        }
        
        console.log(`🏰 Dungeon ${dungeonId} closed (empty).`);
        return true;
    }
    return false;
}

async function isPlayerInAnyDungeon(playerId) {
    const [rows] = await db.execute(
        "SELECT dungeon_id FROM dungeon_players WHERE player_id=? AND is_alive=1",
        [playerId]
    );
    return rows.length ? rows[0].dungeon_id : null;
}

// =======================
//  TARGETING HELPERS
// =======================
async function findEnemyTarget(dungeonId, targetArg) {
    const enemies = await getCurrentEnemies(dungeonId);
    if (!enemies.length) return null;
    const index = parseInt(targetArg) - 1;
    if (!isNaN(index) && index >= 0 && index < enemies.length) return enemies[index];
    const search = targetArg.toLowerCase();
    return enemies.find(e => e.name.toLowerCase().includes(search)) || null;
}

async function findPlayerTarget(dungeonId, targetArg, client) {
    if (targetArg.startsWith('@')) {
        const number = targetArg.substring(1).replace(/\D/g, '');
        if (number) {
            const [rows] = await db.execute(
                `SELECT p.* FROM players p JOIN dungeon_players dp ON p.id = dp.player_id
                 WHERE dp.dungeon_id = ? AND p.id LIKE ? AND dp.is_alive = 1`,
                [dungeonId, `%${number}%`]
            );
            return rows[0] || null;
        }
    }
    const [rows] = await db.execute(
        `SELECT p.* FROM players p JOIN dungeon_players dp ON p.id = dp.player_id
         WHERE dp.dungeon_id = ? AND p.nickname = ? AND dp.is_alive = 1`,
        [dungeonId, targetArg]
    );
    if (rows.length) return rows[0];
    const [rows2] = await db.execute(
        `SELECT p.* FROM players p JOIN dungeon_players dp ON p.id = dp.player_id
         WHERE dp.dungeon_id = ? AND p.id = ? AND dp.is_alive = 1`,
        [dungeonId, targetArg]
    );
    return rows2[0] || null;
}

// =======================
//  STATUS DISPLAY
// =======================
async function getDungeonStatusText(dungeonId) {
    const [dungeon] = await db.execute("SELECT * FROM dungeon WHERE id=?", [dungeonId]);
    if (!dungeon.length) return "Dungeon not found.";
    const d = dungeon[0];
    const enemies = await getCurrentEnemies(dungeonId);
    let text = `══〘 🏰 DUNGEON STATUS 〙══╮\n`;
    text += `┃◆ Rank: ${d.dungeon_rank}  •  Stage: ${d.stage}/${d.max_stage}\n`;
    text += `┃◆ Locked: ${d.locked ? '🔒 YES' : '🔓 NO'}\n`;
    text += `┃◆────────────\n`;
    if (enemies.length === 0) {
        text += `┃◆ ✅ All enemies defeated!\n`;
        text += `┃◆ 🧭 Use !onward to advance\n`;
    } else {
        text += `┃◆ 👾 ENEMIES:\n`;
        enemies.forEach((e, i) => {
            text += `┃◆   ${i+1}. ${e.name} (${e.current_hp}/${e.max_hp} HP)\n`;
        });
    }
    text += `┃◆────────────\n┃◆ 🧭 !attack • !skill <name>\n╰═══════════════════════╯`;
    return text;
}

module.exports = {
    spawnDungeon,
    getActiveDungeon,
    isPlayerInDungeon,
    addPlayerToDungeon,
    removePlayerFromDungeon,
    lockDungeon,
    isDungeonLocked,
    spawnStageEnemies,
    getCurrentEnemies,
    playerAttack,
    playerSkill,
    advanceStage,
    getMaxStageForDungeon,
    findEnemyTarget,
    findPlayerTarget,
    getDungeonStatusText,
    checkAndCloseEmptyDungeon,
    isPlayerInAnyDungeon,
    addDamageContribution,
    distributeEnemyRewards,
    autoStartTimers   // Export so enter.js can use it
};