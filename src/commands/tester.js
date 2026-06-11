/**
 * TESTER SYSTEM
 * Only works in TEST_GROUP_JID.
 *
 * !tester login  — activates your demo account for this session
 * !tester logout — returns to your real account
 * !tester status — shows which account is active
 * !tester reset  — wipes your demo account data (fresh start)
 *
 * While logged in as tester:
 *   - All commands use your demo account (_test suffix in DB)
 *   - Real account is completely untouched
 *   - Demo account starts as a fresh level 1 hunter
 */

const db = require('../database/db');

// In-memory set of userIds currently using demo accounts
// Maps realUserId -> demoUserId
const activeTesterSessions = new Map();
global.activeTesterSessions = activeTesterSessions;

const TEST_GROUP_JID = process.env.TEST_GROUP_JID || '120363408323584748@g.us';

async function ensureDemoAccount(realUserId) {
    const demoId = realUserId + '_test';

    // Check if demo account exists
    const [existing] = await db.execute('SELECT id FROM players WHERE id=?', [demoId]);
    if (existing.length) return demoId;

    // Get real player's role for demo setup
    const [realPlayer] = await db.execute(
        'SELECT nickname, role FROM players WHERE id=?', [realUserId]
    );
    const role    = realPlayer[0]?.role || 'Berserker';
    const nick    = (realPlayer[0]?.nickname || 'Tester') + '_demo';

    // Create fresh demo account
    await db.execute(
        `INSERT INTO players (id, nickname, role, rank, hp, max_hp, strength, agility, intelligence, stamina, mana, max_mana, prestige_level, xp_to_next)
         VALUES (?, ?, ?, 'F', 1000, 1000, 100, 100, 100, 100, 20, 20, 0, 1000)`,
        [demoId, nick, role]
    ).catch(() => {});

    await db.execute(
        'INSERT INTO currency (player_id, gold) VALUES (?, 50000)',
        [demoId]
    ).catch(() => {});

    await db.execute(
        'INSERT INTO xp (player_id, xp) VALUES (?, 0)',
        [demoId]
    ).catch(() => {});

    console.log(`[TESTER] Demo account created: ${demoId}`);
    return demoId;
}

module.exports = {
    name: 'tester',
    activeTesterSessions,
    async execute(msg, args, { userId, client }) {
        const jid = msg.from;

        // Only works in test group
        if (jid !== TEST_GROUP_JID) {
            return msg.reply('❌ !tester commands only work in the Test Group.');
        }

        const sub = args[0]?.toLowerCase();

        if (sub === 'login') {
            if (activeTesterSessions.has(userId)) {
                return msg.reply(
                    `══〘 🧪 TESTER 〙══╮\n` +
                    `┃◆ Already logged into demo account.\n` +
                    `┃◆ !tester logout to return to real account.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const demoId = await ensureDemoAccount(userId);
            activeTesterSessions.set(userId, demoId);

            const [demo] = await db.execute('SELECT nickname, role, `rank` FROM players WHERE id=?', [demoId]);

            return msg.reply(
                `╔══〘 🧪 TESTER LOGIN 〙══╗\n` +
                `┃◆\n` +
                `┃◆ Demo account activated.\n` +
                `┃◆ Your real account is safe.\n` +
                `┃◆\n` +
                `┃◆ Demo: *${demo[0]?.nickname}*\n` +
                `┃◆ Role: ${demo[0]?.role} | Rank: ${demo[0]?.rank}\n` +
                `┃◆ Gold: 50,000 (starter)\n` +
                `┃◆\n` +
                `┃◆ All commands now use this account.\n` +
                `┃◆ !tester logout to switch back.\n` +
                `╚═══════════════════════════╝`
            );
        }

        if (sub === 'logout') {
            if (!activeTesterSessions.has(userId)) {
                return msg.reply(
                    `══〘 🧪 TESTER 〙══╮\n` +
                    `┃◆ You are not logged into a demo account.\n` +
                    `╰═══════════════════════╯`
                );
            }
            activeTesterSessions.delete(userId);
            return msg.reply(
                `╔══〘 🧪 TESTER LOGOUT 〙══╗\n` +
                `┃◆\n` +
                `┃◆ Back to your real account.\n` +
                `┃◆ Demo account preserved for next login.\n` +
                `╚═══════════════════════════╝`
            );
        }

        if (sub === 'status') {
            const isDemo = activeTesterSessions.has(userId);
            const demoId = activeTesterSessions.get(userId);
            let demoInfo = '';
            if (isDemo) {
                const [d] = await db.execute(
                    'SELECT p.nickname, p.`rank`, c.gold FROM players p LEFT JOIN currency c ON c.player_id=p.id WHERE p.id=?',
                    [demoId]
                );
                demoInfo = d[0] ? `\n┃◆ Demo: ${d[0].nickname} [${d[0]['rank']}] | ${Number(d[0].gold||0).toLocaleString()}G` : '';
            }
            return msg.reply(
                `══〘 🧪 TESTER STATUS 〙══╮\n` +
                `┃◆ Active: ${isDemo ? '✅ Demo account' : '❌ Real account'}${demoInfo}\n` +
                `╰═══════════════════════╯`
            );
        }

        if (sub === 'reset') {
            const demoId = userId + '_test';
            await db.execute('DELETE FROM players WHERE id=?', [demoId]).catch(() => {});
            await db.execute('DELETE FROM currency WHERE player_id=?', [demoId]).catch(() => {});
            await db.execute('DELETE FROM xp WHERE player_id=?', [demoId]).catch(() => {});
            await db.execute('DELETE FROM inventory WHERE player_id=?', [demoId]).catch(() => {});
            activeTesterSessions.delete(userId);
            return msg.reply(
                `══〘 🧪 TESTER RESET 〙══╮\n` +
                `┃◆ Demo account wiped.\n` +
                `┃◆ !tester login to start fresh.\n` +
                `╰═══════════════════════╯`
            );
        }

        // Default help
        return msg.reply(
            `╔══〘 🧪 TESTER SYSTEM 〙══╗\n` +
            `┃◆\n` +
            `┃◆ Test commands without touching\n` +
            `┃◆ your real account.\n` +
            `┃◆\n` +
            `┃◆ !tester login  — use demo account\n` +
            `┃◆ !tester logout — back to real account\n` +
            `┃◆ !tester status — see which is active\n` +
            `┃◆ !tester reset  — wipe demo account\n` +
            `┃◆\n` +
            `╚═══════════════════════════╝`
        );
    }
};