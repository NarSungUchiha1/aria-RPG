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
    exceptional: { gold: 2500, xp: 1200, material: 'Void Shard' }
};
const EXCEPTIONAL_THRESHOLD = 0.40;

const mvpStats = new Map();

function _ensureKey(key, playerId) {
    if (!mvpStats.has(key)) mvpStats.set(key, {});
    const stats = mvpStats.get(key);
    if (playerId && !stats[playerId]) {
        stats[playerId] = { damageDealt: 0, healingDone: 0, damageTaken: 0, kills: 0 };
    }
}

function initMvpTracking(key, playerIds) {
    const stats = {};
    for (const id of playerIds) stats[id] = { damageDealt: 0, healingDone: 0, damageTaken: 0, kills: 0 };
    mvpStats.set(key, stats);
}

function recordDamage(key, attackerId, targetId, damage, actualDamage) {
    _ensureKey(key, attackerId);
    _ensureKey(key, typeof targetId === 'string' && !targetId.startsWith('enemy_') ? targetId : null);
    const stats = mvpStats.get(key);
    const amt = actualDamage || damage || 0;
    if (stats[attackerId]) stats[attackerId].damageDealt += amt;
    if (targetId && stats[targetId]) stats[targetId].damageTaken += amt;
}

function recordHeal(key, healerId, amount) {
    _ensureKey(key, healerId);
    const stats = mvpStats.get(key);
    if (stats[healerId]) stats[healerId].healingDone += (amount || 0);
}

function recordKill(key, killerId) {
    _ensureKey(key, killerId);
    const stats = mvpStats.get(key);
    if (stats[killerId]) stats[killerId].kills++;
}

async function calculateMvp(key, participantIds, context = 'dungeon') {
    const stats = mvpStats.get(key);
    if (!stats) return null;

    const results = [];
    for (const id of participantIds) {
        try {
            const [rows] = await db.execute(
                "SELECT nickname, role, prestige_level FROM players WHERE id=? LIMIT 1", [id]
            );
            if (!rows[0]) continue;
            const p = rows[0];
            const s = stats[id] || { damageDealt: 0, healingDone: 0, damageTaken: 0, kills: 0 };

            let score = 0;
            let metric = 'damage';
            if (p.role === 'Healer') { score = s.healingDone; metric = 'healing'; }
            else if (p.role === 'Tank') { score = s.damageTaken; metric = 'damage tanked'; }
            else { score = s.damageDealt; metric = 'damage'; }

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
    results.sort((a, b) => b.score - a.score);
    const mvp = results[0];
    if (mvp.score === 0) return null; // nobody dealt damage — skip

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

module.exports = { initMvpTracking, recordDamage, recordHeal, recordKill, calculateMvp };