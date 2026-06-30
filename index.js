require('dotenv').config();

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    initAuthCreds,
    BufferJSON,
    downloadMediaMessage
} = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const db = require('./src/database/db');
// Per-execution raid group context — replaces global.overrideRaidGroup race condition
const { runWithGroup } = require('./src/utils/raidContext');
const { restockPrestigeShop } = require('./src/systems/prestigeShop');

const app = express();
const PORT = process.env.PORT || 3000;
let lastQR = '';
let lastPairingCode = '';
let isReady        = false;
let isBotRunning   = false;
let pairAttempts   = 0;
const MAX_PAIR_ATTEMPTS = 3;
let lastWas401 = false;
let sock = null;
let BOT_NUMBER = '';
let BOT_LID    = '';
let lastConnectedAt = null;

// Watchdog — if bot claims to be running but hasn't connected in 3 minutes, force reset
setInterval(() => {
    if (isBotRunning && !isReady) {
        const timeSinceAttempt = lastConnectedAt ? Date.now() - lastConnectedAt : Infinity;
        if (timeSinceAttempt > 3 * 60 * 1000) {
            console.log('🔁 Watchdog: bot stuck in connecting state — forcing reset...');
            isBotRunning = false;
            try { sock?.ev?.removeAllListeners(); } catch(e) {}
            try { sock?.ws?.close(); } catch(e) {}
            sock = null;
            startBot();
        }
    }
}, 60 * 1000); // check every minute

// ✅ Simple player cache
const playerCache = new Map();
const CACHE_TTL = 120000;

function getCachedPlayer(userId) {
    const cached = playerCache.get(userId);
    if (!cached) return null;
    if (Date.now() - cached.ts > CACHE_TTL) { playerCache.delete(userId); return null; }
    return cached.data;
}

function setCachedPlayer(userId, data) {
    playerCache.set(userId, { data, ts: Date.now() });
}

// ── Per-user command queue ─────────────────────────────────
const userQueues = new Map();

function enqueueCommand(userId, fn) {
    if (!userQueues.has(userId)) userQueues.set(userId, Promise.resolve());
    const queue = userQueues.get(userId).then(fn).catch(err => {
        console.error(`[Queue error] ${userId}:`, err.message);
    });
    userQueues.set(userId, queue);
    queue.finally(() => {
        if (userQueues.get(userId) === queue) userQueues.delete(userId);
    });
    return queue;
}

app.get('/ping', (req, res) => res.status(200).send('OK'));

// Self-ping every 4 min as backup — real fix is UptimeRobot hitting /ping externally
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://aria-rpg.onrender.com';
setInterval(async () => {
    try { await fetch(`${RENDER_URL}/ping`); } catch {}
}, 4 * 60 * 1000);

app.get('/', async (req, res) => {
    let dbStatus = 'Checking...';
    try {
        await db.query('SELECT 1');
        dbStatus = '🟢 Connected to Aiven';
    } catch (e) {
        dbStatus = '🔴 Database Offline';
    }

    if (isReady) {
        return res.send(`
            <html><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f4f7f6">
                <div style="background:white;padding:40px;border-radius:20px;box-shadow:0 10px 25px rgba(0,0,0,0.1);text-align:center">
                    <h1 style="color:#075e54">✅ ARIA Online</h1>
                    <p style="color:#666">The RPG Bot is currently active.</p>
                    <div style="font-size: 12px; margin-top: 20px; padding: 5px 15px; border-radius: 20px; background: #eee; display: inline-block;">${dbStatus}</div>
                </div>
            </body></html>
        `);
    }

    if (!lastQR && !lastPairingCode) {
        return res.send('<html><head><meta http-equiv="refresh" content="5"></head><body style="text-align:center;padding-top:50px;font-family:sans-serif;"><h2>⏳ Initializing ARIA...</h2><p>Please wait, refreshing automatically...</p></body></html>');
    }

    const url = lastQR ? await QRCode.toDataURL(lastQR) : '';
    res.send(`
        <html>
        <head><title>ARIA Dashboard</title><meta http-equiv="refresh" content="30"></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#e5ddd5;margin:0;">
            <div style="background:white;padding:30px;border-radius:15px;box-shadow:0 4px 15px rgba(0,0,0,0.15);text-align:center;">
                <div style="font-size: 12px; margin-bottom: 20px; padding: 5px 15px; border-radius: 20px; background: #eee; display: inline-block;">DB: ${dbStatus}</div>
                ${lastPairingCode ? `
                <div style="background:#f0f0f0;padding:20px;border-radius:12px;margin-bottom:20px">
                    <h3 style="margin:0 0 10px 0">📱 Pairing Code</h3>
                    <div style="font-size:48px;font-weight:bold;letter-spacing:8px;color:#075e54">${lastPairingCode}</div>
                    <p style="color:gray;margin-top:10px">WhatsApp → Linked Devices → Link with phone number</p>
                </div>
                ` : '<p>⏳ Generating pairing code...</p>'}
                ${url ? `
                <p style="color:gray">— or scan QR —</p>
                <img src="${url}" width="250" height="250" />
                ` : ''}
                <p style="color:gray;font-size:12px;margin-top:20px">Page auto-refreshes every 30 seconds</p>
            </div>
        </body>
        </html>
    `);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Dashboard active on port ${PORT}`);
});

const ADMIN_FILE = path.join(__dirname, "admin.json");
let ADMINS = [];
global.ADMINS = ADMINS;
global.isLockdown = false;

if (fs.existsSync(ADMIN_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf-8"));
        ADMINS = data.admins || (data.admin ? [data.admin] : []);
        global.ADMINS = ADMINS;
        console.log("🔐 Admins loaded:", ADMINS);
    } catch (err) {
        console.error("Failed to load admin.json:", err);
    }
}

const BLOCKED_USERS = new Set([]);

function normalizeId(id) {
    if (!id) return "";
    return id.toString().replace(/@s\.whatsapp\.net|@g\.us|@lid|@c\.us/g, "").split(":")[0].split("@")[0];
}

// Convert LID-based DM JID to @c.us (contact JID for LID sessions)
// WhatsApp's LID system produces: '53635887153297@lid' or '53635887153297alid' (malformed, missing @)
// For LID sessions, user DMs must be sent to @c.us, NOT @s.whatsapp.net (WhatsApp silently rejects those)
function normalizeDMJid(jid) {
    if (!jid) return jid;
    const str = String(jid).trim();
    // Groups stay as @g.us
    if (str.endsWith('@g.us')) return str;
    // Malformed LID missing @ → '53635887153297alid'
    const malformedLid = str.match(/^(\d+)alid$/);
    if (malformedLid) return `${malformedLid[1]}@c.us`;
    // Proper LID format → '53635887153297@lid'
    const properLid = str.match(/^(\d+)@lid$/);
    if (properLid) return `${properLid[1]}@c.us`;
    // If it already has @s.whatsapp.net, convert to @c.us for LID
    if (str.includes('@s.whatsapp.net')) return str.replace('@s.whatsapp.net', '@c.us');
    // Already @c.us
    if (str.endsWith('@c.us')) return str;
    // Unknown suffix with @ — extract numeric part and use @c.us for LID safety
    const anyAt = str.match(/^(\d+)@/);
    if (anyAt) return `${anyAt[1]}@c.us`;
    // Bare number
    if (/^\d+$/.test(str)) return `${str}@c.us`;
    return str;
}

const DUNGEON_GC_ONLY = new Set([
    'dungeon', 'begin', 'onward',
    'clear', 'closedungeon', 'attackboss', 'worldboss'
]);

const HEALER_GC_ONLY = new Set([
    'healers', 'hire', 'contracts'
]);

const BLACKSMITH_GC_ONLY = new Set([
    'forge', 'recipes', 'materials'
]);

const HEALER_GC_JID      = '120363427051780444@g.us';
const CASINO_GC_JID      = process.env.CASINO_GC_JID || '';
const BLACKSMITH_GC_JID  = '120363426728151625@g.us';
const DM_ONLY = new Set(['enter']);

// ── Ban system ─────────────────────────────────────────────
const bannedPlayers = new Set();
global.bannedPlayers = bannedPlayers;

// ── Community whitelist ────────────────────────────────────
// Set COMMUNITY_JID in Render env vars to restrict ARIA to DMs + community groups only
const COMMUNITY_JID   = process.env.COMMUNITY_JID || '';
const allowedGroupJids = new Set();
global.allowedGroupJids = allowedGroupJids;

// ── Test group — bypasses all GC restrictions ──────────────── ADDED
const TEST_GROUP_JID = process.env.TEST_GROUP_JID || '120363408323584748@g.us';

const commands = new Map();
const commandPath = path.join(__dirname, "src/commands");

if (fs.existsSync(commandPath)) {
    fs.readdirSync(commandPath)
        .filter(f => f.endsWith(".js"))
        .forEach(file => {
            try {
                const cmd = require('./src/commands/' + file);
                if (cmd?.name) {
                    commands.set(cmd.name, cmd);
                    if (Array.isArray(cmd.aliases)) {
                        cmd.aliases.forEach(alias => commands.set(alias, cmd));
                    }
                } else {
                    console.warn(`⚠️ Command file ${file} has no name export — skipped.`);
                }
            } catch (err) {
                console.error(`❌ Failed to load command ${file}:`, err.message);
            }
        });
}
console.log(`📦 Loaded ${commands.size} commands`);

async function useMySQLAuthState() {
    const SESSION_ID = 'aria-bot';

    await db.execute(`
        CREATE TABLE IF NOT EXISTS wa_sessions (
            id VARCHAR(50) PRIMARY KEY,
            data_key VARCHAR(255) NOT NULL,
            data_value LONGTEXT NOT NULL,
            UNIQUE KEY unique_session_key (id, data_key(100))
        )
    `).catch(() => {});

    const writeData = async (key, value) => {
        const json = JSON.stringify(value, BufferJSON.replacer);
        await db.execute(
            'INSERT INTO wa_sessions (id, data_key, data_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data_value = ?',
            [SESSION_ID, key, json, json]
        );
    };

    const readData = async (key) => {
        const [rows] = await db.execute(
            'SELECT data_value FROM wa_sessions WHERE id = ? AND data_key = ?',
            [SESSION_ID, key]
        );
        if (rows.length) return JSON.parse(rows[0].data_value, BufferJSON.reviver);
        return null;
    };

    const removeData = async (key) => {
        await db.execute(
            'DELETE FROM wa_sessions WHERE id = ? AND data_key = ?',
            [SESSION_ID, key]
        );
    };

    const creds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        const value = await readData(`${type}-${id}`);
                        if (value) data[id] = value;
                    }
                    return data;
                },
                set: async (data) => {
                    for (const [type, values] of Object.entries(data)) {
                        for (const [id, value] of Object.entries(values || {})) {
                            if (value) {
                                await writeData(`${type}-${id}`, value);
                            } else {
                                await removeData(`${type}-${id}`);
                            }
                        }
                    }
                }
            }
        },
        saveCreds: async () => {
            await writeData('creds', creds);
        }
    };
}

async function startBot() {
    if (isBotRunning) return;
    isBotRunning = true;
    lastConnectedAt = Date.now();

    try {
        try {
            const [credRows] = await db.execute(
                "SELECT data_key FROM wa_sessions WHERE id='aria-bot' AND data_key='creds' LIMIT 1"
            );
            if (!credRows.length || lastWas401) {
                await db.execute("DELETE FROM wa_sessions WHERE id='aria-bot'");
                lastWas401 = false;
                console.log('🧹 No creds / stale 401 session — wiped for fresh start.');
            }
        } catch (e) {}

        const { state, saveCreds } = await useMySQLAuthState();
        const { version } = await fetchLatestBaileysVersion();

        const noop = () => {};
        const silentLogger = { trace:noop, debug:noop, info:noop, warn:noop, error:noop, fatal:noop, child:() => silentLogger };

        sock = makeWASocket({
            version,
            auth: state,
            logger: silentLogger,
            getMessage: async () => ({ conversation: '' }),
            printQRInTerminal: false,
            syncFullHistory: false,
            markOnlineOnConnect: false,
        });

        const thisSock = sock;
        sock.ev.on('creds.update', async () => {
            if (sock !== thisSock) return; // stale socket — ignore
            await saveCreds();
            // Only log once per connection, not on every minor creds update
            if (state.creds?.registrationId && !isReady) {
                console.log(`📱 Paired! registrationId: ${state.creds.registrationId}`);
            }
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                lastQR = qr;
                isReady = false;
                console.log("📲 QR generated — open your Render URL");
                setTimeout(async () => {
                    try {
                        if (sock?.user) return;
                        const phoneNumber = process.env.BOT_PHONE_NUMBER;
                        if (!phoneNumber) {
                            console.warn("⚠️ BOT_PHONE_NUMBER not set in .env — skipping pairing code");
                            return;
                        }
                        const code = await sock.requestPairingCode(phoneNumber);
                        lastPairingCode = code;
                        console.log(`📱 PAIRING CODE: ${code}`);
                    } catch (e) {
                        console.error("Pairing code error:", e.message);
                    }
                }, 3000);
            }

            if (connection === 'close') {
                isReady = false;
                isBotRunning = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                console.log(`⚠️ Connection closed (code: ${statusCode}).`);

                // Clean up old socket so it stops emitting creds.update events
                try { sock?.ev?.removeAllListeners(); } catch(e) {}
                try { sock?.ws?.close(); } catch(e) {}
                sock = null;

                if (statusCode === DisconnectReason.loggedOut) {
                    pairAttempts++;
                    console.log(`🔄 Logged out. Clearing session (attempt ${pairAttempts}/${MAX_PAIR_ATTEMPTS})...`);
                    await db.execute("DELETE FROM wa_sessions WHERE id='aria-bot'").catch(() => {});
                    if (pairAttempts >= MAX_PAIR_ATTEMPTS) {
                        console.log('🛑 Too many failed pair attempts — bot stopped. Restart manually on Render.');
                        return; // Stop the loop
                    }
                    setTimeout(() => startBot(), 10000);
                } else if (statusCode === 515) {
                    // 515 = restart required — WhatsApp asking for clean reconnect
                    console.log('🔄 Restart required (515) — reconnecting in 3s...');
                    setTimeout(() => startBot(), 3000);
                } else if (statusCode === 401) {
                    pairAttempts++;
                    lastWas401 = true;
                    console.log(`🔄 Unauthorized (401). Clearing session (attempt ${pairAttempts}/${MAX_PAIR_ATTEMPTS})...`);
                    await db.execute("DELETE FROM wa_sessions WHERE id='aria-bot'").catch(() => {});
                    if (pairAttempts >= MAX_PAIR_ATTEMPTS) {
                        console.log('🛑 Too many failed attempts — bot stopped. Restart manually on Render.');
                        return;
                    }
                    setTimeout(() => startBot(), 15000);
                } else {
                    const delay = statusCode === 440
                        ? 15000 + Math.floor(Math.random() * 10000)
                        : 5000 + Math.floor(Math.random() * 5000);
                    console.log(`⏳ Reconnecting in ${Math.floor(delay/1000)}s...`);
                    setTimeout(() => startBot(), delay);
                }
            } else if (connection === 'open') {
                pairAttempts = 0; // Reset on successful connect
                const rawId  = sock.user?.id  || '';
                const rawLid = sock.user?.lid || '';
                BOT_NUMBER = rawId.replace(/@[^@]+$/, '').split(':')[0].trim();
                BOT_LID    = rawLid.replace(/@[^@]+$/, '').split(':')[0].trim();
                console.log(`✅ ARIA ONLINE | number: ${BOT_NUMBER} | lid: ${BOT_LID}`);
                isReady = true;

                // Load banned players into memory
                try {
                    const [bans] = await db.execute('SELECT player_id FROM banned_players');
                    bans.forEach(b => bannedPlayers.add(String(b.player_id)));
                    console.log(`[BAN] 🚫 ${bannedPlayers.size} banned players loaded`);
                } catch(e) { console.log('[BAN] No ban table yet — skipping'); }

                // Load community groups into whitelist
                if (COMMUNITY_JID) {
                    try {
                        const allGroups = await sock.groupFetchAllParticipating();
                        for (const [gJid, meta] of Object.entries(allGroups)) {
                            if (meta.linkedParent === COMMUNITY_JID || gJid === COMMUNITY_JID) {
                                allowedGroupJids.add(gJid);
                            }
                        }
                        console.log(`🏘️ Community groups loaded: ${allowedGroupJids.size}`);
                    } catch(e) {
                        console.error('Community load error:', e.message);
                    }
                }

                // Init all missing DB tables
                const { ensureMemoryTables } = require('./src/systems/ariaMemory');
                const { setupMissingTables } = require('./src/database/setupTables');
                Promise.all([
                    ensureMemoryTables().catch(() => {}),
                    setupMissingTables().catch(() => {})
                ]);
                const { ensureResonanceProfileTable } = require('./src/systems/ascendantSystem');
                ensureResonanceProfileTable().catch(() => {});
                lastQR = '';
                lastPairingCode = '';

                await db.execute(`
                    CREATE TABLE IF NOT EXISTS dungeon_entry_log (
                        player_id   VARCHAR(50) NOT NULL,
                        entry_date  DATE        NOT NULL,
                        count       INT         NOT NULL DEFAULT 0,
                        PRIMARY KEY (player_id, entry_date)
                    )
                `).catch(() => {});

                await db.execute(`
                    CREATE TABLE IF NOT EXISTS dungeon_spawn_lock (
                        id         INT PRIMARY KEY,
                        locked_at  DATETIME DEFAULT NOW()
                    )
                `).catch(() => {});
                await db.execute("ALTER TABLE players ADD COLUMN fatigue INT DEFAULT 0").catch(() => {});
                await db.execute("DELETE FROM dungeon_spawn_lock WHERE id=1").catch(() => {});

                // ── Tournament tables ──────────────────────────────── ADDED
                await db.execute(`CREATE TABLE IF NOT EXISTS tournaments (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    name VARCHAR(100) NOT NULL,
                    phase VARCHAR(30) DEFAULT 'registration',
                    phase_ends_at DATETIME DEFAULT NULL,
                    started_at DATETIME DEFAULT NOW(),
                    ended_at DATETIME DEFAULT NULL,
                    is_active TINYINT DEFAULT 1
                )`).catch(() => {});
                await db.execute(`CREATE TABLE IF NOT EXISTS tournament_players (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tournament_id INT NOT NULL,
                    player_id VARCHAR(60) NOT NULL,
                    duo_partner VARCHAR(60) DEFAULT NULL,
                    wins INT DEFAULT 0,
                    losses INT DEFAULT 0,
                    eliminated TINYINT DEFAULT 0,
                    phase_joined VARCHAR(30) DEFAULT 'battle_royale',
                    prize_claimed TINYINT DEFAULT 0,
                    UNIQUE KEY unique_entry (tournament_id, player_id),
                    INDEX (tournament_id)
                )`).catch(() => {});
                await db.execute(`CREATE TABLE IF NOT EXISTS tournament_matches (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    tournament_id INT NOT NULL,
                    phase VARCHAR(30) NOT NULL,
                    player1_id VARCHAR(60) NOT NULL,
                    player2_id VARCHAR(60) NOT NULL,
                    winner_id VARCHAR(60) DEFAULT NULL,
                    status ENUM('pending','active','completed') DEFAULT 'pending',
                    round INT DEFAULT 1,
                    scheduled_at DATETIME DEFAULT NOW(),
                    completed_at DATETIME DEFAULT NULL,
                    INDEX (tournament_id, phase)
                )`).catch(() => {});

                try {
                    const LIVE_G = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
                    await db.execute("UPDATE dungeon d SET d.is_active=0 WHERE d.is_active=1 AND d.locked=0 AND (d.group_jid=? OR d.group_jid IS NULL) AND d.created_at < DATE_SUB(NOW(), INTERVAL 2 HOUR) AND d.id NOT IN (SELECT dungeon_id FROM dungeon_players WHERE is_alive=1)", [LIVE_G]).catch(() => {});
                    const [activeDungeons] = await db.execute("SELECT id FROM dungeon WHERE is_active=1 AND (group_jid=? OR group_jid IS NULL)", [LIVE_G]);
                    if (!activeDungeons.length) {
                        await db.execute("DELETE FROM dungeon_players WHERE player_id IS NOT NULL");
                        await db.execute("DELETE FROM dungeon_enemies WHERE dungeon_id IS NOT NULL");
                    } else {
                        const activeIds = activeDungeons.map(d => d.id);
                        await db.execute(`DELETE FROM dungeon_players WHERE dungeon_id NOT IN (${activeIds.join(',')})`);
                        await db.execute(`DELETE FROM dungeon_enemies WHERE dungeon_id NOT IN (${activeIds.join(',')})`);
                    }
                    console.log('🧹 Stale dungeon state cleared on startup.');

                    try {
                        const [activePD] = await db.execute(
                            "SELECT id, created_at FROM dungeon WHERE is_active=1 AND locked=0 AND dungeon_rank LIKE 'P%' LIMIT 1"
                        );
                        if (activePD.length) {
                            const { startPrestigeLobbyTimer } = require('./src/engine/prestigeDungeon');
                            const RAID_GROUP = process.env.RAID_GROUP_JID || process.env.GROUP_JID;
                            const elapsed = Date.now() - new Date(activePD[0].created_at).getTime();
                            const remaining = (20 * 60 * 1000) - elapsed;
                            if (remaining > 0 && RAID_GROUP) {
                                console.log(`★ Restarting prestige lobby timer — ${Math.floor(remaining/60000)}min remaining`);
                                startPrestigeLobbyTimer(activePD[0].id, sock, RAID_GROUP, remaining);
                            } else if (remaining <= 0) {
                                await db.execute("UPDATE dungeon SET is_active=0 WHERE id=?", [activePD[0].id]);
                                console.log(`★ Prestige dungeon ${activePD[0].id} expired on startup cleanup`);
                            }
                        }
                    } catch(e) { console.error('Prestige lobby restart error:', e.message); }
                } catch (e) {
                    console.error('Startup dungeon cleanup error:', e.message);
                }

                if (ADMINS.length === 0 && sock.user) {
                    const myJid = normalizeId(sock.user.id);
                    ADMINS = [myJid];
                    fs.writeFileSync(ADMIN_FILE, JSON.stringify({ admins: ADMINS }, null, 2));
                    console.log("🔐 Admin bootstrapped:", myJid);
                }
            }
        });

        sock.ev.on('messages.upsert', async ({ messages, type }) => {
          try {
            const msg = messages[0];
            if (!msg) return;
            if (!msg.message || msg.key.fromMe) return;

            const rawJid = msg.key.remoteJid;
            const jid = normalizeDMJid(rawJid);
            const senderJid = msg.key.participant || jid;
            const userId = normalizeId(senderJid);

            const text = msg.message.conversation ||
                         msg.message.extendedTextMessage?.text ||
                         msg.message.imageMessage?.caption || "";

            const msgTypes = Object.keys(msg.message || {}).filter(k => k !== 'messageContextInfo').join(',');
            console.log(`[MSG] ${userId} | ${jid.endsWith('@g.us') ? 'GC' : 'DM'} | ${msgTypes} | "${text.substring(0, 60)}"`);

            const mentionedJids = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
            const quotedParticipant = msg.message?.extendedTextMessage?.contextInfo?.participant || '';
            const quotedNum = quotedParticipant.replace(/@[^@]+$/, '').split(':')[0].trim();

            // ── Aria trigger — name-based, no tagging required ───────────────────
            const textLower = text.trim().toLowerCase();

            // Trigger if message starts with her name or a clear call
            const ARIA_NAMES = /^(aria|hey aria|oi aria|yo aria|aria[,!?])/i;

            // Also trigger if the whole message sounds like she's being addressed:
            // short message that contains "aria" anywhere (e.g. "aria what's my rank?")
            // or a question/statement that starts with aria-adjacent phrasing
            const ariaInText = textLower.includes('aria');
            const startsWithAria = ARIA_NAMES.test(text.trim());
            const shortAriaMsg  = ariaInText && text.trim().split(/\s+/).length <= 12;

            const botMentioned = startsWithAria || shortAriaMsg
               || mentionedJids.some(j => {
                    const jNum = j.replace(/@[^@]+$/, '').split(':')[0].trim();
                    return (BOT_NUMBER && jNum === BOT_NUMBER) ||
                           (BOT_LID    && jNum === BOT_LID);
                })
               || (BOT_NUMBER && text.includes(`@${BOT_NUMBER}`))
               || (BOT_LID    && text.includes(`@${BOT_LID}`));

            if (ariaInText || mentionedJids.length > 0) {
                console.log(`[ARIA debug] BOT_NUMBER=${BOT_NUMBER} BOT_LID=${BOT_LID} botMentioned=${botMentioned} startsWithAria=${startsWithAria} shortAriaMsg=${shortAriaMsg}`);
            }

            const isReplyToBot = (BOT_NUMBER && quotedNum === BOT_NUMBER) ||
                                  (BOT_LID    && quotedNum === BOT_LID);

            const stripped = text.replace(/@\d+/g, '').trim().toLowerCase();
            const QUESTION_STARTERS = /^(what|who|how|when|where|why|can|could|would|should|is|are|do|does|did|will|was|were|tell|show|give|explain|help|check|find|get|which|whose|whom)/;
            const isAskingQuestion = text.includes('?')
                || QUESTION_STARTERS.test(stripped)
                || stripped.split(/\s+/).filter(Boolean).length >= 6;

            // ── RESONANCE FLOW INTERCEPTOR (must be BEFORE Aria) ──────────
            {
                const { isInResFlow, handleResonanceFlow } = require('./src/systems/ascendantSystem');
                if (isInResFlow(userId)) {
                    const flowReply = async (content) => {
                        const mc = typeof content === 'string' ? { text: content } : content;
                        const opts = jid.endsWith('@g.us') ? { quoted: msg } : {};
                        return await sock.sendMessage(jid, mc, opts);
                    };
                    const flowMsg = { reply: flowReply, from: jid };
                    const consumed = await handleResonanceFlow(userId, text, msg, flowMsg, sock);
                    if (consumed) return;
                }
            }

            // Reply to Aria's message = always follow up, no question check needed
            if (botMentioned || (isReplyToBot && !text.startsWith('!'))) {
                let question = text;
                const nonBotMentions = mentionedJids.filter(j => {
                    const n = j.replace(/@[^@]+$/, '').split(':')[0].trim();
                    return n !== BOT_NUMBER && n !== BOT_LID;
                });
                if (nonBotMentions.length > 0) {
                    const db = require('./src/database/db');
                    for (const jid2 of nonBotMentions) {
                        const pid = jid2.replace(/@[^@]+$/, '').split(':')[0].trim();
                        try {
                            const [rows] = await db.execute("SELECT nickname FROM players WHERE id=? LIMIT 1", [pid]);
                            if (rows[0]) question = question.replace(new RegExp(`@${pid}`, 'g'), rows[0].nickname);
                        } catch {}
                    }
                }
                question = question.replace(/@\d+/g, '').trim();
                console.log(`[ARIA] triggered (${botMentioned ? 'mention' : 'reply'}) | "${question}"`);
                const { handleAriaCommand } = require('./src/systems/aiSystems');
                const isAdmin = (global.ADMINS || ADMINS).includes(userId);
                await handleAriaCommand(sock, jid, msg, userId, question, { isAdmin, blockedSet: BLOCKED_USERS });
                return;
            }

            if (!text.startsWith('!')) {
                if (jid.endsWith('@g.us') && text.length > 8) {
                    try {
                        const db2 = require('./src/database/db');
                        const [rows] = await db2.execute("SELECT nickname FROM players WHERE id=? LIMIT 1", [userId]);
                        const nick = rows[0]?.nickname;
                        if (nick) {
                            const RAID_JID = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
                            const groupName = jid === RAID_JID ? 'Raid Group' : `Group_${jid.substring(0, 10)}`;
                            const { witnessMessage } = require('./src/systems/ariaAwareness');
                            witnessMessage(userId, nick, text, jid, groupName).catch(() => {});
                        }
                    } catch {}
                    return;
                }
                // DM with plain text (no ! prefix, no @aria mention) — route to Aria directly
                if (!jid.endsWith('@g.us')) {
                    const { handleAriaCommand } = require('./src/systems/aiSystems');
                    const isAdmin = (global.ADMINS || ADMINS).includes(userId);
                    await handleAriaCommand(sock, jid, msg, userId, text, { isAdmin, blockedSet: BLOCKED_USERS });
                }
                return;
            }

            let cmdText = text;

            // In test group — accept both !command and !test command
            if (jid === TEST_GROUP_JID && text.toLowerCase().startsWith('!test ')) {
                cmdText = '!' + text.slice(6).trim();
            }

            const args = cmdText.slice(1).trim().split(/\s+/);
            const cmdName = args.shift().toLowerCase();

            // ── Community whitelist — only DMs and community groups ────────
            // Test GC is always allowed regardless of community setting
            if (COMMUNITY_JID && jid.endsWith('@g.us') && jid !== TEST_GROUP_JID) {
                if (!allowedGroupJids.has(jid)) {
                    try {
                        const meta = await sock.groupMetadata(jid).catch(() => null);
                        if (meta?.linkedParent === COMMUNITY_JID) {
                            allowedGroupJids.add(jid);
                        } else {
                            return;
                        }
                    } catch(e) {
                        return;
                    }
                }
            }

            // ── Ban check ─────────────────────────────────────────────────
            if (cmdName !== 'ban' && cmdName !== 'unban') {
                if (bannedPlayers.has(userId)) return;
            }

            const command = commands.get(cmdName);
            if (!command) {
                const { handleUnknownCommand } = require('./src/systems/aiSystems');
                await handleUnknownCommand(sock, jid, msg, userId, cmdName, args);
                return;
            }

            if (BLOCKED_USERS.has(userId)) return;

            const RAID_GROUP  = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
            const isDM        = !jid.endsWith('@g.us');
            const isRaidGroup = jid === RAID_GROUP;

            const isAdmin = (global.ADMINS || ADMINS).includes(userId);

            if (global.isLockdown && !isAdmin && cmdName !== 'lockdown') {
                await sock.sendMessage(jid, {
                    text:
                        `══〘 🌍 ARIA 〙══╮
` +
                        `┃◆ 🔒 ARIA is currently under maintenance.
` +
                        `┃◆ We'll be back shortly.
` +
                        `╰═══════════════════════╯`
                }, isDM ? {} : { quoted: msg });
                return;
            }

            // ── Test group bypasses all GC restrictions ──────────────────
            const isTestGroup = jid === TEST_GROUP_JID;

            if (!isTestGroup) {
                if (DUNGEON_GC_ONLY.has(cmdName) && !isRaidGroup) {
                    if (isDM) await sock.sendMessage(jid, { text: `⚔️ Dungeon commands only work inside the Dungeon GC.` });
                    return;
                }

                if (HEALER_GC_ONLY.has(cmdName) && jid !== HEALER_GC_JID) {
                    await sock.sendMessage(jid, { text: `══〘 💚 HEALER MARKET 〙══╮
┃◆ ❌ These commands only work
┃◆ in the Healer Market group.
╰═══════════════════════╯` }, isDM ? {} : { quoted: msg });
                    return;
                }

                if (BLACKSMITH_GC_ONLY.has(cmdName) && jid !== BLACKSMITH_GC_JID) {
                    await sock.sendMessage(jid, { text: `══〘 ⚒️ BLACKSMITH 〙══╮
┃◆ ❌ These commands only work
┃◆ in the Blacksmith group.
╰═══════════════════════╯` }, isDM ? {} : { quoted: msg });
                    return;
                }

                if (DM_ONLY.has(cmdName) && !isDM) {
                    await sock.sendMessage(jid, { text: `📩 Use *!${cmdName}* in the bot's DM, not here.` }, isDM ? {} : { quoted: msg });
                    return;
                }
            }

            console.log(`[CMD] ${userId} → ${cmdName} (from: ${isRaidGroup ? 'RaidGC' : isDM ? 'DM' : 'OtherGC'})`);

            const fakeMsg = {
                body: text,
                from: jid,
                author: senderJid,
                fromMe: msg.key.fromMe,
                id: msg.key.id,
                client: sock,
                rawMsg: msg,

                getContact: async () => {
                    const ppUrl = await sock.profilePictureUrl(senderJid).catch(() => null);
                    return {
                        id: { _serialized: senderJid },
                        number: userId,
                        name: senderJid.split('@')[0],
                        pushname: senderJid.split('@')[0],
                        getProfilePicUrl: async () => ppUrl
                    };
                },

                reply: async (content, _, options) => {
                    const finalMentions = options?.mentions || [];
                    const messageContent = typeof content === 'string'
                        ? { text: content, mentions: finalMentions }
                        : content;
                    const sendOpts = isDM ? {} : { quoted: msg };
                    try {
                        const r = await sock.sendMessage(jid, messageContent, sendOpts);
                        if (isDM) console.log(`[DM SEND] jid="${jid}" ok`);
                        return r;
                    } catch(e) {
                        console.error(`[SEND ERROR] jid="${jid}" ${e?.message}`);
                    }
                },

                get mentionedIds() {
                    const entities = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                    return entities.map(e => normalizeId(e));
                },

                getChat: async () => ({
                    id: { _serialized: jid },
                    isGroup: jid.endsWith('@g.us'),
                    sendMessage: async (content, options) => {
                        return await sock.sendMessage(jid, { text: content }, options);
                    }
                })
            };

            // Resolve effectiveUserId to demo account BEFORE dead check
            let effectiveUserId = userId;
            if (isTestGroup && !['tester', 'testmode'].includes(cmdName)) {
                try {
                    const { activeTesterSessions } = require('./src/commands/tester');
                    if (activeTesterSessions?.has(userId)) {
                        effectiveUserId = activeTesterSessions.get(userId);
                    }
                } catch(e) {}
            }

            try {
                if (!['respawn', 'awaken', 'register', 'tester', 'testmode'].includes(cmdName)) {
                    let hp = null;
                    const cached = getCachedPlayer(effectiveUserId);
                    if (cached !== null) {
                        hp = cached.hp;
                    } else {
                        const [rows] = await db.execute("SELECT hp FROM players WHERE id=?", [effectiveUserId]);
                        if (rows.length) {
                            hp = rows[0].hp;
                            setCachedPlayer(effectiveUserId, rows[0]);
                        } else {
                            setCachedPlayer(effectiveUserId, { hp: null });
                        }
                    }
                    if (hp !== null && hp <= 0) {
                        return await sock.sendMessage(jid, {
                            text:
                                `══〘 💀 YOU ARE DEAD 〙══╮
` +
                                `┃◆ Your HP has reached 0.
` +
                                `┃◆ Use !respawn to revive.
` +
                                `┃◆ (Penalties apply on revival)
` +
                                `╰═══════════════════════╯`
                        }, isDM ? {} : { quoted: msg });
                    }
                }

                try {
                    await db.execute("UPDATE players SET last_active=NOW() WHERE id=?", [userId]).catch(()=>{});
                } catch(e) {}

                await enqueueCommand(userId, async () => {
                    // ── ADDED: swap userId to demo account if tester session active ──
                    if (isTestGroup && cmdName !== 'tester' && cmdName !== 'testmode') {
                        try {
                            const { activeTesterSessions } = require('./src/commands/tester');
                            if (activeTesterSessions?.has(userId)) {
                                effectiveUserId = activeTesterSessions.get(userId);
                            }
                            // Swap mentioned players to their demo IDs so !duel targets _test accounts
                            const origMentionedIds = fakeMsg.mentionedIds;
                            Object.defineProperty(fakeMsg, 'mentionedIds', {
                                get() {
                                    return origMentionedIds.map(mid =>
                                        activeTesterSessions?.has(mid)
                                            ? activeTesterSessions.get(mid)
                                            : mid + '_test'
                                    );
                                },
                                configurable: true
                            });
                        } catch(e) {}
                    }

                    // ── Per-execution group context (replaces global.overrideRaidGroup) ──
                    // runWithGroup sets the raid group for this entire async call chain.
                    // Test GC and live GC commands run in parallel without interfering.
                    // All getRaidGroup() calls anywhere in the chain read from AsyncLocalStorage.
                    const executionGroupJid = isTestGroup ? TEST_GROUP_JID : (process.env.RAID_GROUP_JID || '120363213735662100@g.us');
                    try {
                        await runWithGroup(executionGroupJid, () =>
                            command.execute(fakeMsg, args, { userId: effectiveUserId, isAdmin, client: sock })
                        );
                    } catch (execErr) {
                        console.error("Command Error:", execErr);
                        await sock.sendMessage(jid, { text: "❌ An error occurred." }, isDM ? {} : { quoted: msg });
                    } finally {
                        playerCache.delete(userId);
                    }
                });
            } catch (err) {
                console.error("Outer Command Error:", err);
                playerCache.delete(userId);
                await sock.sendMessage(jid, { text: "❌ An error occurred." }, isDM ? {} : { quoted: msg });
            }
          } catch (fatalErr) {
              console.error('[FATAL MSG HANDLER ERROR]', fatalErr?.message || fatalErr);
          }
        });

        // ==================== REFERRAL TRACKING ====================
        sock.ev.on('group-participants.update', async ({ id, participants, action, author }) => {
            const { REFERRAL_GROUP_JID, REFERRAL_XP_REFERRER, REFERRAL_GOLD_NEW, ensureTable } = require('./src/commands/referral');
            if (id !== REFERRAL_GROUP_JID) return;
            if (action !== 'add') return;
            try {
                await ensureTable();
                console.log(`👥 Join event — group: ${id}, author: ${author}, participants: ${participants.join(',')}`);
                for (const participantJid of participants) {
                    const newUserId = participantJid.split('@')[0];

                    if (!author) {
                        await db.execute(
                            `INSERT INTO referral_pending_bonus (player_id, gold) VALUES (?, ?) ON DUPLICATE KEY UPDATE gold = gold + ?`,
                            [newUserId, REFERRAL_GOLD_NEW, REFERRAL_GOLD_NEW]
                        ).catch(() => {});
                        await sock.sendMessage(REFERRAL_GROUP_JID, {
                            text:
                                `══〘 🔗 NEW HUNTER 〙══╮
` +
                                `┃◆ @${newUserId} just joined ARIA!
` +
                                `┃◆ 
` +
                                `┃◆ 💰 +${REFERRAL_GOLD_NEW} Gold bonus
` +
                                `┃◆    waiting on registration.
` +
                                `┃◆ 
` +
                                `┃◆ Use !awaken to begin your journey.
` +
                                `╰═══════════════════════╯`,
                            mentions: [participantJid]
                        });
                        continue;
                    }

                    const referrerId = author.split('@')[0];
                    if (newUserId === referrerId) continue;

                    const [referrer] = await db.execute("SELECT nickname FROM players WHERE id=?", [referrerId]);
                    if (!referrer.length) continue;

                    const [existing] = await db.execute("SELECT id FROM referrals WHERE referrer_id=? AND referred_id=?", [referrerId, newUserId]);
                    if (existing.length) continue;

                    await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [REFERRAL_XP_REFERRER, referrerId]);
                    await db.execute("INSERT IGNORE INTO referrals (referrer_id, referred_id, xp_rewarded) VALUES (?, ?, ?)", [referrerId, newUserId, REFERRAL_XP_REFERRER]);
                    await db.execute(
                        `INSERT INTO referral_pending_bonus (player_id, gold) VALUES (?, ?) ON DUPLICATE KEY UPDATE gold = gold + ?`,
                        [newUserId, REFERRAL_GOLD_NEW, REFERRAL_GOLD_NEW]
                    ).catch(() => {});

                    await sock.sendMessage(REFERRAL_GROUP_JID, {
                        text:
                            `══〘 🔗 REFERRAL REWARD 〙══╮
` +
                            `┃◆ @${newUserId} just joined ARIA!
` +
                            `┃◆ Invited by: *${referrer[0].nickname}*
` +
                            `┃◆ 
` +
                            `┃◆ ⭐ ${referrer[0].nickname} +${REFERRAL_XP_REFERRER} XP
` +
                            `┃◆ 💰 New player gets +${REFERRAL_GOLD_NEW} Gold on register
` +
                            `┃◆ 
` +
                            `┃◆ Use !awaken to begin your journey.
` +
                            `╰═══════════════════════╯`,
                        mentions: [participantJid, `${referrerId}@s.whatsapp.net`]
                    });
                }
            } catch (e) {
                console.error('Referral tracking error:', e.message);
            }
        });

    } catch (err) {
        console.error('💥 startBot error:', err.message);
        isBotRunning = false;
        setTimeout(() => startBot(), 5000);
    }
}

// ==================== DATABASE HEARTBEAT ====================
let _heartbeatRunning = false;
cron.schedule('*/5 * * * *', async () => {
    if (_heartbeatRunning) return;
    _heartbeatRunning = true;
    try {
        await db.query('SELECT 1');
    } catch (err) {
        console.log('💔 DB Heartbeat failed:', err.message);
    } finally {
        _heartbeatRunning = false;
    }
});

process.on('uncaughtException', (err) => {
    if (err.message?.includes('Connection Closed') || err.output?.statusCode === 428) {
        console.log('⚠️ Connection dropped — bot will reconnect automatically.');
        return;
    }
    console.error('💥 UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
    // Don't exit — try to keep the process alive
});

process.on('unhandledRejection', (reason, promise) => {
    const msg = reason?.message || String(reason);
    if (msg.includes('Connection Closed') || reason?.output?.statusCode === 428) {
        console.log('⚠️ Send failed (connection was closed) — ignoring, will reconnect.');
        return;
    }
    console.error('💥 UNHANDLED REJECTION:', msg);
    console.error(reason?.stack || reason);
});

process.on('SIGTERM', () => {
    console.log('⚠️ SIGTERM received — Render is restarting the service.');
    // Give existing operations 5 seconds to finish then exit cleanly
    setTimeout(() => process.exit(0), 5000);
});

process.on('exit', (code) => {
    console.log(`💀 Process exiting with code ${code}`);
});

// ==================== CRON JOBS ====================
const { spawnDungeon, getWeightedDungeonRank, getActiveDungeon } = require('./src/engine/dungeon');

cron.schedule('0 */1 * * *', async () => {
    if (!isReady || !sock) { console.log('⏭️ Spawn skipped — bot not ready.'); return; }
    console.log('🕒 Scheduled dungeon spawn triggered.');
    try {
        let isEventRunning = false;
        try {
            const [eventRows] = await db.execute("SELECT id FROM events WHERE is_active=1 AND ends_at > NOW() LIMIT 1");
            isEventRunning = eventRows.length > 0;
        } catch (e) { isEventRunning = false; }
        if (isEventRunning) { console.log('⏭️ Regular spawn skipped — event active.'); return; }

        const LRJID = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
        const [terrActive] = await db.execute("SELECT id FROM dungeon WHERE is_active=1 AND dungeon_rank LIKE 'TERRITORY_%' AND (group_jid=? OR group_jid IS NULL) LIMIT 1", [LRJID]);
        if (terrActive.length) { console.log('⏭️ Spawn skipped — territory assault active.'); return; }

        const active = await getActiveDungeon();
        if (active) {
            const [pc] = await db.execute("SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=? AND is_alive=1", [active.id]);
            if (pc[0].cnt > 0 || active.locked === 1) { console.log(`⏭️ Skipping — dungeon ${active.id} has ${pc[0].cnt} players.`); return; }
            console.log(`🧹 Closing stale dungeon ${active.id}.`);
        }
        const rank = await getWeightedDungeonRank();
        console.log(`🎲 Weighted rank selected: ${rank}`);
        await spawnDungeon(rank, sock);
    } catch (err) {
        console.error('Scheduled spawn failed:', err);
    }
});

cron.schedule('*/20 * * * *', async () => {
    if (!isReady || !sock) return;
    try {
        let hasActiveEvent = false;
        try {
            const [eventRows] = await db.execute("SELECT id FROM events WHERE is_active=1 AND ends_at > NOW() LIMIT 1");
            hasActiveEvent = eventRows.length > 0;
        } catch (e) { hasActiveEvent = false; }
        if (!hasActiveEvent) return;

        const LRJID2 = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
        const [terrActiveE] = await db.execute("SELECT id FROM dungeon WHERE is_active=1 AND dungeon_rank LIKE 'TERRITORY_%' AND (group_jid=? OR group_jid IS NULL) LIMIT 1", [LRJID2]);
        if (terrActiveE.length) { console.log('⏭️ Event spawn skipped — territory assault active.'); return; }

        const active = await getActiveDungeon();
        if (active) {
            const [pc] = await db.execute("SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=? AND is_alive=1", [active.id]);
            if (pc[0].cnt > 0 || active.locked === 1) { console.log(`⏭️ Event spawn skipped — dungeon ${active.id} active.`); return; }
        }
        const rank = await getWeightedDungeonRank();
        console.log(`💠 Event dungeon spawn: ${rank}`);
        await spawnDungeon(rank, sock);
    } catch (err) {
        console.error('Event spawn failed:', err);
    }
});

// ==================== EVENT AUTO-END ====================
cron.schedule('8-59/10 * * * *', async () => {
    try {
        const [expired] = await db.execute("SELECT * FROM events WHERE is_active=1 AND ends_at <= NOW() LIMIT 1");
        if (!expired.length) return;
        console.log(`⏰ Event "${expired[0].name}" expired — ending with leaderboard.`);
        const { endEvent } = require('./src/commands/event');
        await endEvent(expired[0].id, sock);
    } catch (e) {
        console.error('Event auto-end error:', e.message);
    }
});

// ==================== SHOP RESTOCK ====================
const { restockAllItems } = require('./src/systems/shopSystem');
cron.schedule('0 0 * * *', async () => {
    console.log('🛒 Restocking shop...');
    try { await restockAllItems(); } catch (err) { console.error('Shop restock failed:', err); }
});

// ==================== PRESTIGE SHOP RESTOCK ====================
cron.schedule('5 0 * * *', async () => {
    console.log('💎 Restocking prestige shop...');
    try { await restockPrestigeShop(); } catch (err) { console.error('Prestige shop restock failed:', err); }
});

startBot();

// ==================== WEEKLY BOUNTY ====================
cron.schedule('0 8 * * 1', async () => {
    if (!isReady || !sock) return;
    try {
        const { selectWeeklyTarget } = require('./src/commands/bounty');
        const target = await selectWeeklyTarget();
        if (!target) return;
        const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
        await sock.sendMessage(RAID_GROUP, {
            text:
                `╔══〘 🎯 MOST WANTED 〙══╗
` +
                `┃◆
` +
                `┃◆ A new bounty has been posted.
` +
                `┃◆
` +
                `┃◆ 🎯 *${target.nickname}* [${target.rank}]
` +
                `┃◆
` +
                `┃◆ This hunter has proven themselves
` +
                `┃◆ too dangerous to ignore.
` +
                `┃◆
` +
                `┃◆ 💰 Reward: ${target.reward_gold?.toLocaleString()}G
` +
                `┃◆ ⭐ Reward: ${target.reward_xp?.toLocaleString()} XP
` +
                `┃◆
` +
                `┃◆ Duel them. Beat them.
` +
                `┃◆ Then !bounty claim to collect.
` +
                `┃◆
` +
                `┃◆ Good luck. You'll need it.
` +
                `╚═══════════════════════════╝`
        });
        console.log(`🎯 Weekly bounty set: ${target.nickname}`);
    } catch(e) { console.error('Bounty cron error:', e.message); }
});

// ==================== MANA REGENERATION ====================
cron.schedule('2-59/10 * * * *', async () => {
    try {
        await db.execute(`
            UPDATE players 
            SET mana = LEAST(max_mana, mana + GREATEST(1, FLOOR(max_mana / 48)))
            WHERE mana < max_mana AND max_mana > 0
        `);
    } catch(e) { console.error('Mana regen error:', e.message); }
});

// ==================== FATIGUE RECOVERY ====================
cron.schedule('4-59/10 * * * *', async () => {
    try {
        await db.execute(`
            UPDATE players
            SET fatigue = GREATEST(0, COALESCE(fatigue, 0) - 5)
            WHERE fatigue > 0
        `);
    } catch(e) { console.error('Fatigue recovery error:', e.message); }
});


// ==================== WEEKLY INACTIVE CLEANUP ====================
cron.schedule('0 3 * * 1', async () => {
    try {
        const { clearInactivePlayers } = require('./src/systems/prestigeSystem');
        await clearInactivePlayers();
        console.log('🧹 Weekly inactive player cleanup done');
    } catch(e) { console.error('Cleanup error:', e.message); }
});

// ==================== PRESTIGE DUNGEON SPAWN ====================
cron.schedule('30 */1 * * *', async () => {
    if (!isReady || !sock) return;
    try {
        const [prestigePlayers] = await db.execute(
            "SELECT DISTINCT prestige_level FROM players WHERE prestige_level > 0 LIMIT 1"
        );
        if (!prestigePlayers.length) return;

        const LIVE_GP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
        const [anyActive] = await db.execute("SELECT id FROM dungeon WHERE is_active=1 AND (group_jid=? OR group_jid IS NULL) LIMIT 1", [LIVE_GP]);
        if (anyActive.length) { console.log('⏭️ Prestige cron skipped — dungeon active'); return; }

        const [recentP] = await db.execute(
            "SELECT id FROM dungeon WHERE dungeon_rank LIKE 'P%' AND created_at > DATE_SUB(NOW(), INTERVAL 25 MINUTE) LIMIT 1"
        );
        if (recentP.length) { console.log('⏭️ Prestige cron skipped — ran recently'); return; }

        const { spawnPrestigeDungeon, getWeightedPrestigeRank } = require('./src/engine/prestigeDungeon');
        const RAID_GROUP = process.env.RAID_GROUP_JID || process.env.GROUP_JID;
        if (!RAID_GROUP) { console.error('★ No RAID_GROUP_JID — cannot spawn prestige dungeon'); return; }

        const prestigeRank = await getWeightedPrestigeRank();
        console.log(`✦ Prestige cron spawn: ${prestigeRank}`);
        await spawnPrestigeDungeon(prestigeRank, sock, RAID_GROUP);
    } catch(e) { console.error('Prestige cron spawn error:', e.message); }
});