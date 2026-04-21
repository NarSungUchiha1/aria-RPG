require('dotenv').config();
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion,
    makeInMemoryStore
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
const HOST = '0.0.0.0';

let lastQR = '';
let lastPairingCode = '';
let isReady = false;

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
        return res.send('<html><body style="text-align:center;padding-top:50px;font-family:sans-serif;"><h2>⏳ Initializing ARIA...</h2><p>Generating QR code, please wait and refresh.</p></body></html>');
    }

    const url = lastQR ? await QRCode.toDataURL(lastQR) : '';
    res.send(`
        <html>
        <head><title>ARIA Dashboard</title><meta http-equiv="refresh" content="30"></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#e5ddd5;margin:0;">
            <div style="background:white;padding:30px;border-radius:15px;box-shadow:0 4px 15px rgba(0,0,0,0.15);text-align:center;">
                <div style="font-size: 12px; margin-bottom: 20px; padding: 5px 15px; border-radius: 20px; background: #eee; display: inline-block;">DB Status: ${dbStatus}</div>
                ${lastPairingCode ? `
                <div style="background:#f0f0f0;padding:20px;border-radius:12px;margin-bottom:20px">
                    <h3 style="margin:0 0 10px 0">📱 Pairing Code</h3>
                    <div style="font-size:48px;font-weight:bold;letter-spacing:8px;color:#075e54">${lastPairingCode}</div>
                    <p style="color:gray;margin-top:10px">WhatsApp → Linked Devices → Link with phone number</p>
                </div>
                ` : ''}
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

app.listen(PORT, HOST, () => {
    console.log(`🌐 Dashboard active! Visit: http://localhost:${PORT}`);
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

function getUserIdFromMsg(msg) {
    const sender = msg.key.participant || msg.key.remoteJid;
    return normalizeId(sender);
}

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

// ==================== BAILEYS LOGIC ====================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const store = makeInMemoryStore({ logger: pino({ level: 'silent' }) });
    store.bind(state);

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        getMessage: async () => ({ conversation: '' })
    });

    store.bind(sock.ev);

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            lastQR = qr;
            isReady = false;
            // Generate pairing code if phone number is available
            (async () => {
                try {
                    if (sock?.user) return;
                    // Wait a bit for connection to stabilize
                    setTimeout(async () => {
                        try {
                            const code = await sock.requestPairingCode('233206963247'); // Replace with your phone number
                            lastPairingCode = code;
                            console.log(`📱 PAIRING CODE: ${code}`);
                        } catch (e) {}
                    }, 3000);
                } catch (e) {}
            })();
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) startBot();
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

            // Restock shop on startup
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

        // ========== COMPATIBILITY LAYER: Make Baileys msg look like whatsapp-web.js ==========
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
                let finalMentions = options?.mentions || [];
                const messageContent = typeof content === 'string' 
                    ? { text: content, mentions: finalMentions }
                    : content;
                return await sock.sendMessage(jid, messageContent, { quoted: msg });
            },
            
            get mentionedIds() {
                const entities = msg.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                return entities.map(e => normalizeId(e));
            },
            
            getChat: async () => {
                return {
                    id: { _serialized: jid },
                    isGroup: jid.endsWith('@g.us'),
                    sendMessage: async (content, options) => {
                        return await sock.sendMessage(jid, { text: content }, options);
                    }
                };
            }
        };

        try {
            // Death check
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
            let targetChat = null;
            if (process.env.ANNOUNCEMENT_GROUP) {
                targetChat = await sock.groupMetadata(process.env.ANNOUNCEMENT_GROUP).catch(() => null);
                if (targetChat) targetChat = { id: { _serialized: process.env.ANNOUNCEMENT_GROUP }, sendMessage: async (content, options) => {
                    return await sock.sendMessage(process.env.ANNOUNCEMENT_GROUP, { text: content }, options);
                }};
            } else if (ADMINS.length) {
                const adminJid = ADMINS[0] + '@s.whatsapp.net';
                targetChat = {
                    id: { _serialized: adminJid },
                    sendMessage: async (content, options) => {
                        return await sock.sendMessage(adminJid, { text: content }, options);
                    }
                };
            }
            if (targetChat) {
                await spawnDungeon(rank, sock, targetChat);
            }
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
}

// ==================== DATABASE HEARTBEAT ====================
cron.schedule('*/5 * * * *', async () => {
    try {
        await db.query('SELECT 1');
        console.log('💓 Database heartbeat sent.');
    } catch (err) {
        console.log('💔 DB Heartbeat failed. Check DB_HOST.');
    }
});

startBot();