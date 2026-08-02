/**
 * VESPERION — THE FIRSTBORN DUSK  ·  Chapter 1 finale raid.
 *
 * Not a dungeon. A single 1,000,000 HP world-event the whole group fights at
 * once. The owner spawns it from AriA's DMs; every member of the raid group is
 * auto-enrolled and promoted, so nobody has to !enter — everyone is already in.
 *
 * Rhythm: every 5 hunter attacks, Vesperion answers by mauling ONE random
 * living hunter. Each hunter it touches escalates:
 *      1st strike — takes 50% of their current HP
 *      2nd strike — takes 85% of what's left
 *      3rd strike — kills them
 * Targets are random every time, so the danger is spread and nobody is safe.
 */
const db = require('../database/db');

// 15M, not 1M: at 1M a single prestige hunter swinging a heavy weapon move
// landed ~80% of the boss's health in one blow and the fight ended instantly.
const VESPERION_HP   = 15_000_000;
const STRIKES_PER_HIT = 5;      // hunter attacks between each retaliation
const ATTACK_COOLDOWN_MS = 10_000;

// Ordinary move damage is balanced against dungeon enemies with hundreds of HP
// — unscaled, a 1,000,000 HP boss would need thousands of blows. Every hit
// landed on Vesperion is amplified so the fight lands around 160 blows.
// Single knob: raise it to shorten the fight, lower it to lengthen.
// Simulated at 18: a 20-30 hunter group wins losing 3-5, a weak group (half
// stats) is dragged to ~420 blows and loses ~25 — a genuine near-wipe.
const RAID_DAMAGE_MULT = 18;

// No single blow may remove more than this share of Vesperion's health. Player
// power varies enormously — a prestige hunter swinging an 11x weapon ultimate
// hits orders of magnitude harder than a fresh one — so without a ceiling the
// fight length is decided entirely by whoever is best geared. This guarantees
// at least 1/PER_HIT_CAP_PCT blows (50) no matter who shows up, while weaker
// hunters still land their full uncapped damage.
const PER_HIT_CAP_PCT = 0.02;

const lastAttack = new Map();   // playerId -> ts

let _ready = false;
async function ensureTables() {
    if (_ready) return;
    await db.execute(`
        CREATE TABLE IF NOT EXISTS vesperion_raid (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            max_hp        BIGINT NOT NULL,
            current_hp    BIGINT NOT NULL,
            total_attacks INT DEFAULT 0,
            is_active     TINYINT DEFAULT 1,
            group_jid     VARCHAR(60),
            started_at    DATETIME DEFAULT NOW(),
            ended_at      DATETIME DEFAULT NULL
        )
    `).catch(e => console.error('[Vesperion] table error:', e.message));
    await db.execute(`
        CREATE TABLE IF NOT EXISTS vesperion_participants (
            raid_id      INT NOT NULL,
            player_id    VARCHAR(60) NOT NULL,
            nickname     VARCHAR(60),
            damage_dealt BIGINT DEFAULT 0,
            attacks      INT DEFAULT 0,
            strikes      INT DEFAULT 0,
            is_dead      TINYINT DEFAULT 0,
            PRIMARY KEY (raid_id, player_id)
        )
    `).catch(() => {});
    _ready = true;
}

// Blue bar, same language as the fatigue meter but longer for a world boss.
function hpBar(current, max, len = 12) {
    const pct = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(pct * len);
    return '🟦'.repeat(filled) + '▫️'.repeat(len - filled);
}

async function getActiveRaid() {
    await ensureTables();
    const [rows] = await db.execute('SELECT * FROM vesperion_raid WHERE is_active=1 ORDER BY id DESC LIMIT 1').catch(() => [[]]);
    return rows[0] || null;
}

/**
 * Spawn the raid and conscript the whole group — every registered member is
 * enrolled and promoted, so the fight starts with everyone already in it.
 */
async function spawnVesperion(client, groupJid) {
    await ensureTables();
    if (await getActiveRaid()) return { ok: false, reason: 'already_active' };

    const [res] = await db.execute(
        'INSERT INTO vesperion_raid (max_hp, current_hp, total_attacks, is_active, group_jid) VALUES (?, ?, 0, 1, ?)',
        [VESPERION_HP, VESPERION_HP, groupJid]
    );
    const raidId = res.insertId;

    // Everyone in the group who has a character is conscripted automatically.
    const { normalizeId } = require('../utils/identity');
    let enrolled = [];
    try {
        const meta = await client.groupMetadata(groupJid);
        const ids = (meta.participants || []).map(p => normalizeId(p.id)).filter(Boolean);
        if (ids.length) {
            const [players] = await db.execute(
                `SELECT id, nickname FROM players WHERE id IN (${ids.map(() => '?').join(',')})`, ids
            ).catch(() => [[]]);
            for (const p of players) {
                await db.execute(
                    'INSERT IGNORE INTO vesperion_participants (raid_id, player_id, nickname) VALUES (?, ?, ?)',
                    [raidId, p.id, p.nickname]
                ).catch(() => {});
                enrolled.push(p);
            }
            // Promote them exactly as entering a dungeon would.
            try {
                const toPromote = (meta.participants || [])
                    .filter(p => players.some(pl => pl.id === normalizeId(p.id)) && !p.admin)
                    .map(p => p.id);
                if (toPromote.length) {
                    await client.groupParticipantsUpdate(groupJid, toPromote, 'promote').catch(() => {});
                }
            } catch (e) { console.error('[Vesperion] promote error:', e.message); }
        }
    } catch (e) { console.error('[Vesperion] enrol error:', e.message); }

    return { ok: true, raidId, enrolled, hp: VESPERION_HP };
}

async function getParticipant(raidId, playerId) {
    const [rows] = await db.execute(
        'SELECT * FROM vesperion_participants WHERE raid_id=? AND player_id=?', [raidId, playerId]
    ).catch(() => [[]]);
    return rows[0] || null;
}

// Late arrivals can still join the fight.
async function enrol(raidId, playerId, nickname) {
    await db.execute(
        'INSERT IGNORE INTO vesperion_participants (raid_id, player_id, nickname) VALUES (?, ?, ?)',
        [raidId, playerId, nickname]
    ).catch(() => {});
    return getParticipant(raidId, playerId);
}

/**
 * A hunter's attack. Returns everything the command needs to narrate the round,
 * including Vesperion's retaliation when this was the 5th blow.
 */
async function attack(playerId, client) {
    const raid = await getActiveRaid();
    if (!raid) return { error: 'no_raid' };

    const cd = lastAttack.get(playerId) || 0;
    const wait = ATTACK_COOLDOWN_MS - (Date.now() - cd);
    if (wait > 0) return { error: 'cooldown', wait: Math.ceil(wait / 1000) };

    const [pRows] = await db.execute(
        'SELECT nickname, hp, max_hp, strength, agility, intelligence FROM players WHERE id=?', [playerId]
    ).catch(() => [[]]);
    const player = pRows[0];
    if (!player) return { error: 'not_registered' };
    if (Number(player.hp) <= 0) return { error: 'dead' };

    let me = await getParticipant(raid.id, playerId);
    if (!me) me = await enrol(raid.id, playerId, player.nickname);
    if (me?.is_dead) return { error: 'dead' };

    lastAttack.set(playerId, Date.now());

    // Basic swing — raw damage off the hunter's best offensive stat. applyAttack
    // applies the raid multiplier, same as it does for skill hits.
    const best = Math.max(Number(player.strength) || 0, Number(player.agility) || 0, Number(player.intelligence) || 0);
    const raw = Math.max(50, Math.floor(best * 1.5 * (0.85 + Math.random() * 0.3)));
    return applyAttack(playerId, raw, { raid, player });
}

/**
 * Land a pre-computed amount of damage — this is what !skill drives, so raid
 * hits run through the same move multipliers, weapons and stats as a dungeon.
 */
async function applyAttack(playerId, damage, ctx = {}) {
    const raid = ctx.raid || await getActiveRaid();
    if (!raid) return { error: 'no_raid' };

    let player = ctx.player;
    if (!player) {
        const [pRows] = await db.execute(
            'SELECT nickname, hp, max_hp FROM players WHERE id=?', [playerId]
        ).catch(() => [[]]);
        player = pRows[0];
        if (!player) return { error: 'not_registered' };
    }

    let me = await getParticipant(raid.id, playerId);
    if (!me) me = await enrol(raid.id, playerId, player.nickname);
    if (me?.is_dead) return { error: 'dead' };

    // One place scales every source of raid damage — skill hits and basic
    // swings alike — so the two can't be balanced against each other by accident.
    const cap = Math.floor(Number(raid.max_hp) * PER_HIT_CAP_PCT);
    const scaled = Math.max(1, Math.floor(damage * RAID_DAMAGE_MULT));
    const capped = scaled > cap;
    damage = Math.min(scaled, cap);
    const newHp = Math.max(0, Number(raid.current_hp) - damage);
    const totalAttacks = Number(raid.total_attacks) + 1;
    await db.execute('UPDATE vesperion_raid SET current_hp=?, total_attacks=? WHERE id=?', [newHp, totalAttacks, raid.id]);
    await db.execute(
        'UPDATE vesperion_participants SET damage_dealt = damage_dealt + ?, attacks = attacks + 1 WHERE raid_id=? AND player_id=?',
        [damage, raid.id, playerId]
    ).catch(() => {});

    const result = {
        damage, capped, nickname: player.nickname,
        bossHp: newHp, bossMax: Number(raid.max_hp),
        bar: hpBar(newHp, Number(raid.max_hp)),
        totalAttacks, defeated: newHp <= 0, retaliation: null, raidId: raid.id
    };

    if (newHp <= 0) {
        await db.execute("UPDATE vesperion_raid SET is_active=0, ended_at=NOW() WHERE id=?", [raid.id]);
        return result;
    }

    // Every 5th blow, it answers — on someone chosen at random.
    if (totalAttacks % STRIKES_PER_HIT === 0) {
        result.retaliation = await retaliate(raid.id);
    }
    return result;
}

/** Vesperion mauls one random living hunter. 50% → 85% → death. */
async function retaliate(raidId) {
    const [alive] = await db.execute(
        `SELECT vp.player_id, vp.nickname, vp.strikes, p.hp, p.max_hp
         FROM vesperion_participants vp JOIN players p ON p.id = vp.player_id
         WHERE vp.raid_id=? AND vp.is_dead=0 AND p.hp > 0`, [raidId]
    ).catch(() => [[]]);
    if (!alive.length) return null;

    const t = alive[Math.floor(Math.random() * alive.length)];
    const strike = Number(t.strikes) + 1;
    const curHp = Number(t.hp);

    let newHp, killed = false, note;
    if (strike === 1) {
        newHp = Math.max(1, Math.floor(curHp * 0.50));
        note = 'It opens them up. Half their blood is on the floor.';
    } else if (strike === 2) {
        newHp = Math.max(1, Math.floor(curHp * 0.15));
        note = 'The second blow nearly finishes the job. They can barely stand.';
    } else {
        newHp = 0; killed = true;
        note = 'The third blow lands. There is no getting up from that one.';
    }

    await db.execute('UPDATE players SET hp=? WHERE id=?', [newHp, t.player_id]);
    await db.execute(
        'UPDATE vesperion_participants SET strikes=?, is_dead=? WHERE raid_id=? AND player_id=?',
        [strike, killed ? 1 : 0, raidId, t.player_id]
    ).catch(() => {});

    // If that was the last hunter standing, the raid is over — otherwise the
    // fight would soft-lock: everyone dead, nobody able to strike, boss alive
    // forever.
    let wipe = false;
    if (killed) {
        const [left] = await db.execute(
            `SELECT COUNT(*) as cnt FROM vesperion_participants vp JOIN players p ON p.id = vp.player_id
             WHERE vp.raid_id=? AND vp.is_dead=0 AND p.hp > 0`, [raidId]
        ).catch(() => [[{ cnt: 1 }]]);
        if ((left[0]?.cnt || 0) === 0) {
            wipe = true;
            await db.execute("UPDATE vesperion_raid SET is_active=0, ended_at=NOW() WHERE id=?", [raidId]).catch(() => {});
        }
    }

    return { playerId: t.player_id, nickname: t.nickname, strike, hp: newHp, maxHp: Number(t.max_hp), killed, note, wipe };
}

/** Huge payout to everyone who threw a punch, weighted by contribution. */
async function distributeRewards(raidId, client, groupJid) {
    const [parts] = await db.execute(
        'SELECT * FROM vesperion_participants WHERE raid_id=? AND attacks > 0 ORDER BY damage_dealt DESC', [raidId]
    ).catch(() => [[]]);
    if (!parts.length) return { lines: [], count: 0 };

    const totalDmg = parts.reduce((s, p) => s + Number(p.damage_dealt), 0) || 1;
    const POOL_LUMENS = 3_000_000;
    const POOL_XP     = 1_500_000;
    const FLAT_LUMENS = 25_000;
    const FLAT_XP     = 12_000;

    const lines = [];
    for (const p of parts) {
        const share = Number(p.damage_dealt) / totalDmg;
        const lumens = FLAT_LUMENS + Math.floor(POOL_LUMENS * share);
        const xp     = FLAT_XP     + Math.floor(POOL_XP * share);
        await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [lumens, p.player_id]).catch(() => {});
        await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [xp, p.player_id]).catch(() => {});
        // Revive the fallen — they earned it.
        await db.execute('UPDATE players SET hp = max_hp WHERE id=?', [p.player_id]).catch(() => {});
        lines.push(`┃★ ${p.nickname} — ${Number(p.damage_dealt).toLocaleString()} dmg · +${lumens.toLocaleString()}L`);
    }

    // The hunt is over — everyone conscripted for it loses the admin they were
    // given when it spawned. Enrolment is dropped, not just the promotion.
    await demoteAll(raidId, client, groupJid);

    return { lines, count: parts.length, top: parts[0] };
}

/** Strip admin from everyone this raid promoted. */
async function demoteAll(raidId, client, groupJid) {
    try {
        if (!client || !groupJid) return 0;
        const [parts] = await db.execute(
            'SELECT player_id FROM vesperion_participants WHERE raid_id=?', [raidId]
        ).catch(() => [[]]);
        if (!parts.length) return 0;

        const { normalizeId } = require('../utils/identity');
        const ids = new Set(parts.map(p => String(p.player_id)));
        const meta = await client.groupMetadata(groupJid);
        // Never demote the bot or the group owner — only the conscripts.
        const targets = (meta.participants || [])
            .filter(p => ids.has(normalizeId(p.id)) && p.admin !== 'superadmin')
            .map(p => p.id);

        if (targets.length) {
            await client.groupParticipantsUpdate(groupJid, targets, 'demote').catch(() => {});
            console.log(`👋 Vesperion raid ${raidId}: demoted ${targets.length} hunter(s).`);
        }
        return targets.length;
    } catch (e) { console.error('[Vesperion] demote error:', e.message); return 0; }
}

module.exports = {
    VESPERION_HP, STRIKES_PER_HIT, RAID_DAMAGE_MULT,
    ensureTables, getActiveRaid, spawnVesperion, attack, applyAttack, retaliate,
    distributeRewards, demoteAll, hpBar, getParticipant, enrol
};
