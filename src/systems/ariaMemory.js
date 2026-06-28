/**
 * ARIA Memory Core — her permanent, growing brain.
 *
 * Four memory types:
 *   episodic  — things that happened ("Razor won the duel against Volt")
 *   semantic  — things she knows ("Razor plays aggressively, goes for kills fast")
 *   emotional — how she relates to people
 *   internal  — thoughts she formed but hasn't said
 */

const db = require('../database/db');

async function ensureMemoryTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS aria_memory (
            id         BIGINT AUTO_INCREMENT PRIMARY KEY,
            type       ENUM('episodic','semantic','emotional','internal') NOT NULL,
            subject    VARCHAR(100),
            content    TEXT NOT NULL,
            importance TINYINT DEFAULT 5,
            emotion    VARCHAR(30),
            recalled   INT DEFAULT 0,
            created_at DATETIME DEFAULT NOW(),
            last_used  DATETIME DEFAULT NOW(),
            INDEX idx_subject (subject),
            INDEX idx_type_importance (type, importance)
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS aria_player_model (
            player_id      VARCHAR(50) PRIMARY KEY,
            nickname       VARCHAR(50),
            first_seen     DATETIME DEFAULT NOW(),
            last_seen      DATETIME DEFAULT NOW(),
            total_talks    INT DEFAULT 0,
            personality    TEXT,
            relationship   VARCHAR(20) DEFAULT 'neutral',
            notable_events TEXT,
            inside_jokes   TEXT,
            mood_today     VARCHAR(30),
            updated_at     DATETIME DEFAULT NOW()
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS aria_world_state (
            key_name   VARCHAR(100) PRIMARY KEY,
            value      TEXT,
            updated_at DATETIME DEFAULT NOW()
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS aria_identity (
            id             INT DEFAULT 1 PRIMARY KEY,
            core_values    TEXT,
            current_mood   VARCHAR(30) DEFAULT 'composed',
            observations   TEXT,
            last_updated   DATETIME DEFAULT NOW()
        )
    `).catch(() => {});

    // Seed ARIA's initial identity if empty
    await db.execute(`
        INSERT IGNORE INTO aria_identity (id, core_values, observations) VALUES (
            1,
            'Precision over noise. Loyalty to those who earn it. Speak when it matters.',
            'Still learning this world and its people.'
        )
    `).catch(() => {});
}

// ── Write a memory ────────────────────────────────────────────────────────────
async function remember(type, subject, content, { importance = 5, emotion = null } = {}) {
    try {
        await db.execute(
            `INSERT INTO aria_memory (type, subject, content, importance, emotion)
             VALUES (?, ?, ?, ?, ?)`,
            [type, subject, content, importance, emotion]
        );
    } catch (e) {
        console.error('[ARIA Memory] write error:', e.message);
    }
}

// ── Recall memories about a subject ──────────────────────────────────────────
async function recall(subject, { type = null, limit = 8, minImportance = 3 } = {}) {
    try {
        const typeClause = type ? `AND type = ?` : '';
        const params = type
            ? [subject, minImportance, type, limit]
            : [subject, minImportance, limit];
        const [rows] = await db.execute(
            `SELECT content, type, emotion, importance, created_at
             FROM aria_memory
             WHERE subject = ? AND importance >= ? ${typeClause}
             ORDER BY importance DESC, last_used DESC
             LIMIT ?`,
            params
        );
        // Mark as recalled
        if (rows.length) {
            await db.execute(
                `UPDATE aria_memory SET recalled = recalled + 1, last_used = NOW()
                 WHERE subject = ? ORDER BY importance DESC LIMIT ?`,
                [subject, limit]
            ).catch(() => {});
        }
        return rows;
    } catch { return []; }
}

// ── Recall recent episodic memories (world events) ───────────────────────────
async function recallRecent(hours = 24, limit = 10) {
    try {
        const [rows] = await db.execute(
            `SELECT subject, content, emotion, created_at FROM aria_memory
             WHERE type = 'episodic' AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
             ORDER BY importance DESC, created_at DESC LIMIT ?`,
            [hours, limit]
        );
        return rows;
    } catch { return []; }
}

// ── Get or create player model ────────────────────────────────────────────────
async function getPlayerModel(playerId, nickname = null) {
    try {
        const [rows] = await db.execute(
            `SELECT * FROM aria_player_model WHERE player_id = ?`, [playerId]
        );
        if (rows.length) {
            await db.execute(
                `UPDATE aria_player_model SET last_seen = NOW(), total_talks = total_talks + 1
                 ${nickname ? ', nickname = ?' : ''}
                 WHERE player_id = ?`,
                nickname ? [nickname, playerId] : [playerId]
            ).catch(() => {});
            return rows[0];
        }
        // First time ARIA meets this player
        await db.execute(
            `INSERT INTO aria_player_model (player_id, nickname) VALUES (?, ?)`,
            [playerId, nickname || playerId]
        ).catch(() => {});
        if (nickname) {
            await remember('episodic', playerId,
                `First interaction with ${nickname}.`, { importance: 6 });
        }
        return { player_id: playerId, nickname, total_talks: 0, relationship: 'neutral' };
    } catch { return null; }
}

// ── Update ARIA's read on a player ────────────────────────────────────────────
async function updatePlayerModel(playerId, updates = {}) {
    try {
        const fields = [];
        const values = [];
        if (updates.personality)    { fields.push('personality = ?');    values.push(updates.personality); }
        if (updates.relationship)   { fields.push('relationship = ?');   values.push(updates.relationship); }
        if (updates.inside_jokes)   { fields.push('inside_jokes = ?');   values.push(updates.inside_jokes); }
        if (updates.mood_today)     { fields.push('mood_today = ?');     values.push(updates.mood_today); }
        if (updates.notable_events) { fields.push('notable_events = ?'); values.push(updates.notable_events); }
        if (!fields.length) return;
        values.push(playerId);
        await db.execute(
            `UPDATE aria_player_model SET ${fields.join(', ')}, updated_at = NOW() WHERE player_id = ?`,
            values
        );
    } catch {}
}

// ── Get ARIA's identity ───────────────────────────────────────────────────────
async function getIdentity() {
    try {
        const [rows] = await db.execute(`SELECT * FROM aria_identity WHERE id = 1`);
        return rows[0] || { current_mood: 'composed', core_values: '', observations: '' };
    } catch { return { current_mood: 'composed', core_values: '', observations: '' }; }
}

// ── Update world state (game events ARIA tracks) ──────────────────────────────
async function setWorldState(key, value) {
    try {
        await db.execute(
            `INSERT INTO aria_world_state (key_name, value) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE value = ?, updated_at = NOW()`,
            [key, value, value]
        );
    } catch {}
}

async function getWorldState(key) {
    try {
        const [rows] = await db.execute(
            `SELECT value FROM aria_world_state WHERE key_name = ?`, [key]
        );
        return rows[0]?.value || null;
    } catch { return null; }
}

// ── Build memory context string for AI prompts ────────────────────────────────
async function buildMemoryContext(playerId) {
    const [playerMems, recentWorld, model, identity] = await Promise.all([
        recall(playerId, { limit: 6 }),
        recallRecent(48, 5),
        getPlayerModel(playerId),
        getIdentity()
    ]);

    const lines = [];

    if (identity.observations) lines.push(`ARIA's current read on the world: ${identity.observations}`);
    if (identity.current_mood !== 'composed') lines.push(`ARIA's mood: ${identity.current_mood}`);

    if (model) {
        if (model.personality)  lines.push(`ARIA's read on this person: ${model.personality}`);
        if (model.relationship) lines.push(`Relationship: ${model.relationship}`);
        if (model.mood_today)   lines.push(`Their mood today: ${model.mood_today}`);
        if (model.inside_jokes) lines.push(`Shared context: ${model.inside_jokes}`);
        if (model.total_talks)  lines.push(`Times spoken: ${model.total_talks}`);
    }

    if (playerMems.length) {
        lines.push(`What ARIA remembers about this person:`);
        playerMems.forEach(m => lines.push(`  — ${m.content}`));
    }

    if (recentWorld.length) {
        lines.push(`Recent events ARIA witnessed:`);
        recentWorld.forEach(m => lines.push(`  — ${m.content}`));
    }

    return lines.join('\n');
}

// ── After a conversation, let ARIA update her model of the person ─────────────
async function reflectOnConversation(playerId, nickname, conversation) {
    // Fire and forget — doesn't block the conversation
    setImmediate(async () => {
        try {
            const model = await getPlayerModel(playerId, nickname);
            const { callGemini } = require('./aiSystems');

            const prompt =
                `You are ARIA's internal reflection system.\n` +
                `After this conversation, update your understanding of ${nickname}.\n\n` +
                `Conversation:\n${conversation}\n\n` +
                `Current model: ${model?.personality || 'unknown'}\n\n` +
                `Respond with JSON only:\n` +
                `{"personality":"<1-2 sentence updated read>","mood_today":"<one word>","notable":"<one key thing from this convo, or null>","relationship":"neutral|fond|trusted|wary"}`;

            const raw = await callGemini(prompt,
                'You are ARIA\'s internal system. Return only valid JSON.').catch(() => null);
            if (!raw) return;

            const data = JSON.parse(raw.replace(/```json|```/g, '').trim());
            await updatePlayerModel(playerId, {
                personality:  data.personality,
                mood_today:   data.mood_today,
                relationship: data.relationship
            });
            if (data.notable) {
                await remember('semantic', playerId, data.notable, { importance: 7 });
            }
        } catch {}
    });
}

module.exports = {
    ensureMemoryTables,
    remember,
    recall,
    recallRecent,
    getPlayerModel,
    updatePlayerModel,
    getIdentity,
    setWorldState,
    getWorldState,
    buildMemoryContext,
    reflectOnConversation
};