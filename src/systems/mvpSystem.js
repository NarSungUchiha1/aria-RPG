/**
 * MVP System — Party Duels & Dungeons
 *
 * Role-based criteria:
 *  Berserker / Assassin / Mage → highest damage dealt
 *  Healer                      → most healing done
 *  Tank                        → most damage absorbed (taken)
 *
 * Tiers:
 *  MVP       → top performer, bonus gold + XP
 *  MVP+      → exceptional (≥40% of total), bonus gold + XP + a material
 */

const db = require('../database/db');

// ── Reward config ─────────────────────────────────────────────────────────────
const MVP_REWARDS = {
    standard:    { gold: 1000, xp: 500  },
    exceptional: { gold: 2500, xp: 1200, material: 'Void Shard' }
};

// How much of the total metric a player needs to be "exceptional"
const EXCEPTIONAL_THRESHOLD = 0.40; // 40% of total

// ── Stat tracking per duel/dungeon key ───────────────────────────────────────
const mvpStats = new Map();
// key → { playerId: { damageDealt, healingDone, damageTaken, kills, role } }

function initMvpTracking(key, playerIds) {
    const stats = {};
    for (const id of playerIds) stats[id] = { damageDealt: 0, healingDone: 0, damageTaken: 0, kills: 0, role: null };
    mvpStats.set(key, stats);
}

function recordDamage(key, attackerId, targetId, damage, actualDamage) {
    const stats = mvpStats.get(key);
    if (!stats) return;
    if (stats[attackerId]) stats[attackerId].damageDealt += (actualDamage || damage || 0);
    if (stats[targetId])   stats[targetId].damageTaken  += (actualDamage || damage || 0);
}

function recordHeal(key, healerId, amount) {
    const stats = mvpStats.get(key);
    if (!stats || !stats[healerId]) return;
    stats[healerId].healingDone += (amount || 0);
}

function recordKill(key, killerId) {
    const stats = mvpStats.get(key);
    if (!stats || !stats[killerId]) return;
    stats[killerId].kills++;
}

// ── Calculate and announce MVP ────────────────────────────────────────────────
async function calculateMvp(key, participantIds, context = 'dungeon') {
    const stats = mvpStats.get(key);
    if (!stats) return null;

    // Fetch roles for all participants
    const results = [];
    for (const id of participantIds) {
        if (!stats[id]) continue;
        try {
            const [rows] = await db.execute(
                "SELECT nickname, role, prestige_level FROM players WHERE id=? LIMIT 1", [id]
            );
            if (!rows[0]) continue;
            const p = rows[0];
            const s = stats[id];

            // Role-based score
            let score = 0;
            let metric = 'damage';
            if (p.role === 'Healer') {
                score  = s.healingDone;
                metric = 'healing';
            } else if (p.role === 'Tank') {
                score  = s.damageTaken;
                metric = 'damage tanked';
            } else {
                score  = s.damageDealt;
                metric = 'damage';
            }

            results.push({
                id, nickname: p.nickname, role: p.role,
                prestige: p.prestige_level > 0,
                score, metric,
                damageDealt: s.damageDealt,
                healingDone: s.healingDone,
                damageTaken: s.damageTaken,
                kills: s.kills
            });
        } catch {}
    }

    if (!results.length) return null;

    // Sort by role-based score
    results.sort((a, b) => b.score - a.score);
    const mvp = results[0];

    // Check if exceptional
    const totalScore = results.reduce((sum, r) => sum + r.score, 0);
    const isExceptional = totalScore > 0 && (mvp.score / totalScore) >= EXCEPTIONAL_THRESHOLD;

    const rewards = isExceptional ? MVP_REWARDS.exceptional : MVP_REWARDS.standard;

    // Give rewards
    try {
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [rewards.gold, mvp.id]);
        await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?",           [rewards.xp,   mvp.id]);
        if (isExceptional && rewards.material) {
            await db.execute(
                "INSERT INTO inventory (player_id, item_name, item_type, quantity) VALUES (?,?,'material',1) ON DUPLICATE KEY UPDATE quantity=quantity+1",
                [mvp.id, rewards.material]
            );
        }
    } catch (e) { console.error('[MVP] reward error:', e.message); }

    // Build announcement
    const tier    = isExceptional ? '🌟 EXCEPTIONAL MVP' : '⭐ MVP';
    const details = [];
    if (mvp.damageDealt > 0) details.push(`${mvp.damageDealt.toLocaleString()} dmg dealt`);
    if (mvp.healingDone > 0) details.push(`${mvp.healingDone.toLocaleString()} healed`);
    if (mvp.damageTaken > 0 && mvp.role === 'Tank') details.push(`${mvp.damageTaken.toLocaleString()} tanked`);
    if (mvp.kills > 0)       details.push(`${mvp.kills} KO${mvp.kills > 1 ? 's' : ''}`);

    let reward_line = `+${rewards.gold.toLocaleString()} Gold  +${rewards.xp.toLocaleString()} XP`;
    if (isExceptional && rewards.material) reward_line += `  +1 ${rewards.material}`;

    const msg =
        `╭══〘 ${tier} 〙══╮\n` +
        `┃★ ${mvp.nickname} [${mvp.role}]\n` +
        `┃★ ${details.join('  |  ')}\n` +
        `┃★ 🎁 ${reward_line}\n` +
        `╰═══════════════════════╯`;

    // Cleanup
    mvpStats.delete(key);

    return { mvp, isExceptional, rewards, message: msg };
}

module.exports = { initMvpTracking, recordDamage, recordHeal, recordKill, calculateMvp };