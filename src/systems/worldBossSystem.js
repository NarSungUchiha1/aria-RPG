const db = require('../database/db');

const BOSS_SPAWN_INTERVAL_HOURS = 12;

async function spawnWorldBoss() {
    const bosses = [
        { name: "Ancient Lich", rank: "S", hp: 100000, atk: 100, def: 50, exp: 2000, gold: 5000 },
        { name: "Void Leviathan", rank: "SS", hp: 250000, atk: 150, def: 70, exp: 5000, gold: 10000 }
    ];
    const boss = bosses[Math.floor(Math.random() * bosses.length)];
    await db.execute(
        `INSERT INTO world_boss (name, \`rank\`, max_hp, current_hp, atk, def, exp_reward, gold_reward, is_active, spawn_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
        [boss.name, boss.rank, boss.hp, boss.hp, boss.atk, boss.def, boss.exp, boss.gold]
    );
    console.log(`🌍 World Boss ${boss.name} spawned!`);
    return boss;
}

async function getActiveWorldBoss() {
    const [rows] = await db.execute("SELECT * FROM world_boss WHERE is_active=1 LIMIT 1");
    return rows[0] || null;
}

async function attackWorldBoss(playerId, damage) {
    const boss = await getActiveWorldBoss();
    if (!boss) return { error: "No active world boss." };
    const newHp = BigInt(boss.current_hp) - BigInt(damage);
    const newHpNum = newHp > 0n ? Number(newHp) : 0;
    await db.execute("UPDATE world_boss SET current_hp = ? WHERE id=?", [newHpNum, boss.id]);
    await db.execute(
        `INSERT INTO world_boss_contributions (player_id, boss_id, damage_dealt)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE damage_dealt = damage_dealt + ?`,
        [playerId, boss.id, damage, damage]
    );
    const defeated = newHpNum <= 0;
    if (defeated) {
        await distributeWorldBossRewards(boss.id);
        await db.execute("UPDATE world_boss SET is_active=0 WHERE id=?", [boss.id]);
    }
    return { boss, damage, newHp: newHpNum, defeated };
}

async function distributeWorldBossRewards(bossId) {
    const [boss] = await db.execute("SELECT * FROM world_boss WHERE id=?", [bossId]);
    const [contributors] = await db.execute(
        "SELECT player_id, damage_dealt FROM world_boss_contributions WHERE boss_id=?",
        [bossId]
    );
    const totalDamage = contributors.reduce((sum, c) => sum + Number(c.damage_dealt), 0);
    for (const c of contributors) {
        const share = totalDamage > 0 ? c.damage_dealt / totalDamage : 0;
        const gold = Math.floor(boss[0].gold_reward * share);
        const exp = Math.floor(boss[0].exp_reward * share);
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [gold, c.player_id]);
        await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [exp, c.player_id]);
    }
}

module.exports = { spawnWorldBoss, getActiveWorldBoss, attackWorldBoss };