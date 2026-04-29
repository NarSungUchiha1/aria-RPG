const db = require('../database/db');
const { RAID_GROUP } = require('../engine/dungeon');

const VOID_WAR_GOAL     = 100000; // Total damage needed to defeat Leviathan
const WAR_BONUS_GOLD    = 500;
const WAR_BONUS_XP      = 300;
const CORRUPTION_HOURS  = 24;
const CORRUPTION_DEBUFF = 30; // % stat reduction

async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS void_war (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            is_active    TINYINT DEFAULT 1,
            total_damage INT DEFAULT 0,
            goal         INT DEFAULT ${VOID_WAR_GOAL},
            started_at   DATETIME DEFAULT NOW(),
            ends_at      DATETIME NOT NULL,
            completed    TINYINT DEFAULT 0
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS void_war_contributions (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            war_id      INT NOT NULL,
            player_id   VARCHAR(50) NOT NULL,
            nickname    VARCHAR(100) NOT NULL,
            damage      INT DEFAULT 0,
            dungeons    INT DEFAULT 0,
            UNIQUE KEY unique_contribution (war_id, player_id)
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS void_corruption (
            player_id   VARCHAR(50) PRIMARY KEY,
            expires_at  DATETIME NOT NULL
        )
    `).catch(() => {});
}

async function getActiveWar() {
    await ensureTables();
    const [rows] = await db.execute(
        "SELECT * FROM void_war WHERE is_active=1 AND ends_at > NOW() LIMIT 1"
    );
    return rows[0] || null;
}

async function isCorrupted(playerId) {
    const [rows] = await db.execute(
        "SELECT * FROM void_corruption WHERE player_id=? AND expires_at > NOW()",
        [playerId]
    );
    return rows.length > 0;
}

async function addWarDamage(playerId, nickname, dungeonRank) {
    await ensureTables();
    const war = await getActiveWar();
    if (!war) return null;

    // Damage contribution scales with dungeon rank
    const rankDamage = { F:500, E:800, D:1200, C:1800, B:2600, A:3500, S:5000 };
    const damage = rankDamage[dungeonRank] || 500;

    await db.execute(
        `INSERT INTO void_war_contributions (war_id, player_id, nickname, damage, dungeons)
         VALUES (?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE damage = damage + ?, dungeons = dungeons + 1`,
        [war.id, playerId, nickname, damage, damage]
    );

    await db.execute(
        "UPDATE void_war SET total_damage = total_damage + ? WHERE id=?",
        [damage, war.id]
    );

    // Check if goal reached
    const [updated] = await db.execute("SELECT total_damage, goal FROM void_war WHERE id=?", [war.id]);
    return { damage, totalDamage: updated[0].total_damage, goal: updated[0].goal };
}

async function startVoidWar(hours = 48, client) {
    await ensureTables();

    // Close any existing war
    await db.execute("UPDATE void_war SET is_active=0 WHERE is_active=1");

    const endsAt = new Date(Date.now() + hours * 3600000);
    await db.execute(
        "INSERT INTO void_war (is_active, total_damage, goal, ends_at) VALUES (1, 0, ?, ?)",
        [VOID_WAR_GOAL, endsAt.toISOString().slice(0,19).replace('T',' ')]
    );

    if (client) {
        const { tagAll } = require('../utils/tagAll');
        let mentions = [];
        try { const t = await tagAll(client); mentions = t.mentions || []; } catch(e) {}

        const { sendWithRetry } = require('../utils/sendWithRetry');
        await sendWithRetry(client, RAID_GROUP, {
            text:
                `╭══〘 ⚡ THE VOID WAR 〙══╮\n` +
                `┃◆ \n` +
                `┃◆   CHAPTER 3 — THE VOID WAR\n` +
                `┃◆   The ancient ones have arrived.\n` +
                `┃◆ \n` +
                `┃◆ ━━━━━━━━━━━━━━━━━━━━\n` +
                `┃◆ \n` +
                `┃◆ The Void Leviathan has breached\n` +
                `┃◆ the seal. Normal weapons do nothing.\n` +
                `┃◆ \n` +
                `┃◆ But the Void Shards you collected —\n` +
                `┃◆ they react to it. Burn against it.\n` +
                `┃◆ \n` +
                `┃◆ Every dungeon cleared deals damage\n` +
                `┃◆ to the Leviathan's forces.\n` +
                `┃◆ \n` +
                `┃◆ ⚡ GOAL: ${VOID_WAR_GOAL.toLocaleString()} collective damage\n` +
                `┃◆ ⏳ Time: ${hours} hours\n` +
                `┃◆ \n` +
                `┃◆ ✅ SUCCEED → Everyone gets:\n` +
                `┃◆    +${WAR_BONUS_GOLD} Gold  +${WAR_BONUS_XP} XP\n` +
                `┃◆    + Rare material drops\n` +
                `┃◆ \n` +
                `┃◆ ❌ FAIL → Void Corruption:\n` +
                `┃◆    -${CORRUPTION_DEBUFF}% all stats for ${CORRUPTION_HOURS}h\n` +
                `┃◆ \n` +
                `┃◆ Use !warstatus to track progress.\n` +
                `┃◆ The hunt has begun. Rise.\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`,
            mentions
        });
    }
}

async function endVoidWar(client, forced = false) {
    await ensureTables();
    const war = await getActiveWar();
    if (!war && !forced) return;

    const warId = war?.id;
    const success = war && war.total_damage >= war.goal;

    await db.execute("UPDATE void_war SET is_active=0, completed=? WHERE is_active=1", [success ? 1 : 0]);

    const [contributors] = await db.execute(
        `SELECT vc.player_id, vc.nickname, vc.damage, vc.dungeons
         FROM void_war_contributions vc
         WHERE vc.war_id=?
         ORDER BY vc.damage DESC`,
        [warId]
    );

    // ✅ Goal reached — spawn the Void Leviathan
    if (success) {
        // Reward all contributors
        for (const c of contributors) {
            await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [WAR_BONUS_GOLD, c.player_id]);
            await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [WAR_BONUS_XP, c.player_id]);
        }

        if (client) {
            const { sendWithRetry } = require('../utils/sendWithRetry');
            const { tagAll } = require('../utils/tagAll');
            let mentions = [];
            try { const t = await tagAll(client); mentions = t.mentions || []; } catch(e) {}

            // Build leaderboard
            let board = '';
            const medals = ['🥇','🥈','🥉'];
            contributors.slice(0,10).forEach((c, i) => {
                board += `┃◆ ${medals[i] || `${i+1}.`} *${c.nickname}* — ${c.damage.toLocaleString()} dmg (${c.dungeons} raids)\n`;
            });

            await sendWithRetry(client, RAID_GROUP, {
                text:
                    `╭══〘 ⚡ VOID WAR — GOAL REACHED 〙══╮\n` +
                    `┃◆ \n` +
                    `┃◆ The collective damage threshold\n` +
                    `┃◆ has been reached.\n` +
                    `┃◆ \n` +
                    `┃◆ The Leviathan's forces have been\n` +
                    `┃◆ weakened enough to face it directly.\n` +
                    `┃◆ \n` +
                    `┃◆ 🏆 TOP HUNTERS:\n` +
                    `${board}` +
                    `┃◆ \n` +
                    `┃◆ All participants: +${WAR_BONUS_GOLD} Gold +${WAR_BONUS_XP} XP\n` +
                    `┃◆ \n` +
                    `┃◆ ⚠️ Prepare yourselves.\n` +
                    `┃◆ The Leviathan itself is coming.\n` +
                    `┃◆ \n` +
                    `╰═══════════════════════════╯`,
                mentions
            });

            // Auto-spawn the Leviathan after 30 seconds
            setTimeout(async () => {
                try {
                    const WORLD_BOSSES = require('../systems/worldBossSystem').WORLD_BOSSES;
                    const leviathan = WORLD_BOSSES.find(b => b.name === 'The Void Leviathan');
                    if (!leviathan) return;

                    await db.execute(
                        `INSERT INTO world_boss (name, \`rank\`, max_hp, current_hp, atk, def, exp_reward, gold_reward, is_active, spawn_time)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
                        [leviathan.name, leviathan.rank, leviathan.hp, leviathan.hp,
                         leviathan.atk, leviathan.def, leviathan.exp, leviathan.gold]
                    );

                    // Init battle
                    const { initBattle } = require('../systems/leviathan');
                    await initBattle(client);

                    await sendWithRetry(client, RAID_GROUP, {
                        text:
                            `╭══〘 🌊 IT HAS ARRIVED 〙══╮\n` +
                            `┃◆ \n` +
                            `┃◆ ${leviathan.spawnMsg}\n` +
                            `┃◆ \n` +
                            `┃◆ ❤️ HP: ${leviathan.hp.toLocaleString()}\n` +
                            `┃◆ \n` +
                            `┃◆ ALL HUNTERS — use !attackboss\n` +
                            `┃◆ Every 5-6 turns it retaliates.\n` +
                            `┃◆ Shard holders cannot be killed.\n` +
                            `┃◆ \n` +
                            `╰═══════════════════════════╯`,
                        mentions
                    });
                } catch(e) { console.error('Leviathan auto-spawn error:', e.message); }
            }, 30000);
        }
    } else {
        // Apply void corruption to all registered players
        const [players] = await db.execute("SELECT id FROM players");
        const expires = new Date(Date.now() + CORRUPTION_HOURS * 3600000);
        const expiresStr = expires.toISOString().slice(0,19).replace('T',' ');
        for (const p of players) {
            await db.execute(
                `INSERT INTO void_corruption (player_id, expires_at) VALUES (?, ?)
                 ON DUPLICATE KEY UPDATE expires_at=?`,
                [p.id, expiresStr, expiresStr]
            );
        }
    }

    if (client) {
        const { sendWithRetry } = require('../utils/sendWithRetry');
        const { tagAll } = require('../utils/tagAll');
        let mentions = [];
        try { const t = await tagAll(client); mentions = t.mentions || []; } catch(e) {}

        // Build leaderboard
        let board = '';
        const medals = ['🥇','🥈','🥉'];
        contributors.slice(0,10).forEach((c, i) => {
            board += `┃◆ ${medals[i] || `${i+1}.`} *${c.nickname}* — ${c.damage.toLocaleString()} dmg (${c.dungeons} raids)\n`;
        });

        await sendWithRetry(client, RAID_GROUP, {
            text: success
                ? `╭══〘 ✅ VOID WAR — VICTORY 〙══╮\n` +
                  `┃◆ \n` +
                  `┃◆ The Void Leviathan has fallen.\n` +
                  `┃◆ \n` +
                  `┃◆ Total Damage: ${war.total_damage.toLocaleString()}/${war.goal.toLocaleString()}\n` +
                  `┃◆ \n` +
                  `┃◆ 🏆 TOP HUNTERS:\n` +
                  `${board}` +
                  `┃◆ \n` +
                  `┃◆ All participants rewarded:\n` +
                  `┃◆ +${WAR_BONUS_GOLD} Gold  +${WAR_BONUS_XP} XP\n` +
                  `┃◆ \n` +
                  `┃◆ The seal holds. For now.\n` +
                  `┃◆ — ARIA Control\n` +
                  `┃◆ \n` +
                  `╰═══════════════════════════╯`
                : `╭══〘 ❌ VOID WAR — FAILED 〙══╮\n` +
                  `┃◆ \n` +
                  `┃◆ The Leviathan was not stopped.\n` +
                  `┃◆ The void corruption spreads.\n` +
                  `┃◆ \n` +
                  `┃◆ Total Damage: ${war?.total_damage.toLocaleString() || 0}/${VOID_WAR_GOAL.toLocaleString()}\n` +
                  `┃◆ \n` +
                  `┃◆ ☠️ ALL HUNTERS are void-corrupted.\n` +
                  `┃◆ -${CORRUPTION_DEBUFF}% all stats for ${CORRUPTION_HOURS} hours.\n` +
                  `┃◆ \n` +
                  `┃◆ The hunt continues.\n` +
                  `┃◆ — ARIA Control\n` +
                  `┃◆ \n` +
                  `╰═══════════════════════════╯`,
            mentions
        });
    }
}

module.exports = {
    ensureTables,
    getActiveWar,
    isCorrupted,
    addWarDamage,
    startVoidWar,
    endVoidWar,
    VOID_WAR_GOAL,
    CORRUPTION_DEBUFF
};