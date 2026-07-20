require('dotenv').config();

const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    initAuthCreds,
    BufferJSON,
    downloadMediaMessage,
    S_WHATSAPP_NET
} = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const db = require('./src/database/db');
// Per-execution raid group context — replaces global.overrideRaidGroup race condition
const { runWithGroup } = require('./src/utils/raidContext');

const app = express();
const PORT = process.env.PORT || 3000;
let lastQR = '';
let lastPairingCode = '';
let isReady        = false;
let isBotRunning   = false;
let pairAttempts   = 0;
const MAX_PAIR_ATTEMPTS = 3;
// Under heavy load WhatsApp can throw a spurious 401. Wiping the session forces
// a manual re-link, so try the EXISTING session a couple times before giving up.
let consecutive401 = 0;
const SOFT_401_RETRIES = 2;
const PAIR_COOLDOWN_MS  = 30 * 60 * 1000; // 30 min cooldown after cap
// Global reconnect-failure governor: any run of failed connects (no successful
// 'open' between them) that hits this cap STOPS all reconnects. Prevents the
// tight reconnect spam (403/503/etc.) that gets a number flagged/banned.
let consecutiveCloses = 0;
const MAX_CONSECUTIVE_CLOSES = 3;
// Set on SIGTERM. Render's zero-downtime deploys run OLD and NEW instances
// simultaneously; if the old one keeps reconnecting, the two fight over the
// single WhatsApp session (each connect 401-kicks the other) — flagged fast.
// When true: no reconnects, no forceReconnect, no startBot. Die quietly.
let shuttingDown = false;
// Pairing-code governor — see the qr handler. Requesting a new link code on
// every ~20s QR rotation is itself number-flagging behavior.
let lastPairingCodeAt = 0;
let pairingCodesThisBoot = 0;
const PAIRING_CODE_INTERVAL_MS = 3 * 60 * 1000;
const MAX_PAIRING_CODES_PER_BOOT = 3;

// Load pair attempts from DB on startup (survives Render restarts)
async function loadPairAttempts() {
    try {
        await db.execute(`CREATE TABLE IF NOT EXISTS pair_state (
            k VARCHAR(50) PRIMARY KEY, v TEXT
        )`);
        const [rows] = await db.execute("SELECT v FROM pair_state WHERE k='pair_data'");
        if (rows.length) {
            const data = JSON.parse(rows[0].v);
            pairAttempts = data.attempts || 0;
            const elapsed = Date.now() - (data.lastAttempt || 0);
            // Reset after cooldown
            if (elapsed > PAIR_COOLDOWN_MS) {
                pairAttempts = 0;
                await savePairAttempts();
            }
            console.log(`📊 Pair attempts loaded: ${pairAttempts}/${MAX_PAIR_ATTEMPTS}`);
        }
    } catch(e) { console.error('Pair state load error:', e.message); }
}
async function savePairAttempts() {
    try {
        await db.execute(
            "INSERT INTO pair_state (k, v) VALUES ('pair_data', ?) ON DUPLICATE KEY UPDATE v=?",
            [JSON.stringify({ attempts: pairAttempts, lastAttempt: Date.now() }),
             JSON.stringify({ attempts: pairAttempts, lastAttempt: Date.now() })]
        );
    } catch(e) {}
}
async function resetPairAttempts() {
    pairAttempts = 0;
    await savePairAttempts();
}
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

// ── LIVENESS HEARTBEAT ────────────────────────────────────────────────────
// The "stuck connecting" watchdog above only fires when !isReady. It does NOT
// cover a ZOMBIE socket: a black-holed TCP connection where the peer vanished
// without a FIN/RST. In that state Baileys never emits 'close', isReady stays
// true, and sends silently buffer into the dead socket (cron "succeeds" in the
// logs but nothing reaches WhatsApp) — for hours, until the server reaps it.
//
// Baileys' own keepAlive is meant to catch this but empirically does not here.
// So we run an INDEPENDENT active probe: send the same w:p ping and require a
// round-trip response within a hard timeout. Two consecutive misses => the
// connection is dead; force a clean reconnect immediately instead of waiting
// hours. A server error response still counts as ALIVE (we got a round-trip).
// Timestamp of the last inbound event of ANY kind (message/receipt/presence).
// Bumped by listeners registered in startBot(). Used by the receive watchdog
// below to catch the case where the socket is alive but Baileys has stopped
// delivering incoming events.
let lastInbound = Date.now();
let lastForcedReconnect = 0;

// ── EVENT-LOOP LAG MONITOR ────────────────────────────────────────────────────
// Distinguishes "actually dead" from "saturated but alive". A 1s timer that
// fires much later means the loop is overloaded (a big raid), NOT that the
// connection died. We use this to SUPPRESS forced reconnects during saturation:
// reconnecting mid-overload just adds load and — worse — the churn/conflict can
// make WhatsApp log the device out, forcing a manual re-link.
let loopLag = 0;
let lagLastTick = Date.now();
setInterval(() => {
    const now = Date.now();
    loopLag = Math.max(0, now - lagLastTick - 1000);
    lagLastTick = now;
}, 1000);
const SATURATION_LAG_MS = 5000;

function forceReconnect(reason) {
    if (shuttingDown) return;
    // If the event loop is badly lagged we're saturated, not dead — a reconnect
    // now would worsen it and risk a WhatsApp logout. Let it drain instead.
    if (loopLag > SATURATION_LAG_MS) {
        console.warn(`⏳ Skipping reconnect (${reason}) — event loop lagged ${loopLag}ms, likely saturation not death.`);
        heartbeatFails = 0;
        return;
    }
    console.log(`🔁 Forcing reconnect — ${reason}`);
    lastForcedReconnect = Date.now();
    heartbeatFails = 0;
    lastInbound = Date.now(); // reset so the fresh socket isn't instantly re-flagged
    isReady = false;
    isBotRunning = false;
    // removeAllListeners first so closing this socket does NOT re-enter the
    // connection.update handler (which would schedule its own startBot()).
    try { sock?.ev?.removeAllListeners(); } catch(e) {}
    try { sock?.end?.(new Error(reason)); } catch(e) {}
    try { sock?.ws?.close(); } catch(e) {}
    sock = null;
    startBot();
}

let heartbeatFails = 0;
let heartbeatInFlight = false;
// Conservative (8 min) so quiet periods don't trigger false-positive reconnects
// that hammer Render / churn the WhatsApp connection. Tunable via env.
const RECEIVE_STALL_MS   = (parseInt(process.env.RECEIVE_STALL_MIN) || 8) * 60 * 1000;
const RECONNECT_COOLDOWN = 15 * 60 * 1000;  // don't force-reconnect more than once per 15 min
setInterval(async () => {
    if (!isReady || !sock || heartbeatInFlight) return;
    heartbeatInFlight = true;
    let alive = false;
    try {
        await Promise.race([
            sock.query({
                tag: 'iq',
                attrs: { to: S_WHATSAPP_NET, type: 'get', xmlns: 'w:p' },
                content: [{ tag: 'ping', attrs: {} }]
            }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('hb-timeout')), 15000))
        ]);
        alive = true; // got a normal response
    } catch (e) {
        // Only our own timeout means "no round-trip". A server-side error node
        // means the socket is alive and talking, so don't treat it as a zombie.
        alive = e?.message !== 'hb-timeout';
    } finally {
        heartbeatInFlight = false;
    }

    // ── CASE 1: socket-level zombie (no round-trip at all) ────────────────
    if (!alive) {
        heartbeatFails++;
        console.log(`💓 Heartbeat: no round-trip (${heartbeatFails}/2) — connection may be a zombie.`);
        if (heartbeatFails >= 2) forceReconnect('heartbeat: connection dead (no round-trip)');
        return;
    }
    heartbeatFails = 0;

    // ── CASE 2: socket is alive but Baileys stopped delivering events ─────
    // The ping round-trips fine, yet no messages/receipts/presence have come
    // in for minutes. That's a receive-pipeline stall the socket probe can't
    // see. Force a reconnect (rate-limited so genuine idle can't cause churn).
    const inboundAge = Date.now() - lastInbound;
    if (inboundAge > RECEIVE_STALL_MS && (Date.now() - lastForcedReconnect) > RECONNECT_COOLDOWN) {
        forceReconnect(`receive stall: socket alive but no inbound events for ${Math.round(inboundAge/1000)}s`);
    }
}, 30 * 1000); // probe every 30s

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

// ── GLOBAL COMMAND CONCURRENCY LIMITER (backpressure) ─────────────────────────
// Combat commands fire dozens of sequential DB queries each. During a big raid,
// 20+ players issuing them at once thrash the event loop and exhaust the 10-conn
// DB pool, so everything backs up and throughput collapses (the "died under
// pressure" symptom). Capping how many commands run AT ONCE keeps the pool
// un-starved so each command finishes fast — higher total throughput under load,
// and it degrades gracefully instead of falling over.
// Scaled down for Render's 0.1 CPU (was 6). Raise via env on a bigger host.
const MAX_CONCURRENT_COMMANDS = parseInt(process.env.MAX_CONCURRENT_COMMANDS) || 4;
let activeCommands = 0;
const commandWaiters = [];
function acquireCommandSlot() {
    if (activeCommands < MAX_CONCURRENT_COMMANDS) { activeCommands++; return Promise.resolve(); }
    return new Promise(resolve => commandWaiters.push(resolve));
}
function releaseCommandSlot() {
    const next = commandWaiters.shift();
    if (next) next();            // hand the slot straight to the next waiter
    else if (activeCommands > 0) activeCommands--;
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

// Identity handling lives in ONE place now — src/utils/identity.js.
const { normalizeId, normalizeDMJid } = require('./src/utils/identity');

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

// Item-management commands blocked for Ascendants — they are beyond items.
const ASCENDANT_BLOCKED = new Set([
    'shop', 'buy', 'forge', 'equip', 'unequip', 'usepotion', 'brew', 'upgrade', 'repair'
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
                    global.commands = commands; // enable !evolve hot-reload of command modules
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
    // Use the DEDICATED auth pool so session writes are never starved by
    // gameplay load on the main pool during a raid (starved writes => corrupted
    // persisted session => forced re-link).
    const authDb = db.authPool || db;

    await authDb.execute(`
        CREATE TABLE IF NOT EXISTS wa_sessions (
            id VARCHAR(50) PRIMARY KEY,
            data_key VARCHAR(255) NOT NULL,
            data_value LONGTEXT NOT NULL,
            UNIQUE KEY unique_session_key (id, data_key(100))
        )
    `).catch(() => {});

    // Retry session writes — a transient failure here silently corrupts the
    // session, so we never want a single hiccup to lose a key/cred update.
    const writeData = async (key, value) => {
        const json = JSON.stringify(value, BufferJSON.replacer);
        let lastErr;
        for (let attempt = 1; attempt <= 4; attempt++) {
            try {
                await authDb.execute(
                    'INSERT INTO wa_sessions (id, data_key, data_value) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE data_value = ?',
                    [SESSION_ID, key, json, json]
                );
                return;
            } catch (e) {
                lastErr = e;
                await new Promise(r => setTimeout(r, 200 * attempt));
            }
        }
        console.error(`[AUTH WRITE FAILED] key="${key}" after retries — session persistence at risk: ${lastErr?.message}`);
    };

    const readData = async (key) => {
        const [rows] = await authDb.execute(
            'SELECT data_value FROM wa_sessions WHERE id = ? AND data_key = ?',
            [SESSION_ID, key]
        );
        if (rows.length) return JSON.parse(rows[0].data_value, BufferJSON.reviver);
        return null;
    };

    const removeData = async (key) => {
        await authDb.execute(
            'DELETE FROM wa_sessions WHERE id = ? AND data_key = ?',
            [SESSION_ID, key]
        ).catch(() => {});
    };

    const creds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                // Batch fetch — ONE query instead of N sequential round-trips.
                // Baileys hits this on every encrypt/decrypt (session/sender-key/
                // pre-key lookups); in a busy group a single incoming message can
                // request a dozen+ ids. Awaiting them one at a time over a remote
                // DB connection was N×RTT of latency stacked onto every message —
                // the main source of the bot's sluggishness under load.
                get: async (type, ids) => {
                    const data = {};
                    if (!ids.length) return data;
                    const keys = ids.map(id => `${type}-${id}`);
                    const [rows] = await authDb.execute(
                        `SELECT data_key, data_value FROM wa_sessions WHERE id = ? AND data_key IN (${keys.map(() => '?').join(',')})`,
                        [SESSION_ID, ...keys]
                    );
                    const rowMap = Object.fromEntries(rows.map(r => [r.data_key, r.data_value]));
                    for (const id of ids) {
                        const raw = rowMap[`${type}-${id}`];
                        if (raw) data[id] = JSON.parse(raw, BufferJSON.reviver);
                    }
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const [type, values] of Object.entries(data)) {
                        for (const [id, value] of Object.entries(values || {})) {
                            tasks.push(value ? writeData(`${type}-${id}`, value) : removeData(`${type}-${id}`));
                        }
                    }
                    await Promise.all(tasks);
                }
            }
        },
        saveCreds: async () => {
            await writeData('creds', creds);
        }
    };
}

async function startBot() {
    if (shuttingDown) { console.log('⚰️ Shutting down — not (re)connecting.'); return; }
    if (isBotRunning) return;
    isBotRunning = true;
    await loadPairAttempts();
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
            keepAliveIntervalMs: 20000,
            // Default is 20s. Under real load (decrypting a busy raid group) the
            // handshake can miss that window, which registers as a connection
            // failure and fires ANOTHER connect attempt — the exact rapid-retry
            // pattern that gets a number flagged. 60s matches the known-stable
            // reference bot's setting.
            connectTimeoutMs: 60000,
        });

        // ── OUTBOUND SEND THROTTLE ─────────────────────────────────────────
        // Combat/tournament resolution fires several sendMessage calls back to
        // back (attack line, blessing procs, kill announce, next-turn prompt)
        // — a burst of messages landing in the SAME chat within milliseconds
        // is exactly the pattern WhatsApp's abuse detection watches for. Space
        // sends to the same jid out with a minimum gap + jitter so it reads as
        // pacing, not a script dumping a buffer. Per-jid ordering is preserved;
        // different chats are NOT held up by each other's queue.
        const _rawSendMessage = sock.sendMessage.bind(sock);
        const _sendQueues = new Map(); // jid -> promise chain
        const _lastSendAt  = new Map(); // jid -> ts of last actual send
        const SEND_MIN_GAP_MS = 600;
        sock.sendMessage = (jid, content, options) => {
            const prevChain = _sendQueues.get(jid) || Promise.resolve();
            const nextChain = prevChain.then(async () => {
                const wait = SEND_MIN_GAP_MS - (Date.now() - (_lastSendAt.get(jid) || 0));
                if (wait > 0) await new Promise(r => setTimeout(r, wait + Math.floor(Math.random() * 250)));
                _lastSendAt.set(jid, Date.now());
                return _rawSendMessage(jid, content, options);
            });
            // Detach the queue from this send's own outcome so one failed/rejected
            // send doesn't wedge every later message to the same jid.
            _sendQueues.set(jid, nextChain.catch(() => {}));
            return nextChain;
        };

        const thisSock = sock;

        // Bump inbound-activity timestamp on ANY incoming event. The receive
        // watchdog uses this to detect a stalled receive pipeline (socket alive
        // but Baileys no longer delivering events).
        const bumpInbound = () => { if (sock === thisSock) lastInbound = Date.now(); };
        sock.ev.on('messages.upsert', bumpInbound);
        sock.ev.on('messages.update', bumpInbound);
        sock.ev.on('message-receipt.update', bumpInbound);
        sock.ev.on('presence.update', bumpInbound);

        sock.ev.on('creds.update', async () => {
            if (sock !== thisSock) return; // stale socket — ignore
            await saveCreds();
            // Only log when ACTUALLY paired — registrationId exists even before
            // pairing (initAuthCreds pre-creates it), which made the log print
            // "Paired!" on every creds save while still unpaired.
            if (state.creds?.registered && !isReady) {
                console.log(`📱 Paired! registrationId: ${state.creds.registrationId}`);
            }
        });

        sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                lastQR = qr;
                isReady = false;
                console.log("📲 QR generated — open your Render URL");
                // Baileys rotates the QR every ~20s while unpaired. Requesting a
                // pairing code on EVERY rotation hammered WhatsApp with a new
                // link-code request each time (6+/3min) — flagging behavior all
                // by itself. Governor: max one code per PAIRING_CODE_INTERVAL_MS,
                // max MAX_PAIRING_CODES_PER_BOOT per process. The QR itself keeps
                // rotating on the dashboard regardless.
                setTimeout(async () => {
                    try {
                        if (sock?.user) return;
                        if (pairAttempts >= MAX_PAIR_ATTEMPTS) {
                            console.log('🛑 Pair cap reached — not requesting new code. Wait 30 min or restart manually.');
                            return;
                        }
                        if (Date.now() - lastPairingCodeAt < PAIRING_CODE_INTERVAL_MS) return; // current code still valid — don't invalidate it
                        if (pairingCodesThisBoot >= MAX_PAIRING_CODES_PER_BOOT) {
                            console.log('🛑 Pairing-code cap for this boot reached — scan the QR instead, or restart to get a fresh code.');
                            return;
                        }
                        const phoneNumber = process.env.BOT_PHONE_NUMBER;
                        if (!phoneNumber) {
                            console.warn("⚠️ BOT_PHONE_NUMBER not set in .env — skipping pairing code");
                            return;
                        }
                        lastPairingCodeAt = Date.now();
                        pairingCodesThisBoot++;
                        const code = await sock.requestPairingCode(phoneNumber);
                        lastPairingCode = code;
                        console.log(`📱 PAIRING CODE: ${code} (${pairingCodesThisBoot}/${MAX_PAIRING_CODES_PER_BOOT} this boot)`);
                    } catch (e) {
                        console.error("Pairing code error:", e.message);
                    }
                }, 5000);
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

                if (shuttingDown) { console.log('⚰️ Closed during shutdown — no reconnect.'); return; }

                consecutiveCloses++;

                // ── REFUSAL codes → STOP, never loop. Rapidly reconnecting a
                // number WhatsApp is refusing is exactly what escalates to a ban.
                if (statusCode === DisconnectReason.loggedOut) { // 401
                    consecutive401++;
                    if (consecutive401 <= SOFT_401_RETRIES) {
                        console.log(`🔄 401/logout — soft retry ${consecutive401}/${SOFT_401_RETRIES} with EXISTING session...`);
                        setTimeout(() => startBot(), 20000);
                        return;
                    }
                    console.log('🛑 Persistent 401 — WhatsApp logged this session out. Clearing session and STOPPING.');
                    console.log('🛑 Auto re-pair DISABLED (it triggers bans). RESTART the service manually to re-link.');
                    await db.execute("DELETE FROM wa_sessions WHERE id='aria-bot'").catch(() => {});
                    consecutive401 = 0;
                    return; // STOP
                }
                if (statusCode === 403 || statusCode === 405) {
                    console.log(`🛑 Connection ${statusCode} — WhatsApp is REFUSING this number (blocked/restricted).`);
                    console.log('🛑 STOPPING all reconnects — looping here is what escalates to a full ban.');
                    console.log('🛑 This number is likely flagged. Switch numbers and RESTART manually.');
                    return; // STOP
                }

                // ── Global safety cap (any code): too many failures in a row → STOP.
                if (consecutiveCloses >= MAX_CONSECUTIVE_CLOSES) {
                    console.log(`🛑 ${consecutiveCloses} reconnect failures in a row — STOPPING to avoid flagging the number. Restart manually.`);
                    return; // STOP
                }

                // ── Transient codes → reconnect with GROWING backoff (10s,20s,...,60s).
                if (statusCode === 515) {
                    console.log('🔄 Restart required (515) — reconnecting in 3s...');
                    setTimeout(() => startBot(), 3000);
                } else {
                    const delay = Math.min(10000 * consecutiveCloses, 60000) + Math.floor(Math.random() * 5000);
                    console.log(`⏳ Reconnecting in ${Math.floor(delay/1000)}s (attempt ${consecutiveCloses}/${MAX_CONSECUTIVE_CLOSES})...`);
                    setTimeout(() => startBot(), delay);
                }
            } else if (connection === 'open') {
                resetPairAttempts(); // Persist reset to DB
                const rawId  = sock.user?.id  || '';
                const rawLid = sock.user?.lid || '';
                BOT_NUMBER = rawId.replace(/@[^@]+$/, '').split(':')[0].trim();
                BOT_LID    = rawLid.replace(/@[^@]+$/, '').split(':')[0].trim();
                console.log(`✅ ARIA ONLINE | number: ${BOT_NUMBER} | lid: ${BOT_LID}`);
                isReady = true;
                lastInbound = Date.now(); // fresh connection — reset receive-stall clock
                consecutive401 = 0;       // connected fine — clear the soft-retry counter
                consecutiveCloses = 0;    // clear the global reconnect-failure counter

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

            // EXPERIMENT: never process the bot's OWN account's messages, even if
            // fromMe wasn't set (multi-device/LID can misflag self-messages). The
            // linked number was seeing/echoing its own traffic — this cuts that.
            if ((BOT_NUMBER && userId === BOT_NUMBER) || (BOT_LID && userId === BOT_LID)) {
                console.log(`[SELF] Ignored own-account message (userId=${userId})`);
                return;
            }

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
                // In the test group the !resonance command runs under the tester's
                // demo id (e.g. "<num>_test"), so the flow was started under THAT id.
                // Resolve the same effective id here — otherwise the interceptor
                // checks the raw id and never matches the flow the command wrote.
                let flowUserId = userId;
                try {
                    if (jid === TEST_GROUP_JID) {
                        const { activeTesterSessions } = require('./src/commands/tester');
                        if (activeTesterSessions?.has(userId)) flowUserId = activeTesterSessions.get(userId);
                    }
                } catch(e) {}
                if (isInResFlow(flowUserId)) {
                    const flowReply = async (content) => {
                        const mc = typeof content === 'string' ? { text: content } : content;
                        const opts = jid.endsWith('@g.us') ? { quoted: msg } : {};
                        return await sock.sendMessage(jid, mc, opts);
                    };
                    const flowMsg = { reply: flowReply, from: jid };
                    const consumed = await handleResonanceFlow(flowUserId, text, msg, flowMsg, sock);
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
                    // VIPs get the gold interface on EVERY command reply — the
                    // standard UI is restyled here at the send layer (cached
                    // check, 60s TTL) so no command file needs to know about it.
                    try {
                        const { isVipCached, applyVipStyle } = require('./src/systems/subscriberSystem');
                        if (await isVipCached(userId)) {
                            if (messageContent.text)    messageContent.text    = applyVipStyle(messageContent.text);
                            if (messageContent.caption) messageContent.caption = applyVipStyle(messageContent.caption);
                        }
                    } catch(e) {}
                    // Never touch a null/reconnecting socket — that threw
                    // "Cannot read properties of null (reading 'sendMessage')"
                    // and hung the command slot when a 440 hit mid-reply.
                    if (!sock || !isReady) {
                        console.log(`[SEND SKIP] socket down — dropped reply to ${jid}`);
                        return;
                    }
                    // Media replies skip the quoted context: quoting in a group
                    // forces a group-metadata fetch that fails on Baileys 7
                    // ("missing <group> node") and stalls image sends like !vip.
                    const isMedia = messageContent && (messageContent.image || messageContent.video || messageContent.document || messageContent.sticker);
                    const sendOpts = (isDM || isMedia) ? {} : { quoted: msg };
                    try {
                        // Cap the send so a flaky connection / metadata stall can't
                        // tie up the command slot for the whole 60s timeout.
                        return await Promise.race([
                            sock.sendMessage(jid, messageContent, sendOpts),
                            new Promise((_, rej) => setTimeout(() => rej(new Error('send timeout 20s')), 20000))
                        ]);
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

            // Ascendants are beyond items — block item-management commands for them.
            if (ASCENDANT_BLOCKED.has(cmdName)) {
                try {
                    const { isResonated } = require('./src/systems/ascendantSystem');
                    if (await isResonated(effectiveUserId)) {
                        return await sock.sendMessage(jid, {
                            text:
                                `╭══〘 ✧ ASCENDANT 〙══╮\n` +
                                `┃✧ You have transcended items.\n` +
                                `┃✧ No shops, no forge, no potions.\n` +
                                `┃✧ Your power is your own now.\n` +
                                `╰═══════════════════════╯`
                        }, isDM ? {} : { quoted: msg });
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
                    // Backpressure: wait for a free slot before running the command.
                    await acquireCommandSlot();
                    try {
                        await Promise.race([
                            runWithGroup(executionGroupJid, () =>
                                command.execute(fakeMsg, args, { userId: effectiveUserId, isAdmin, client: sock })
                            ),
                            // Safety valve: never let one hung command hold a slot forever
                            // and deadlock the limiter. Release after 60s and move on.
                            new Promise((_, reject) => setTimeout(() => reject(new Error('cmd-slot-timeout')), 60000))
                        ]);
                    } catch (execErr) {
                        if (execErr?.message === 'cmd-slot-timeout') {
                            console.warn(`[CMD TIMEOUT] ${cmdName} by ${userId} exceeded 60s — slot released`);
                        } else {
                            console.error("Command Error:", execErr);
                            await sock.sendMessage(jid, { text: "❌ An error occurred." }, isDM ? {} : { quoted: msg });
                        }
                    } finally {
                        playerCache.delete(userId);
                        releaseCommandSlot();
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
    console.log('⚠️ SIGTERM — releasing the WhatsApp session NOW so the replacement instance can take it without a fight.');
    shuttingDown = true;
    isReady = false;
    isBotRunning = false;
    // Close the socket immediately — the new deploy instance is about to (or
    // already trying to) use these same credentials. removeAllListeners first
    // so the close doesn't schedule a reconnect.
    try { sock?.ev?.removeAllListeners(); } catch(e) {}
    try { sock?.end?.(new Error('sigterm')); } catch(e) {}
    try { sock?.ws?.close(); } catch(e) {}
    sock = null;
    setTimeout(() => process.exit(0), 3000);
});

process.on('exit', (code) => {
    console.log(`💀 Process exiting with code ${code}`);
});

// ==================== CRON JOBS ====================
// All scheduled jobs live in src/boot/crons.js (extracted from index.js).
// Registered ONCE at boot; the accessors hand each tick the LIVE socket and
// ready flag, exactly like the old closures over module-level variables did.
require('./src/boot/crons').registerCrons({
    getSock: () => sock,
    isReady: () => isReady,
});

// ── DEPLOY-SAFE STARTUP ──────────────────────────────────────────────────────
// Render's zero-downtime deploy runs the OLD instance until this one is live.
// Connecting immediately means two processes fight over the one WhatsApp
// session (each connect 401-kicks the other) — prime number-flagging behavior.
// The Express port above is already open (that's what makes Render mark us
// live and SIGTERM the old instance), so wait for the old one to release the
// session before we touch it. Tunable via CONNECT_DELAY_MS.
const CONNECT_DELAY_MS = parseInt(process.env.CONNECT_DELAY_MS || '20000');
console.log(`⏳ Waiting ${Math.round(CONNECT_DELAY_MS / 1000)}s before connecting — letting any previous deploy instance release the session...`);
setTimeout(() => startBot(), CONNECT_DELAY_MS);
