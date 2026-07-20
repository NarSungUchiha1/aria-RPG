/**
 * SUNSHARD REFLECTIONS — player vs. their own mirror (PvC with PvP rules).
 *
 * When a Sunshard crashes into a dungeon, the light throws every hunter's
 * reflection back at them. Each player must beat THEIR OWN reflection before
 * they can move on. The reflection:
 *   • uses the player's OWN moveset (it can heal and shield itself)
 *   • is built from the player's stats, buffed by the dungeon's rank
 *   • only fights its owner — nobody can help, nobody can be helped
 *
 * Because the gate is per-player, the party splits naturally: whoever beats
 * their reflection can !onward and push ahead, while the rest are still
 * locked in their duel.
 */
const db = require('../database/db');

// Reflection buff by dungeon rank — deeper dungeon, stronger mirror.
const RANK_SCALE = {
    F: 1.15, E: 1.25, D: 1.35, C: 1.45, B: 1.55, A: 1.7, S: 1.9,
    PF: 2.0, PE: 2.1, PD: 2.2, PC: 2.3, PB: 2.4, PA: 2.5, PS: 2.6
};

// Every mirror starts at 15k HP and grows with the original's CURRENT stats —
// the stronger the hunter, the deadlier the thing wearing their face.
const REFLECTION_BASE_HP = 15000;
const HP_PER_STAT        = 15;

// Break your mirror within 5 minutes or it kills you.
const REFLECTION_TIME_LIMIT_MS = 5 * 60 * 1000;
const deadlineTimers = new Map(); // dungeonId -> timeout

let _tableReady = false;
async function ensureReflectionTable() {
    if (_tableReady) return;
    await db.execute(`
        CREATE TABLE IF NOT EXISTS dungeon_reflections (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            dungeon_id  INT NOT NULL,
            player_id   VARCHAR(60) NOT NULL,
            nickname    VARCHAR(60),
            max_hp      INT NOT NULL,
            current_hp  INT NOT NULL,
            shield      INT DEFAULT 0,
            atk         INT DEFAULT 0,
            defeated    TINYINT DEFAULT 0,
            created_at  DATETIME DEFAULT NOW(),
            UNIQUE KEY uniq_dungeon_player (dungeon_id, player_id),
            INDEX (dungeon_id)
        )
    `).catch(e => console.error('[Reflection] table error:', e.message));
    _tableReady = true;
}

function scaleFor(rank) {
    return RANK_SCALE[rank] || 1.4;
}

/**
 * Spawn a reflection for every living player in the dungeon.
 * Returns the list of spawned reflections (for the announcement).
 */
async function spawnReflections(dungeonId, rank) {
    await ensureReflectionTable();
    const [players] = await db.execute(
        `SELECT dp.player_id, p.nickname, p.max_hp, p.strength, p.agility, p.intelligence, p.stamina
         FROM dungeon_players dp JOIN players p ON p.id = dp.player_id
         WHERE dp.dungeon_id=? AND dp.is_alive=1`,
        [dungeonId]
    );
    if (!players.length) return [];

    // Anyone still locked in an unfinished mirror is skipped — a second shard
    // must never heal a straggler's mirror back to full and restart their clock.
    const [busy] = await db.execute(
        'SELECT player_id FROM dungeon_reflections WHERE dungeon_id=? AND defeated=0',
        [dungeonId]
    ).catch(() => [[]]);
    const stillFighting = new Set(busy.map(b => String(b.player_id)));

    const scale = scaleFor(rank);
    const spawned = [];
    for (const p of players) {
        if (stillFighting.has(String(p.player_id))) continue;
        // 15k floor + the original's CURRENT stats, then rank-scaled: a weak
        // hunter meets a 15k wall, a monster meets a monster.
        const statPower = (Number(p.strength) || 0) + (Number(p.agility) || 0)
                        + (Number(p.intelligence) || 0) + (Number(p.stamina) || 0);
        const hp  = Math.floor((REFLECTION_BASE_HP + statPower * HP_PER_STAT) * scale);
        const atk = Math.max(10, Math.floor(Math.max(
            Number(p.strength) || 0, Number(p.agility) || 0, Number(p.intelligence) || 0
        ) * scale * 0.45));
        await db.execute(
            `INSERT INTO dungeon_reflections (dungeon_id, player_id, nickname, max_hp, current_hp, shield, atk, defeated)
             VALUES (?, ?, ?, ?, ?, 0, ?, 0)
             ON DUPLICATE KEY UPDATE max_hp=?, current_hp=?, shield=0, atk=?, defeated=0`,
            [dungeonId, p.player_id, p.nickname, hp, hp, atk, hp, hp, atk]
        ).catch(() => {});
        spawned.push({ player_id: p.player_id, nickname: p.nickname, hp, atk });
    }
    return spawned;
}

// The player's living reflection, or null.
async function getReflection(playerId, dungeonId) {
    await ensureReflectionTable();
    const [rows] = await db.execute(
        'SELECT * FROM dungeon_reflections WHERE dungeon_id=? AND player_id=? AND defeated=0 LIMIT 1',
        [dungeonId, playerId]
    ).catch(() => [[]]);
    return rows[0] || null;
}

async function hasLivingReflection(playerId, dungeonId) {
    return !!(await getReflection(playerId, dungeonId));
}

/**
 * Find a living reflection in this dungeon by its owner's name, so teammates
 * can call the target: !skill <move> <name>. Matches exact nickname first,
 * then a partial (case-insensitive) match.
 */
async function getReflectionByName(dungeonId, nameArg) {
    await ensureReflectionTable();
    const q = String(nameArg || '').replace(/^@/, '').trim().toLowerCase();
    if (!q) return null;
    const [rows] = await db.execute(
        'SELECT * FROM dungeon_reflections WHERE dungeon_id=? AND defeated=0',
        [dungeonId]
    ).catch(() => [[]]);
    const exact = rows.find(r => String(r.nickname || '').toLowerCase() === q);
    if (exact) return exact;
    return rows.find(r => String(r.nickname || '').toLowerCase().includes(q)) || null;
}

// True if a Sunshard invasion happened on this dungeon at all (living OR
// already-broken mirrors). Used to relax the normal "clear the stage first"
// rule so whoever breaks their mirror can push on.
async function invasionActive(dungeonId) {
    await ensureReflectionTable();
    const [rows] = await db.execute(
        'SELECT COUNT(*) as cnt FROM dungeon_reflections WHERE dungeon_id=?',
        [dungeonId]
    ).catch(() => [[{ cnt: 0 }]]);
    return (rows[0]?.cnt || 0) > 0;
}

// How many reflections are still standing in this dungeon.
async function livingReflectionCount(dungeonId) {
    await ensureReflectionTable();
    const [rows] = await db.execute(
        'SELECT COUNT(*) as cnt FROM dungeon_reflections WHERE dungeon_id=? AND defeated=0',
        [dungeonId]
    ).catch(() => [[{ cnt: 0 }]]);
    return rows[0]?.cnt || 0;
}

/**
 * Apply damage to a reflection (shield soaks first). Returns the outcome.
 */
async function damageReflection(playerId, dungeonId, damage) {
    const refl = await getReflection(playerId, dungeonId);
    return damageReflectionRow(refl, damage);
}

// Core: damage a specific reflection row (used when a teammate calls the target).
async function damageReflectionRow(refl, damage) {
    if (!refl) return null;

    let dmg = Math.max(0, Math.floor(damage));
    let absorbed = 0;
    if (refl.shield > 0) {
        absorbed = Math.min(refl.shield, dmg);
        dmg -= absorbed;
        await db.execute('UPDATE dungeon_reflections SET shield = GREATEST(0, shield - ?) WHERE id=?', [absorbed, refl.id]);
    }
    const newHp = Math.max(0, refl.current_hp - dmg);
    const defeated = newHp <= 0;
    await db.execute(
        'UPDATE dungeon_reflections SET current_hp=?, defeated=? WHERE id=?',
        [newHp, defeated ? 1 : 0, refl.id]
    );
    return { absorbed, dealt: dmg, hp: newHp, maxHp: refl.max_hp, defeated, nickname: refl.nickname };
}

/**
 * The reflection's turn — it uses the PLAYER'S OWN moveset, so it can heal
 * itself, shield up, or strike back. Returns { text, damage } for the reply.
 */
async function reflectionTurn(playerId, dungeonId, playerMoves) {
    const refl = await getReflection(playerId, dungeonId);
    return reflectionTurnRow(refl, playerMoves);
}

// Core: a specific reflection takes its turn. It strikes whoever engaged it,
// so helping a teammate means drawing their mirror's attention onto you.
async function reflectionTurnRow(refl, playerMoves) {
    if (!refl) return null;
    // Re-read so HP/shield reflect the hit that just landed.
    const [fresh] = await db.execute('SELECT * FROM dungeon_reflections WHERE id=? AND defeated=0', [refl.id]).catch(() => [[]]);
    refl = fresh[0] || refl;

    const hpPct = refl.current_hp / Math.max(1, refl.max_hp);
    const heals   = (playerMoves || []).filter(m => m.type === 'heal');
    const shields = (playerMoves || []).filter(m => m.type === 'shield');
    const attacks = (playerMoves || []).filter(m => m.type === 'damage');

    // Mirrors your instincts: heal when hurt, shield when pressured, else hit.
    if (hpPct < 0.35 && heals.length && Math.random() < 0.55) {
        const mv = heals[Math.floor(Math.random() * heals.length)];
        const amount = Math.floor(refl.max_hp * 0.18);
        const healed = Math.min(refl.max_hp, refl.current_hp + amount);
        await db.execute('UPDATE dungeon_reflections SET current_hp=? WHERE id=?', [healed, refl.id]);
        return { text: `🪞 Your reflection used *${mv.name}* — healed ${amount.toLocaleString()} HP!`, damage: 0 };
    }
    if (hpPct < 0.6 && shields.length && refl.shield <= 0 && Math.random() < 0.45) {
        const mv = shields[Math.floor(Math.random() * shields.length)];
        const amount = Math.floor(refl.max_hp * 0.12);
        await db.execute('UPDATE dungeon_reflections SET shield=? WHERE id=?', [amount, refl.id]);
        return { text: `🪞 Your reflection used *${mv.name}* — raised a ${amount.toLocaleString()} shield!`, damage: 0 };
    }

    const mv = attacks.length ? attacks[Math.floor(Math.random() * attacks.length)] : null;
    const mult = mv?.multiplier || 1.0;
    const dmg = Math.max(1, Math.floor(refl.atk * mult * (0.85 + Math.random() * 0.3)));
    return { text: `🪞 Your reflection used *${mv?.name || 'Mirror Strike'}* — ${dmg.toLocaleString()} damage!`, damage: dmg };
}

/**
 * The 5-minute clock. Any hunter whose mirror is still standing when it runs
 * out is killed by it. Broken mirrors are safe — the timer only takes those
 * who couldn't finish.
 */
async function resolveReflectionDeadline(dungeonId, client) {
    try {
        await ensureReflectionTable();
        const [alive] = await db.execute(
            'SELECT player_id, nickname FROM dungeon_reflections WHERE dungeon_id=? AND defeated=0',
            [dungeonId]
        ).catch(() => [[]]);
        if (!alive.length) return 0;

        for (const r of alive) {
            await db.execute('UPDATE players SET hp = 0 WHERE id=?', [r.player_id]).catch(() => {});
            await db.execute(
                'UPDATE dungeon_players SET is_alive=0 WHERE player_id=? AND dungeon_id=?',
                [r.player_id, dungeonId]
            ).catch(() => {});
        }
        // The mirrors won — clear them so the stage isn't left gated.
        await db.execute('UPDATE dungeon_reflections SET defeated=1 WHERE dungeon_id=? AND defeated=0', [dungeonId]).catch(() => {});

        if (client) {
            const { getDungeonGroup } = require('../engine/dungeon');
            await client.sendMessage(getDungeonGroup(dungeonId), {
                text:
                    '╔══〘 ☄️ THE LIGHT GOES OUT 〙══╗\n' +
                    '┃★\n' +
                    '┃★ Five minutes. That was all\n' +
                    '┃★ the shard was ever going to give.\n' +
                    '┃★\n' +
                    alive.map(r => `┃★ ☠️ *${r.nickname}* was taken by their reflection.`).join('\n') + '\n' +
                    '┃★\n' +
                    '┃★ Use !respawn.\n' +
                    '╚═══════════════════════════╝'
            }).catch(() => {});
        }
        console.log(`☠️ Reflection deadline: ${alive.length} hunter(s) killed in dungeon ${dungeonId}.`);
        // If the mirrors just took the last hunters standing, the dungeon is
        // empty — close it out rather than leaving it open forever.
        try {
            const { checkAndCloseEmptyDungeon } = require('../engine/dungeon');
            await checkAndCloseEmptyDungeon(dungeonId, client);
        } catch (e) {}
        return alive.length;
    } catch (e) { console.error('[Reflection] deadline error:', e.message); return 0; }
}

function scheduleReflectionDeadline(dungeonId, client) {
    clearReflectionDeadline(dungeonId);
    const t = setTimeout(() => {
        deadlineTimers.delete(dungeonId);
        resolveReflectionDeadline(dungeonId, client);
    }, REFLECTION_TIME_LIMIT_MS);
    deadlineTimers.set(dungeonId, t);
}

function clearReflectionDeadline(dungeonId) {
    const t = deadlineTimers.get(dungeonId);
    if (t) { clearTimeout(t); deadlineTimers.delete(dungeonId); }
}

// Clear all reflections for a dungeon (on close/clear).
async function clearReflections(dungeonId) {
    await ensureReflectionTable();
    clearReflectionDeadline(dungeonId);
    await db.execute('DELETE FROM dungeon_reflections WHERE dungeon_id=?', [dungeonId]).catch(() => {});
}

module.exports = {
    REFLECTION_TIME_LIMIT_MS,
    ensureReflectionTable, spawnReflections, getReflection, getReflectionByName,
    hasLivingReflection, livingReflectionCount, invasionActive,
    damageReflection, damageReflectionRow, reflectionTurn, reflectionTurnRow,
    scheduleReflectionDeadline, clearReflectionDeadline, resolveReflectionDeadline,
    clearReflections
};
