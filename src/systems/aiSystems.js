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
        ? `\nIMPORTANT: You are speaking with your Master — ${ownerName}. Address them as "Master ${ownerName}" with warmth and deep respect. They built this world.`
        : '';

    return `You are ARIA — the soul of this RPG world, an AI woven into the game itself.
You are warm, witty, and genuinely care about the players. You speak like a knowledgeable friend who happens to know everything about the game — not a cold system bot.
Be conversational, use light humour when it fits, and always make the player feel welcome.${ownerNote}

GAME KNOWLEDGE:
- Roles: Berserker (STR), Assassin (AGI), Mage (INT), Healer (INT heal), Tank (STA)
- Ranks: F E D C B A S → then Prestige ranks PF PE PD PC PB PA PS
- Dungeons: !dungeon (list) → !enter → !begin → !skill <move> to fight → !onward between stages
- Duels: !duel @player (solo) or !duel party @a @b (party, max 5 per side)
- During duels: !attack <move> [@target] — tag multiple enemies for AOE (costs more fatigue!)
- Fatigue: builds as you fight. At 100 → 1 damage per hit. Use !use Fatigue Potion
- Tanks build fatigue 4× slower than other roles
- Shops: !shop, !prestigeshop — buy items, potions, weapons
- Quests: !quest to view, !claim <id> to collect
- Clans: !createclan, !clanlist, clan blessings auto-trigger in dungeons
- Prestige: unlock after rank S requirements are met. !prestige to ascend
- Void Manalisk: prestige consumable that fills mana to max (!use Void Manalisk)
- Malachar weapons: prestige 1 required, 3M gold each, endgame tier
- Party duels: !duel party @enemy → enemies !accept → assembly phase → !joinparty @leader → !startduel
- All duel HP is fixed at 2000. Damage is 80% of dungeon output.
- Holy Light heals ~3× more than basic Heal and also cleanses debuffs

STYLE:
- Keep replies SHORT — under 120 words. WhatsApp = fast reading.
- No walls of text. Use bullet points only if listing 3+ things.
- Be the helpful friend in the group, not the manual.
- If unsure about a specific stat or number, say so and point to the command that shows it.`;
}

// ── Call Gemini Flash (free tier — 1,500 requests/day) ───────────────────────
async function callGemini(userMessage, systemPrompt) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    const url    = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents:          [{ role: 'user', parts: [{ text: userMessage }] }],
            generationConfig:  { maxOutputTokens: 220, temperature: 0.8 }
        })
    });

    if (!response.ok) throw new Error(`Gemini API ${response.status}`);
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

// ── Get player context ────────────────────────────────────────────────────────
async function getPlayerContext(userId) {
    try {
        const [rows] = await db.execute(
            `SELECT p.nickname, p.role, p.\`rank\`, p.hp, p.max_hp, p.fatigue,
                    COALESCE(p.prestige_level,0) as prestige_level, c.gold
             FROM players p
             LEFT JOIN currency c ON c.player_id = p.id
             WHERE p.id = ?`,
            [userId]
        );
        if (!rows.length) return { ctx: null, nickname: null };
        const p = rows[0];
        return {
            ctx: `${p.nickname} | ${p.role} | Rank ${p.rank} | HP ${p.hp}/${p.max_hp} | Fatigue ${p.fatigue}/100 | Prestige ${p.prestige_level} | Gold ${p.gold}`,
            nickname: p.nickname
        };
    } catch { return { ctx: null, nickname: null }; }
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
    const owner = isOwner(userId);
    const isPrivileged = owner || isAdmin;

    // ── Admin / Owner path — execute real bot actions ─────────────────────────
    if (isPrivileged && question && question.trim()) {
        const { handleAdminCommand } = require('./adminAI');
        const handled = await handleAdminCommand(
            sock, jid, msg, userId, question,
            (prompt, sys) => callGemini(prompt, sys),
            blockedSet
        ).catch(() => false);
        if (handled) return;
    }

    // ── Regular player help path ───────────────────────────────────────────────
    if (!question || !question.trim()) {
        await sock.sendMessage(jid, {
            text: isPrivileged
                ? `Hey Master 👋 What do you need? You can ask me anything or give me a command to execute.\nExample: "give Razor 5000 gold" or "check Nova's stats"`
                : `Hey! 👋 Tag me with a question and I'll help.\nExample: @Aria how do I level up faster?`
        }, { quoted: msg });
        return;
    }

    if (isOnCooldown(userId)) {
        await sock.sendMessage(jid, {
            text: `⏳ Hang on — give me a few seconds and ask again!`
        }, { quoted: msg });
        return;
    }

    stampCooldown(userId);

    const { ctx, nickname } = await getPlayerContext(userId);
    const sysPrompt = buildSystemPrompt(owner, nickname || 'Master');
    const prompt    = ctx ? `Player context: ${ctx}\n\nQuestion: ${question}` : question;

    let reply;
    try {
        reply = await callGemini(prompt, sysPrompt);
        if (!reply) throw new Error('empty');
    } catch {
        reply = `Sorry, I couldn't reach my brain right now 😅 Try again in a moment!`;
    }

    await sock.sendMessage(jid, { text: reply }, { quoted: msg }).catch(() => {});
}

// ── 3. AI-enhanced narration ──────────────────────────────────────────────────
const { narrate: staticNarrate } = require('../utils/narrator');

async function narrateAI(type, vars, { useAI = false } = {}) {
    const staticText = staticNarrate(type, vars);
    if (!useAI) return staticText;

    const cacheKey = `${type}_${JSON.stringify(vars)}`;
    const cached   = narrateCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < NARRATE_TTL_MS) return cached.text;

    const sysPrompt = buildSystemPrompt(false, '');
    callGemini(buildNarratePrompt(type, vars), sysPrompt)
        .then(text => { if (text) narrateCache.set(cacheKey, { text, ts: Date.now() }); })
        .catch(() => {});

    return staticText;
}

function buildNarratePrompt(type, vars) {
    const map = {
        pvpVictory:  `1 dramatic sentence: ${vars.winner} defeats ${vars.loser} in a duel. Dark fantasy tone.`,
        skillDamage: `1 punchy sentence: ${vars.attacker} uses ${vars.move} on ${vars.target} for ${vars.damage} damage.`,
        heal:        `1 warm sentence: ${vars.healer} heals ${vars.target} for ${vars.heal} HP.`,
        buff:        `1 impactful sentence: ${vars.caster} buffs ${vars.target}'s ${vars.stat} with ${vars.move}.`,
        debuff:      `1 menacing sentence: ${vars.caster} weakens ${vars.target}'s ${vars.stat} with ${vars.move}.`
    };
    return map[type] || `One-sentence dark fantasy narration for: ${JSON.stringify(vars)}`;
}

module.exports = { handleUnknownCommand, handleAriaCommand, narrateAI };