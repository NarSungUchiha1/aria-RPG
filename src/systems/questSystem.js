const db = require('../database/db');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

// ── Table Setup ───────────────────────────────────────────────────────────────
async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS quests (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            quest_type       ENUM('daily','achievement','party') NOT NULL,
            role             VARCHAR(20) NULL,
            title            VARCHAR(100) NOT NULL,
            description      TEXT,
            objective_type   VARCHAR(50) NOT NULL,
            objective_target VARCHAR(50) NULL,
            objective_count  INT NOT NULL DEFAULT 1,
            reward_xp        INT DEFAULT 0,
            reward_gold      INT DEFAULT 0,
            reward_sp        INT DEFAULT 0,
            reward_title     VARCHAR(50) NULL,
            is_active        TINYINT DEFAULT 1
        )
    `).catch(() => {});

    // Add role column if missing (for existing tables)
    await db.execute(`ALTER TABLE quests ADD COLUMN IF NOT EXISTS role VARCHAR(20) NULL`).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS player_quests (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            player_id     VARCHAR(50) NOT NULL,
            quest_id      INT NOT NULL,
            progress      INT DEFAULT 0,
            completed     TINYINT DEFAULT 0,
            claimed       TINYINT DEFAULT 0,
            assigned_date DATE NOT NULL,
            UNIQUE KEY unique_player_quest_date (player_id, quest_id, assigned_date)
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS player_achievements (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            player_id    VARCHAR(50) NOT NULL,
            quest_id     INT NOT NULL,
            progress     INT DEFAULT 0,
            completed    TINYINT DEFAULT 0,
            claimed      TINYINT DEFAULT 0,
            earned_at    DATETIME NULL,
            UNIQUE KEY unique_player_achievement (player_id, quest_id)
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS party_quest_progress (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            quest_id     INT NOT NULL,
            week_start   DATE NOT NULL,
            progress     INT DEFAULT 0,
            completed    TINYINT DEFAULT 0,
            claimed      TINYINT DEFAULT 0,
            UNIQUE KEY unique_party_quest_week (quest_id, week_start)
        )
    `).catch(() => {});

    await seedQuests();
}

// ── Seed Quest Pool ───────────────────────────────────────────────────────────
async function seedQuests() {
    const [existing] = await db.execute("SELECT COUNT(*) as cnt FROM quests");
    if (existing[0].cnt > 0) return;

    // Columns: quest_type, role, title, description, objective_type, objective_target, objective_count, reward_xp, reward_gold, reward_sp, reward_title
    const quests = [

        // ══ DAILY — UNIVERSAL (role = null, 1 assigned per day) ══════════════
        ['daily', null, 'Into the Depths',   'Enter a dungeon',                           'dungeon_enter',  null,  1,  100,  100, 0, null],
        ['daily', null, 'First Step',        'Clear 1 dungeon stage',                     'stage_clear',    null,  1,  120,  100, 0, null],
        ['daily', null, 'The Challenger',    'Win 1 PvP duel',                            'pvp_win',        null,  1,  200,  250, 0, null],
        ['daily', null, 'Loot Run',          'Complete 1 full dungeon run',               'dungeon_clear',  null,  1,  300,  300, 0, null],
        ['daily', null, 'Potion Duty',       'Use 3 consumable items',                    'item_use',       null,  3,  100,   80, 0, null],

        // ══ DAILY — TANK ═════════════════════════════════════════════════════
        ['daily', 'Tank', 'Iron Wall',       'Complete a dungeon without dying',          'dungeon_survive', null, 1,  300,  200, 0, null],
        ['daily', 'Tank', 'Guardian Duty',   'Clear 3 dungeon stages',                   'stage_clear',     null, 3,  200,  150, 0, null],
        ['daily', 'Tank', 'Damage Sponge',   'Deal 400 damage in dungeons',              'damage_dealt',    null, 400, 150, 200, 0, null],
        ['daily', 'Tank', 'Shield Up',       'Use 10 skills in combat',                  'skill_use',       null, 10, 150,  100, 0, null],
        ['daily', 'Tank', 'Boss Blocker',    'Defeat 2 dungeon bosses',                  'boss_kill',       null, 2,  500,  400, 0, null],

        // ══ DAILY — ASSASSIN ═════════════════════════════════════════════════
        ['daily', 'Assassin', 'Shadow Work', 'Defeat 15 enemies in dungeons',            'enemy_kill',      null, 15, 250,  200, 0, null],
        ['daily', 'Assassin', 'Blade Dance', 'Use 12 skills in combat',                  'skill_use',       null, 12, 150,  120, 0, null],
        ['daily', 'Assassin', 'Lethal Edge', 'Deal 800 damage in dungeons',              'damage_dealt',    null, 800, 200, 250, 0, null],
        ['daily', 'Assassin', 'Phantom Run', 'Complete a dungeon without dying',         'dungeon_survive', null, 1,  300,  200, 0, null],
        ['daily', 'Assassin', 'Duel Master', 'Win 1 PvP duel',                           'pvp_win',         null, 1,  250,  300, 0, null],

        // ══ DAILY — MAGE ══════════════════════════════════════════════════════
        ['daily', 'Mage', 'Arcane Fury',    'Deal 1000 damage using magic',              'damage_dealt',    null, 1000, 250, 200, 0, null],
        ['daily', 'Mage', 'Mana Surge',     'Use 15 skills in combat',                  'skill_use',       null, 15,  200,  150, 0, null],
        ['daily', 'Mage', 'Spell Runner',   'Complete 1 full dungeon run',               'dungeon_clear',   null, 1,   300,  300, 0, null],
        ['daily', 'Mage', 'Monster Study',  'Defeat 10 enemies in dungeons',             'enemy_kill',      null, 10,  200,  150, 0, null],
        ['daily', 'Mage', 'Boss Melt',      'Defeat 2 dungeon bosses',                   'boss_kill',       null, 2,   500,  400, 0, null],

        // ══ DAILY — HEALER ════════════════════════════════════════════════════
        ['daily', 'Healer', 'Life Bringer', 'Use 5 consumable items',                   'item_use',        null, 5,  150,  120, 0, null],
        ['daily', 'Healer', 'Holy Run',     'Complete 1 dungeon without dying',          'dungeon_survive', null, 1,  350,  250, 0, null],
        ['daily', 'Healer', 'Restoration',  'Use 12 skills in combat',                  'skill_use',       null, 12, 180,  140, 0, null],
        ['daily', 'Healer', 'Stage Keeper', 'Clear 3 dungeon stages',                   'stage_clear',     null, 3,  200,  150, 0, null],
        ['daily', 'Healer', 'Boss Support', 'Defeat 2 dungeon bosses',                  'boss_kill',       null, 2,  500,  400, 0, null],

        // ══ DAILY — BERSERKER ════════════════════════════════════════════════
        ['daily', 'Berserker', 'Bloodthirst', 'Defeat 20 enemies in dungeons',          'enemy_kill',      null, 20,  300,  250, 0, null],
        ['daily', 'Berserker', 'Rampage',     'Deal 1200 damage in dungeons',           'damage_dealt',    null, 1200, 300, 250, 0, null],
        ['daily', 'Berserker', 'Destroyer',   'Defeat 2 dungeon bosses',                'boss_kill',       null, 2,   500,  400, 0, null],
        ['daily', 'Berserker', 'Rage Mode',   'Use 10 skills in combat',                'skill_use',       null, 10,  150,  100, 0, null],
        ['daily', 'Berserker', 'No Retreat',  'Complete a dungeon without dying',        'dungeon_survive', null, 1,   300,  200, 0, null],

        // ══ ACHIEVEMENTS (universal) ══════════════════════════════════════════
        ['achievement', null, 'First Blood',      'Win your first PvP duel',             'pvp_win',        null,  1,   500,  500,  3, 'Duelist'],
        ['achievement', null, 'Veteran',          'Complete 10 full dungeon runs',        'dungeon_clear',  null,  10, 1000, 1000,  5, 'Veteran'],
        ['achievement', null, 'Rising Star',      'Reach Rank C',                         'rank_reached',   'C',   1,   800,  800,  5, 'Rising Star'],
        ['achievement', null, 'Elite',            'Reach Rank A',                         'rank_reached',   'A',   1,  2000, 2000, 10, 'Elite'],
        ['achievement', null, 'Legend',           'Reach Rank S',                         'rank_reached',   'S',   1,  5000, 5000, 20, 'Legend'],
        ['achievement', null, 'Void Hunter',      'Collect your first Void Shard',        'shard_collect',  null,  1,  1000, 1000,  8, 'Void Hunter'],
        ['achievement', null, 'Void Keeper',      'Collect all 5 Void Shards',            'shard_collect',  null,  5,  5000, 5000, 20, 'Void Keeper'],
        ['achievement', null, 'Obliterator',      'Deal 50,000 total damage',             'damage_dealt',   null, 50000, 2000, 2000, 10, 'Obliterator'],
        ['achievement', null, 'Champion',         'Win 10 PvP duels',                     'pvp_win',        null,  10, 1500, 1500,  8, 'Champion'],
        ['achievement', null, 'Boss Slayer',      'Defeat 20 dungeon bosses',             'boss_kill',      null,  20, 3000, 3000, 15, 'Boss Slayer'],
        ['achievement', null, 'S-Rank Conqueror', 'Clear an S-rank dungeon',              'srank_clear',    null,  1,  5000, 5000, 20, 'S-Rank Conqueror'],
        ['achievement', null, 'Centurion',        'Enter 100 dungeons',                   'dungeon_enter',  null, 100, 3000, 3000, 15, 'Centurion'],

        // ══ PARTY (weekly) ═══════════════════════════════════════════════════
        ['party', null, 'Party Grind',     'Clear 10 dungeons together this week',       'dungeon_clear',  null,  10, 1000, 1000,  5, null],
        ['party', null, 'Boss Rush',       'Defeat 5 bosses together this week',         'boss_kill',      null,   5, 1500, 1500,  8, null],
        ['party', null, 'Void Seekers',    'Collect 3 Void Shards together this week',   'shard_collect',  null,   3, 2000, 2000, 10, null],
    ];

    for (const q of quests) {
        await db.execute(
            `INSERT INTO quests (quest_type, role, title, description, objective_type, objective_target,
             objective_count, reward_xp, reward_gold, reward_sp, reward_title) VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
            q
        );
    }
    console.log('📜 Quest pool seeded.');
}

// ── Assign Daily Quests ───────────────────────────────────────────────────────
async function assignDailyQuests(playerId) {
    const today = new Date().toISOString().split('T')[0];
    const [existing] = await db.execute(
        "SELECT COUNT(*) as cnt FROM player_quests WHERE player_id=? AND assigned_date=?",
        [playerId, today]
    );
    if (existing[0].cnt >= 3) return;

    // Get player's role
    const [playerRow] = await db.execute("SELECT role FROM players WHERE id=?", [playerId]);
    const role = playerRow[0]?.role || null;

    // 2 role-specific quests
    const [roleQuests] = await db.execute(
        "SELECT * FROM quests WHERE quest_type='daily' AND role=? AND is_active=1 ORDER BY RAND() LIMIT 2",
        [role]
    );

    // 1 universal quest
    const [universalQuests] = await db.execute(
        "SELECT * FROM quests WHERE quest_type='daily' AND role IS NULL AND is_active=1 ORDER BY RAND() LIMIT 1"
    );

    const toAssign = [...roleQuests, ...universalQuests];
    for (const q of toAssign) {
        await db.execute(
            `INSERT IGNORE INTO player_quests (player_id, quest_id, progress, completed, claimed, assigned_date)
             VALUES (?, ?, 0, 0, 0, ?)`,
            [playerId, q.id, today]
        );
    }
}

// ── Ensure achievement rows exist for all players ─────────────────────────────
async function ensureAchievements(playerId) {
    const [allAch] = await db.execute(
        "SELECT id FROM quests WHERE quest_type='achievement' AND is_active=1"
    );
    for (const a of allAch) {
        await db.execute(
            `INSERT IGNORE INTO player_achievements (player_id, quest_id, progress, completed, claimed)
             VALUES (?, ?, 0, 0, 0)`,
            [playerId, a.id]
        );
    }
}

// ── Ensure party quest rows for current week ──────────────────────────────────
async function ensurePartyQuests() {
    const weekStart = getWeekStart();
    const [partyQuests] = await db.execute(
        "SELECT id FROM quests WHERE quest_type='party' AND is_active=1"
    );
    for (const q of partyQuests) {
        await db.execute(
            `INSERT IGNORE INTO party_quest_progress (quest_id, week_start, progress, completed, claimed)
             VALUES (?, ?, 0, 0, 0)`,
            [q.id, weekStart]
        );
    }
}

function getWeekStart() {
    const now  = new Date();
    const day  = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const mon  = new Date(now.setDate(diff));
    return mon.toISOString().split('T')[0];
}

// ── Update Quest Progress ─────────────────────────────────────────────────────
async function updateQuestProgress(playerId, objectiveType, amount = 1, client = null) {
    // ✅ Auto-assign today's quests if not yet assigned — player doesn't need to open !quests first
    await assignDailyQuests(playerId);
    await ensureAchievements(playerId);
    await ensurePartyQuests();

    // ── Daily quests ─────────────────────────────────────────────
    const today = new Date().toISOString().split('T')[0];
    await db.execute(
        `UPDATE player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         SET pq.progress = LEAST(pq.progress + ?, q.objective_count)
         WHERE pq.player_id = ?
           AND q.objective_type = ?
           AND pq.completed = 0
           AND pq.assigned_date = ?`,
        [amount, playerId, objectiveType, today]
    );
    // Auto-complete daily
    await db.execute(
        `UPDATE player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         SET pq.completed = 1
         WHERE pq.player_id = ?
           AND pq.progress >= q.objective_count
           AND pq.completed = 0
           AND pq.assigned_date = ?`,
        [playerId, today]
    );

    // ── Achievement quests ───────────────────────────────────────
    // For rank_reached achievements, check the player's current rank matches the target
    const [rankRow] = await db.execute("SELECT `rank` FROM players WHERE id=?", [playerId]).catch(() => [[]]);
    const currentRank = rankRow[0]?.rank || null;

    await db.execute(
        `UPDATE player_achievements pa
         JOIN quests q ON pa.quest_id = q.id
         SET pa.progress = LEAST(pa.progress + ?, q.objective_count)
         WHERE pa.player_id = ?
           AND q.objective_type = ?
           AND (
               q.objective_target IS NULL
               OR (q.objective_type = 'rank_reached' AND q.objective_target = ?)
               OR q.objective_target IS NULL
           )
           AND pa.completed = 0`,
        [amount, playerId, objectiveType, currentRank]
    );
    // Auto-complete and notify achievements
    const [newlyCompleted] = await db.execute(
        `UPDATE player_achievements pa
         JOIN quests q ON pa.quest_id = q.id
         SET pa.completed = 1, pa.earned_at = NOW()
         WHERE pa.player_id = ?
           AND pa.progress >= q.objective_count
           AND pa.completed = 0`,
        [playerId]
    );
    if (newlyCompleted.affectedRows > 0 && client) {
        await notifyAchievements(playerId, client);
    }

    // ── Party quests ─────────────────────────────────────────────
    const weekStart = getWeekStart();
    await db.execute(
        `UPDATE party_quest_progress pqp
         JOIN quests q ON pqp.quest_id = q.id
         SET pqp.progress = LEAST(pqp.progress + ?, q.objective_count)
         WHERE q.objective_type = ?
           AND pqp.week_start = ?
           AND pqp.completed = 0`,
        [amount, objectiveType, weekStart]
    );
    await db.execute(
        `UPDATE party_quest_progress pqp
         JOIN quests q ON pqp.quest_id = q.id
         SET pqp.completed = 1
         WHERE pqp.progress >= q.objective_count
           AND pqp.week_start = ?
           AND pqp.completed = 0`,
        [weekStart]
    );
}

// ── Achievement GC Notification ───────────────────────────────────────────────
async function notifyAchievements(playerId, client) {
    const [earned] = await db.execute(
        `SELECT q.title, q.reward_title, q.reward_sp, q.reward_gold, q.reward_xp
         FROM player_achievements pa
         JOIN quests q ON pa.quest_id = q.id
         WHERE pa.player_id = ? AND pa.completed = 1 AND pa.claimed = 0`,
        [playerId]
    );
    if (!earned.length) return;

    const [player] = await db.execute("SELECT nickname FROM players WHERE id=?", [playerId]);
    const nickname = player[0]?.nickname || playerId;

    for (const ach of earned) {
        let text =
            `╭══〘 🏆 ACHIEVEMENT UNLOCKED 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ ⚡ ${nickname}\n` +
            `┃◆ unlocked: ${ach.title}\n` +
            `┃◆ \n`;
        if (ach.reward_title) text += `┃◆ 🎖️ Title: "${ach.reward_title}"\n`;
        text +=
            `┃◆ ⭐ +${ach.reward_xp} XP\n` +
            `┃◆ 💰 +${ach.reward_gold} Gold\n` +
            (ach.reward_sp ? `┃◆ ✨ +${ach.reward_sp} SP\n` : '') +
            `┃◆ \n` +
            `┃◆ Use !claim to collect.\n` +
            `┃◆ \n` +
            `╰═══════════════════════════╯`;

        try {
            await client.sendMessage(RAID_GROUP, { text });
        } catch (e) {}
    }
}

// ── Claim Rewards ─────────────────────────────────────────────────────────────
async function claimQuestRewards(playerId, questId, client) {
    // Try daily first
    const today = new Date().toISOString().split('T')[0];
    const [daily] = await db.execute(
        `SELECT pq.*, q.reward_xp, q.reward_gold, q.reward_sp, q.reward_title, q.title, q.quest_type
         FROM player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         WHERE pq.player_id=? AND pq.quest_id=? AND pq.completed=1
           AND pq.claimed=0 AND pq.assigned_date=?`,
        [playerId, questId, today]
    );

    if (daily.length) {
        const q = daily[0];
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?",  [q.reward_gold, playerId]);
        await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?",            [q.reward_xp,   playerId]);
        if (q.reward_sp) await db.execute("UPDATE players SET sp = sp + ? WHERE id=?", [q.reward_sp, playerId]);
        await db.execute("UPDATE player_quests SET claimed=1 WHERE player_id=? AND quest_id=? AND assigned_date=?",
            [playerId, questId, today]);
        return { success: true, quest: q };
    }

    // Try achievement
    const [ach] = await db.execute(
        `SELECT pa.*, q.reward_xp, q.reward_gold, q.reward_sp, q.reward_title, q.title, q.quest_type
         FROM player_achievements pa
         JOIN quests q ON pa.quest_id = q.id
         WHERE pa.player_id=? AND pa.quest_id=? AND pa.completed=1 AND pa.claimed=0`,
        [playerId, questId]
    );

    if (ach.length) {
        const q = ach[0];
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?",  [q.reward_gold, playerId]);
        await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?",            [q.reward_xp,   playerId]);
        if (q.reward_sp)    await db.execute("UPDATE players SET sp = sp + ? WHERE id=?",    [q.reward_sp,    playerId]);
        if (q.reward_title) await db.execute("UPDATE players SET title=? WHERE id=?",        [q.reward_title, playerId]);
        await db.execute("UPDATE player_achievements SET claimed=1 WHERE player_id=? AND quest_id=?",
            [playerId, questId]);
        return { success: true, quest: q };
    }

    return { error: "Quest not found, not completed, or already claimed." };
}

// ── Get Player Quest Display ──────────────────────────────────────────────────
async function getPlayerQuests(playerId) {
    await assignDailyQuests(playerId);
    await ensureAchievements(playerId);
    await ensurePartyQuests();

    const today     = new Date().toISOString().split('T')[0];
    const weekStart = getWeekStart();

    const [daily] = await db.execute(
        `SELECT pq.quest_id as id, q.title, q.description, q.objective_count,
                pq.progress, pq.completed, pq.claimed
         FROM player_quests pq
         JOIN quests q ON pq.quest_id = q.id
         WHERE pq.player_id=? AND pq.assigned_date=?
         ORDER BY pq.completed ASC`,
        [playerId, today]
    );

    const [achievements] = await db.execute(
        `SELECT pa.quest_id as id, q.title, q.description, q.objective_count,
                pa.progress, pa.completed, pa.claimed, q.reward_title
         FROM player_achievements pa
         JOIN quests q ON pa.quest_id = q.id
         WHERE pa.player_id=?
         ORDER BY pa.completed DESC, pa.progress DESC
         LIMIT 5`,
        [playerId]
    );

    const [party] = await db.execute(
        `SELECT pqp.quest_id as id, q.title, q.description, q.objective_count,
                pqp.progress, pqp.completed, pqp.claimed
         FROM party_quest_progress pqp
         JOIN quests q ON pqp.quest_id = q.id
         WHERE pqp.week_start=?`,
        [weekStart]
    );

    return { daily, achievements, party };
}

// ── Progress Bar ──────────────────────────────────────────────────────────────
function progressBar(current, total) {
    const pct   = Math.min(1, current / total);
    const filled = Math.floor(pct * 8);
    const bar   = '█'.repeat(filled) + '░'.repeat(8 - filled);
    return `[${bar}] ${current}/${total}`;
}

module.exports = {
    ensureTables,
    assignDailyQuests,
    updateQuestProgress,
    claimQuestRewards,
    getPlayerQuests,
    progressBar
};