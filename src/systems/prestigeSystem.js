const db = require('../database/db');

async function ensureTables() {
    // Add prestige columns to players table
    await db.execute(`ALTER TABLE players ADD COLUMN IF NOT EXISTS prestige_level INT DEFAULT 0`).catch(() => {});
    await db.execute(`ALTER TABLE players ADD COLUMN IF NOT EXISTS last_active DATETIME DEFAULT NOW()`).catch(() => {});
}

async function getPrestigeBadge(prestigeLevel) {
    if (!prestigeLevel || prestigeLevel <= 0) return '';
    return '⭐'.repeat(Math.min(prestigeLevel, 5)); // max 5 stars shown
}

async function getRankDisplay(player) {
    const badge = await getPrestigeBadge(player.prestige_level);
    if (badge) return `${badge}${player.rank}`;
    return player.rank;
}

async function canPrestige(playerId) {
    const [rows] = await db.execute("SELECT `rank`, prestige_level FROM players WHERE id=?", [playerId]);
    if (!rows.length) return { ok: false, reason: 'not_registered' };
    if (rows[0].rank !== 'S') return { ok: false, reason: 'not_s_rank', rank: rows[0].rank };
    return { ok: true, currentPrestige: rows[0].prestige_level || 0 };
}

async function doPrestige(playerId) {
    await ensureTables();
    const check = await canPrestige(playerId);
    if (!check.ok) return check;

    const newLevel = check.currentPrestige + 1;

    // Strip gold and XP only on first prestige
    if (newLevel === 1) {
        await db.execute("UPDATE currency SET gold = 0 WHERE player_id=?", [playerId]);
        await db.execute("UPDATE xp SET xp = 0 WHERE player_id=?", [playerId]);
    }

    // Reset rank to F, update prestige level
    await db.execute(
        "UPDATE players SET `rank`='F', prestige_level=? WHERE id=?",
        [newLevel, playerId]
    );

    // Reset stats to F rank base (keep role bonuses)
    const [player] = await db.execute("SELECT role FROM players WHERE id=?", [playerId]);
    const role = player[0]?.role;
    const baseStats = { strength: 5, agility: 5, intelligence: 5, stamina: 5, hp: 100, max_hp: 100 };
    if (role === 'Tank')      { baseStats.stamina += 5; baseStats.strength += 3; baseStats.hp += 50; baseStats.max_hp += 50; }
    if (role === 'Assassin')  { baseStats.agility += 5; baseStats.strength += 2; baseStats.hp += 10; baseStats.max_hp += 10; }
    if (role === 'Mage')      { baseStats.intelligence += 5; baseStats.agility += 2; baseStats.hp += 10; baseStats.max_hp += 10; }
    if (role === 'Healer')    { baseStats.intelligence += 4; baseStats.stamina += 3; baseStats.hp += 20; baseStats.max_hp += 20; }
    if (role === 'Berserker') { baseStats.strength += 5; baseStats.agility += 2; baseStats.hp += 30; baseStats.max_hp += 30; }

    await db.execute(
        "UPDATE players SET strength=?, agility=?, intelligence=?, stamina=?, hp=?, max_hp=? WHERE id=?",
        [baseStats.strength, baseStats.agility, baseStats.intelligence, baseStats.stamina,
         baseStats.hp, baseStats.max_hp, playerId]
    );

    return { ok: true, newLevel };
}

async function updateLastActive(playerId) {
    await db.execute("UPDATE players SET last_active=NOW() WHERE id=?", [playerId]).catch(() => {});
}

async function clearInactivePlayers() {
    // Remove players inactive for 7+ days from dungeon tables only (not players table)
    await db.execute(
        `DELETE dp FROM dungeon_players dp
         JOIN players p ON p.id = dp.player_id
         WHERE p.last_active < DATE_SUB(NOW(), INTERVAL 7 DAY)
         AND dp.dungeon_id IN (SELECT id FROM dungeon WHERE is_active=0)`
    ).catch(() => {});
    console.log('🧹 Cleared inactive dungeon players');
}

module.exports = {
    ensureTables,
    getPrestigeBadge,
    getRankDisplay,
    canPrestige,
    doPrestige,
    updateLastActive,
    clearInactivePlayers
};