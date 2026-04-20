require('dotenv').config();
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion 
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
const isRender = process.env.RENDER === 'true';
const HOST = '0.0.0.0';

let lastQR = '';
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

    if (!lastQR) {
        return res.send('<html><body style="text-align:center;padding-top:50px;font-family:sans-serif;"><h2>⏳ Initializing ARIA...</h2><p>Generating QR code, please wait and refresh.</p></body></html>');
    }

    const url = await QRCode.toDataURL(lastQR);
    res.send(`
        <html>
        <head><title>ARIA Dashboard</title><meta http-equiv="refresh" content="10"></head>
        <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;background:#e5ddd5;margin:0;">
            <div style="background:white;padding:30px;border-radius:15px;box-shadow:0 4px 15px rgba(0,0,0,0.15);text-align:center;">
                <div style="font-size: 12px; margin-bottom: 20px; padding: 5px 15px; border-radius: 20px; background: #eee; display: inline-block;">DB Status: ${dbStatus}</div>
                <h2>🔐 Link to WhatsApp</h2>
                <img src="${url}" width="250" height="250" />
                <p style="color:gray; font-size: 12px; margin-top: 20px;">Scan this with WhatsApp Linked Devices</p>
            </div>
        </body>
        </html>
    `);
});

app.listen(PORT, HOST, () => {
    const url = isRender ? 'Your Render URL' : `http://localhost:${PORT}`;
    console.log(`🌐 Dashboard active! Visit: ${url}`);
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
    return id.toString().replace(/@s\.whatsapp\.net|@g\.us|@lid/g, "").split(":")[0].split("@")[0];
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

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            lastQR = qr;
            isReady = false;
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('⚠️ Connection closed. Reconnecting:', shouldReconnect);
            if (shouldReconnect) startBot();
        } else if (connection === 'open') {
            console.log('✅ ARIA ONLINE');
            isReady = true;
            lastQR = '';
            
            if (ADMINS.length === 0 && sock.user) {
                const myJid = normalizeId(sock.user.id);
                ADMINS = [myJid];
                fs.writeFileSync(ADMIN_FILE, JSON.stringify({ admins: ADMINS }, null, 2));
                console.log("🔐 Admin bootstrapped:", myJid);
            }
        }
    });

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const jid = msg.key.remoteJid;
        const senderJid = msg.key.participant || jid;
        const userId = normalizeId(senderJid);
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (!text.startsWith('!')) return;

        const args = text.slice(1).trim().split(/\s+/);
        const cmdName = args.shift().toLowerCase();

        const command = commands.get(cmdName);
        if (!command) return;

        try {
            // Check HP if not a bypass command
            if (!['respawn', 'awaken', 'register'].includes(cmdName)) {
                const [rows] = await db.execute("SELECT hp FROM players WHERE id=?", [userId]);
                if (rows.length && rows[0].hp <= 0) {
                    return await sock.sendMessage(jid, { text: "💀 You are dead. Use !respawn" }, { quoted: msg });
                }
            }

            const legacyMsg = {
                body: text,
                from: jid,
                author: senderJid,
                reply: (txt) => sock.sendMessage(jid, { text: txt }, { quoted: msg })
            };

            await command.execute(legacyMsg, args, { userId, isAdmin: ADMINS.includes(userId), client: sock });
        } catch (err) {
            console.error("Command Error:", err);
        }
    });
}

// ==================== DATABASE HEARTBEAT ====================
cron.schedule('*/5 * * * *', async () => {
    try {
        await db.query('SELECT 1');
        console.log('💓 Database heartbeat sent.');
    } catch (err) {
        console.log('💔 DB Heartbeat failed (Address not found). Check your DB_HOST environment variable.');
    }
});

startBot();