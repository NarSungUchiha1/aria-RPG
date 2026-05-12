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

    // ── Owner/Admin — full power mode ─────────────────────────────────────────
    if (isPrivileged && question?.trim()) {
        const { handleAdminCommand } = require('./adminAI');
        const handled = await handleAdminCommand(
            sock, jid, msg, userId, question,
            (prompt, sys) => callGemini(prompt, sys),
            blockedSet
        ).catch(() => false);
        if (handled) return;
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
    // Cache by type + move so the same skill gets consistent flavour, refreshing every 30s
    const cacheKey = `${type}_${vars.move || vars.stat || vars.enemy || ''}`;
    const cached   = narrateCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < 30000) return cached.text;

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
        pvpVictory:  `1 or more dramatic sentences (dark fantasy). ${vars.winner} has just defeated ${vars.loser} in a duel. Make it feel earned and brutal.`,
        skillDamage: `1 or more punchy sentence. ${vars.attacker} uses ${vars.move} on ${vars.target} dealing ${vars.damage} damage. Visceral and cinematic.`,
        heal:        `1 or more sentences ${vars.healer} heals ${vars.target} restoring ${vars.heal} HP. Hopeful but battle-worn.`,
        buff:        `1 or more sentences. ${vars.caster} empowers ${vars.target} with ${vars.move}, boosting their ${vars.stat}. Dramatic.`,
        debuff:      `1 or more sentences. ${vars.caster} weakens ${vars.target} with ${vars.move}, reducing their ${vars.stat}. Dark and menacing.`,
        enemyDefeat: `1 or more sentences. The enemy ${vars.enemy} has been slain. Triumphant but gritty.`,
        evasion:     `1 or more sentences. ${vars.target} dodges the attack at the last second. Slick and fast.`,
        revive:      `1 or more sentences. ${vars.player} refuses to stay down and rises again. Defiant.`,
        cleanse:     `1 or more sentences. ${vars.caster} purges the dark energy afflicting ${vars.target}. Relieving.`,
        shield:      `1 or more sentences. ${vars.caster} raises a barrier protecting ${vars.target}. Powerful.`,
        defenseBlock:`1 or more sentences. The enemy's defenses absorb the blow. Frustrated tone.`
    };
    return map[type] || `1-sentence dark fantasy narration: ${JSON.stringify(vars)}`;
}

module.exports = { handleUnknownCommand, handleAriaCommand, narrateAI };