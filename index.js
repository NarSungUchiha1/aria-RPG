require('dotenv').config();
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    initAuthCreds,
    BufferJSON
} = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const pino = require('pino');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const db = require('./src/database/db');

// ==================== EXPRESS SERVER ====================
const app = express();
const PORT = process.env.PORT || 3000;
let lastQR = '';
let lastPairingCode = '';
let isReady = false;
let isBotRunning = false;

app.get('/ping', (req, res) => res.status(200).send('OK'));

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

// ==================== ADMIN SYSTEM ====================
const ADMIN_FILE = path.join(__dirname, "admin.json");
let ADMINS = [];

if (fs.existsSync(ADMIN_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf-8"));
        ADMINS = data.admins || (data.admin ? [data.admin] : []);
        console.log("🔐 Admins loaded:", ADMINS);
    } catch (err) {
        console.error("Failed to load admin.json:", err);
    }
}

function normalizeId(id) {
    if (!id) return "";
    return id.toString().replace(/@s\.whatsapp\.net|@g\.us|@lid|@c\.us/g, "").split(":")[0].split("@")[0];
}

// ==================== CHANNEL CONFIG ====================
// Commands that ONLY work inside the dungeon group chat
const DUNGEON_GC_ONLY = new Set([
    'dungeon', 'begin', 'onward',
    'clear', 'closedungeon', 'attackboss', 'worldboss'
]);

// Commands that ONLY work in DMs with the bot
const DM_ONLY = new Set(['enter']);

// Commands that work ANYWHERE (no restriction)
// Everything else falls here: help, me, stats, shop, buy, inventory,
// equip, unequip, repair, upgradeweapon, use, duel, accept, decline,
// register, awaken, rankup, convert, upgrade, pay, transfer, trade,
// quests, claim, give, erase, promote, demote, restock, update, getgroupid, etc.

// ==================== COMMAND LOADER ====================
const commands = new Map();
const commandPath = path.join(__dirname, "src/commands");

if (fs.existsSync(commandPath)) {
    fs.readdirSync(commandPath)
        .filter(f => f.endsWith(".js"))
        .forEach(file => {
            const cmd = require('./src/commands/' + file);
            if (cmd?.name) commands.set(cmd.name, cmd);
        });
}
console.log(`📦 Loaded ${commands.size} commands`);

// ==================== MYSQL AUTH STATE ====================
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
        if (rows.length) {
            return JSON.parse(rows[0].data_value, BufferJSON.reviver);
        }
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

// ==================== BAILEYS LOGIC ====================
async function startBot() {
    if (isBotRunning) return;
    isBotRunning = true;

    try {
        // ✅ Clean up any duplicate/stale sessions before connecting
        // Keeps only the most recent creds row, removes orphaned key rows
        try {
            const [credRows] = await db.execute(
                "SELECT data_key FROM wa_sessions WHERE id='aria-bot' AND data_key='creds' LIMIT 1"
            );
            if (!credRows.length) {
                // No creds at all — wipe everything and start fresh
                await db.execute("DELETE FROM wa_sessions WHERE id='aria-bot'");
                console.log('🧹 No creds found — session wiped for fresh start.');
            }
        } catch (e) {}
        const { state, saveCreds } = await useMySQLAuthState();
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            getMessage: async () => ({ conversation: '' }),
            // Suppress verbose session management logs
            printQRInTerminal: false
        });

        sock.ev.on('creds.update', async () => {
            await saveCreds();
            // ✅ Guard: if registrationId doesn't match our known bot session, reject it
            const KNOWN_REG_ID = 581496701;
            if (state.creds?.registrationId && state.creds.registrationId !== KNOWN_REG_ID) {
                console.error(`🚨 INTRUDER DETECTED — registrationId mismatch!`);
                console.error(`   Expected: ${KNOWN_REG_ID}`);
                console.error(`   Got:      ${state.creds.registrationId}`);

                // ✅ Warn the intruder before kicking them
                try {
                    const adminId = process.env.BOT_PHONE_NUMBER
                        ? `${process.env.BOT_PHONE_NUMBER}@s.whatsapp.net`
                        : null;

                    // Message them directly on their own session before we wipe it
                    if (adminId) {
                        await sock.sendMessage(adminId, {
                            text:
                                `╭══〘 🚨 ARIA SYSTEM ALERT 〙══╮\n` +
                                `┃◆ \n` +
                                `┃◆ An unauthorized session has been\n` +
                                `┃◆ detected on this number.\n` +
                                `┃◆ \n` +
                                `┃◆ ⚠️ You are not ARIA 🌍📍.\n` +
                                `┃◆ This session is will be terminated.\n` +
                                `┃◆ But before that,\n` +
                                `┃◆ I will hack you and your fada \n` +
                                `┃◆.\n` +
                                `┃◆ \n` +
                                `╰═══════════════════════════╯`
                        });
                    }
                } catch (e) {
                    console.error("Could not send intruder warning:", e.message);
                }

                console.error(`   Wiping session and forcing fresh pair...`);
                await db.execute("DELETE FROM wa_sessions WHERE id='aria-bot'");
                isBotRunning = false;
                sock.end();
                setTimeout(() => startBot(), 5000);
                return;
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
                        // ✅ Phone number from env — add BOT_PHONE_NUMBER to your .env
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
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                console.log(`⚠️ Connection closed (code: ${statusCode}). Reconnecting: ${shouldReconnect}`);
                if (shouldReconnect) {
                    // Code 440 = session conflict — wait longer to let WhatsApp clear the old session
                    const delay = statusCode === 440
                        ? 15000 + Math.floor(Math.random() * 10000)  // 15-25s for conflicts
                        : 5000  + Math.floor(Math.random() * 5000);  // 5-10s for other errors
                    console.log(`⏳ Reconnecting in ${Math.floor(delay/1000)}s...`);
                    setTimeout(() => startBot(), delay);
                }
            } else if (connection === 'open') {
                console.log('✅ ARIA ONLINE');
                isReady = true;
                lastQR = '';
                lastPairingCode = '';

                // ✅ Ensure dungeon entry tracking table exists
                await db.execute(`
                    CREATE TABLE IF NOT EXISTS dungeon_entry_log (
                        player_id   VARCHAR(50) NOT NULL,
                        entry_date  DATE        NOT NULL,
                        count       INT         NOT NULL DEFAULT 0,
                        PRIMARY KEY (player_id, entry_date)
                    )
                `).catch(() => {});

                // ✅ Clean up any stale dungeon state from previous crash/restart
                // In-memory timers and locks are gone on restart, so close any
                // unlocked (lobby) dungeons and wipe orphaned player/enemy records
                try {
                    // Close any dungeons that were in lobby (not yet started) — timers are gone
                    await db.execute(
                        "UPDATE dungeon SET is_active=0 WHERE is_active=1 AND locked=0"
                    );
                    // Wipe players/enemies from any dungeon no longer active
                    const [activeDungeons] = await db.execute(
                        "SELECT id FROM dungeon WHERE is_active=1"
                    );
                    if (!activeDungeons.length) {
                        await db.execute("DELETE FROM dungeon_players");
                        await db.execute("DELETE FROM dungeon_enemies");
                    }
                    console.log('🧹 Stale dungeon state cleared on startup.');
                } catch (e) {
                    console.error('Startup dungeon cleanup error:', e.message);
                }

                if (ADMINS.length === 0 && sock.user) {
                    const myJid = normalizeId(sock.user.id);
                    ADMINS = [myJid];
                    fs.writeFileSync(ADMIN_FILE, JSON.stringify({ admins: ADMINS }, null, 2));
                    console.log("🔐 Admin bootstrapped:", myJid);
                }

                try {
                    // Shop restocks daily via cron — no need to force restock on every restart
                } catch (e) {
                    console.error("Initial shop restock failed:", e);
                }
            }
        });

        sock.ev.on('messages.upsert', async ({ messages }) => {
            const msg = messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const jid = msg.key.remoteJid;
            const senderJid = msg.key.participant || jid;
            const userId = normalizeId(senderJid);

            const text = msg.message.conversation ||
                         msg.message.extendedTextMessage?.text ||
                         msg.message.imageMessage?.caption ||
                         "";

            if (!text.startsWith('!')) return;

            const args = text.slice(1).trim().split(/\s+/);
            const cmdName = args.shift().toLowerCase();

            const command = commands.get(cmdName);
            if (!command) return;

            // ==================== CHANNEL ROUTING ====================
            const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
            const isDM = !jid.endsWith('@g.us');
            const isRaidGroup = jid === RAID_GROUP;

            if (DUNGEON_GC_ONLY.has(cmdName) && !isRaidGroup) {
                // Only tell them where to go if they're in a GC — silent ignore in other GCs
                if (isDM) {
                    await sock.sendMessage(jid,
                        { text: `⚔️ Dungeon commands only work inside the Dungeon GC.` },
                        { quoted: msg }
                    );
                }
                return;
            }

            if (DM_ONLY.has(cmdName) && !isDM) {
                await sock.sendMessage(jid,
                    { text: `📩 Use *!${cmdName}* in the bot's DM, not here.` },
                    { quoted: msg }
                );
                return;
            }
            // =========================================================

            console.log(`[CMD] ${userId} → ${cmdName} (from: ${isRaidGroup ? 'RaidGC' : isDM ? 'DM' : 'OtherGC'})`);

            const fakeMsg = {
                body: text,
                from: jid,
                author: senderJid,
                fromMe: msg.key.fromMe,
                id: msg.key.id,

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
                    return await sock.sendMessage(jid, messageContent, { quoted: msg });
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

            try {
                if (!['respawn', 'awaken', 'register'].includes(cmdName)) {
                    const [rows] = await db.execute("SELECT hp FROM players WHERE id=?", [userId]);
                    if (rows.length && rows[0].hp <= 0) {
                        return await sock.sendMessage(jid, {
                            text:
                                `══〘 💀 YOU ARE DEAD 〙══╮\n` +
                                `┃◆ Your HP has reached 0.\n` +
                                `┃◆ Use !respawn to revive.\n` +
                                `┃◆ (Penalties apply on revival)\n` +
                                `╰═══════════════════════╯`
                        }, { quoted: msg });
                    }
                }

                await command.execute(fakeMsg, args, {
                    userId,
                    isAdmin: ADMINS.includes(userId),
                    client: sock
                });
            } catch (err) {
                console.error("Command Error:", err);
                await sock.sendMessage(jid, { text: "❌ An error occurred." }, { quoted: msg });
            }
        });

        // ==================== SCHEDULED DUNGEON SPAWN ====================
        const { spawnDungeon, getWeightedDungeonRank, getActiveDungeon } = require('./src/engine/dungeon');

        // Regular spawn — every 4 hours, skipped during active event
        cron.schedule('0 */4 * * *', async () => {
            console.log('🕒 Scheduled dungeon spawn triggered.');
            try {
                let isEventRunning = false;
                try {
                    const [eventRows] = await db.execute(
                        "SELECT id FROM events WHERE is_active=1 AND ends_at > NOW() LIMIT 1"
                    );
                    isEventRunning = eventRows.length > 0;
                } catch (e) { isEventRunning = false; }
                if (isEventRunning) {
                    console.log('⏭️ Regular spawn skipped — event active (20min cron handles it).');
                    return;
                }
                const active = await getActiveDungeon();
                if (active) {
                    console.log(`⏭️ Skipping — dungeon ${active.id} already active.`);
                    return;
                }
                const rank = await getWeightedDungeonRank();
                console.log(`🎲 Weighted rank selected: ${rank}`);
                await spawnDungeon(rank, sock);
            } catch (err) {
                console.error('Scheduled spawn failed:', err);
            }
        });

        // ⚡ Event spawn — every 20 minutes, only fires during active event
        cron.schedule('*/20 * * * *', async () => {
            try {
                let hasActiveEvent = false;
                try {
                    const [eventRows] = await db.execute(
                        "SELECT id FROM events WHERE is_active=1 AND ends_at > NOW() LIMIT 1"
                    );
                    hasActiveEvent = eventRows.length > 0;
                } catch (e) { hasActiveEvent = false; }
                if (!hasActiveEvent) return;
                const active = await getActiveDungeon();
                if (active) {
                    console.log(`⏭️ Event spawn skipped — dungeon ${active.id} still active.`);
                    return;
                }
                const rank = await getWeightedDungeonRank();
                console.log(`💠 Event dungeon spawn: ${rank}`);
                await spawnDungeon(rank, sock);
            } catch (err) {
                console.error('Event spawn failed:', err);
            }
        });

        // ==================== SHOP RESTOCK ====================
        const { restockAllItems } = require('./src/systems/shopSystem');
        cron.schedule('0 0 * * *', async () => {
            console.log('🛒 Restocking shop...');
            try {
                await restockAllItems();
            } catch (err) {
                console.error('Shop restock failed:', err);
            }
        });

    } catch (err) {
        console.error('💥 startBot error:', err.message);
        isBotRunning = false;
        setTimeout(() => startBot(), 5000);
    }
}

// ==================== DATABASE HEARTBEAT ====================
cron.schedule('*/5 * * * *', async () => {
    try {
        await db.query('SELECT 1');
        console.log('💓 DB heartbeat OK');
    } catch (err) {
        console.log('💔 DB Heartbeat failed:', err.message);
    }
});

// ==================== ERROR HANDLING ====================
process.on('uncaughtException', (err) => {
    console.error('💥 UNCAUGHT EXCEPTION:', err.message);
    console.error(err.stack);
});

process.on('unhandledRejection', (reason) => {
    console.error('💥 UNHANDLED REJECTION:', reason);
});

startBot();