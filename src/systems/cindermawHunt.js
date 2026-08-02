/**
 * CINDERMAW — THE SWALLOWED STAR  ·  Chapter 2 finale.
 *
 * A server-wide event fought ALONE. Chapter 1 ended on "it had eaten a piece
 * of the sun — and it is not the only one," so there isn't one Cindermaw:
 * there are many, and every hunter meets their own in AriA's DMs. No party,
 * no rescue.
 *
 * Each beast is sized off the hunter who faces it, so a fresh recruit and a
 * prestige veteran get the same ~18-exchange fight rather than the same HP
 * bar. The hunt closes — and Chapter 3 begins — once the community has put
 * down KILLS_TO_ADVANCE of them.
 */
const db = require('../database/db');

// Instance HP scales with the hunter's own power. Damage is roughly
// stat x moveMultiplier, so pinning HP to stat x this constant keeps the fight
// about the same LENGTH for everyone instead of trivial for whales and
// impossible for newcomers.
// Simulated across fresh / prestige / ascendant builds: these land the fight
// at ~11 exchanges for everyone, ending around 23% HP. Winnable, but close
// enough that a bad move choice or an unlucky roll kills you.
const HP_PER_STAT       = 80;
const HP_FLOOR          = 8_000;
const KILLS_TO_ADVANCE  = 10;

// Its counterattack, as a share of the hunter's max HP. At ~7% average a
// hunter survives ~14 exchanges — just past the ~11 it takes to kill the
// beast, so the margin is thin on purpose.
const BITE_MIN_PCT = 0.05;
const BITE_MAX_PCT = 0.09;

let _ready = false;
async function ensureTables() {
    if (_ready) return;
    await db.execute(`
        CREATE TABLE IF NOT EXISTS cindermaw_hunt (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            is_active  TINYINT DEFAULT 1,
            kills      INT DEFAULT 0,
            group_jid  VARCHAR(60),
            started_at DATETIME DEFAULT NOW(),
            ended_at   DATETIME DEFAULT NULL
        )
    `).catch(e => console.error('[Cindermaw] table error:', e.message));
    await db.execute(`
        CREATE TABLE IF NOT EXISTS cindermaw_instances (
            hunt_id      INT NOT NULL,
            player_id    VARCHAR(60) NOT NULL,
            nickname     VARCHAR(60),
            max_hp       BIGINT NOT NULL,
            current_hp   BIGINT NOT NULL,
            exchanges    INT DEFAULT 0,
            defeated     TINYINT DEFAULT 0,
            player_died  TINYINT DEFAULT 0,
            started_at   DATETIME DEFAULT NOW(),
            PRIMARY KEY (hunt_id, player_id)
        )
    `).catch(() => {});
    _ready = true;
}

function emberBar(current, max, len = 12) {
    const pct = Math.max(0, Math.min(1, current / max));
    const filled = Math.round(pct * len);
    return '🟧'.repeat(filled) + '▫️'.repeat(len - filled);
}

async function getHunt() {
    await ensureTables();
    const [rows] = await db.execute('SELECT * FROM cindermaw_hunt WHERE is_active=1 ORDER BY id DESC LIMIT 1').catch(() => [[]]);
    return rows[0] || null;
}

async function openHunt(groupJid) {
    await ensureTables();
    if (await getHunt()) return { ok: false, reason: 'already_open' };
    const [res] = await db.execute(
        'INSERT INTO cindermaw_hunt (is_active, kills, group_jid) VALUES (1, 0, ?)', [groupJid]
    );
    return { ok: true, huntId: res.insertId };
}

async function getInstance(huntId, playerId) {
    const [rows] = await db.execute(
        'SELECT * FROM cindermaw_instances WHERE hunt_id=? AND player_id=?', [huntId, playerId]
    ).catch(() => [[]]);
    return rows[0] || null;
}

/** Summon this hunter's own beast. Sized to them, so the fight is fair. */
async function summon(huntId, playerId) {
    const [pRows] = await db.execute(
        'SELECT nickname, strength, agility, intelligence FROM players WHERE id=?', [playerId]
    ).catch(() => [[]]);
    const p = pRows[0];
    if (!p) return { error: 'not_registered' };

    const existing = await getInstance(huntId, playerId);
    if (existing && !existing.defeated) return { ok: true, instance: existing, already: true };
    if (existing && existing.defeated)  return { error: 'already_slain' };

    const best = Math.max(Number(p.strength) || 0, Number(p.agility) || 0, Number(p.intelligence) || 0);
    const hp = Math.max(HP_FLOOR, Math.floor(best * HP_PER_STAT));

    await db.execute(
        `INSERT INTO cindermaw_instances (hunt_id, player_id, nickname, max_hp, current_hp)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE max_hp=?, current_hp=?, exchanges=0, defeated=0, player_died=0`,
        [huntId, playerId, p.nickname, hp, hp, hp, hp]
    ).catch(() => {});
    return { ok: true, instance: await getInstance(huntId, playerId), nickname: p.nickname };
}

/** One exchange: the hunter's blow, then the beast bites back. */
async function exchange(playerId, damage) {
    const hunt = await getHunt();
    if (!hunt) return { error: 'no_hunt' };

    const inst = await getInstance(hunt.id, playerId);
    if (!inst) return { error: 'no_instance' };
    if (inst.defeated) return { error: 'already_slain' };

    const [pRows] = await db.execute('SELECT nickname, hp, max_hp FROM players WHERE id=?', [playerId]).catch(() => [[]]);
    const player = pRows[0];
    if (!player) return { error: 'not_registered' };
    if (Number(player.hp) <= 0) return { error: 'you_are_down' };

    damage = Math.max(1, Math.floor(damage));
    const bossHp = Math.max(0, Number(inst.current_hp) - damage);
    const exchanges = Number(inst.exchanges) + 1;

    const out = {
        damage, nickname: player.nickname,
        bossHp, bossMax: Number(inst.max_hp),
        bar: emberBar(bossHp, Number(inst.max_hp)),
        exchanges, slain: bossHp <= 0, bite: null, huntId: hunt.id
    };

    if (bossHp <= 0) {
        await db.execute(
            'UPDATE cindermaw_instances SET current_hp=0, defeated=1, exchanges=? WHERE hunt_id=? AND player_id=?',
            [exchanges, hunt.id, playerId]
        );
        const [k] = await db.execute('UPDATE cindermaw_hunt SET kills = kills + 1 WHERE id=?', [hunt.id]).catch(() => [{}]);
        const [row] = await db.execute('SELECT kills FROM cindermaw_hunt WHERE id=?', [hunt.id]).catch(() => [[]]);
        out.totalKills = Number(row[0]?.kills || 0);
        return out;
    }

    await db.execute(
        'UPDATE cindermaw_instances SET current_hp=?, exchanges=? WHERE hunt_id=? AND player_id=?',
        [bossHp, exchanges, hunt.id, playerId]
    );

    // It bites back every exchange — this is a solo fight, nobody is tanking.
    const pct = BITE_MIN_PCT + Math.random() * (BITE_MAX_PCT - BITE_MIN_PCT);
    const bite = Math.max(1, Math.floor(Number(player.max_hp) * pct));
    const newPlayerHp = Math.max(0, Number(player.hp) - bite);
    await db.execute('UPDATE players SET hp=? WHERE id=?', [newPlayerHp, playerId]);

    out.bite = { damage: bite, hp: newPlayerHp, maxHp: Number(player.max_hp), killed: newPlayerHp <= 0 };
    if (newPlayerHp <= 0) {
        await db.execute(
            'UPDATE cindermaw_instances SET player_died=1 WHERE hunt_id=? AND player_id=?', [hunt.id, playerId]
        ).catch(() => {});
    }
    return out;
}

/** Personal reward for putting one down. */
async function rewardKill(playerId, exchanges) {
    const LUMENS = 400_000;
    const XP     = 200_000;
    await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [LUMENS, playerId]).catch(() => {});
    await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [XP, playerId]).catch(() => {});
    await db.execute('UPDATE players SET hp = max_hp WHERE id=?', [playerId]).catch(() => {});
    return { lumens: LUMENS, xp: XP };
}

async function closeHunt(huntId) {
    await db.execute("UPDATE cindermaw_hunt SET is_active=0, ended_at=NOW() WHERE id=?", [huntId]).catch(() => {});
}

async function huntStatus() {
    const hunt = await getHunt();
    if (!hunt) return null;
    const [rows] = await db.execute(
        `SELECT COUNT(*) as summoned,
                SUM(defeated=1) as slain,
                SUM(defeated=0 AND player_died=1) as lost
         FROM cindermaw_instances WHERE hunt_id=?`, [hunt.id]
    ).catch(() => [[{}]]);
    return {
        hunt,
        kills: Number(hunt.kills || 0),
        needed: KILLS_TO_ADVANCE,
        summoned: Number(rows[0]?.summoned || 0),
        lost: Number(rows[0]?.lost || 0)
    };
}

module.exports = {
    KILLS_TO_ADVANCE, HP_PER_STAT,
    ensureTables, getHunt, openHunt, summon, getInstance, exchange,
    rewardKill, closeHunt, huntStatus, emberBar
};
