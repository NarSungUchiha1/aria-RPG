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
    'clear', 'closedungeon', 'spawn', 'attackboss', 'worldboss'
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
        const { state, saveCreds } = await useMySQLAuthState();
        const { version } = await fetchLatestBaileysVersion();

        const sock = makeWASocket({
            version,
            auth: state,
            logger: pino({ level: 'silent' }),
            getMessage: async () => ({ conversation: '' })
        });

        sock.ev.on('creds.update', saveCreds);

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
                    setTimeout(() => startBot(), 5000);
                }
            } else if (connection === 'open') {
                console.log('✅ ARIA ONLINE');
                isReady = true;
                lastQR = '';
                lastPairingCode = '';

                if (ADMINS.length === 0 && sock.user) {
                    const myJid = normalizeId(sock.user.id);
                    ADMINS = [myJid];
                    fs.writeFileSync(ADMIN_FILE, JSON.stringify({ admins: ADMINS }, null, 2));
                    console.log("🔐 Admin bootstrapped:", myJid);
                }

                try {
                    const { restockAllItems } = require('./src/systems/shopSystem');
                    await restockAllItems();
                    console.log("🛒 Shop initially stocked.");
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
                        return await sock.sendMessage(jid, { text: "💀 You are dead. Use !respawn" }, { quoted: msg });
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
        const { spawnDungeon } = require('./src/engine/dungeon');
        cron.schedule('0 */4 * * *', async () => {
            console.log('🕒 Scheduled dungeon spawn triggered.');
            const ranks = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
            const rank = ranks[Math.floor(Math.random() * ranks.length)];
            try {
                await spawnDungeon(rank, sock);
            } catch (err) {
                console.error('Scheduled spawn failed:', err);
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