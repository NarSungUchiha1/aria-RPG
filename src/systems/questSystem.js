const db = require('../database/db');
const { RAID_GROUP } = require('../engine/dungeon');

// ── Table Setup ───────────────────────────────────────────────────────────────
async function ensureTables() {
    // Core quest pool
    await db.execute(`
        CREATE TABLE IF NOT EXISTS quests (
            id               INT AUTO_INCREMENT PRIMARY KEY,
            quest_type       ENUM('daily','achievement','party') NOT NULL,
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

    // Player quest progress (daily + party)
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

    // Permanent achievement tracking
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

    // Weekly party quest progress
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
    if (existing[0].cnt > 0) return; // Already seeded

    const quests = [
        // ── DAILY ───────────────────────────────────────────────────────────
        ['daily', 'Slayer',          'Defeat 10 enemies in dungeons',           'enemy_kill',      null,      10,  200,  150, 0, null],
        ['daily', 'Stage Clearer',   'Clear 3 dungeon stages',                  'stage_clear',     null,       3,  150,  100, 0, null],
        ['daily', 'Damage Dealer',   'Deal 500 total damage in dungeons',       'damage_dealt',    null,     500,  100,  200, 0, null],
        ['daily', 'Skill User',      'Use 15 skills in combat',                 'skill_use',       null,      15,  120,  100, 0, null],
        ['daily', 'Dungeon Runner',  'Complete 1 full dungeon run',             'dungeon_clear',   null,       1,  300,  300, 0, null],
        ['daily', 'The Grinder',     'Defeat 25 enemies in dungeons',           'enemy_kill',      null,      25,  400,  300, 0, null],
        ['daily', 'Survivor',        'Complete a dungeon without dying',        'dungeon_survive',  null,      1,  250,  200, 0, null],
        ['daily', 'Duel Ready',      'Win 1 PvP duel',                          'pvp_win',         null,       1,  200,  250, 0, null],
        ['daily', 'Potion Sipper',   'Use 3 consumable items',                  'item_use',        null,       3,  100,   80, 0, null],
        ['daily', 'Boss Hunter',     'Defeat 2 dungeon bosses',                 'boss_kill',       null,       2,  500,  400, 0, null],

        // ── ACHIEVEMENTS ─────────────────────────────────────────────────────
        ['achievement', 'First Blood',       'Win your first PvP duel',              'pvp_win',       null,    1,  500,  500,  3, 'Duelist'],
        ['achievement', 'Dungeon Veteran',   'Complete 10 full dungeon runs',        'dungeon_clear', null,   10, 1000, 1000,  5, 'Veteran'],
        ['achievement', 'Rank Up',           'Reach Rank C',                         'rank_reached',  'C',    1,  800,  800,  5, 'Rising Star'],
        ['achievement', 'Elite Hunter',      'Reach Rank A',                         'rank_reached',  'A',    1, 2000, 2000, 10, 'Elite'],
        ['achievement', 'Legend',            'Reach Rank S',                         'rank_reached',  'S',    1, 5000, 5000, 20, 'Legend'],
        ['achievement', 'Void Hunter',       'Collect 1 Void Shard',                 'shard_collect', null,   1, 1000, 1000,  8, 'Void Hunter'],
        ['achievement', 'Void Collector',    'Collect all 5 Void Shards',            'shard_collect', null,   5, 5000, 5000, 20, 'Void Keeper'],
        ['achievement', 'Obliterator',       'Deal 50,000 total damage',             'damage_dealt',  null,50000, 2000, 2000, 10, 'Obliterator'],
        ['achievement', 'Unstoppable',       'Win 10 PvP duels',                     'pvp_win',       null,   10, 1500, 1500,  8, 'Champion'],
        ['achievement', 'Boss Slayer',       'Defeat 20 dungeon bosses',             'boss_kill',     null,   20, 3000, 3000, 15, 'Boss Slayer'],
        ['achievement', 'S-Rank Conqueror',  'Clear an S-rank dungeon',              'srank_clear',   null,    1, 5000, 5000, 20, 'S-Rank Conqueror'],
        ['achievement', 'Centurion',         'Enter 100 dungeons',                   'dungeon_enter', null,  100, 3000, 3000, 15, 'Centurion'],

        // ── PARTY ────────────────────────────────────────────────────────────
        ['party', 'Party Grind',     'Party clears 10 dungeons this week',      'dungeon_clear',  null,   10, 1000, 1000,  5, null],
        ['party', 'Boss Rush',       'Party defeats 5 bosses this week',        'boss_kill',      null,    5, 1500, 1500,  8, null],
        ['party', 'Void Seekers',    'Party collects 3 Void Shards this week',  'shard_collect',  null,    3, 2000, 2000, 10, null],
    ];

    for (const q of quests) {
        await db.execute(
            `INSERT INTO quests (quest_type, title, description, objective_type, objective_target,
             objective_count, reward_xp, reward_gold, reward_sp, reward_title) VALUES (?,?,?,?,?,?,?,?,?,?)`,
            q
        );
    }
    console.log('📜 Quest pool seeded.');
}

// ── Assign Daily Quests ───────────────────────────────────────────────────────
async function assignDailyQuests(playerId) {
    const today = new Date().toISOString().split('T')[0];
    const [existing] = await db.execute(
        "SELECT * FROM player_quests WHERE player_id=? AND assigned_date=?",
        [playerId, today]
    );
    if (existing.length >= 3) return;

    const [quests] = await db.execute(
        "SELECT * FROM quests WHERE quest_type='daily' AND is_active=1 ORDER BY RAND() LIMIT 3"
    );
    for (const q of quests) {
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