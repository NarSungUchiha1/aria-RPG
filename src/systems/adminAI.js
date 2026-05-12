/**
 * ARIA Admin Intelligence — Personal AI for the Master
 *
 * Four modes she switches between automatically:
 *   1. db_query   — generates + runs SELECT SQL for any question about the game
 *   2. action     — executes real changes (give gold, ban, reset, announce...)
 *   3. code_help  — writes actual code changes when Master asks to modify something
 *   4. chat       — friendly conversation, game lore, advice
 */

const db      = require('../database/db');
const fs      = require('fs');
const path    = require('path');

// ── Full schema for Gemini to write SQL against ───────────────────────────────
const DB_SCHEMA = `
MySQL database for ARIA RPG bot. Tables and key columns:

players: id(VARCHAR), nickname, role(Berserker/Assassin/Mage/Healer/Tank), rank(F/E/D/C/B/A/S/PF-PS),
  hp, max_hp, strength, agility, intelligence, stamina, fatigue(0-100), sp,
  prestige_level(0=normal), pvp_wins, pvp_losses, title, mana, max_mana

currency: player_id, gold

xp: player_id, xp

inventory: id, player_id, item_name, item_type, quantity, equipped(0/1), durability, max_durability

dungeon: id, dungeon_rank, stage, max_stage, boss_name, is_active(0/1),
  stage_cleared(0/1), in_combat(0/1), locked(0/1)

dungeon_players: player_id, dungeon_id, is_alive(0/1), session_gold, session_xp

dungeon_enemies: id, dungeon_id, name, current_hp, max_hp, attack, def, rank

clans: id, name, leader_id, blessing_type, description

clan_members: clan_id, player_id, joined_at

quests: id, title, quest_type(daily/achievement/party), objective_type, objective_count,
  reward_gold, reward_xp, reward_sp, reward_title, is_active

player_quests: id, player_id, quest_id, progress, completed(0/1), claimed(0/1), assigned_date

pvp_challenges: id, challenger_id, target_id, bet_amount, status(pending/accepted/declined),
  duel_type(solo/party), created_at

blocked_users: player_id
`;

// ── Source file map (for code help) ──────────────────────────────────────────
const SRC_ROOT = path.join(__dirname, '../../');
const FILE_MAP = {
    'pvpsystem': 'src/systems/pvpsystem.js',
    'dungeon':   'src/engine/dungeon.js',
    'skill':     'src/commands/skill.js',
    'shop':      'src/systems/shopSystem.js',
    'prestige':  'src/systems/prestigeShop.js',
    'quest':     'src/systems/questSystem.js',
    'clan':      'src/systems/clanSystem.js',
    'fatigue':   'src/systems/fatigueSystem.js',
    'rolemoves': 'src/data/roleMoves.js',
    'bag':       'src/systems/bagSystem.js',
    'narrator':  'src/utils/narrator.js'
};

function readFile(key) {
    const rel = FILE_MAP[key];
    if (!rel) return null;
    try { return fs.readFileSync(path.join(SRC_ROOT, rel), 'utf8'); }
    catch { return null; }
}

// ── Safe SQL execution — SELECT only ─────────────────────────────────────────
async function runQuery(sql) {
    const clean = sql.trim().replace(/;+$/, '');
    const upper = clean.toUpperCase();
    const banned = ['DROP','DELETE','UPDATE','INSERT','ALTER','CREATE','TRUNCATE','REPLACE','EXEC','CALL'];
    if (!upper.startsWith('SELECT') && !upper.startsWith('SHOW')) {
        throw new Error('Only SELECT/SHOW queries allowed from AI.');
    }
    for (const word of banned) {
        if (upper.includes(word + ' ') || upper.includes(word + '(')) {
            throw new Error(`Blocked keyword: ${word}`);
        }
    }
    const limited = clean.includes('LIMIT') ? clean : `${clean} LIMIT 25`;
    const [rows] = await db.execute(limited);
    return rows;
}

function formatRows(rows) {
    if (!rows || !rows.length) return '_(no results)_';
    const keys = Object.keys(rows[0]);
    const lines = rows.map(r =>
        keys.map(k => `${k}: ${r[k] ?? '—'}`).join(' | ')
    );
    if (lines.length <= 10) return lines.join('\n');
    return lines.slice(0, 10).join('\n') + `\n...and ${lines.length - 10} more`;
}

// ── Fixed action registry ─────────────────────────────────────────────────────
async function findPlayer(nickname) {
    if (!nickname) return null;
    const [rows] = await db.execute(
        "SELECT id, nickname, `rank`, role, hp, max_hp, fatigue, sp, prestige_level FROM players WHERE LOWER(nickname) LIKE ? LIMIT 1",
        [`%${nickname.toLowerCase()}%`]
    );
    return rows[0] || null;
}

const ACTIONS = {
    give_gold:     async ({ target, amount }) => {
        const p = await findPlayer(target);
        if (!p) return `❌ Can't find "${target}".`;
        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [amount, p.id]);
        return `✅ Dropped ${Number(amount).toLocaleString()} gold on *${p.nickname}* 💰`;
    },
    take_gold:     async ({ target, amount }) => {
        const p = await findPlayer(target);
        if (!p) return `❌ Can't find "${target}".`;
        await db.execute("UPDATE currency SET gold = GREATEST(0, gold - ?) WHERE player_id=?", [amount, p.id]);
        return `✅ Took ${amount} gold from *${p.nickname}*.`;
    },
    give_xp:       async ({ target, amount }) => {
        const p = await findPlayer(target);
        if (!p) return `❌ Can't find "${target}".`;
        await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [amount, p.id]);
        return `✅ Gave ${Number(amount).toLocaleString()} XP to *${p.nickname}* ✨`;
    },
    give_sp:       async ({ target, amount }) => {
        const p = await findPlayer(target);
        if (!p) return `❌ Can't find "${target}".`;
        await db.execute("UPDATE players SET sp = sp + ? WHERE id=?", [amount, p.id]);
        return `✅ Gave ${amount} SP to *${p.nickname}*.`;
    },
    give_item:     async ({ target, item, quantity = 1 }) => {
        const p = await findPlayer(target);
        if (!p) return `❌ Can't find "${target}".`;
        await db.execute(
            "INSERT INTO inventory (player_id, item_name, item_type, quantity) VALUES (?,?,'misc',?) ON DUPLICATE KEY UPDATE quantity=quantity+?",
            [p.id, item, quantity, quantity]
        );
        return `✅ Added ${quantity}× *${item}* to *${p.nickname}*'s bag 🎁`;
    },
    set_rank:      async ({ target, rank }) => {
        const valid = ['F','E','D','C','B','A','S','PF','PE','PD','PC','PB','PA','PS'];
        const r = rank?.toUpperCase();
        if (!valid.includes(r)) return `❌ Invalid rank. Options: ${valid.join(', ')}`;
        const p = await findPlayer(target);
        if (!p) return `❌ Can't find "${target}".`;
        await db.execute("UPDATE players SET `rank`=? WHERE id=?", [r, p.id]);
        return `✅ *${p.nickname}* is now rank *${r}* 🎖️`;
    },
    reset_fatigue: async ({ target }) => {
        const p = await findPlayer(target);
        if (!p) return `❌ Can't find "${target}".`;
        await db.execute("UPDATE players SET fatigue=0 WHERE id=?", [p.id]);
        return `✅ *${p.nickname}* is refreshed — fatigue cleared ⚡`;
    },
    restore_hp:    async ({ target }) => {
        const p = await findPlayer(target);
        if (!p) return `❌ Can't find "${target}".`;
        await db.execute("UPDATE players SET hp=max_hp WHERE id=?", [p.id]);
        return `✅ *${p.nickname}* fully healed ❤️`;
    },
    set_prestige:  async ({ target, level }) => {
        const p = await findPlayer(target);
        if (!p) return `❌ Can't find "${target}".`;
        await db.execute("UPDATE players SET prestige_level=? WHERE id=?", [level, p.id]);
        return `✅ *${p.nickname}*'s prestige set to ${level} ⭐`;
    },
    ban_player:    async ({ target }, sock, jid, blockedSet) => {
        const p = await findPlayer(target);
        if (!p) return `❌ Can't find "${target}".`;
        blockedSet?.add(p.id);
        await db.execute("INSERT IGNORE INTO blocked_users (player_id) VALUES (?)", [p.id]).catch(() => {});
        return `🚫 *${p.nickname}* has been blocked.`;
    },
    unban_player:  async ({ target }, sock, jid, blockedSet) => {
        const p = await findPlayer(target);
        if (!p) return `❌ Can't find "${target}".`;
        blockedSet?.delete(p.id);
        await db.execute("DELETE FROM blocked_users WHERE player_id=?", [p.id]).catch(() => {});
        return `✅ *${p.nickname}* unbanned and free to play again.`;
    },
    announce:      async ({ message }, sock, jid) => {
        const text =
            `╔══════════════════════════════╗\n` +
            `       📢  ARIA ANNOUNCEMENT\n` +
            `╚══════════════════════════════╝\n${message}`;
        await sock.sendMessage(jid, { text }).catch(() => {});
        return `📢 Announcement sent!`;
    },
    wipe_player:   async ({ target }) => {
        const p = await findPlayer(target);
        if (!p) return `❌ Can't find "${target}".`;
        await db.execute("UPDATE players SET hp=1, fatigue=100 WHERE id=?", [p.id]);
        await db.execute("UPDATE currency SET gold=0 WHERE player_id=?", [p.id]);
        return `💀 *${p.nickname}* has been wiped. HP=1, fatigue=100, gold=0.`;
    }
};

// ── Main entry ────────────────────────────────────────────────────────────────
async function handleAdminCommand(sock, jid, msg, userId, instruction, callGemini, blockedSet) {
    if (!instruction?.trim()) {
        await sock.sendMessage(jid, {
            text: `What do you need, Master? 😊\n\nI can:\n• Answer *anything* about the game data\n• Execute changes (give gold, set rank, ban, announce...)\n• Write code when you need something changed\n• Just chat\n\nJust tell me in plain English!`
        }, { quoted: msg });
        return true;
    }

    // ── Step 1: Classify intent ───────────────────────────────────────────────
    const classifyPrompt =
        `Classify this instruction from the game admin: "${instruction}"\n\n` +
        `Respond with ONLY one of these JSON formats:\n\n` +
        `{"type":"db_query","question":"<restate what they want to know>"}\n` +
        `{"type":"action","name":"${Object.keys(ACTIONS).join('|')}","params":{"target":"<nickname>","amount":<number>,"item":"<name>","rank":"<rank>","message":"<text>","level":<number>}}\n` +
        `{"type":"code_help","topic":"<pvpsystem|dungeon|skill|shop|prestige|quest|clan|fatigue|rolemoves|bag|narrator>","request":"<what to change>"}\n` +
        `{"type":"chat","reply":"<friendly response>"}\n\n` +
        `Rules:\n` +
        `- "show/list/get/what/how many/stats/who/which/check" = db_query\n` +
        `- "give/set/reset/ban/unban/restore/announce/wipe" = action\n` +
        `- "change/fix/update/add/remove from code/make it so/adjust" = code_help\n` +
        `- Everything else = chat\n` +
        `- Include ONLY relevant params, skip what's not needed`;

    let classified;
    try {
        const raw = await callGemini(instruction, classifyPrompt);
        classified = JSON.parse(raw.replace(/```json|```/g, '').trim());
    } catch {
        // Hard fallback — treat as db_query
        classified = { type: 'db_query', question: instruction };
    }

    // ── Step 2: Execute based on type ─────────────────────────────────────────
    const { type, question, name, params = {}, topic, request, reply } = classified;

    // ── CHAT ──────────────────────────────────────────────────────────────────
    if (type === 'chat') {
        await sock.sendMessage(jid, { text: reply || `Got it! 😄` }, { quoted: msg });
        return true;
    }

    // ── DB QUERY — Gemini generates SQL, we run it safely ────────────────────
    if (type === 'db_query') {
        try {
            const sqlPrompt =
                `You are a MySQL expert. Generate a SELECT query to answer:\n"${question}"\n\n` +
                `Database schema:\n${DB_SCHEMA}\n\n` +
                `Rules:\n` +
                `- Only SELECT statements\n` +
                `- Use JOINs when needed\n` +
                `- Add readable column aliases (e.g. p.nickname as 'Player', c.gold as 'Gold')\n` +
                `- ORDER BY sensibly\n` +
                `- LIMIT 20 max\n` +
                `- Respond with ONLY the SQL, no explanation, no backticks`;

            const sql = (await callGemini(question, sqlPrompt)).replace(/```sql|```/g, '').trim();
            console.log(`[ARIA SQL] ${sql}`);

            const rows  = await runQuery(sql);
            const table = formatRows(rows);

            // Ask Gemini to narrate the results
            const narratePrompt =
                `The admin asked: "${question}"\n` +
                `Results:\n${table}\n\n` +
                `Give a friendly, concise summary of these results in 2-4 sentences. Don't list every row — highlight what's interesting. Use emojis naturally.`;
            const summary = await callGemini(table, narratePrompt).catch(() => table);

            await sock.sendMessage(jid, { text: `${summary}\n\n\`\`\`\n${table}\n\`\`\`` }, { quoted: msg });
        } catch (err) {
            await sock.sendMessage(jid, {
                text: `Hmm, I couldn't pull that data 😅 (${err.message}). Try rephrasing?`
            }, { quoted: msg });
        }
        return true;
    }

    // ── ACTION ────────────────────────────────────────────────────────────────
    if (type === 'action') {
        if (!ACTIONS[name]) {
            await sock.sendMessage(jid, {
                text: `I don't know how to "${name}" yet 🤔 Try rephrasing!`
            }, { quoted: msg });
            return true;
        }
        let result;
        try {
            result = await ACTIONS[name](params, sock, jid, blockedSet);
        } catch (err) {
            result = `Something went wrong: ${err.message}`;
        }
        await sock.sendMessage(jid, { text: result }, { quoted: msg });
        return true;
    }

    // ── CODE HELP — Gemini reads the file and writes the change ──────────────
    if (type === 'code_help') {
        const fileContent = topic ? readFile(topic) : null;
        const codePrompt =
            `You are a senior Node.js developer working on ARIA RPG bot.\n` +
            `The admin wants: "${request || instruction}"\n` +
            `${fileContent ? `\nCurrent file (${topic}):\n\`\`\`js\n${fileContent.substring(0, 3000)}\n...\n\`\`\`` : ''}\n\n` +
            `Write the minimal code change needed. Show:\n` +
            `1. What to change (before/after or the new block)\n` +
            `2. Where it goes\n` +
            `3. Any other files affected\n` +
            `Be specific and concise. This is a WhatsApp message so keep it readable.`;

        try {
            const codeReply = await callGemini(instruction, codePrompt);
            await sock.sendMessage(jid, { text: codeReply }, { quoted: msg });
        } catch {
            await sock.sendMessage(jid, {
                text: `Couldn't generate the code change right now 😅 Try again!`
            }, { quoted: msg });
        }
        return true;
    }

    return true;
}

module.exports = { handleAdminCommand };