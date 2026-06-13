/**
 * MVP System — Party Duels & Dungeons
 * Role-based criteria:
 *  Berserker / Assassin / Mage → highest damage dealt
 *  Healer                      → most healing done
 *  Tank                        → most damage absorbed (taken)
 */

const db = require('../database/db');

const MVP_REWARDS = {
    standard:    { gold: 1000, xp: 500  },
    exceptional: { gold: 2500, xp: 1200, material: 'Void Crystal' }
};
const EXCEPTIONAL_THRESHOLD = 0.40;

const mvpStats = new Map();

function _ensureKey(key, rawPlayerId) {
    if (!mvpStats.has(key)) mvpStats.set(key, {});
    const stats = mvpStats.get(key);
    if (!rawPlayerId) return;
    // FIX: normalize so all IDs use the same format
    const playerId = String(rawPlayerId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '').split(':')[0];
    if (!stats[playerId]) {
        stats[playerId] = { damageDealt: 0, healingDone: 0, damageTaken: 0, kills: 0 };
    }
}

function initMvpTracking(key, playerIds) {
    const stats = {};
    for (const rawId of playerIds) {
        // FIX: normalize IDs at init time so they match what recordDamage stores
        const id = String(rawId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '').split(':')[0];
        stats[id] = { damageDealt: 0, healingDone: 0, damageTaken: 0, kills: 0 };
    }
    mvpStats.set(key, stats);
}

// Supports both call signatures:
//   3-arg: recordDamage(key, playerId, damage)          — used by dungeon.js
//   5-arg: recordDamage(key, attackerId, targetId, damage, actualDamage)
function recordDamage(key, attackerRawId, targetIdOrDamage, damage, actualDamage) {
    const attackerId = String(attackerRawId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '').split(':')[0];
    _ensureKey(key, attackerId);
    const stats = mvpStats.get(key);
    // If 3-arg call: targetIdOrDamage IS the damage amount
    let targetId = null;
    let amt = 0;
    if (damage === undefined && actualDamage === undefined) {
        // 3-arg form: (key, playerId, damage)
        amt = Number(targetIdOrDamage) || 0;
    } else {
        // 5-arg form: (key, attacker, target, damage, actualDamage)
        targetId = targetIdOrDamage;
        amt = actualDamage || damage || 0;
        _ensureKey(key, typeof targetId === 'string' && !targetId.startsWith('enemy_') ? targetId : null);
        // Record damage taken for Tank scoring
        if (targetId) {
            const normTarget = String(targetId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '').split(':')[0];
            if (stats && stats[normTarget]) stats[normTarget].damageTaken += amt;
        }
    }
    if (stats && stats[attackerId]) stats[attackerId].damageDealt += amt;
}

function recordHeal(key, healerRawId, targetId, amount, actualAmount) {
    // Support both 3-arg and 5-arg call signatures
    const healAmount = actualAmount || amount || 0;
    const healerId = String(healerRawId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '').split(':')[0];
    _ensureKey(key, healerId);
    const stats = mvpStats.get(key);
    if (stats[healerId]) stats[healerId].healingDone += healAmount;
}

function recordKill(key, killerRawId) {
    const killerId = String(killerRawId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '').split(':')[0];
    _ensureKey(key, killerId);
    const stats = mvpStats.get(key);
    if (stats[killerId]) stats[killerId].kills++;
}

async function calculateMvp(key, participantIds, context = 'dungeon') {
    const stats = mvpStats.get(key);
    if (!stats) {
        console.log('[MVP] No stats found for key:', key, '| Available keys:', [...mvpStats.keys()]);
        return null;
    }

    const results = [];
    for (const rawId of participantIds) {
        // Normalize ID — strip WhatsApp suffix
        const id = String(rawId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '').split(':')[0];
        try {
            const [rows] = await db.execute(
                "SELECT nickname, role, prestige_level FROM players WHERE id=? LIMIT 1", [id]
            );
            if (!rows[0]) continue;
            const p = rows[0];
            const s = stats[id] || { damageDealt: 0, healingDone: 0, damageTaken: 0, kills: 0 };

            // Score = best metric for this player.
            // Healers/Tanks who out-damage the party still compete on damage.
            let score = 0;
            let metric = 'damage';
            if (p.role === 'Healer') {
                if (s.healingDone >= s.damageDealt) { score = s.healingDone; metric = 'healing'; }
                else { score = s.damageDealt; metric = 'damage'; }
            } else if (p.role === 'Tank') {
                const best = Math.max(s.damageTaken, s.damageDealt);
                if (s.damageTaken >= s.damageDealt) { score = s.damageTaken; metric = 'damage tanked'; }
                else { score = s.damageDealt; metric = 'damage'; }
            } else {
                score = s.damageDealt; metric = 'damage';
            }

            results.push({
                id, nickname: p.nickname, role: p.role,
                prestige: (p.prestige_level || 0) > 0,
                score, metric,
                damageDealt: s.damageDealt,
                healingDone: s.healingDone,
                damageTaken: s.damageTaken,
                kills: s.kills
            });
        } catch(e) {}
    }

    if (!results.length) return null;

    // Sort by score descending but pick MVP as best performer relative to their role peers
    // Normalize scores so a Healer who healed 5k competes fairly with a Berserker who dealt 50k
    // Each player's score is normalized as % contribution within their metric group
    const damageGroup = results.filter(r => r.metric === 'damage');
    const healGroup   = results.filter(r => r.metric === 'healing');
    const tankGroup   = results.filter(r => r.metric === 'damage tanked');

    const maxDmg  = Math.max(1, ...damageGroup.map(r => r.score));
    const maxHeal = Math.max(1, ...healGroup.map(r => r.score));
    const maxTank = Math.max(1, ...tankGroup.map(r => r.score));

    results.forEach(r => {
        if (r.metric === 'damage')       r.normalizedScore = r.score / maxDmg;
        else if (r.metric === 'healing') r.normalizedScore = r.score / maxHeal;
        else                             r.normalizedScore = r.score / maxTank;
    });

    results.sort((a, b) => b.normalizedScore - a.normalizedScore);
    const mvp = results[0];
    if (mvp.score === 0) return null;

    // Also pick top performer from each OTHER role group for consolation rewards
    const roleRewards = [];
    for (const group of [damageGroup, healGroup, tankGroup]) {
        const top = [...group].sort((a, b) => b.score - a.score)[0];
        if (top && top.id !== mvp.id && top.score > 0) roleRewards.push(top);
    }

    // Give consolation rewards to top of each role group
    for (const r of roleRewards) {
        const consolation = Math.floor(MVP_REWARDS.standard.gold * 0.4);
        const consolationXp = Math.floor(MVP_REWARDS.standard.xp * 0.4);
        await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [consolation, r.id]).catch(() => {});
        await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [consolationXp, r.id]).catch(() => {});
    }

    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const isExceptional = totalScore > 0 && (mvp.score / totalScore) >= EXCEPTIONAL_THRESHOLD;
    const rewards = isExceptional ? MVP_REWARDS.exceptional : MVP_REWARDS.standard;

    try {
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [rewards.gold, mvp.id]);
        await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [rewards.xp, mvp.id]);
        if (isExceptional && rewards.material) {
            await db.execute(
                "INSERT INTO inventory (player_id, item_name, item_type, quantity) VALUES (?,?,'material',1) ON DUPLICATE KEY UPDATE quantity=quantity+1",
                [mvp.id, rewards.material]
            );
        }
    } catch(e) { console.error('[MVP] reward error:', e.message); }

    const tier = isExceptional ? '🌟 EXCEPTIONAL MVP' : '⭐ MVP';
    const details = [];
    if (mvp.damageDealt > 0) details.push(`${mvp.damageDealt.toLocaleString()} dmg`);
    if (mvp.healingDone > 0) details.push(`${mvp.healingDone.toLocaleString()} healed`);
    if (mvp.role === 'Tank' && mvp.damageTaken > 0) details.push(`${mvp.damageTaken.toLocaleString()} tanked`);
    if (mvp.kills > 0) details.push(`${mvp.kills} KO${mvp.kills > 1 ? 's' : ''}`);

    let rewardLine = `+${rewards.gold.toLocaleString()}G  +${rewards.xp.toLocaleString()}XP`;
    if (isExceptional && rewards.material) rewardLine += `  +1 ${rewards.material}`;

    // Build full leaderboard
    let board = '';
    results.forEach((r, i) => {
        const crown = i === 0 ? '👑' : `${i + 1}.`;
        const rDetails = [];
        if (r.damageDealt > 0) rDetails.push(`${r.damageDealt.toLocaleString()} dmg`);
        if (r.healingDone > 0) rDetails.push(`${r.healingDone.toLocaleString()} healed`);
        if (r.kills > 0) rDetails.push(`${r.kills} KO`);
        board += `┃◆ ${crown} ${r.nickname} [${r.role}] — ${rDetails.join(' | ') || '0'}\n`;
    });

    const message =
        `╔══〘 ${tier} 〙══╗\n` +
        `┃◆\n` +
        board +
        `┃◆\n` +
        `┃◆ 🏆 *${mvp.nickname}* — ${details.join('  |  ')}\n` +
        `┃◆ 🎁 ${rewardLine}\n` +
        `╚═══════════════════════════╝`;

    mvpStats.delete(key);
    return { mvp, isExceptional, rewards, message };
}

// Aliases for backward compatibility with dungeon.js imports
const getMvp = calculateMvp;
const getContributions = (key) => mvpStats.get(key) || {};

// Record damage taken by a player (enemy retaliation) for Tank MVP scoring
function recordDamageTaken(key, playerRawId, amount) {
    const playerId = String(playerRawId).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '').split(':')[0];
    _ensureKey(key, playerId);
    const stats = mvpStats.get(key);
    if (stats && stats[playerId]) stats[playerId].damageTaken += (amount || 0);
}

module.exports = { initMvpTracking, recordDamage, recordHeal, recordKill, recordDamageTaken, calculateMvp, getMvp, getContributions, mvpStats };