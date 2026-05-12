const db = require('../database/db');
const { getPlayerClan, getClanMembers, ensureClanTables } = require('../systems/clanSystem');

const WAR_COOLDOWN_DAYS = 7;
const WAR_DURATION_HRS  = 72;

async function ensureWarTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS clan_wars (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            challenger_id INT NOT NULL,
            defender_id   INT NOT NULL,
            mode          INT NOT NULL DEFAULT 1,
            format        VARCHAR(10) DEFAULT 'bo3',
            status        ENUM('pending','active','completed','draw') DEFAULT 'pending',
            winner_id     INT DEFAULT NULL,
            challenger_score INT DEFAULT 0,
            defender_score   INT DEFAULT 0,
            created_at    DATETIME DEFAULT NOW(),
            ends_at       DATETIME DEFAULT NULL
        )
    `).catch(() => {});

    await db.execute(`
        CREATE TABLE IF NOT EXISTS clan_war_duels (
            id       INT AUTO_INCREMENT PRIMARY KEY,
            war_id   INT NOT NULL,
            p1_id    VARCHAR(50) NOT NULL,
            p2_id    VARCHAR(50) NOT NULL,
            winner_id VARCHAR(50) DEFAULT NULL,
            status   ENUM('pending','completed') DEFAULT 'pending'
        )
    `).catch(() => {});
}

async function getActiveWar(clanId) {
    const [rows] = await db.execute(
        "SELECT * FROM clan_wars WHERE (challenger_id=? OR defender_id=?) AND status IN ('pending','active') LIMIT 1",
        [clanId, clanId]
    );
    return rows[0] || null;
}

async function getLastWar(clanId) {
    const [rows] = await db.execute(
        "SELECT * FROM clan_wars WHERE (challenger_id=? OR defender_id=?) AND status='completed' ORDER BY created_at DESC LIMIT 1",
        [clanId, clanId]
    );
    return rows[0] || null;
}

const MODE_NAMES = {
    1: '⚔️ Void Duel (PvP)',
    2: '📖 Knowledge of the Ancients (Quiz)',
    3: '🏃 Dungeon Dominance (Speed Clear)',
    4: '💀 Blood Hunt (Kill Race)',
    5: '🌑 Void Conquest (Contribution War)'
};

module.exports = {
    name: 'clanwar',
    async execute(msg, args, { userId, client }) {
        try {
            await ensureClanTables();
            await ensureWarTables();

            const sub = args[0]?.toLowerCase();

            // ── !clanwar ── show status ───────────────────────────────────────
            if (!sub) {
                const myClan = await getPlayerClan(userId);
                if (!myClan) return msg.reply("❌ You are not in a clan.");

                const activeWar = await getActiveWar(myClan.id);
                if (!activeWar) return msg.reply(
                    `╔══〘 ⚔️ CLAN WAR 〙══╗\n` +
                    `┃◆ No active war.\n` +
                    `┃◆\n` +
                    `┃◆ !clanwar challenge <clan> <mode> <bo3/bo5>\n` +
                    `┃◆\n` +
                    `┃◆ MODES:\n` +
                    Object.entries(MODE_NAMES).map(([k,v]) => `┃◆ ${k}. ${v}`).join('\n') + '\n' +
                    `╚═══════════════════════════╝`
                );

                const [c1] = await db.execute("SELECT name FROM clans WHERE id=?", [activeWar.challenger_id]);
                const [c2] = await db.execute("SELECT name FROM clans WHERE id=?", [activeWar.defender_id]);
                return msg.reply(
                    `╔══〘 ⚔️ CLAN WAR 〙══╗\n` +
                    `┃◆ ${c1[0]?.name} vs ${c2[0]?.name}\n` +
                    `┃◆ Mode: ${MODE_NAMES[activeWar.mode]}\n` +
                    `┃◆ Format: ${activeWar.format?.toUpperCase()}\n` +
                    `┃◆ Status: ${activeWar.status.toUpperCase()}\n` +
                    `┃◆ Score: ${activeWar.challenger_score} - ${activeWar.defender_score}\n` +
                    `╚═══════════════════════════╝`
                );
            }

            // ── !clanwar challenge <clan> <mode> <bo3/bo5> ───────────────────
            if (sub === 'challenge') {
                const myClan = await getPlayerClan(userId);
                if (!myClan || myClan.leader_id !== userId) return msg.reply("❌ Only clan leaders can declare war.");

                const targetName = args[1];
                const mode       = parseInt(args[2]) || 1;
                const format     = args[3]?.toLowerCase() === 'bo5' ? 'bo5' : 'bo3';

                if (!targetName) return msg.reply("❌ !clanwar challenge <clan name> <mode 1-5> <bo3/bo5>");
                if (!MODE_NAMES[mode]) return msg.reply("❌ Mode must be 1-5.");

                const [target] = await db.execute("SELECT * FROM clans WHERE LOWER(name)=LOWER(?)", [targetName]);
                if (!target.length) return msg.reply(`❌ Clan *${targetName}* not found.`);
                if (target[0].id === myClan.id) return msg.reply("❌ Cannot war your own clan.");

                // Check cooldowns
                const myLastWar  = await getLastWar(myClan.id);
                const theirLastWar = await getLastWar(target[0].id);
                const cooldownMs = WAR_COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

                if (myLastWar && Date.now() - new Date(myLastWar.created_at) < cooldownMs) {
                    return msg.reply(`❌ Your clan is still on war cooldown (${WAR_COOLDOWN_DAYS} days).`);
                }

                // Check no active war
                const myActive = await getActiveWar(myClan.id);
                if (myActive) return msg.reply("❌ Your clan is already in a war.");
                const theirActive = await getActiveWar(target[0].id);
                if (theirActive) return msg.reply(`❌ *${target[0].name}* is already in a war.`);

                // Create war challenge
                await db.execute(
                    "INSERT INTO clan_wars (challenger_id, defender_id, mode, format, status) VALUES (?, ?, ?, ?, 'pending')",
                    [myClan.id, target[0].id, mode, format]
                );

                return msg.reply(
                    `╔══〘 ⚔️ WAR DECLARED 〙══╗\n` +
                    `┃◆\n` +
                    `┃◆ *${myClan.name}* challenges\n` +
                    `┃◆ *${target[0].name}* to war!\n` +
                    `┃◆\n` +
                    `┃◆ Mode: ${MODE_NAMES[mode]}\n` +
                    `┃◆ Format: ${format.toUpperCase()}\n` +
                    `┃◆\n` +
                    `┃◆ Leader of *${target[0].name}* must\n` +
                    `┃◆ type !clanwar accept within 24h.\n` +
                    `╚═══════════════════════════╝`
                );
            }

            // ── !clanwar accept ───────────────────────────────────────────────
            if (sub === 'accept') {
                const myClan = await getPlayerClan(userId);
                if (!myClan || myClan.leader_id !== userId) return msg.reply("❌ Leaders only.");

                const [war] = await db.execute(
                    "SELECT * FROM clan_wars WHERE defender_id=? AND status='pending' LIMIT 1",
                    [myClan.id]
                );
                if (!war.length) return msg.reply("❌ No pending war challenge.");

                const endsAt = new Date(Date.now() + WAR_DURATION_HRS * 60 * 60 * 1000);
                await db.execute(
                    "UPDATE clan_wars SET status='active', ends_at=? WHERE id=?",
                    [endsAt, war[0].id]
                );

                const [c1] = await db.execute("SELECT name FROM clans WHERE id=?", [war[0].challenger_id]);
                return msg.reply(
                    `╔══〘 ⚔️ WAR ACCEPTED 〙══╗\n` +
                    `┃◆\n` +
                    `┃◆ *${myClan.name}* has accepted!\n` +
                    `┃◆ War against *${c1[0]?.name}* begins.\n` +
                    `┃◆\n` +
                    `┃◆ Mode: ${MODE_NAMES[war[0].mode]}\n` +
                    `┃◆ Format: ${war[0].format?.toUpperCase()}\n` +
                    `┃◆ Duration: ${WAR_DURATION_HRS} hours\n` +
                    `┃◆\n` +
                    `┃◆ May the stronger bloodline win.\n` +
                    `╚═══════════════════════════╝`
                );
            }

            // ── !clanwar decline ──────────────────────────────────────────────
            if (sub === 'decline') {
                const myClan = await getPlayerClan(userId);
                if (!myClan || myClan.leader_id !== userId) return msg.reply("❌ Leaders only.");

                const [war] = await db.execute(
                    "SELECT * FROM clan_wars WHERE defender_id=? AND status='pending' LIMIT 1",
                    [myClan.id]
                );
                if (!war.length) return msg.reply("❌ No pending war challenge.");

                await db.execute("DELETE FROM clan_wars WHERE id=?", [war[0].id]);
                return msg.reply(`✅ War challenge declined.`);
            }

            // ── !clanwar result <score1> <score2> (admin/mode 2) ─────────────
            if (sub === 'result') {
                const myClan = await getPlayerClan(userId);
                if (!myClan || myClan.leader_id !== userId) return msg.reply("❌ Leaders only.");

                const s1 = parseInt(args[1]);
                const s2 = parseInt(args[2]);
                if (isNaN(s1) || isNaN(s2)) return msg.reply("❌ !clanwar result <your score> <their score>");

                const war = await getActiveWar(myClan.id);
                if (!war || war.status !== 'active') return msg.reply("❌ No active war.");

                const isChallenger = war.challenger_id === myClan.id;
                const newC = isChallenger ? s1 : s2;
                const newD = isChallenger ? s2 : s1;

                await db.execute(
                    "UPDATE clan_wars SET challenger_score=?, defender_score=? WHERE id=?",
                    [newC, newD, war.id]
                );
                return msg.reply(`✅ Scores updated: ${newC} - ${newD}`);
            }

            // ── !clanwar end (admin) ──────────────────────────────────────────
            if (sub === 'end') {
                if (!args[1]) return msg.reply("❌ !clanwar end <war id>");
                const warId = parseInt(args[1]);
                const [war] = await db.execute("SELECT * FROM clan_wars WHERE id=?", [warId]);
                if (!war.length) return msg.reply("❌ War not found.");

                const w = war[0];
                let winnerId = null;
                let result   = 'DRAW';
                if (w.challenger_score > w.defender_score) { winnerId = w.challenger_id; result = 'WIN'; }
                else if (w.defender_score > w.challenger_score) { winnerId = w.defender_id; result = 'WIN'; }

                await db.execute(
                    "UPDATE clan_wars SET status=?, winner_id=? WHERE id=?",
                    [result === 'DRAW' ? 'draw' : 'completed', winnerId, warId]
                );

                const [c1] = await db.execute("SELECT name FROM clans WHERE id=?", [w.challenger_id]);
                const [c2] = await db.execute("SELECT name FROM clans WHERE id=?", [w.defender_id]);
                const winner = winnerId ? (winnerId === w.challenger_id ? c1[0]?.name : c2[0]?.name) : null;

                // Reward winners
                if (winnerId) {
                    await db.execute(
                        "UPDATE currency SET gold = gold + 5000 WHERE player_id IN (SELECT player_id FROM clan_members WHERE clan_id=?)",
                        [winnerId]
                    );
                    await db.execute(
                        "UPDATE xp SET xp = xp + 3000 WHERE player_id IN (SELECT player_id FROM clan_members WHERE clan_id=?)",
                        [winnerId]
                    );
                }

                return msg.reply(
                    `╔══〘 ⚔️ WAR CONCLUDED 〙══╗\n` +
                    `┃◆\n` +
                    `┃◆ ${c1[0]?.name} ${w.challenger_score} - ${w.defender_score} ${c2[0]?.name}\n` +
                    `┃◆\n` +
                    `┃◆ ${winner ? `🏆 *${winner}* wins!` : '🤝 Draw — no winner.'}\n` +
                    (winnerId ? `┃◆ Winners: +5,000G +3,000XP each\n` : '') +
                    `╚═══════════════════════════╝`
                );
            }

        } catch (err) {
            console.error('clanwar error:', err);
            msg.reply("❌ Clan war command failed.");
        }
    }
};