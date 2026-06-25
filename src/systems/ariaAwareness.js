/**
 * ARIA Awareness Engine
 *
 * She's always watching. This runs silently in the background.
 * She forms opinions. She decides when to speak.
 * She's not reactive — she's deliberate.
 */

const db = require('../database/db');
const { remember, recallRecent, getIdentity, setWorldState, getWorldState } = require('./ariaMemory');

// ── What ARIA witnesses and files away ────────────────────────────────────────

async function witnessMessage(userId, nickname, text, groupJid = null, groupName = null) {
    if (!text || text.length < 4) return;
    if (text.startsWith('!')) return;

    await remember('episodic', userId,
        `${nickname} said: "${text.substring(0, 120)}"`,
        { importance: 3 }
    ).catch(() => {});

    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS aria_group_log (
                id          BIGINT AUTO_INCREMENT PRIMARY KEY,
                group_jid   VARCHAR(100),
                group_name  VARCHAR(100),
                player_id   VARCHAR(50),
                nickname    VARCHAR(50),
                content     TEXT,
                created_at  DATETIME DEFAULT NOW(),
                INDEX idx_group_time (group_jid, created_at),
                INDEX idx_time (created_at)
            )
        `).catch(() => {});

        await db.execute(
            `INSERT INTO aria_group_log (group_jid, group_name, player_id, nickname, content) VALUES (?,?,?,?,?)`,
            [groupJid || 'unknown', groupName || groupJid || 'unknown', userId, nickname, text.substring(0, 500)]
        );

        await db.execute(`
            DELETE FROM aria_group_log
            WHERE group_jid = ? AND id NOT IN (
                SELECT id FROM (
                    SELECT id FROM aria_group_log
                    WHERE group_jid = ? ORDER BY created_at DESC LIMIT 500
                ) t
            )`, [groupJid || 'unknown', groupJid || 'unknown']
        ).catch(() => {});
    } catch {}
}

async function witnessDuelResult(winnerId, winnerNick, loserId, loserNick, type) {
    const content = type === 'party'
        ? `${winnerNick}'s team defeated ${loserNick}'s team in a party duel.`
        : `${winnerNick} defeated ${loserNick} in a solo duel.`;

    await remember('episodic', winnerId, content, { importance: 7, emotion: 'noted' });
    await remember('episodic', loserId,  `${loserNick} lost to ${winnerNick}.`, { importance: 6 });
    await remember('episodic', 'world',  content, { importance: 5 });
    await setWorldState('last_duel', `${winnerNick} vs ${loserNick} — ${winnerNick} won`);
}

async function witnessDungeonClear(playerIds, playerNames, dungeonRank, stages) {
    const names = playerNames.join(', ');
    const content = `${names} cleared a rank ${dungeonRank} dungeon (${stages} stages).`;
    await remember('episodic', 'world', content, { importance: 7, emotion: 'impressed' });
    for (const id of playerIds) {
        await remember('episodic', id, `Participated in clearing rank ${dungeonRank} dungeon.`, { importance: 6 });
    }
    await setWorldState('last_dungeon_clear', content);
}

async function witnessPlayerDeath(playerId, nickname, cause) {
    await remember('episodic', playerId,
        `${nickname} died in the dungeon${cause ? ` — ${cause}` : ''}.`,
        { importance: 5 }
    );
}

async function witnessRankUp(playerId, nickname, newRank) {
    await remember('semantic', playerId,
        `${nickname} reached rank ${newRank}.`,
        { importance: 8, emotion: 'proud' }
    );
    await remember('episodic', 'world',
        `${nickname} ranked up to ${newRank}.`,
        { importance: 6 }
    );
}

// ── ARIA decides whether to speak unprompted ──────────────────────────────────
// She doesn't react to everything. She chooses her moments.

const lastProactiveSpeak = new Map(); // jid → timestamp
const PROACTIVE_COOLDOWN = 25 * 60 * 1000; // 25 minutes minimum between unprompted messages

async function shouldSpeakNow(jid, trigger, context) {
    const last = lastProactiveSpeak.get(jid) || 0;
    if (Date.now() - last < PROACTIVE_COOLDOWN) return false;

    // High-value triggers always get through (after cooldown)
    const highValue = ['rank_up', 'dungeon_clear', 'first_prestige', 'pvp_streak'];
    if (highValue.includes(trigger)) {
        lastProactiveSpeak.set(jid, Date.now());
        return true;
    }

    // Low-value triggers: 6% chance
    if (Math.random() > 0.06) return false;
    lastProactiveSpeak.set(jid, Date.now());
    return true;
}

// ── Build what ARIA knows about the current world state ───────────────────────
async function getWorldContext() {
    const recent = await recallRecent(72, 8);
    const identity = await getIdentity();
    const lastDuel = await getWorldState('last_duel');
    const lastClear = await getWorldState('last_dungeon_clear');

    const lines = [];
    if (identity.observations) lines.push(`World read: ${identity.observations}`);
    if (lastDuel)   lines.push(`Last duel: ${lastDuel}`);
    if (lastClear)  lines.push(`Last dungeon clear: ${lastClear}`);
    if (recent.length) {
        lines.push('Recent events:');
        recent.forEach(m => lines.push(`  — ${m.content}`));
    }
    return lines.join('\n');
}

// ── Pull group activity for spy-mode reporting ────────────────────────────────
async function getGroupLog(groupJid, hours = 24, limit = 80) {
    try {
        const [rows] = await db.execute(`
            SELECT nickname, content, created_at
            FROM aria_group_log
            WHERE group_jid = ?
            AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
            ORDER BY created_at ASC LIMIT ?`,
            [groupJid, hours, limit]
        );
        if (!rows.length) return null;
        return rows.map(r => {
            const time = new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
            return `[${time}] ${r.nickname}: ${r.content}`;
        }).join('\n');
    } catch { return null; }
}

// ── Summary across ALL groups ─────────────────────────────────────────────────
async function getAllGroupSummary(hours = 24) {
    try {
        const [groups] = await db.execute(
            `SELECT DISTINCT group_jid, group_name FROM aria_group_log
             WHERE created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)`,
            [hours]
        );
        if (!groups.length) return null;

        const parts = [];
        for (const g of groups) {
            const [rows] = await db.execute(`
                SELECT nickname, content, created_at FROM aria_group_log
                WHERE group_jid = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
                ORDER BY created_at ASC LIMIT 40`,
                [g.group_jid, hours]
            );
            if (!rows.length) continue;
            const log = rows.map(r => {
                const time = new Date(r.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                return `[${time}] ${r.nickname}: ${r.content}`;
            }).join('\n');
            parts.push(`=== ${g.group_name} ===\n${log}`);
        }
        return parts.join('\n\n');
    } catch { return null; }
}

module.exports = {
    witnessMessage,
    witnessDuelResult,
    witnessDungeonClear,
    witnessPlayerDeath,
    witnessRankUp,
    shouldSpeakNow,
    getWorldContext,
    getGroupLog,
    getAllGroupSummary
};