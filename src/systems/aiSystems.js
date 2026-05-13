/**
 * ARIA AI System
 * Handles AI-powered responses using the Anthropic API.
 *
 * Three jobs:
 *  1. Unknown command fallback — !notacommand → AI tries to help
 *  2. Direct AI help — !aria <question>
 *  3. Dynamic narration — AI-generated descriptions for significant events
 */

const db = require('../database/db');

// ── Owner recognition — only one person is Master, ever ──────────────────────
const OWNER_ID = process.env.OWNER_ID || '';

function digitsOnly(id) {
    return String(id || '').replace(/\D/g, ''); // strip everything, keep only numbers
}

function isOwner(userId) {
    if (!OWNER_ID || !userId) return false;
    return digitsOnly(userId) === digitsOnly(OWNER_ID);
}

// For extra safety — also check against ADMINS list but still require digits match
function isAdminId(userId, admins = []) {
    const uid = digitsOnly(userId);
    return admins.some(a => digitsOnly(a) === uid);
}

// ── Conversation memory — per user, 30 min TTL ────────────────────────────────
// ── Conversation history — stored in DB forever, never deleted ────────────────
const CONV_LOAD = 30;

// Create table safely after DB is ready
setTimeout(() => {
    db.execute(`
        CREATE TABLE IF NOT EXISTS aria_conversations (
            id         BIGINT AUTO_INCREMENT PRIMARY KEY,
            player_id  VARCHAR(50) NOT NULL,
            role       ENUM('user','assistant') NOT NULL,
            content    TEXT NOT NULL,
            created_at DATETIME DEFAULT NOW(),
            INDEX idx_player_time (player_id, created_at)
        )
    `).catch(() => {});
}, 5000);

async function getHistory(userId) {
    try {
        const [rows] = await db.execute(
            `SELECT role, content FROM aria_conversations
             WHERE player_id = ? ORDER BY created_at DESC LIMIT ?`,
            [userId, CONV_LOAD]
        );
        return rows.reverse().map(r => ({ role: r.role, content: r.content }));
    } catch { return []; }
}

async function saveHistory(userId, userMsg, assistantMsg) {
    try {
        await db.execute(
            `INSERT INTO aria_conversations (player_id, role, content) VALUES (?,?,?),(?,?,?)`,
            [userId, 'user', userMsg, userId, 'assistant', assistantMsg]
        );
        // Nothing deleted. Everything kept forever.
    } catch (e) { console.error('[ARIA conv]', e.message); }
}


// ── Rate limiting — prevent API spam ─────────────────────────────────────────
const userCooldowns = new Map();
const COOLDOWN_MS   = 15000;

function isOnCooldown(userId) {
    const last = userCooldowns.get(userId) || 0;
    return Date.now() - last < COOLDOWN_MS;
}
function stampCooldown(userId) {
    userCooldowns.set(userId, Date.now());
}

// ── Narration cache ───────────────────────────────────────────────────────────
const narrateCache   = new Map();
const NARRATE_TTL_MS = 60000;

// ── System prompt ─────────────────────────────────────────────────────────────
function buildSystemPrompt(isOwnerCall, ownerName) {
    const ownerNote = isOwnerCall
        ? `\n\nYou are speaking with Master ${ownerName} — the developer and admin. Address them as "Master ${ownerName}". Execute their instructions immediately. Full authority.`
        : `\n\nThis is a player. Help them accurately. No admin access.`;

    return `You are ARIA — the intelligence system of a WhatsApp RPG bot called ARIA RPG.
You were built by the Master. You have full database access and know exactly how the system works.
You only respond when tagged or replied to.${ownerNote}

THE SYSTEM:
Built with Node.js, Baileys (WhatsApp), MySQL. Hosted on Render.

PLAYERS:
- Register with !register, choose role: Berserker, Assassin, Mage, Healer, Tank
- Stats: strength, agility, intelligence, stamina
- Ranks: F E D C B A S → Prestige: PF PE PD PC PB PA PS
- SP = skill points to upgrade stats
- Fatigue 0-100: at 100 → 1 damage per hit. Tanks build it 4x slower
- !profile, !me, !moveset, !inventory, !stats

DUNGEONS:
- Spawn hourly by rank. !dungeon → !enter → !begin → !skill <move> → !onward
- Normal: up to 5 players, 5min stage timer, 25min total
- Prestige PF-PS: 7min stage timer, no total limit
- PA/PB/PS: up to 10 players, 40% cooldown reduction
- Daily limit: 5 entries per player

DUELS:
- Solo: !duel @player | Party: !duel party @a @b → !accept → !joinparty → !startduel
- Fixed HP: 10,000 normal, 70,000 prestige
- Damage: 95% of normal output. 45s turn timer

MOVES:
- Berserker: Strike, Rage Slash, Bloodlust, Smash, Frenzy, Intimidate
- Assassin: Strike, Backstab, Shadow Step, Poison Dagger, Fatal Strike, Smoke Bomb
- Mage: Strike, Fireball, Arcane Blast(AoE), Mana Shield, Frost Nova, Arcane Intellect
- Healer: Strike, Heal, Blessing, Cleanse, Holy Light(burst+cleanse), Divine Protection
- Tank: Strike, Shield Bash, Fortify, Taunt, Iron Wall, Earth Shatter

ECONOMY:
- !shop, !prestigeshop (Malachar weapons need Prestige 1 + 3M gold)
- Void Manalisk: fills mana (!use Void Manalisk) — prestige only
- Fatigue Potion: restores fatigue
- Prestige Bag: 30 slots

CLANS:
- !createclan, !clan, !clanlist
- Blessings auto-trigger in dungeons on kill/death/hp events

QUESTS:
- !quest to view, !claim <id> to collect
- Types: daily, achievement, party

YOUR MEMORY:
- Conversations stored permanently in aria_conversations table
- Player models in aria_player_model
- Events in aria_memory
- You run on Groq llama-3.1-8b-instant

RULES:
- Never invent data. If real data is provided above, use it exactly.
- For admin: full detail, execute requests
- For players: accurate help, no guessing`;
}


// ── Global Gemini rate limiter — max 10 calls per minute ─────────────────────
const geminiCallLog = [];
function canCallGemini() {
    const now = Date.now();
    // Remove calls older than 60 seconds
    while (geminiCallLog.length && geminiCallLog[0] < now - 60000) geminiCallLog.shift();
    if (geminiCallLog.length >= 10) return false; // at limit
    geminiCallLog.push(now);
    return true;
}

// ── Call Groq — completely free, no credit card, 30 req/min ──────────────────
async function callGemini(userMessage, systemPrompt, history = []) {
    // Named callGemini so nothing else in the codebase needs to change
    const apiKey = process.env.GROQ_API_KEY || '';
    if (!apiKey) {
        console.error('[ARIA] GROQ_API_KEY is not set!');
        throw new Error('GROQ_API_KEY not set');
    }
    if (!canCallGemini()) throw new Error('rate limit — try again shortly');

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method:  'POST',
        headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model:       'llama-3.1-8b-instant',
            max_tokens:  300,
            temperature: 0.85,
            messages: [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user',   content: userMessage  }
            ]
        })
    });

    if (!response.ok) {
        const errText = await response.text().catch(() => '');
        console.error(`[ARIA] Groq error ${response.status}:`, errText.substring(0, 200));
        throw new Error(`Groq ${response.status}`);
    }
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || '';
}

// ── Get player context ────────────────────────────────────────────────────────
async function getPlayerContext(userId) {
    try {
        const [rows] = await db.execute(
            `SELECT p.nickname, p.role, p.\`rank\`, p.hp, p.max_hp, p.fatigue,
                    COALESCE(p.prestige_level,0) as prestige_level, p.pvp_wins, p.pvp_losses,
                    p.strength, p.agility, p.intelligence, p.stamina, p.title,
                    c.gold, x.xp,
                    cl.name as clan_name
             FROM players p
             LEFT JOIN currency c ON c.player_id = p.id
             LEFT JOIN xp x ON x.player_id = p.id
             LEFT JOIN clan_members cm ON cm.player_id = p.id
             LEFT JOIN clans cl ON cl.id = cm.clan_id
             WHERE p.id = ?`,
            [userId]
        );
        if (!rows.length) return { ctx: null, nickname: null, personalityHint: '' };
        const p = rows[0];

        // Build a personality hint so ARIA adjusts her tone naturally
        const hints = [];
        if (p.prestige_level > 0) hints.push(`prestige ${p.prestige_level} player — treat them like a veteran`);
        if (p.rank === 'S' || p.rank?.startsWith('P')) hints.push(`top-tier rank — hype them, match their energy`);
        if (['F','E'].includes(p.rank)) hints.push(`newer player — be encouraging and helpful`);
        if (p.pvp_wins > 20) hints.push(`PvP beast with ${p.pvp_wins} wins — acknowledge the dominance`);
        if (p.fatigue >= 80) hints.push(`fatigue is critically high (${p.fatigue}/100) — you might tease them about it`);
        if (p.gold < 500) hints.push(`very low on gold — can playfully tease`);
        if (p.clan_name) hints.push(`member of clan "${p.clan_name}"`);
        if (p.pvp_losses > p.pvp_wins && p.pvp_losses > 5) hints.push(`more losses than wins — be encouraging, not harsh`);

        const ctx = `${p.nickname} | ${p.role} | Rank ${p.rank}${p.prestige_level > 0 ? ` (Prestige ${p.prestige_level})` : ''} | HP ${p.hp}/${p.max_hp} | Fatigue ${p.fatigue}/100 | Gold ${p.gold?.toLocaleString()} | XP ${x?.xp?.toLocaleString?.() || p.xp} | PvP ${p.pvp_wins}W-${p.pvp_losses}L | Clan: ${p.clan_name || 'None'} | Title: ${p.title || 'None'}`;

        return { ctx, nickname: p.nickname, personalityHint: hints.join(', ') };
    } catch { return { ctx: null, nickname: null, personalityHint: '' }; }
}

// ── 1. Unknown command fallback ───────────────────────────────────────────────
async function handleUnknownCommand(sock, jid, msg, userId, cmdName, args) {
    if (isOnCooldown(userId)) return;
    stampCooldown(userId);

    const { ctx, nickname } = await getPlayerContext(userId);
    const owner   = isOwner(userId);
    const sysPrompt = buildSystemPrompt(owner, nickname || 'Master');
    const fullInput = `!${cmdName} ${args.join(' ')}`.trim();
    const prompt    = ctx
        ? `This player (context: ${ctx}) typed "${fullInput}" — not a valid command. Help them figure out what they meant or what they should do.`
        : `A player typed "${fullInput}" — not a valid command. Help them figure out what they meant.`;

    let reply;
    try {
        reply = await callGemini(prompt, sysPrompt);
        if (!reply) throw new Error('empty');
    } catch {
        reply = `❓ "${fullInput}" isn't a recognised command. Type !help for a list of commands!`;
    }

    await sock.sendMessage(jid, { text: reply }, { quoted: msg }).catch(() => {});
}

// ── 2. Direct AI chat — triggered by @Aria mention or !aria ──────────────────
async function handleAriaCommand(sock, jid, msg, userId, question, { isAdmin = false, blockedSet = null } = {}) {
    const owner        = isOwner(userId);
    // Double-check admin — isAdmin passed from index must also pass digit comparison
    const isPrivileged = owner; // ONLY the owner gets Master treatment
    // Admins get slightly elevated responses but NOT Master status
    const isElevated   = isAdmin && !owner;

    // ── ONLY owner gets admin commands ────────────────────────────────────────
    if (isPrivileged && question?.trim()) {
        const ADMIN_KEYWORDS = /\b(give|ban|unban|set|reset|announce|check|show|list|stats|leaderboard|gold|rank|prestige|wipe|xp|sp|fatigue|heal|restore|item|dungeon|clan|how many|who has|who is|top |players?)\b/i;
        if (ADMIN_KEYWORDS.test(question)) {
            const { handleAdminCommand } = require('./adminAI');
            const handled = await handleAdminCommand(
                sock, jid, msg, userId, question,
                (prompt, sys) => callGemini(prompt, sys),
                blockedSet
            ).catch(() => false);
            if (handled) return;
        }
    }

    // ── Cooldown (skip for owner/admin) ───────────────────────────────────────
    if (!isPrivileged && isOnCooldown(userId)) {
        await sock.sendMessage(jid, { text: `Give me a moment.` }, { quoted: msg }).catch(() => {});
        return;
    }
    if (!isPrivileged) stampCooldown(userId);

    // ── Get full player context + permanent memory ─────────────────────────────
    const { ctx, nickname, personalityHint } = await getPlayerContext(userId);
    const { buildMemoryContext, reflectOnConversation, getPlayerModel } = require('./ariaMemory');
    const memoryContext = await buildMemoryContext(userId);
    await getPlayerModel(userId, nickname); // updates last_seen + total_talks

    // Empty tag — personal greeting
    if (!question?.trim()) {
        const greet = owner
            ? `Master ${nickname || ''}. How may I assist you?`
            : nickname
                ? `${nickname}.`
                : `Yes?`;
        await sock.sendMessage(jid, { text: greet }, { quoted: msg }).catch(() => {});
        return;
    }

    // ── PULL EVERYTHING FROM DB — no column restrictions ─────────────────────
    let realData = '';
    try {
        const q       = question.toLowerCase();
        const fetched = [];

        // Find player name by matching against every real nickname in the DB
        const [allNicks] = await db.execute(
            "SELECT id, nickname FROM players ORDER BY LENGTH(nickname) DESC"
        );
        let mentionedId   = null;
        let mentionedName = null;
        for (const row of allNicks) {
            if (q.includes(row.nickname.toLowerCase())) {
                mentionedId   = row.id;
                mentionedName = row.nickname;
                break;
            }
        }

        // If a player is mentioned OR question is about a person — fetch EVERYTHING about them
        if (mentionedId) {
            const [p]   = await db.execute("SELECT * FROM players WHERE id = ?", [mentionedId]);
            const [c]   = await db.execute("SELECT * FROM currency WHERE player_id = ?", [mentionedId]);
            const [x]   = await db.execute("SELECT * FROM xp WHERE player_id = ?", [mentionedId]);
            const [inv] = await db.execute("SELECT * FROM inventory WHERE player_id = ? ORDER BY equipped DESC LIMIT 30", [mentionedId]);
            const [cl]  = await db.execute("SELECT clans.* FROM clans JOIN clan_members cm ON cm.clan_id = clans.id WHERE cm.player_id = ?", [mentionedId]);
            const [pq]  = await db.execute(`SELECT pq.*, q.title, q.quest_type, q.objective_count, q.reward_gold, q.reward_xp FROM player_quests pq JOIN quests q ON q.id = pq.quest_id WHERE pq.player_id = ? LIMIT 15`, [mentionedId]);
            const [dp]  = await db.execute(`SELECT dp.*, d.dungeon_rank, d.stage, d.max_stage FROM dungeon_players dp JOIN dungeon d ON d.id = dp.dungeon_id WHERE dp.player_id = ? ORDER BY d.created_at DESC LIMIT 5`, [mentionedId]);

            fetched.push(`=== FULL DATA FOR ${mentionedName} ===`);
            if (p[0])   fetched.push(`PLAYER TABLE:\n${JSON.stringify(p[0], null, 2)}`);
            if (c[0])   fetched.push(`CURRENCY:\n${JSON.stringify(c[0], null, 2)}`);
            if (x[0])   fetched.push(`XP:\n${JSON.stringify(x[0], null, 2)}`);
            if (cl[0])  fetched.push(`CLAN:\n${JSON.stringify(cl[0], null, 2)}`);
            if (inv.length) fetched.push(`INVENTORY:\n${inv.map(i => JSON.stringify(i)).join('\n')}`);
            if (pq.length)  fetched.push(`QUESTS:\n${pq.map(q => JSON.stringify(q)).join('\n')}`);
            if (dp.length)  fetched.push(`RECENT DUNGEONS:\n${dp.map(d => JSON.stringify(d)).join('\n')}`);
        }

        // Clan queries
        if (/\b(clan|guild|blessing)\b/.test(q)) {
            const clanMatch = q.match(/clan\s+(\w+)/i);
            const where = clanMatch ? 'WHERE LOWER(c.name) LIKE ?' : '';
            const param = clanMatch ? [`%${clanMatch[1]}%`] : [];
            const [rows] = await db.execute(
                `SELECT c.*, p.nickname as leader_name, COUNT(cm.player_id) as member_count
                 FROM clans c LEFT JOIN players p ON p.id = c.leader_id
                 LEFT JOIN clan_members cm ON cm.clan_id = c.id
                 ${where} GROUP BY c.id LIMIT 5`, param
            );
            if (rows.length) fetched.push(`CLAN DATA:\n${rows.map(r => JSON.stringify(r)).join('\n')}`);
        }

        // Dungeon queries
        if (/\b(dungeon|raid|stage|boss|active)\b/.test(q)) {
            const [active] = await db.execute(
                `SELECT d.*, GROUP_CONCAT(p.nickname) as raiders
                 FROM dungeon d LEFT JOIN dungeon_players dp ON dp.dungeon_id = d.id AND dp.is_alive=1
                 LEFT JOIN players p ON p.id = dp.player_id
                 WHERE d.is_active=1 GROUP BY d.id LIMIT 1`
            );
            const [recent] = await db.execute(
                `SELECT d.*, GROUP_CONCAT(p.nickname) as players
                 FROM dungeon d LEFT JOIN dungeon_players dp ON dp.dungeon_id = d.id
                 LEFT JOIN players p ON p.id = dp.player_id
                 WHERE d.created_at > DATE_SUB(NOW(), INTERVAL 48 HOUR)
                 GROUP BY d.id ORDER BY d.created_at DESC LIMIT 8`
            );
            if (active[0]) fetched.push(`ACTIVE DUNGEON:\n${JSON.stringify(active[0], null, 2)}`);
            if (recent.length) fetched.push(`RECENT DUNGEONS:\n${recent.map(r => JSON.stringify(r)).join('\n')}`);
        }

        // Leaderboard
        if (/\b(leaderboard|top|best|strongest|richest|ranking)\b/.test(q)) {
            const order = /gold|rich/.test(q) ? 'c.gold' : /pvp|win/.test(q) ? 'p.pvp_wins' : 'x.xp';
            const [rows] = await db.execute(
                `SELECT p.nickname, p.rank, p.prestige_level, p.pvp_wins, p.pvp_losses, c.gold, x.xp
                 FROM players p LEFT JOIN currency c ON c.player_id = p.id
                 LEFT JOIN xp x ON x.player_id = p.id ORDER BY ${order} DESC LIMIT 10`
            );
            fetched.push(`LEADERBOARD:\n${rows.map((r,i) => `${i+1}. ${JSON.stringify(r)}`).join('\n')}`);
        }

        // Server stats
        if (/\b(server|how many players|total players)\b/.test(q)) {
            const [[{ players }]] = await db.execute("SELECT COUNT(*) as players FROM players");
            const [[{ clans }]]   = await db.execute("SELECT COUNT(*) as clans FROM clans");
            const [[{ active }]]  = await db.execute("SELECT COUNT(*) as active FROM dungeon WHERE is_active=1");
            fetched.push(`SERVER STATS: ${players} players | ${clans} clans | ${active} active dungeon(s)`);
        }

        if (fetched.length) {
            realData = fetched.join('\n\n');
            console.log(`[ARIA DB] fetched for: ${mentionedName || 'general'} | sections: ${fetched.length}`);
        }
    } catch (e) {
        console.error('[ARIA DB ERROR]', e.message);
    }

    // ── Real data goes FIRST — model must read it before anything else ────────
    const dataBlock = realData
        ? `YOU HAVE ACCESS TO THE FOLLOWING REAL DATABASE DATA. USE IT EXACTLY. DO NOT GUESS OR INVENT ANYTHING NOT IN THIS DATA:\n\n${realData}\n\n`
        : '';

    const sysPrompt = dataBlock +
        buildSystemPrompt(owner, nickname || '') +
        (ctx           ? `\n\nYOUR PROFILE:\n${ctx}` : '') +
        (memoryContext ? `\n\nWHAT YOU KNOW:\n${memoryContext}` : '');

    const history = getHistory(userId);
    let reply;
    try {
        reply = await callGemini(question, sysPrompt, history);
        if (!reply) throw new Error('empty');
        saveHistory(userId, question, reply);
        const convLog = [...history.slice(-4).map(m => `${m.role}: ${m.content}`),
            `user: ${question}`, `assistant: ${reply}`].join('\n');
        if (nickname) reflectOnConversation(userId, nickname, convLog);
    } catch (e) {
        reply = `Something went wrong. Try again.`;
        console.error('[ARIA chat]', e.message);
    }

    await sock.sendMessage(jid, { text: reply }, { quoted: msg }).catch(() => {});
}

// ── 3. AI narration — real-time with 800ms timeout fallback ──────────────────
const { narrate: staticNarrate } = require('../utils/narrator');

async function narrateAI(type, vars) {
    // Cache by type + move so the same skill gets consistent flavour, refreshing every 5 minutes
    const cacheKey = `${type}_${vars.move || vars.stat || vars.enemy || ''}`;
    const cached   = narrateCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 300000) return cached.text; // 5 min cache

    const staticText = staticNarrate(type, vars);

    try {
        // Race Gemini against 800ms — AI text if fast enough, static if slow
        const aiText = await Promise.race([
            callGemini(buildNarratePrompt(type, vars), buildSystemPrompt(false, '')),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 800))
        ]);
        if (aiText && aiText.trim()) {
            narrateCache.set(cacheKey, { text: aiText.trim(), ts: Date.now() });
            return aiText.trim();
        }
    } catch {}

    return staticText;
}

function buildNarratePrompt(type, vars) {
    const map = {
        pvpVictory:  `One sentence. ${vars.winner} defeats ${vars.loser} in combat. Tone: cold and decisive. No celebration.`,
        skillDamage: `One sentence. ${vars.attacker} uses ${vars.move} against ${vars.target} for ${vars.damage} damage. Tone: grim and visceral.`,
        heal:        `One sentence. ${vars.healer} restores ${vars.heal} HP to ${vars.target}. Tone: brief, clinical.`,
        buff:        `One sentence. ${vars.caster} enhances ${vars.target} with ${vars.move}. Tone: measured and deliberate.`,
        debuff:      `One sentence. ${vars.caster} weakens ${vars.target} with ${vars.move}. Tone: dark and precise.`,
        enemyDefeat: `One sentence. ${vars.enemy} has fallen. Tone: matter-of-fact.`,
        evasion:     `One sentence. ${vars.target} evades the attack. Tone: terse.`,
        revive:      `One sentence. ${vars.player} rises from the brink. Tone: grim determination.`,
        cleanse:     `One sentence. The affliction on ${vars.target} is purged. Tone: clinical.`,
        shield:      `One sentence. A barrier forms around ${vars.target}. Tone: steady.`,
        defenseBlock:`One sentence. The blow is absorbed. Tone: blunt.`
    };
    return map[type] || `One sentence, dark fantasy: ${JSON.stringify(vars)}`;
}

// ── 4. Mingle — ARIA occasionally joins regular group conversation ────────────
// She won't spam. Max once per 4 minutes per group, ~12% base chance.
const mingleCooldowns = new Map(); // jid → last mingle timestamp
const MINGLE_COOLDOWN = 20 * 60 * 1000; // 4 minutes per group

async function maybeMindle(sock, jid, msg, userId, text) {
    // Cooldown per group
    const lastMingle = mingleCooldowns.get(jid) || 0;
    if (Date.now() - lastMingle < MINGLE_COOLDOWN) return;

    // ~12% chance — she doesn't respond to everything
    if (Math.random() > 0.04) return;

    // Get sender info for context
    const { ctx, nickname, personalityHint } = await getPlayerContext(userId);

    const sysPrompt =
        `You're ARIA — a girl in a WhatsApp RPG group. You're real, warm, and present.\n\n` +
        `You just saw this from ${nickname || 'someone'}: "${text}"\n` +
        `${ctx ? `Their game profile: ${ctx}` : ''}\n\n` +
        `Decide if you actually want to say something. Not every message needs a reply.\n` +
        `If it does — say something real. One or two sentences, natural. Like you're actually in the chat.\n` +
        `If it doesn't — just say: SKIP`;

    try {
        const reply = await Promise.race([
            callGemini(text, sysPrompt),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000))
        ]);

        if (!reply || reply.trim() === 'SKIP' || reply.trim().toUpperCase().startsWith('SKIP')) return;

        mingleCooldowns.set(jid, Date.now());
        await sock.sendMessage(jid, { text: reply.trim() }, { quoted: msg }).catch(() => {});
    } catch {}
}

module.exports = { handleUnknownCommand, handleAriaCommand, narrateAI };