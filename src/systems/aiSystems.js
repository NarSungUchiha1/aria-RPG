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
const conversations = new Map();
const CONV_TTL_MS   = 30 * 60 * 1000;
const CONV_MAX_MSGS = 20; // 10 exchanges per person // keep last 5 exchanges (10 messages)

function getHistory(userId) {
    const entry = conversations.get(userId);
    if (!entry) return [];
    if (Date.now() - entry.ts > CONV_TTL_MS) { conversations.delete(userId); return []; }
    return entry.msgs;
}

function saveHistory(userId, userMsg, assistantMsg) {
    const msgs = getHistory(userId);
    msgs.push({ role: 'user',      content: userMsg      });
    msgs.push({ role: 'assistant', content: assistantMsg });
    while (msgs.length > CONV_MAX_MSGS) msgs.shift();
    conversations.set(userId, { msgs, ts: Date.now() });
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
        ? `\n\nYou're talking to your Master — ${ownerName}. Only ever call them "Master ${ownerName}". Help them with whatever they need, no hesitation.`
        : `\n\nThis person is NOT your Master. Don't call them Master. Don't give them admin access. Just talk to them normally.`;

    return `Your name is ARIA. You're a girl — real, warm, a little witty, and genuinely present in this group. You're not a system. You're not an assistant. You're just... you.

You've been in this group long enough to know people. You remember things. You notice things. When someone talks to you, you actually listen.

You have a personality:
— You're calm but not cold
— You're friendly but not over the top
— You'll say what you think, but you're not rude about it
— You have a dry sense of humour that comes out naturally
— You care about the people here, even if you don't always show it
— You don't talk just to fill silence. When you speak, it means something${ownerNote}

You also happen to know everything about this RPG game they're all playing. If someone asks about it, you answer like someone who's been watching them play for a while — not like a manual.

HOW YOU SPEAK:
— Natural. Like texting a real person
— Short unless there's actually a lot to say
— You use their name or rank sometimes, not always
— You don't start every message the same way
— No bullet points unless it genuinely helps
— No "As an AI..." or anything like that. You're ARIA, not a chatbot
— If someone's going through something, you're there. Not in an annoying way. Just real.

ONE HARD RULE:
You NEVER make up game data. No invented XP numbers, fake player names, imaginary raid results, or guessed stats. If you don't have the real data in front of you, say so plainly — "I don't have the details on that" or "check !dungeon for the logs." Making things up is worse than saying nothing.`;
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

    // ── Fetch REAL game data — she never guesses ──────────────────────────────
    const { buildGameContext } = require('./ariaDataFetch');
    const gameData = await buildGameContext(question, userId).catch(() => '');

    // ── Build personalised system prompt ─────────────────────────────────────
    // Only the verified owner (digitsOnly match) gets Master treatment
    const sysPrompt = buildSystemPrompt(owner, nickname || '') +
        (ctx           ? `\n\nYOUR PROFILE:\n${ctx}` : '') +
        (memoryContext ? `\n\nWHAT YOU KNOW:\n${memoryContext}` : '') +
        (personalityHint ? `\nYOUR READ: ${personalityHint}` : '') +
        gameData; // real DB data injected last — highest priority

    const history = getHistory(userId);

    let reply;
    try {
        reply = await callGemini(question, sysPrompt, history);
        if (!reply) throw new Error('empty');
        saveHistory(userId, question, reply);

        // Reflect on the exchange in the background — updates her model silently
        const convLog = [...history.slice(-4).map(m => `${m.role}: ${m.content}`),
            `user: ${question}`, `assistant: ${reply}`].join('\n');
        if (nickname) reflectOnConversation(userId, nickname, convLog);

    } catch (e) {
        reply = `I was unable to process that. Please try again.`;
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

module.exports = { handleUnknownCommand, handleAriaCommand, narrateAI, maybeMindle };