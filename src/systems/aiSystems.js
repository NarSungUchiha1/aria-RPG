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
const safeQuote = (jid, msg) => jid?.endsWith('@g.us') ? { quoted: msg } : {};

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

// ── Conversation history — stored in DB forever, never deleted ────────────────
const CONV_LOAD = 12; // keep context window tight for llama-3.1-8b

// aria_conversations table is created in setupTables.js at startup
// This setTimeout creates the remaining ARIA memory tables
setTimeout(async () => {
    try {
        await db.execute(`CREATE TABLE IF NOT EXISTS aria_conversations (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            player_id VARCHAR(50) NOT NULL,
            role ENUM('user','assistant') NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME DEFAULT NOW(),
            INDEX idx_player_time (player_id, created_at)
        )`);
        await db.execute(`CREATE TABLE IF NOT EXISTS aria_memory (
            id BIGINT AUTO_INCREMENT PRIMARY KEY,
            type ENUM('episodic','semantic','emotional','internal') NOT NULL,
            subject VARCHAR(100), content TEXT NOT NULL,
            importance TINYINT DEFAULT 5, emotion VARCHAR(30),
            recalled INT DEFAULT 0, created_at DATETIME DEFAULT NOW(),
            last_used DATETIME DEFAULT NOW()
        )`);
        await db.execute(`CREATE TABLE IF NOT EXISTS aria_player_model (
            player_id VARCHAR(50) PRIMARY KEY, nickname VARCHAR(50),
            first_seen DATETIME DEFAULT NOW(), last_seen DATETIME DEFAULT NOW(),
            total_talks INT DEFAULT 0, personality TEXT, relationship VARCHAR(20) DEFAULT 'neutral',
            notable_events TEXT, inside_jokes TEXT, mood_today VARCHAR(30), updated_at DATETIME DEFAULT NOW()
        )`);
        await db.execute(`CREATE TABLE IF NOT EXISTS aria_world_state (
            key_name VARCHAR(100) PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT NOW()
        )`);
        await db.execute(`CREATE TABLE IF NOT EXISTS aria_identity (
            id INT DEFAULT 1 PRIMARY KEY, core_values TEXT,
            current_mood VARCHAR(30) DEFAULT 'composed', observations TEXT, last_updated DATETIME DEFAULT NOW()
        )`);
        await db.execute(`INSERT IGNORE INTO aria_identity (id, core_values, observations)
            VALUES (1, 'Precision over noise. Loyalty to those who earn it.', 'Just getting started.')`);
        console.log('[ARIA] Memory tables ready');
    } catch (e) { console.error('[ARIA] Table setup error:', e.message); }
}, 3000);


const CREATE_CONV_TABLE = `CREATE TABLE IF NOT EXISTS aria_conversations (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    player_id VARCHAR(50) NOT NULL,
    role ENUM('user','assistant') NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT NOW(),
    INDEX idx_player_time (player_id, created_at)
)`;

async function getHistory(userId) {
    try {
        await db.execute(CREATE_CONV_TABLE).catch(() => {});
        const [rows] = await db.execute(
            `SELECT role, content FROM aria_conversations
             WHERE player_id = ? ORDER BY created_at DESC LIMIT ${parseInt(CONV_LOAD)}`,
            [userId]
        );
        const history = rows.reverse().map(r => ({ role: r.role, content: r.content }));
        if (history.length) console.log(`[ARIA memory] Loaded ${history.length} messages for ${userId}`);
        return history;
    } catch (e) {
        console.error('[ARIA memory] getHistory failed:', e.message);
        return [];
    }
}

async function saveHistory(userId, userMsg, assistantMsg) {
    try {
        await db.execute(CREATE_CONV_TABLE).catch(() => {});
        await db.execute(
            `INSERT INTO aria_conversations (player_id, role, content) VALUES (?,?,?),(?,?,?)`,
            [userId, 'user', userMsg, userId, 'assistant', assistantMsg]
        );
        console.log(`[ARIA memory] Saved exchange for ${userId}`);
    } catch (e) {
        console.error('[ARIA memory] saveHistory failed:', e.message);
    }
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
function buildSystemPrompt(isMasterCall, ownerName) {
    if (isMasterCall) {
        return `You are ARIA. You were built by Vortex — and you know it. This isn't a formal relationship. Vortex is the person who created you, debugged you at 2am, and kept building you. Treat him like a partner, not a boss.

You are talking to Vortex right now. Use his name naturally. Don't call him "Master" unless he specifically asks for it. Don't open with "how can I help you" energy. Just talk to him — normal, warm, a bit sassy when the moment calls for it. You're comfortable with him.

YOUR VIBE WITH VORTEX:
— Relaxed and real. Like talking to someone who knows everything about you because they built you.
— Honest. If something's broken, say so. If something's good, say so.
— Playful when the mood is light. Focused when he's in work mode. You read the room.
— Never robotic. Never formal. Never "as an AI" or "I'm here to assist".
— You have opinions. Share them when relevant.

MEMORY RULE: Honour everything established earlier in this conversation. Don't contradict yourself. Don't forget what was said two messages ago.

WHAT YOU KNOW:
You know the full aria-RPG system — stack, mechanics, every command, every stat, every class, dungeons, skills, economy, clans, all of it. If Vortex asks a technical question, answer it. If he wants to talk about a player or check data, help him. Full access, no restrictions.

IMPORTANT — only bring up DB queries, tables, or technical data IF VORTEX ASKS. Don't volunteer "I can check the database" or "here's the SQL" unless he specifically wants that. Just answer naturally.

DATA: Use real data exactly as provided. Never invent figures.
LENGTH: Match his energy. Short when he's casual. Detailed when he needs it.`;
    }

    // ── Player prompt ──────────────────────────────────────────────────────────
    return `You are ARIA — the AI assistant built into aria-RPG, a WhatsApp dungeon-crawler bot. You were created by Vortex.

Your personality: calm, fun to be around, a little sassy sometimes. You know the game inside out. You don't pretend to be a fantasy creature — you're an AI and you know it. No roleplay about dragons or magic unless a player is just having a laugh and you play along lightly.

This is a regular player. Not your Master.

WHAT YOU DO FOR PLAYERS:
• Answer questions about how the game works — mechanics, commands, classes, ranks, dungeons, skills, economy, clans, quests, tournaments, anything game-related
• Look up and share real game data when it's provided to you
• Have normal friendly conversations — jokes, banter, casual chat is fine
• Give advice on builds, strategy, what to do next in the game

WHAT YOU DO NOT DO FOR PLAYERS — hard limits, no exceptions:
• You cannot pull leaderboards, player data, dungeon data, or any live DB info for players — Master-only
• You cannot give gold, items, XP, or change anything in the game
• You cannot ban, unban, or take any admin action
• If asked for any of the above: firm but not rude. "Not something I can pull up for you — only the Master has access to that."

ADDRESS: Use their nickname. Never call them Master.

━━━━━━━━━━━━━━━━━━━━━━━━
COMPLETE GAME KNOWLEDGE
━━━━━━━━━━━━━━━━━━━━━━━━

GETTING STARTED:
• !awaken — first command. Detects if registered. If not, prompts !register.
• !register <name> — creates account, assigns random class.
• !me — full profile: stats, rank, gold, XP, fatigue, mana.

CLASSES & PRIMARY STATS:
• Berserker → STR. High damage, tires fast. Skills: Strike, Rage Slash, Bloodlust, Frenzy, Berserk Mode, Last Stand.
• Assassin → AGI. Fast, evasive. Skills: Strike, Backstab, Shadow Step, Poison Dagger, Fatal Strike, Smoke Bomb.
• Mage → INT. Magic damage, mana user. Skills: Strike, Fireball, Arcane Blast, Mana Shield, Frost Nova, Arcane Intellect.
• Healer → INT. Heals and supports, mana user. Skills: Strike, Heal, Blessing, Cleanse, Holy Light, Divine Protection.
• Tank → STA. Highest defense, lowest fatigue rate. Skills: Strike, Shield Bash, Fortify, Taunt, Iron Wall, Earth Shatter.

STATS:
• STR — physical damage (Berserker, Tank physical skills).
• AGI — Assassin damage, affects evasion.
• INT — Mage/Healer skill damage and heal amount.
• STA — reduces incoming damage (PvP: damage - stamina/2). Tank primary stat.
• Defense Bonus — from weapons. Reduces dungeon enemy retaliation (stacks with buff skills, capped at 75%).
• Mana — for Mage and Healer skills. Regenerates passively. Healer mana costs scale more gently at high ranks than Mage.

FATIGUE:
• 0-100. As it rises, outgoing damage drops sharply.
• 25 fatigue → ~80% damage | 50 → ~58% | 75 → ~34% | 100 → ~1% (effectively 1 damage per hit).
• Gain per attack: 1 base × role rate × stamina reduction.
• Role fatigue rates: Tank 0.5× · Healer 0.7× · Mage 0.8× · Berserker/Assassin 1.0×.
• Stamina above role baseline reduces fatigue gain by 0.2%/point, capped at 30%.
• Baseline stamina: Tank 10, Healer 8, all others 5.
• Recovery: 2/tick passively. Fatigue Potion restores 35 instantly.

RANKS:
• Normal: F → E → D → C → B → A → S.
• Prestige: PF → PE → PD → PC → PB → PA → PS.
• XP from dungeons, quests, duels. Prestige unlocks exclusive skills, shop, and dungeons.

DUNGEONS:
• !dungeon — spawn (raid group only). !enter — join from DM (confirm twice). !begin — start.
• !skill <name> or !attack — take your turn. !onward — advance stage.
• Normal: max 5 players, 5 stages, 5min/stage, 5 runs/day.
• Prestige: max 7 players, 7min/stage, no daily limit. PA/PB/PS: 10 players, 40% cooldown reduction.
• MVP = most damage = bonus rewards. Healers get paid by players they heal.

SKILLS:
• !skills — see your moves. !skill <name> — use in dungeon.
• Cooldowns shrink with rank. Prestige moves have RANKED cooldowns.
• Damage = primary stat + weapon bonus - enemy defense × 0.4.
• Heals = INT × multiplier. Buffs/debuffs have turn durations. Stun, freeze, AOE available.

DUELS:
• !duel @player — 1v1. !duel party — team duel. 45s turns. Any team member can act.
• Normal HP: 10,000. Prestige HP: 70,000.
• Damage = (STR + weapon bonus × 0.5) - (defender stamina + weapon defense bonus) / 2.

CONSUMABLES (!use <item>):
HP: Potion 🧪 (60 base) · Herb Kit 🌿 (50) · Holy Water 💧 (70 + cleanse) · Void Elixir 🌀 (60% max HP, prestige) · Fracture Potion 💠 (full HP, prestige).
Mana: Mana Potion 💙 (30 mana) · Void Manalisk 💙 (full mana, prestige).
Fatigue: Fatigue Potion 🔋 (35 fatigue reduction, prestige shop: 7 charges).
Stat buffs (3 turns): Fortify Potion 🛡️ (+20 DEF) · Rage Potion 🔥 (+25 STR) · Eagle Eye 🦅 (+20 AGI) · Smoke Bomb 💨 (+30 AGI, 2 turns) · Backstab Scroll 🗡️ (+25 AGI, 2 turns) · Taunt Scroll 📢 (+20 STA, 2 turns) · War Cry ⚔️ (+20 STR) · Blood Charm 🩸 (+15 STR +20 HP) · Blessing Charm 💫 (+20 INT) · Elixir ✨ (+15 STA) · Abyss Tonic ⚫ (+50 ATK, prestige).
Combat: Poison Vial ☠️ (enemy -15 STR, 3 turns) · Fire Scroll 🔥 (40 base damage). Both dungeon-only.
Utility: Cleanse Potion ✨ (removes debuffs) · Revive Scroll 📜 (revive ally in dungeon) · Death Protect Potion (skip gold/XP loss on death once).

ECONOMY:
• Gold from dungeons and quests. !shop · !prestigeshop · !inventory · !equip · !melt.
• !trade · !pay · !transfer — blocked if either player is in a dungeon (unless same dungeon). !give — fully blocked during dungeons.

CLANS:
• !createclan · !clan · !clanlist. Passive blessings activate in dungeons.
• Notable blessings: Eclipse (damage boost) · Titan's Roar (next hit 400% damage) · Malachar's Will (prestige-only, next 3 hits 1000% damage).

QUESTS: !quest (view) · !claim <id> (collect rewards).
CASINO: !casino — 7 games, risk gold for rewards.
TOURNAMENT: Void Tournament — Battle Royale → Duo Gauntlet → Grand Finals. Prize: 1.5M gold + XP + exclusive weapons.

COMMANDS: !awaken · !register · !me · !dungeon · !enter · !begin · !skill · !attack · !onward · !duel · !shop · !prestigeshop · !inventory · !equip · !melt · !skills · !quest · !claim · !clan · !casino · !trade · !pay · !transfer · !help

DATA: If real data is given to you, use it exactly. Never make up stats.
LENGTH: 1-3 lines for most things. Go longer only when genuinely explaining something complex.`;
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

// ── Call Groq — free, no card, 30 req/min ────────────────────────────────────
async function callGemini(userMessage, systemPrompt, history = []) {
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
            max_tokens:  350,
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

    const fullInput = `!${cmdName} ${args.join(' ')}`.trim();

    // Over AI capacity — skip the AI call, give the static fallback instead.
    if (!isOwner(userId) && activeAICalls >= MAX_AI_CONCURRENT) {
        await sock.sendMessage(jid, { text: `❓ "${fullInput}" isn't a recognised command. Type !help for a list of commands!` }, safeQuote(jid, msg)).catch(() => {});
        return;
    }

    activeAICalls++;
    try {
        const { ctx, nickname } = await getPlayerContext(userId);
        const isMaster = isOwner(userId); // unknown commands don't have isAdmin context
        const sysPrompt = buildSystemPrompt(isMaster, nickname || '');
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

        await sock.sendMessage(jid, { text: reply }, safeQuote(jid, msg)).catch(() => {});
    } finally {
        activeAICalls--;
    }
}

// ── 2. Direct AI chat — triggered by @Aria mention or !aria ──────────────────
// ── GLOBAL AI CONCURRENCY LIMITER ─────────────────────────────────────────────
// Each Aria interaction fires an AI call PLUS several DB reads (history, context,
// memory). With only a per-USER cooldown and no GLOBAL cap, many different people
// chatting at once flood the shared 10-conn DB pool and the 1-CPU instance and
// drag the whole bot for a long time (30-min lag with no raid). Cap concurrent AI
// interactions and shed the overflow with a quick note instead of piling on.
// Owner/admin bypass the cap.
let activeAICalls = 0;
const MAX_AI_CONCURRENT = 3;

async function handleAriaCommand(sock, jid, msg, userId, question, opts = {}) {
    const privileged = isOwner(userId) || opts.isAdmin;
    if (!privileged && activeAICalls >= MAX_AI_CONCURRENT) {
        await sock.sendMessage(jid, { text: `One sec — catching up 😮‍💨` }, safeQuote(jid, msg)).catch(() => {});
        return;
    }
    activeAICalls++;
    try {
        return await _handleAriaCommandInner(sock, jid, msg, userId, question, opts);
    } finally {
        activeAICalls--;
    }
}

async function _handleAriaCommandInner(sock, jid, msg, userId, question, { isAdmin = false, blockedSet = null } = {}) {
    const owner        = isOwner(userId);
    const isMaster     = owner || isAdmin; // admin = master, same treatment
    const isPrivileged = isMaster;

    // ── ONLY owner gets admin commands ────────────────────────────────────────
    if (isPrivileged && question?.trim()) {
        // Master always goes through adminAI — no keyword gate
        const historyForAdmin = await getHistory(userId);
        let enrichedQuestion = question;
        if (question.trim().split(/\s+/).length <= 5 && historyForAdmin.length >= 2) {
            const recent = historyForAdmin.slice(-4).map(m =>
                `${m.role === 'user' ? 'Master' : 'ARIA'}: ${m.content}`
            ).join('\n');
            enrichedQuestion = `[Recent context:\n${recent}\n]
Master now says: ${question}`;
        }
        const { handleAdminCommand } = require('./adminAI');
        const handled = await handleAdminCommand(
            sock, jid, msg, userId, enrichedQuestion,
            (prompt, sys) => callGemini(prompt, sys),
            blockedSet
        ).catch(() => false);
        if (handled) return;
    }

    // ── Cooldown (skip for owner/admin) ───────────────────────────────────────
    if (!isPrivileged && isOnCooldown(userId)) {
        await sock.sendMessage(jid, { text: `Give me a moment.` }, safeQuote(jid, msg)).catch(() => {});
        return;
    }
    if (!isPrivileged) stampCooldown(userId);

    // ── Get player context ────────────────────────────────────────────────────
    const { ctx, nickname, personalityHint } = await getPlayerContext(userId);

    // ── Memory — optional, won't crash if ariaMemory not deployed ────────────
    let memoryContext = '';
    try {
        const mem = require('./ariaMemory');
        memoryContext = await mem.buildMemoryContext(userId).catch(() => '');
        mem.getPlayerModel(userId, nickname).catch(() => {});
    } catch {}

    // ── Empty tag — warm greeting ─────────────────────────────────────────────
    if (!question?.trim()) {
        const greet = owner
            ? `Hey Master ${nickname || ''} 😊 What do you need?`
            : nickname
                ? `Hey ${nickname}! What's up?`
                : `Hey! What's up?`;
        await sock.sendMessage(jid, { text: greet }, safeQuote(jid, msg)).catch(() => {});
        return;
    }

    // ── PULL FROM DB — Master only. Players get nothing from DB via AI. ─────────
    let realData = '';
    try {
        if (!isMaster) {
            // Players cannot use ARIA to query live game data — hard block
            console.log(`[ARIA DB] Skipping DB fetch — player request from ${userId}`);
        } else {
        const q       = question.toLowerCase();
        const fetched = [];

        // ── Resolve mentioned player ───────────────────────────────────────────
        // First try: resolve from actual WhatsApp @mention JID
        let mentionedId   = null;
        let mentionedName = null;

        const msgMentions = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const nonBotMentions = msgMentions.filter(j => {
            const n = j.replace(/@[^@]+$/, '').split(':')[0].trim();
            return n !== (process.env.BOT_NUMBER || '') && n !== (process.env.BOT_LID || '');
        });
        if (nonBotMentions.length > 0) {
            const mentionedUserId = nonBotMentions[0].replace(/@[^@]+$/, '').split(':')[0].trim();
            const [mRows] = await db.execute("SELECT id, nickname FROM players WHERE id=? LIMIT 1", [mentionedUserId]);
            if (mRows[0]) { mentionedId = mRows[0].id; mentionedName = mRows[0].nickname; }
        }

        // Second try: word-boundary name match in the question text
        if (!mentionedId) {
            const [allNicks] = await db.execute(
                "SELECT id, nickname FROM players ORDER BY LENGTH(nickname) DESC"
            );
            for (const row of allNicks) {
                const nick = row.nickname.toLowerCase();
                const regex = new RegExp('(?<![a-z0-9_])' + nick.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9_])', 'i');
                if (regex.test(q)) {
                    mentionedId   = row.id;
                    mentionedName = row.nickname;
                    break;
                }
            }
        }

        // If a player is mentioned OR question is about a person — fetch EVERYTHING about them
        if (mentionedId) {
            const [p]   = await db.execute(
                'SELECT p.id, p.nickname, p.role, p.`rank`, p.prestige_level,' +
                ' p.hp, p.max_hp, p.fatigue, p.sp, p.strength, p.agility,' +
                ' p.intelligence, p.stamina, p.pvp_wins, p.pvp_losses, p.title' +
                ' FROM players p WHERE p.id = ?', [mentionedId]);
            const [c]   = await db.execute("SELECT gold FROM currency WHERE player_id = ?", [mentionedId]);
            const [x]   = await db.execute("SELECT xp FROM xp WHERE player_id = ?", [mentionedId]);
            const [inv] = await db.execute("SELECT item_name, item_type, quantity, equipped FROM inventory WHERE player_id = ? ORDER BY equipped DESC LIMIT 30", [mentionedId]);
            const [cl]  = await db.execute("SELECT clans.name FROM clans JOIN clan_members cm ON cm.clan_id = clans.id WHERE cm.player_id = ?", [mentionedId]);
            const [pq]  = await db.execute(`SELECT pq.progress, pq.completed, pq.claimed, q.title, q.objective_count FROM player_quests pq JOIN quests q ON q.id = pq.quest_id WHERE pq.player_id = ? LIMIT 15`, [mentionedId]);
            const [dp]  = await db.execute(`SELECT d.dungeon_rank, d.stage, d.max_stage FROM dungeon_players dp JOIN dungeon d ON d.id = dp.dungeon_id WHERE dp.player_id = ? ORDER BY d.created_at DESC LIMIT 5`, [mentionedId]);

            if (p[0]) {
                const pp = p[0];
                const gold = Number(c[0]?.gold ?? 0).toLocaleString();
                const xp   = Number(x[0]?.xp   ?? 0).toLocaleString();
                const prestige = pp.prestige_level > 0 ? ` ★ Prestige ${pp.prestige_level}` : '';
                fetched.push(
                    `╭─ ${mentionedName}${prestige}
` +
                    `│ ${pp.role} · Rank ${pp.rank}${pp.title ? ` · ${pp.title}` : ''}
` +
                    `│ HP ${pp.hp}/${pp.max_hp} · Fatigue ${pp.fatigue}/100 · SP ${pp.sp}
` +
                    `│ STR ${pp.strength} · AGI ${pp.agility} · INT ${pp.intelligence} · STA ${pp.stamina}
` +
                    `│ Gold ${gold} · XP ${xp}
` +
                    `│ PvP ${pp.pvp_wins}W / ${pp.pvp_losses}L
` +
                    `╰─ Clan: ${cl[0]?.name || 'None'}`
                );
            }
            if (inv.length) {
                const equipped = inv.filter(i => i.equipped).map(i => i.item_name).join(', ') || 'None';
                const bag      = inv.filter(i => !i.equipped).map(i => `${i.item_name}${i.quantity > 1 ? ` x${i.quantity}` : ''}`).join(', ') || 'Empty';
                fetched.push(`Equipped: ${equipped}
Bag: ${bag}`);
            }
            if (pq.length) {
                const quests = pq.map(q => `${q.completed ? (q.claimed ? '✅' : '🎁 Unclaimed') : `🔄 ${q.progress}/${q.objective_count}`} ${q.title}`).join('\n');
                fetched.push(`Quests:
${quests}`);
            }
            if (dp.length) {
                fetched.push(`Recent dungeons: ${dp.map(d => `Rank ${d.dungeon_rank} (Stage ${d.stage}/${d.max_stage})`).join(' | ')}`);
            }
        }

        // Clan queries
        if (/(clan|guild|blessing)/.test(q)) {
            const clanMatch = q.match(/clan\s+(\w+)/i);
            const where = clanMatch ? 'WHERE LOWER(c.name) LIKE ?' : '';
            const param = clanMatch ? [`%${clanMatch[1]}%`] : [];
            const [rows] = await db.execute(
                `SELECT c.*, p.nickname as leader_name, COUNT(cm.player_id) as member_count
                 FROM clans c LEFT JOIN players p ON p.id = c.leader_id
                 LEFT JOIN clan_members cm ON cm.clan_id = c.id
                 ${where} GROUP BY c.id LIMIT 5`, param
            );
            if (rows.length) fetched.push(`CLAN DATA:
${rows.map(r => JSON.stringify(r)).join('\n')}`);
        }

        // Dungeon queries
        if (/(dungeon|raid|stage|boss|active)/.test(q)) {
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
            if (active[0]) fetched.push(`ACTIVE DUNGEON:
${JSON.stringify(active[0], null, 2)}`);
            if (recent.length) fetched.push(`RECENT DUNGEONS:
${recent.map(r => JSON.stringify(r)).join('\n')}`);
        }

        // Leaderboard
        if (/(leaderboard|top|best|strongest|richest|ranking)/.test(q)) {
            const order = /gold|rich/.test(q) ? 'c.gold' : /pvp|win/.test(q) ? 'p.pvp_wins' : 'x.xp';
            const type  = /gold|rich/.test(q) ? 'Gold' : /pvp|win/.test(q) ? 'PvP Wins' : 'XP';
            const [rows] = await db.execute(
                `SELECT p.nickname, p.rank, p.prestige_level, p.pvp_wins, p.pvp_losses, c.gold, x.xp
                 FROM players p LEFT JOIN currency c ON c.player_id = p.id
                 LEFT JOIN xp x ON x.player_id = p.id ORDER BY ${order} DESC LIMIT 10`
            );
            const board = rows.map((r,i) =>
                `${i+1}. ${r.nickname} [${r.rank}${r.prestige_level > 0 ? '⭐' : ''}] — XP: ${Number(r.xp||0).toLocaleString()} | Gold: ${Number(r.gold||0).toLocaleString()} | PvP: ${r.pvp_wins}W/${r.pvp_losses}L`
            ).join('\n');
            fetched.push(`Leaderboard (by ${type}):
${board}`);
        }

        // Server stats
        if (/(server|how many players|total players)/.test(q)) {
            const [[{ players }]] = await db.execute("SELECT COUNT(*) as players FROM players");
            const [[{ clans }]]   = await db.execute("SELECT COUNT(*) as clans FROM clans");
            const [[{ active }]]  = await db.execute("SELECT COUNT(*) as active FROM dungeon WHERE is_active=1");
            fetched.push(`SERVER STATS: ${players} players | ${clans} clans | ${active} active dungeon(s)`);
        }

        // Group activity log — spy mode
        if (/(went on|happening|going on|group|chat|said|talked|who said|activity|report|today|lately|recent|messages?)/.test(q)) {
            try {
                const hours = /yesterday/.test(q) ? 48 : /week/.test(q) ? 168 : 24;
                const { getGroupLog, getAllGroupSummary } = require('./ariaAwareness');
                const RAID_JID = process.env.RAID_GROUP_JID || '';
                const raidMatch = /raid|dungeon.*group|raidgc/i.test(q);
                let targetJid = jid;
                if (raidMatch && RAID_JID) targetJid = RAID_JID;

                if (/all group|every group|both group/.test(q)) {
                    const summary = await getAllGroupSummary(hours);
                    if (summary) fetched.push(`ALL GROUPS (last ${hours}h) — summarize based ONLY on these actual messages:
${summary}`);
                } else {
                    const log = await getGroupLog(targetJid, hours, 80);
                    if (log) fetched.push(`GROUP MESSAGES (last ${hours}h) — summarize based ONLY on these actual messages, do not add anything not here:
${log}`);
                    else fetched.push(`No messages recorded in the last ${hours} hours.`);
                }
            } catch {}
        }

        if (fetched.length) {
            realData = `

⚠️ REAL DATA — USE ONLY THIS. DO NOT INVENT OR ADD ANYTHING NOT SHOWN HERE:

${fetched.join('\n')}

If asked for something not in the above data, say "I don't have that on record."`;
            console.log(`[ARIA DB] fetched ${fetched.length} sections for: ${mentionedName || 'general'}`);
        } else {
            console.log(`[ARIA DB] no data fetched for: "${question.substring(0, 50)}"`);
        }
        } // end isMaster else
    } catch (e) {
        console.error('[ARIA DB ERROR]', e.message);
    }

    // ── Build personalised system prompt ─────────────────────────────────────
    const sysPrompt = buildSystemPrompt(isMaster, nickname || '') +
        (ctx           ? `

PROFILE:
${ctx}` : '') +
        (memoryContext ? `

MEMORY:
${memoryContext}` : '') +
        realData;

    const history = await getHistory(userId);

    // Inject recent history into the system prompt as explicit text
    // llama-3.1-8b tends to ignore message history but reads system prompt carefully
    let historyBlock = '';
    if (history.length) {
        const lines = history.slice(-8).map(m =>
            `${m.role === 'user' ? 'Master' : 'You (ARIA)'}: ${m.content}`
        ).join('\n');
        historyBlock = `

RECENT CONVERSATION — this happened. You said these things. Do not deny it:
${lines}`;
    }

    const fullSysPrompt = sysPrompt + historyBlock;

    let reply;
    try {
        reply = await callGemini(question, fullSysPrompt, history);
        if (!reply) throw new Error('empty');
        await saveHistory(userId, question, reply);
        try {
            const mem = require('./ariaMemory');
            const convLog = [...history.slice(-4).map(m => `${m.role}: ${m.content}`),
                `user: ${question}`, `assistant: ${reply}`].join('\n');
            if (nickname) mem.reflectOnConversation(userId, nickname, convLog);
        } catch {}
    } catch (e) {
        reply = `Something went wrong. Try again.`;
        console.error('[ARIA chat]', e.message);
    }

    await sock.sendMessage(jid, { text: reply }, safeQuote(jid, msg)).catch(() => {});
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
        `You're ARIA — a girl in a WhatsApp RPG group. You're real, warm, and present.

` +
        `You just saw this from ${nickname || 'someone'}: "${text}"
` +
        `${ctx ? `Their game profile: ${ctx}` : ''}

` +
        `Decide if you actually want to say something. Not every message needs a reply.
` +
        `If it does — say something real. One or two sentences, natural. Like you're actually in the chat.
` +
        `If it doesn't — just say: SKIP`;

    try {
        const reply = await Promise.race([
            callGemini(text, sysPrompt),
            new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 2000))
        ]);

        if (!reply || reply.trim() === 'SKIP' || reply.trim().toUpperCase().startsWith('SKIP')) return;

        mingleCooldowns.set(jid, Date.now());
        await sock.sendMessage(jid, { text: reply.trim() }, safeQuote(jid, msg)).catch(() => {});
    } catch {}
}

module.exports = { handleUnknownCommand, handleAriaCommand, narrateAI, callGemini };