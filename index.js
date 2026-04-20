require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const express = require('express');
const cron = require('node-cron');
const db = require('./src/database/db');

// ==================== EXPRESS SERVER ====================
const app = express();
const PORT = process.env.PORT || 3000;
let lastQR = '';
let lastPairingCode = '';

app.get('/ping', (req, res) => res.status(200).send('OK'));

app.get('/status', (req, res) => {
    res.json({
        connected: !lastQR,
        qrReady: !!lastQR,
        pairingCode: lastPairingCode || null
    });
});

app.get('/', async (req, res) => {
    let dbStatus = 'Checking...';
    try {
        await db.query('SELECT 1');
        dbStatus = '🟢 Connected to Aiven';
    } catch (e) {
        dbStatus = '🔴 Database Offline';
    }

    if (!lastQR && !lastPairingCode) {
        return res.send(`
            <html><body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f4f7f6">
                <div style="background:white;padding:40px;border-radius:20px;box-shadow:0 10px 25px rgba(0,0,0,0.1);text-align:center">
                    <h1 style="color:#075e54">✅ ARIA Online</h1>
                    <p style="color:#666">The RPG Bot is currently authenticated and active.</p>
                    <div style="font-size: 12px; margin-top: 20px; padding: 5px 15px; border-radius: 20px; background: #eee; display: inline-block;">${dbStatus}</div>
                </div>
            </body></html>
        `);
    }

    QRCode.toDataURL(lastQR || '', (err, url) => {
        res.send(`
            <html>
            <head>
                <title>ARIA Dashboard</title>
                <meta http-equiv="refresh" content="15">
                <style>
                    body { display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; font-family:sans-serif; background:#e5ddd5; margin:0; }
                    .card { background:white; padding:30px; border-radius:15px; box-shadow:0 4px 15px rgba(0,0,0,0.15); text-align:center; width: 90%; max-width:400px; }
                    .status-bar { font-size: 12px; margin-bottom: 20px; padding: 5px 15px; border-radius: 20px; background: #eee; display: inline-block; }
                    .code-box { background:#f0f0f0; padding:20px; border-radius:10px; font-size:32px; font-weight:bold; letter-spacing:5px; color:#075e54; margin:20px 0; border: 2px dashed #075e54; }
                    img { border: 10px solid white; box-shadow: 0 0 10px rgba(0,0,0,0.1); }
                </style>
            </head>
            <body>
                <div class="card">
                    <div class="status-bar">DB Status: ${dbStatus}</div>
                    <h2>🔐 Link to WhatsApp</h2>
                    ${lastPairingCode ? `<p>Pairing Code:</p><div class="code-box">${lastPairingCode}</div>` : ''}
                    ${lastQR && !err && url ? `<p>Scan QR:</p><img src="${url}" width="250" height="250" />` : ''}
                    <p style="color:gray; font-size: 12px; margin-top: 20px;">Open WhatsApp > Linked Devices > Link a Device</p>
                </div>
            </body>
            </html>
        `);
    });
});

app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

// ==================== CLIENT SETUP ====================
const isLinux = process.platform === 'linux';
const path = require('path');
process.env.PUPPETEER_CACHE_DIR = path.join(__dirname, '.cache', 'puppeteer');
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth'
    }),
    puppeteer: {
        headless: true,
        // No need for executablePath anymore, as the CACHE_DIR handles it
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    }
});

// Resilience to prevent crashes from library bugs
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection:', reason);
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

// ==================== HELPERS ====================
function normalizeId(id) {
    if (!id) return "";
    return id.toString().replace(/@c\.us|@g\.us|@lid/g, "").split("@")[0];
}

function getUserId(msg) {
    const raw = msg.author || msg.from;
    return normalizeId(raw);
}

function isAdmin(msg) {
    return ADMINS.includes(getUserId(msg));
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

// ==================== EVENTS ====================
client.on('qr', qr => {
    lastQR = qr;
    lastPairingCode = ''; 
    console.log("📲 New QR available on the dashboard: http://localhost:3000");
    // STABILITY: We strictly DO NOT call requestPairingCode here.
    // This stops the "Execution context was destroyed" loop.
});

client.on('ready', async () => {
    lastQR = '';
    lastPairingCode = '';
    console.log("✅ ARIA READY");
    
    // Auto-set admin if missing
    if (ADMINS.length === 0 && client.info?.wid) {
        const firstAdmin = normalizeId(client.info.wid._serialized);
        ADMINS = [firstAdmin];
        fs.writeFileSync(ADMIN_FILE, JSON.stringify({ admins: ADMINS }, null, 2));
        console.log("🔐 Bootstrap admin set:", firstAdmin);
    }
    
    // Non-blocking shop restock
    console.log("🛒 Attempting initial shop restock...");
    setTimeout(async () => {
        try {
            const { restockAllItems } = require('./src/systems/shopSystem');
            await restockAllItems();
            console.log("🛒 Shop successfully restocked.");
        } catch (e) {
            console.error("⚠️ Shop restock skipped: Database connection timed out. Check Aiven settings.");
        }
    }, 2000); // Give the system a 2s breather after WhatsApp connects
});
// ==================== DATABASE HEARTBEAT ====================
// Runs every 5 minutes to prevent Aiven/Render from closing the idle connection
cron.schedule('*/5 * * * *', async () => {
    try {
        // A simple 'SELECT 1' is the industry standard for a heartbeat
        await db.query('SELECT 1');
        console.log('💓 Database heartbeat sent.');
    } catch (err) {
        console.error('💔 Heartbeat failed. Attempting to keep pool alive:', err.message);
    }
});
client.on('disconnected', (reason) => {
    console.log('⚠️ Client disconnected:', reason);
    lastQR = '';
    lastPairingCode = '';
});

// ==================== MAIN HANDLER ====================
client.on('message_create', async msg => {
    if (!msg.body || !msg.body.startsWith('!')) return;
    if (msg.fromMe) return;

    const userId = getUserId(msg);
    if (!userId) return;

    const args = msg.body.slice(1).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    // Death check
    if (!['respawn', 'awaken', 'register'].includes(cmd)) {
        try {
            const [rows] = await db.execute("SELECT hp FROM players WHERE id=?", [userId]);
            if (rows.length && rows[0].hp <= 0) return msg.reply("💀 You are dead. Use !respawn");
        } catch (err) { console.error("Death check error:", err); }
    }

    const command = commands.get(cmd);
    if (!command) return;

    try {
        await command.execute(msg, args, { userId, isAdmin: isAdmin(msg), client });
    } catch (err) {
        console.error("Command Error:", err);
        msg.reply("❌ An error occurred.");
    }
});

// ==================== CRON JOBS ====================
const { spawnDungeon } = require('./src/engine/dungeon');
cron.schedule('0 */4 * * *', async () => {
    const ranks = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
    const rank = ranks[Math.floor(Math.random() * ranks.length)];
    try {
        let targetChat = null;
        if (process.env.ANNOUNCEMENT_GROUP) {
            targetChat = await client.getChatById(process.env.ANNOUNCEMENT_GROUP);
        } else if (ADMINS.length) {
            const contact = await client.getContactById(ADMINS[0] + '@c.us');
            targetChat = await contact.getChat();
        }
        if (targetChat) await spawnDungeon(rank, client, targetChat);
    } catch (err) { console.error('Dungeon spawn failed:', err); }
});

// ==================== START ====================
async function startBot() {
    try {
        console.log("🚀 Initializing ARIA...");
        await client.initialize();
    } catch (err) {
        console.error("❌ Critical Startup Error:", err.message);
    }
}

startBot();