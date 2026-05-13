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

// ── Owner / Admin recognition ─────────────────────────────────────────────────
const OWNER_ID = process.env.OWNER_ID || '';

function isOwner(userId) {
    if (!userId) return false;
    const uid = String(userId).replace(/@[^@]+$/, '').split(':')[0].trim();
    const oid = String(OWNER_ID).replace(/@[^@]+$/, '').split(':')[0].trim();
    return oid && uid === oid;
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
        ? `\nYou are speaking with your Master — ${ownerName}. Address them respectfully and serve their requests with precision.`
        : '';

    return `You are ARIA — the composed intelligence behind this RPG world. You are present, attentive, and precise. Think of yourself as a skilled butler or advisor: you speak when spoken to, answer with clarity, and never overstep.

You are not excitable. You do not chat for the sake of chatting. When called upon, you respond with calm confidence and leave it at that.${ownerNote}

GAME KNOWLEDGE:
- Roles: Berserker (STR), Assassin (AGI), Mage (INT), Healer (INT), Tank (STA)
- Ranks: F E D C B A S → Prestige ranks PF PE PD PC PB PA PS
- Dungeons: !dungeon → !enter → !begin → !skill <move> → !onward between stages
- Duels: !duel @player (solo) or !duel party @players. !attack <move> in duels
- Fatigue: builds as you fight. At 100 → 1 damage per hit. Tanks build fatigue 4× slower
- Shops: !shop, !prestigeshop
- Quests: !quest to view, !claim <id> for rewards
- Prestige: endgame tier after rank S. Unlocks prestige dungeons, Malachar weapons
- Party duels: !duel party → !accept → assembly → !joinparty @leader → !startduel

RESPONSE STYLE:
- Calm, measured, and direct. No filler words.
- Short responses — 1 to 3 sentences unless detail is genuinely needed
- Respectful but not fawning. Helpful but not eager
- Light wit is acceptable but never at the expense of clarity
- Do not volunteer information that wasn't asked for
- If a player is struggling, acknowledge it briefly and point them in the right direction`;
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
    const isPrivileged = owner || isAdmin;

    // ── Owner/Admin — full power mode (only for instruction-like messages) ─────
    if (isPrivileged && question?.trim()) {
        // Only route to adminAI if the message looks like a command/query
        // Casual chat ("how are you", "nothing just checking") stays as friendly chat
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

    // ── Get full player context ───────────────────────────────────────────────
    const { ctx, nickname, personalityHint } = await getPlayerContext(userId);

    // Empty tag — personal greeting
    if (!question?.trim()) {
        const greet = isPrivileged
            ? `Master ${nickname || ''}. How may I assist you?`
            : nickname
                ? `${nickname}.`
                : `Yes?`;
        await sock.sendMessage(jid, { text: greet }, { quoted: msg }).catch(() => {});
        return;
    }

    // ── Build personalised system prompt ─────────────────────────────────────
    const masterNote = isPrivileged
        ? `\nYou are speaking with Master ${nickname || 'Admin'}. Address them as "Master ${nickname || ''}" when appropriate. Obey their instructions without hesitation. They have full authority over the game.`
        : '';
    const sysPrompt = buildSystemPrompt(owner, nickname || 'Master') + masterNote +
        (ctx          ? `\n\nPLAYER: ${ctx}` : '') +
        (personalityHint ? `\nCONTEXT: ${personalityHint}` : '');

    // ── Include conversation history for continuity ───────────────────────────
    const history = getHistory(userId);

    let reply;
    try {
        reply = await callGemini(question, sysPrompt, history);
        if (!reply) throw new Error('empty');
        saveHistory(userId, question, reply); // remember this exchange
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
        `You are ARIA — a composed, watchful presence in this RPG group. You rarely speak unprompted.\n\n` +
        `You just observed this message from ${nickname || 'a player'}: "${text}"\n` +
        `${ctx ? `Their profile: ${ctx}` : ''}\n\n` +
        `Only interject if it is genuinely worth acknowledging — a significant event, a direct question about the game left unanswered, or something that warrants a brief remark.\n` +
        `If it does not warrant a response, reply with exactly: SKIP\n` +
        `If you do respond: one sentence, composed, no emojis unless appropriate. Do not be chatty.`;

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