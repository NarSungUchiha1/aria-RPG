/**
 * TESTER SYSTEM
 * Only works in TEST_GROUP_JID.
 *
 * !tester login              — activate demo account (auto-registers if needed)
 * !tester logout             — return to real account
 * !tester status             — show active session info
 * !tester reset              — wipe ALL demo account data (full clean slate)
 * !tester setrank <rank>     — set demo account rank (F/E/D/C/B/A/S/PF..PS)
 * !tester setrole <role>     — set demo account role
 * !tester setgold <amount>   — set demo account gold
 * !tester list               — show all active tester sessions in this GC
 *
 * While logged in:
 *   - All commands run against your demo account (_test suffix in DB)
 *   - All announcements route to the test GC
 *   - Real account is completely untouched
 */

const db = require('../database/db');

const activeTesterSessions = new Map(); // realUserId -> demoUserId
global.activeTesterSessions = activeTesterSessions;

const TEST_GROUP_JID = process.env.TEST_GROUP_JID || '120363408323584748@g.us';

const VALID_RANKS = ['F','E','D','C','B','A','S','PF','PE','PD','PC','PB','PA','PS'];
const VALID_ROLES = ['Berserker','Assassin','Mage','Healer','Tank','Explorer'];

// Rank → sensible base stats for testing
const RANK_STATS = {
    F:  { hp: 1000,  max_hp: 1000,  strength: 100,  agility: 100,  intelligence: 100,  stamina: 100,  prestige_level: 0 },
    E:  { hp: 1500,  max_hp: 1500,  strength: 200,  agility: 200,  intelligence: 200,  stamina: 200,  prestige_level: 0 },
    D:  { hp: 2500,  max_hp: 2500,  strength: 400,  agility: 400,  intelligence: 400,  stamina: 400,  prestige_level: 0 },
    C:  { hp: 4000,  max_hp: 4000,  strength: 700,  agility: 700,  intelligence: 700,  stamina: 700,  prestige_level: 0 },
    B:  { hp: 6000,  max_hp: 6000,  strength: 1200, agility: 1200, intelligence: 1200, stamina: 1200, prestige_level: 0 },
    A:  { hp: 9000,  max_hp: 9000,  strength: 2000, agility: 2000, intelligence: 2000, stamina: 2000, prestige_level: 0 },
    S:  { hp: 13000, max_hp: 13000, strength: 3200, agility: 3200, intelligence: 3200, stamina: 3200, prestige_level: 0 },
    PF: { hp: 18000, max_hp: 18000, strength: 5000, agility: 5000, intelligence: 5000, stamina: 5000, prestige_level: 1 },
    PE: { hp: 24000, max_hp: 24000, strength: 7000, agility: 7000, intelligence: 7000, stamina: 7000, prestige_level: 1 },
    PD: { hp: 31000, max_hp: 31000, strength: 9500, agility: 9500, intelligence: 9500, stamina: 9500, prestige_level: 1 },
    PC: { hp: 39000, max_hp: 39000, strength: 12500,agility: 12500,intelligence: 12500,stamina: 12500,prestige_level: 2 },
    PB: { hp: 48000, max_hp: 48000, strength: 16000,agility: 16000,intelligence: 16000,stamina: 16000,prestige_level: 2 },
    PA: { hp: 58000, max_hp: 58000, strength: 20000,agility: 20000,intelligence: 20000,stamina: 20000,prestige_level: 3 },
    PS: { hp: 70000, max_hp: 70000, strength: 25000,agility: 25000,intelligence: 25000,stamina: 25000,prestige_level: 3 },
};

async function ensureDemoAccount(realUserId) {
    const demoId = realUserId + '_test';

    // Get real player info
    const [realPlayer] = await db.execute(
        'SELECT nickname, role FROM players WHERE id=?', [realUserId]
    );
    const role = realPlayer[0]?.role || 'Berserker';
    const nick = (realPlayer[0]?.nickname || realUserId.slice(-6)) + '_demo';

    const stats = RANK_STATS['F'];

    // Upsert demo player — always ensure it exists with at least F-rank stats
    await db.execute(
        `INSERT INTO players
            (id, nickname, role, \`rank\`, hp, max_hp, strength, agility, intelligence, stamina,
             mana, max_mana, prestige_level, fatigue)
         VALUES (?, ?, ?, 'F', ?, ?, ?, ?, ?, ?, 100, 100, 0, 0)
         ON DUPLICATE KEY UPDATE id=id`,
        [demoId, nick, role,
         stats.hp, stats.max_hp, stats.strength, stats.agility, stats.intelligence, stats.stamina]
    ).catch(() => {});

    await db.execute(
        'INSERT INTO currency (player_id, gold) VALUES (?, 100000) ON DUPLICATE KEY UPDATE gold=gold',
        [demoId]
    ).catch(() => {});

    await db.execute(
        'INSERT INTO xp (player_id, xp) VALUES (?, 0) ON DUPLICATE KEY UPDATE xp=xp',
        [demoId]
    ).catch(() => {});

    return demoId;
}

async function wipeDemoAccount(demoId) {
    const tables = [
        'players', 'currency', 'xp', 'inventory',
        'dungeon_players', 'clan_members', 'clan_blessing_state',
        'player_quests', 'void_corruption', 'bounty_progress',
        'active_effects', 'dungeon_entry_log'
    ];
    for (const table of tables) {
        const col = (table === 'dungeon_players') ? 'player_id'
                  : (table === 'clan_members')    ? 'player_id'
                  : (table === 'players')         ? 'id'
                  : 'player_id';
        await db.execute(`DELETE FROM ${table} WHERE ${col}=?`, [demoId]).catch(() => {});
    }
}

async function applyRankToDemo(demoId, rank) {
    const stats = RANK_STATS[rank];
    if (!stats) return false;
    await db.execute(
        `UPDATE players SET \`rank\`=?, hp=?, max_hp=?, strength=?, agility=?, intelligence=?,
         stamina=?, prestige_level=?, fatigue=0 WHERE id=?`,
        [rank, stats.hp, stats.max_hp, stats.strength, stats.agility,
         stats.intelligence, stats.stamina, stats.prestige_level, demoId]
    );
    return true;
}

module.exports = {
    name: 'tester',
    activeTesterSessions,
    async execute(msg, args, { userId, isAdmin, client }) {
        if (msg.from !== TEST_GROUP_JID) {
            return msg.reply('❌ !tester commands only work in the Test GC.');
        }

        const sub = args[0]?.toLowerCase();

        // ── LOGIN ──────────────────────────────────────────────────────────
        if (sub === 'login') {
            if (activeTesterSessions.has(userId)) {
                const demoId = activeTesterSessions.get(userId);
                const [d] = await db.execute(
                    'SELECT p.nickname, p.`rank`, p.role, c.gold FROM players p LEFT JOIN currency c ON c.player_id=p.id WHERE p.id=?',
                    [demoId]
                );
                return msg.reply(
                    `══〘 🧪 TESTER 〙══╮\n` +
                    `┃◆ Already on demo account.\n` +
                    `┃◆ *${d[0]?.nickname}* [${d[0]?.rank}] ${d[0]?.role}\n` +
                    `┃◆ Gold: ${Number(d[0]?.gold||0).toLocaleString()}\n` +
                    `┃◆ !tester logout to switch back.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const demoId = await ensureDemoAccount(userId);
            activeTesterSessions.set(userId, demoId);

            const [demo] = await db.execute(
                'SELECT nickname, role, `rank` FROM players WHERE id=?', [demoId]
            );

            return msg.reply(
                `╔══〘 🧪 TESTER LOGIN 〙══╗\n` +
                `┃◆\n` +
                `┃◆ Demo account active.\n` +
                `┃◆ Real account untouched.\n` +
                `┃◆\n` +
                `┃◆ Demo: *${demo[0]?.nickname}*\n` +
                `┃◆ Role: ${demo[0]?.role} | Rank: ${demo[0]?.rank}\n` +
                `┃◆ Gold: 100,000\n` +
                `┃◆\n` +
                `┃◆ All commands use this account.\n` +
                `┃◆\n` +
                `┃◆ Useful shortcuts:\n` +
                `┃◆ !tester setrank <F-PS>\n` +
                `┃◆ !tester setrole <role>\n` +
                `┃◆ !tester setgold <amount>\n` +
                `┃◆ !tester reset  — full wipe\n` +
                `┃◆ !tester logout — back to real\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── LOGOUT ─────────────────────────────────────────────────────────
        if (sub === 'logout') {
            if (!activeTesterSessions.has(userId)) {
                return msg.reply(
                    `══〘 🧪 TESTER 〙══╮\n` +
                    `┃◆ Not on a demo account.\n` +
                    `╰═══════════════════════╯`
                );
            }
            activeTesterSessions.delete(userId);
            return msg.reply(
                `══〘 🧪 TESTER 〙══╮\n` +
                `┃◆ ✅ Back to real account.\n` +
                `┃◆ Demo preserved for next login.\n` +
                `╰═══════════════════════╯`
            );
        }

        // ── STATUS ─────────────────────────────────────────────────────────
        if (!sub || sub === 'status') {
            const isDemo = activeTesterSessions.has(userId);
            const demoId = activeTesterSessions.get(userId);
            let info = '';
            if (isDemo && demoId) {
                const [d] = await db.execute(
                    'SELECT p.nickname, p.`rank`, p.role, p.hp, p.max_hp, p.strength, p.agility, p.intelligence, p.stamina, c.gold FROM players p LEFT JOIN currency c ON c.player_id=p.id WHERE p.id=?',
                    [demoId]
                );
                if (d[0]) {
                    info =
                        `┃◆ *${d[0].nickname}* [${d[0].rank}] ${d[0].role}\n` +
                        `┃◆ HP: ${d[0].hp}/${d[0].max_hp}\n` +
                        `┃◆ STR:${d[0].strength} AGI:${d[0].agility} INT:${d[0].intelligence} STA:${d[0].stamina}\n` +
                        `┃◆ Gold: ${Number(d[0].gold||0).toLocaleString()}\n`;
                }
            }
            return msg.reply(
                `╔══〘 🧪 TESTER STATUS 〙══╗\n` +
                `┃◆\n` +
                `┃◆ ${isDemo ? '🟢 Demo account active' : '🔴 Real account (not logged in)'}\n` +
                `┃◆\n` +
                `${info}` +
                `╚═══════════════════════════╝`
            );
        }

        // ── RESET ──────────────────────────────────────────────────────────
        if (sub === 'reset') {
            const demoId = userId + '_test';
            await wipeDemoAccount(demoId);
            activeTesterSessions.delete(userId);
            return msg.reply(
                `══〘 🧪 TESTER RESET 〙══╮\n` +
                `┃◆ ✅ Demo account fully wiped.\n` +
                `┃◆ !tester login to start fresh.\n` +
                `╰═══════════════════════╯`
            );
        }

        // ── SETRANK ────────────────────────────────────────────────────────
        if (sub === 'setrank') {
            const rank = args[1]?.toUpperCase();
            if (!rank || !VALID_RANKS.includes(rank)) {
                return msg.reply(
                    `══〘 🧪 TESTER 〙══╮\n` +
                    `┃◆ Valid ranks: ${VALID_RANKS.join(', ')}\n` +
                    `┃◆ Usage: !tester setrank S\n` +
                    `╰═══════════════════════╯`
                );
            }
            const demoId = activeTesterSessions.get(userId) || userId + '_test';
            const [exists] = await db.execute('SELECT id FROM players WHERE id=?', [demoId]);
            if (!exists.length) {
                return msg.reply(`══〘 🧪 TESTER 〙══╮\n┃◆ ❌ Login first: !tester login\n╰═══════════════════════╯`);
            }
            await applyRankToDemo(demoId, rank);
            const stats = RANK_STATS[rank];
            return msg.reply(
                `══〘 🧪 TESTER 〙══╮\n` +
                `┃◆ ✅ Demo rank set to *${rank}*\n` +
                `┃◆ HP: ${stats.hp} | STR/AGI/INT/STA: ${stats.strength}\n` +
                `┃◆ Prestige: ${stats.prestige_level}\n` +
                `╰═══════════════════════╯`
            );
        }

        // ── SETROLE ────────────────────────────────────────────────────────
        if (sub === 'setrole') {
            const role = args[1] ? args[1].charAt(0).toUpperCase() + args[1].slice(1).toLowerCase() : null;
            if (!role || !VALID_ROLES.includes(role)) {
                return msg.reply(
                    `══〘 🧪 TESTER 〙══╮\n` +
                    `┃◆ Valid roles: ${VALID_ROLES.join(', ')}\n` +
                    `┃◆ Usage: !tester setrole Mage\n` +
                    `╰═══════════════════════╯`
                );
            }
            const demoId = activeTesterSessions.get(userId) || userId + '_test';
            const [exists] = await db.execute('SELECT id FROM players WHERE id=?', [demoId]);
            if (!exists.length) {
                return msg.reply(`══〘 🧪 TESTER 〙══╮\n┃◆ ❌ Login first: !tester login\n╰═══════════════════════╯`);
            }
            await db.execute('UPDATE players SET role=? WHERE id=?', [role, demoId]);
            return msg.reply(
                `══〘 🧪 TESTER 〙══╮\n` +
                `┃◆ ✅ Demo role set to *${role}*\n` +
                `╰═══════════════════════╯`
            );
        }

        // ── SETGOLD ────────────────────────────────────────────────────────
        if (sub === 'setgold') {
            const amount = parseInt(args[1]);
            if (isNaN(amount) || amount < 0) {
                return msg.reply(`══〘 🧪 TESTER 〙══╮\n┃◆ Usage: !tester setgold 500000\n╰═══════════════════════╯`);
            }
            const demoId = activeTesterSessions.get(userId) || userId + '_test';
            const [exists] = await db.execute('SELECT id FROM players WHERE id=?', [demoId]);
            if (!exists.length) {
                return msg.reply(`══〘 🧪 TESTER 〙══╮\n┃◆ ❌ Login first: !tester login\n╰═══════════════════════╯`);
            }
            await db.execute(
                'INSERT INTO currency (player_id, gold) VALUES (?,?) ON DUPLICATE KEY UPDATE gold=?',
                [demoId, amount, amount]
            );
            return msg.reply(
                `══〘 🧪 TESTER 〙══╮\n` +
                `┃◆ ✅ Gold set to ${amount.toLocaleString()}\n` +
                `╰═══════════════════════╯`
            );
        }

        // ── LIST ───────────────────────────────────────────────────────────
        if (sub === 'list') {
            if (!activeTesterSessions.size) {
                return msg.reply(`══〘 🧪 TESTER 〙══╮\n┃◆ No active tester sessions.\n╰═══════════════════════╯`);
            }
            const lines = [];
            for (const [real, demo] of activeTesterSessions) {
                const [d] = await db.execute(
                    'SELECT nickname, `rank`, role FROM players WHERE id=?', [demo]
                ).catch(() => [[]]);
                lines.push(`┃◆ ${d[0]?.nickname || demo} [${d[0]?.rank}] ${d[0]?.role}`);
            }
            return msg.reply(
                `╔══〘 🧪 ACTIVE TESTERS 〙══╗\n` +
                `┃◆\n` +
                `${lines.join('\n')}\n` +
                `┃◆\n` +
                `┃◆ ${activeTesterSessions.size} session(s) active\n` +
                `╚═══════════════════════════╝`
            );
        }

        // ── HELP ───────────────────────────────────────────────────────────
        return msg.reply(
            `╔══〘 🧪 TESTER SYSTEM 〙══╗\n` +
            `┃◆\n` +
            `┃◆ Full game sandbox — real account\n` +
            `┃◆ completely untouched.\n` +
            `┃◆\n` +
            `┃◆ !tester login          — start demo\n` +
            `┃◆ !tester logout         — back to real\n` +
            `┃◆ !tester status         — show demo info\n` +
            `┃◆ !tester reset          — wipe demo data\n` +
            `┃◆ !tester setrank <rank> — F E D C B A S\n` +
            `┃◆                          PF PE PD PC PB PA PS\n` +
            `┃◆ !tester setrole <role> — Berserker Assassin\n` +
            `┃◆                          Mage Healer Tank Explorer\n` +
            `┃◆ !tester setgold <amt>  — set gold amount\n` +
            `┃◆ !tester list           — active sessions\n` +
            `┃◆\n` +
            `╚═══════════════════════════╝`
        );
    }
};