const db = require('../database/db');
const { RAID_GROUP } = require('../engine/dungeon');

// ── Boss Lore Pool ────────────────────────────────────────────────────────────
const WORLD_BOSSES = [
    {
        name: 'Malachar the Undying',
        rank: 'S',
        hp: 80000, atk: 120, def: 60,
        exp: 3000, gold: 6000,
        lore:
            `Malachar was once ARIA's greatest hunter — a man who\n` +
            `┃◆    reached Rank S and then kept going, pushing beyond\n` +
            `┃◆    the system's limits. The void consumed him.\n` +
            `┃◆    He returned as something that cannot die.\n` +
            `┃◆    He remembers nothing. He hunts everything.`,
        spawnMsg:
            `The ground splits. A figure emerges from below —\n` +
            `┃◆    armour black as collapsed stars, eyes hollow.\n` +
            `┃◆    The system recognises him. It cannot stop him.\n` +
            `┃◆    Malachar the Undying walks again.`
    },
    {
        {
        name: 'The Void Leviathan',
        rank: 'SS',
        hp: 500000, atk: 250, def: 120,
        exp: 15000, gold: 30000,
        chapter: 3,
        lore:
            `It was not born. It has always existed.\n` +
            `┃◆    Before the first Gate opened. Before the system.\n` +
            `┃◆    Before this world had a name.\n` +
            `┃◆    \n` +
            `┃◆    A thousand hunters gave their lives to seal it.\n` +
            `┃◆    Their sacrifice became the Gates themselves —\n` +
            `┃◆    not portals, but prison bars.\n` +
            `┃◆    \n` +
            `┃◆    The bars are broken now.\n` +
            `┃◆    The Void Leviathan does not attack.\n` +
            `┃◆    It simply arrives. And things stop existing.`,
        spawnMsg:
            `The ocean rose three hundred metres and fell.\n` +
            `┃◆    The sky turned the colour of a bruise.\n` +
            `┃◆    Every Hunter within range felt it —\n` +
            `┃◆    not heard, not seen. Felt.\n` +
            `┃◆    Something vast and patient and ancient\n` +
            `┃◆    just opened its eyes.\n` +
            `┃◆    \n` +
            `┃◆    The Void Leviathan has arrived.\n` +
            `┃◆    The system cannot classify it.\n` +
            `┃◆    The system is afraid.`,
        voidMoves: [
            { name: 'Void Surge',       damage: 800,  msg: 'Reality fractures. Everyone takes void damage.' },
            { name: 'Abyssal Drain',    damage: 600,  msg: 'The Leviathan drains life from the battlefield.' },
            { name: 'Dimensional Tear', damage: 1200, msg: 'A rift opens. Catastrophic void energy released.' },
            { name: 'Corruption Wave',  damage: 400,  msg: 'Void corruption spreads across all hunters.' },
            { name: 'Gravity Crush',    damage: 900,  msg: 'Gravity inverts. Hunters are crushed inward.' }
        ]
    },
    {
        name: 'Seraphel, Fallen Warden',
        rank: 'S',
        hp: 95000, atk: 140, def: 75,
        exp: 4000, gold: 8000,
        lore:
            `Seraphel was ARIA's guardian — a divine construct\n` +
            `┃◆    built to protect hunters from threats beyond\n` +
            `┃◆    their rank. Something corrupted her core.\n` +
            `┃◆    Now she sees all hunters as the threat.`,
        spawnMsg:
            `Wings of fractured light tear across the sky.\n` +
            `┃◆    A being of divine wrath descends — her eyes\n` +
            `┃◆    once gold, now burning red.\n` +
            `┃◆    Seraphel has turned. She comes for you.`
    },
    {
        name: 'Kroneth the Hollow King',
        rank: 'A',
        hp: 50000, atk: 95, def: 45,
        exp: 2000, gold: 4000,
        lore:
            `Kroneth ruled the C-rank dungeon realm for decades,\n` +
            `┃◆    absorbing the souls of every hunter who failed\n` +
            `┃◆    to clear his domain. He has outgrown his cage.\n` +
            `┃◆    Every soul he carries screams through him.`,
        spawnMsg:
            `The dungeon bells ring backwards. A king made of\n` +
            `┃◆    stolen souls rises from the failed raids of\n` +
            `┃◆    a thousand hunters. Kroneth the Hollow King\n` +
            `┃◆    has escaped the dungeon realm.`
    },
    {
        name: 'Abyss-Touched Golem',
        rank: 'B',
        hp: 30000, atk: 70, def: 35,
        exp: 1200, gold: 2500,
        lore:
            `A dungeon construct gone wrong — fused with void\n` +
            `┃◆    energy during the last Void Fracture event.\n` +
            `┃◆    It has no mind. Only impact. Only destruction.\n` +
            `┃◆    It will not stop until everything breaks.`,
        spawnMsg:
            `The earth shakes. A colossus of stone and void\n` +
            `┃◆    energy crashes through the dungeon walls.\n` +
            `┃◆    It has no eyes. It does not need them.\n` +
            `┃◆    The Abyss-Touched Golem is here.`
    }
];

// ── Ensure Tables ─────────────────────────────────────────────────────────────
async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS world_boss (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            name         VARCHAR(100) NOT NULL,
            \`rank\`     VARCHAR(10) NOT NULL,
            max_hp       BIGINT NOT NULL,
            current_hp   BIGINT NOT NULL,
            atk          INT NOT NULL,
            def          INT NOT NULL,
            exp_reward   INT NOT NULL,
            gold_reward  INT NOT NULL,
            is_active    TINYINT DEFAULT 1,
            spawn_time   DATETIME DEFAULT NOW()
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS world_boss_contributions (
            player_id    VARCHAR(50) NOT NULL,
            boss_id      INT NOT NULL,
            damage_dealt BIGINT DEFAULT 0,
            PRIMARY KEY (player_id, boss_id)
        )
    `).catch(() => {});
}

// ── Spawn Boss ────────────────────────────────────────────────────────────────
async function spawnWorldBoss(client) {
    await ensureTables();

    // Close any existing boss
    await db.execute("UPDATE world_boss SET is_active=0 WHERE is_active=1");

    const boss = WORLD_BOSSES[Math.floor(Math.random() * WORLD_BOSSES.length)];

    await db.execute(
        `INSERT INTO world_boss (name, \`rank\`, max_hp, current_hp, atk, def, exp_reward, gold_reward, is_active, spawn_time)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
        [boss.name, boss.rank, boss.hp, boss.hp, boss.atk, boss.def, boss.exp, boss.gold]
    );

    console.log(`🌍 World Boss spawned: ${boss.name}`);

    if (client) {
        const { tagAll } = require('../utils/tagAll');
        let mentions = [];
        try { const t = await tagAll(client); mentions = t.mentions || []; } catch(e) { console.log('tagAll failed, continuing without mentions.'); }

        await client.sendMessage(RAID_GROUP, {
            text:
                `╭══〘 ⚠️ WORLD BOSS ALERT 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ ════ LORE ════\n` +
                `┃◆ \n` +
                `┃◆    ${boss.lore}\n` +
                `┃◆ \n` +
                `┃◆ ════ EVENT ════\n` +
                `┃◆ \n` +
                `┃◆    ${boss.spawnMsg}\n` +
                `┃◆ \n` +
                `┃◆ ━━ 👹 ${boss.name} ━━\n` +
                `┃◆   Rank: ${boss.rank}\n` +
                `┃◆   ❤️ HP: ${boss.hp.toLocaleString()}\n` +
                `┃◆   ⚔️ ATK: ${boss.atk}  🛡️ DEF: ${boss.def}\n` +
                `┃◆ \n` +
                `┃◆ 🏆 Rewards by damage contribution.\n` +
                `┃◆ Use !attackboss to fight.\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`,
            mentions
        });
    }

    return boss;
}

// ── Get Active Boss ───────────────────────────────────────────────────────────
async function getActiveWorldBoss() {
    await ensureTables();
    const [rows] = await db.execute(
        "SELECT * FROM world_boss WHERE is_active=1 ORDER BY id DESC LIMIT 1"
    );
    return rows[0] || null;
}

// ── Attack Boss ───────────────────────────────────────────────────────────────
async function attackWorldBoss(playerId, damage) {
    const boss = await getActiveWorldBoss();
    if (!boss) return { error: "No active world boss." };

    const newHp    = Math.max(0, Number(boss.current_hp) - damage);
    await db.execute("UPDATE world_boss SET current_hp=? WHERE id=?", [newHp, boss.id]);
    await db.execute(
        `INSERT INTO world_boss_contributions (player_id, boss_id, damage_dealt)
         VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE damage_dealt = damage_dealt + ?`,
        [playerId, boss.id, damage, damage]
    );

    const defeated = newHp <= 0;
    if (defeated) {
        await distributeWorldBossRewards(boss.id);
        await db.execute("UPDATE world_boss SET is_active=0 WHERE id=?", [boss.id]);
    }

    return { boss, damage, newHp, defeated };
}

// ── Distribute Rewards ────────────────────────────────────────────────────────
async function distributeWorldBossRewards(bossId) {
    const [bossRows] = await db.execute("SELECT * FROM world_boss WHERE id=?", [bossId]);
    const boss = bossRows[0];
    if (!boss) return;

    const [contributors] = await db.execute(
        `SELECT wbc.player_id, wbc.damage_dealt, p.nickname
         FROM world_boss_contributions wbc
         JOIN players p ON p.id = wbc.player_id
         WHERE wbc.boss_id=?
         ORDER BY wbc.damage_dealt DESC`,
        [bossId]
    );
    if (!contributors.length) return;

    const totalDamage = contributors.reduce((sum, c) => sum + Number(c.damage_dealt), 0);

    // Distribute rewards proportionally + build leaderboard
    const rewardLines = [];
    for (const c of contributors) {
        const share = totalDamage > 0 ? Number(c.damage_dealt) / totalDamage : 0;
        const gold  = Math.floor(boss.gold_reward * share);
        const exp   = Math.floor(boss.exp_reward  * share);
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [gold, c.player_id]);
        await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [exp, c.player_id]);
        rewardLines.push({ nickname: c.nickname, damage: Number(c.damage_dealt), gold, exp });
    }

    // Announce in GC
    const { RAID_GROUP: rg } = require('../engine/dungeon');
    const db2 = require('../database/db');

    let announcement =
        `╭══〘 💀 WORLD BOSS DEFEATED 〙══╮\n` +
        `┃◆ \n` +
        `┃◆ ${boss.name} has fallen.\n` +
        `┃◆ The world breathes again.\n` +
        `┃◆ \n` +
        `┃◆ ━━ 🏆 DAMAGE LEADERBOARD ━━\n`;

    rewardLines.forEach((r, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '  ';
        announcement +=
            `┃◆ ${medal} ${r.nickname}\n` +
            `┃◆    💥 ${r.damage.toLocaleString()} dmg\n` +
            `┃◆    💰 +${r.gold} Gold  ⭐ +${r.exp} XP\n`;
    });

    announcement +=
        `┃◆ \n` +
        `╰═══════════════════════════╯`;

    // We need client to send — stored for use in attackboss.js
    return announcement;
}

module.exports = {
    spawnWorldBoss,
    getActiveWorldBoss,
    attackWorldBoss,
    distributeWorldBossRewards,
    WORLD_BOSSES
};