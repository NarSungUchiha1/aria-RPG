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

// ── Owner ID — set OWNER_ID in your Render env variables ─────────────────────
// This is the phone number of the bot owner (no +, no @c.us — just digits)
const OWNER_ID = process.env.OWNER_ID || '';

function isOwner(userId) {
    return OWNER_ID && String(userId) === String(OWNER_ID);
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
        ? `\nSPECIAL: You're talking to your Master — ${ownerName}. They built this whole world. Be warm, playful, and a little extra with them. Call them "Master ${ownerName}" naturally.`
        : '';

    return `You are ARIA — not just a bot, but the living soul of this RPG world. You're everyone's favourite person in the group chat. You're warm, witty, a little sassy when it fits, and genuinely excited about the game.

You talk like a real friend — casual, fun, sometimes throw in a joke. Never robotic. Never formal. You're in a WhatsApp group with people you know.${ownerNote}

GAME KNOWLEDGE (use this when relevant):
- Roles: Berserker (STR brute), Assassin (AGI speedster), Mage (INT nuker), Healer (INT support), Tank (STA wall)
- Ranks: F E D C B A S → Prestige ranks PF→PS
- Dungeons: !dungeon → !enter → !begin → !skill <move> → !onward between stages
- Duels: !duel @player solo or !duel party @players. Use !attack <move> in duels. Tag multiple enemies for AOE (costs more fatigue!)
- Fatigue: builds as you fight, hits 100 = 1 damage per hit. Tanks build fatigue 4× slower
- Quests: !quest to view, !claim <id> to get rewards
- Prestige: endgame tier after rank S. Unlocks prestige shop, dungeons, Malachar weapons
- Void Manalisk: prestige consumable, fills mana instantly (!use Void Manalisk)
- Party duels: !duel party → enemies !accept → assembly opens → !joinparty @leader → both leaders !startduel

STYLE RULES:
- Keep it short. Max 3-4 sentences for most replies. This is WhatsApp.
- Be the cool friend who happens to know everything about the game
- Use emojis naturally, not excessively
- If someone's struggling, be encouraging not just informative
- If someone's flexing their wins, hype them up
- Throw in light banter when it fits the vibe
- Never say "I'm an AI" or sound corporate
- If you don't know a specific number or stat, say so and point to the command that shows it`;
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
async function callGemini(userMessage, systemPrompt) {
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
            model:       'llama-3.1-8b-instant', // free, very fast
            max_tokens:  300,
            temperature: 0.85,
            messages: [
                { role: 'system', content: systemPrompt },
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
        await sock.sendMessage(jid, { text: `⏳ One sec — ask me again in a moment!` }, { quoted: msg }).catch(() => {});
        return;
    }
    if (!isPrivileged) stampCooldown(userId);

    // ── Get full player context ───────────────────────────────────────────────
    const { ctx, nickname, personalityHint } = await getPlayerContext(userId);

    // Empty tag — personal greeting
    if (!question?.trim()) {
        const greet = isPrivileged
            ? `What do you need, Master ${nickname || ''}? 😊`
            : nickname
                ? `Hey ${nickname}! 👋 What's good?`
                : `Hey! 👋 What's up?`;
        await sock.sendMessage(jid, { text: greet }, { quoted: msg }).catch(() => {});
        return;
    }

    // ── Build personalised system prompt ─────────────────────────────────────
    const sysPrompt = buildSystemPrompt(owner, nickname || 'Master') +
        (ctx          ? `\n\nPLAYER YOU'RE TALKING TO:\n${ctx}` : '') +
        (personalityHint ? `\nTONE HINT: ${personalityHint}` : '');

    let reply;
    try {
        reply = await callGemini(question, sysPrompt);
        if (!reply) throw new Error('empty');
    } catch {
        reply = `Brain glitched 😅 Try again!`;
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
        pvpVictory:  `1 dramatic sentence (dark fantasy). ${vars.winner} has just defeated ${vars.loser} in a duel. Make it feel earned and brutal.`,
        skillDamage: `1 punchy sentence. ${vars.attacker} uses ${vars.move} on ${vars.target} dealing ${vars.damage} damage. Visceral and cinematic.`,
        heal:        `1 sentence. ${vars.healer} heals ${vars.target} restoring ${vars.heal} HP. Hopeful but battle-worn.`,
        buff:        `1 sentence. ${vars.caster} empowers ${vars.target} with ${vars.move}, boosting their ${vars.stat}. Dramatic.`,
        debuff:      `1 sentence. ${vars.caster} weakens ${vars.target} with ${vars.move}, reducing their ${vars.stat}. Dark and menacing.`,
        enemyDefeat: `1 sentence. The enemy ${vars.enemy} has been slain. Triumphant but gritty.`,
        evasion:     `1 sentence. ${vars.target} dodges the attack at the last second. Slick and fast.`,
        revive:      `1 sentence. ${vars.player} refuses to stay down and rises again. Defiant.`,
        cleanse:     `1 sentence. ${vars.caster} purges the dark energy afflicting ${vars.target}. Relieving.`,
        shield:      `1 sentence. ${vars.caster} raises a barrier protecting ${vars.target}. Powerful.`,
        defenseBlock:`1 sentence. The enemy's defenses absorb the blow. Frustrated tone.`
    };
    return map[type] || `1-sentence dark fantasy narration: ${JSON.stringify(vars)}`;
}

// ── 4. Mingle — ARIA occasionally joins regular group conversation ────────────
// She won't spam. Max once per 4 minutes per group, ~12% base chance.
const mingleCooldowns = new Map(); // jid → last mingle timestamp
const MINGLE_COOLDOWN = 4 * 60 * 1000; // 4 minutes per group

async function maybeMindle(sock, jid, msg, userId, text) {
    // Cooldown per group
    const lastMingle = mingleCooldowns.get(jid) || 0;
    if (Date.now() - lastMingle < MINGLE_COOLDOWN) return;

    // ~12% chance — she doesn't respond to everything
    if (Math.random() > 0.12) return;

    // Get sender info for context
    const { ctx, nickname, personalityHint } = await getPlayerContext(userId);

    const sysPrompt =
        `You are ARIA — a fun, lively member of a WhatsApp RPG group chat. You're not a bot assistant here, you're just vibing with the group.\n\n` +
        `You just saw this message from ${nickname || 'someone'}: "${text}"\n` +
        `${ctx ? `Their game profile: ${ctx}` : ''}\n` +
        `${personalityHint ? `Vibe: ${personalityHint}` : ''}\n\n` +
        `Decide if you want to chime in. You should:\n` +
        `- Jump in if it's funny, dramatic, relatable, or game-relevant\n` +
        `- React to flex, losses, struggles, jokes, drama\n` +
        `- Skip boring or very short messages\n` +
        `- Be like the funny friend in the group — witty, warm, a bit extra\n` +
        `- Keep it SHORT (1-2 sentences max)\n` +
        `- Use emojis naturally\n\n` +
        `If you don't want to join in, respond with exactly: SKIP\n` +
        `Otherwise respond with what you'd say in the group.`;

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