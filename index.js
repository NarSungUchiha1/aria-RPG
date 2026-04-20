require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cron = require('node-cron');
const db = require('./src/database/db');

// ==================== EXPRESS SERVER ====================
const app = express();
const PORT = process.env.PORT || 3000;
let lastQR = '';

app.get('/ping', (req, res) => res.status(200).send('OK'));

app.get('/', (req, res) => {
    if (!lastQR) {
        return res.send(`
            <html><body style="font-family:sans-serif;text-align:center;padding:40px">
                <h2>✅ ARIA is connected to WhatsApp!</h2>
                <p>No QR needed — session is active.</p>
            </body></html>
        `);
    }
    QRCode.toDataURL(lastQR, (err, url) => {
        if (err) return res.send('Error generating QR');
        res.send(`
            <html><body style="display:flex;flex-direction:column;align-items:center;font-family:sans-serif;padding:40px">
                <h2>📲 Scan with WhatsApp</h2>
                <img src="${url}" style="width:300px;height:300px"/>
                <p style="color:gray">Refresh if QR expires</p>
            </body></html>
        `);
    });
});

app.listen(PORT, () => console.log(`🌐 Server running on port ${PORT}`));

// ==================== CLIENT SETUP ====================
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "aria" }),
    puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--disable-gpu'
        ]
    }
});

// ==================== ADMIN SYSTEM ====================
const ADMIN_FILE = path.join(__dirname, "admin.json");
let ADMINS = [];

if (fs.existsSync(ADMIN_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf-8"));
        if (Array.isArray(data.admins)) {
            ADMINS = data.admins;
        } else if (data.admin) {
            ADMINS = [data.admin];
        }
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

fs.readdirSync(commandPath)
    .filter(f => f.endsWith(".js"))
    .forEach(file => {
        const cmd = require('./src/commands/' + file);
        if (cmd?.name) commands.set(cmd.name, cmd);
    });

// ==================== EVENTS ====================
client.on('qr', qr => {
    lastQR = qr;
    console.log("📲 QR ready — open your Render URL to scan");
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
    lastQR = '';
    console.log("✅ ARIA READY");
    if (ADMINS.length === 0 && client.info?.wid) {
        const firstAdmin = normalizeId(client.info.wid._serialized);
        ADMINS = [firstAdmin];
        fs.writeFileSync(ADMIN_FILE, JSON.stringify({ admins: ADMINS }, null, 2));
        console.log("🔐 Bootstrap admin set:", firstAdmin);
    }
    try {
        const { restockAllItems } = require('./src/systems/shopSystem');
        await restockAllItems();
        console.log("🛒 Shop initially stocked.");
    } catch (e) {
        console.error("Initial shop restock failed:", e);
    }
});

client.on('disconnected', (reason) => {
    console.log('⚠️ Client disconnected:', reason);
    lastQR = '';
});

// ==================== MAIN HANDLER ====================
client.on('message_create', async msg => {
    if (!msg.body || !msg.body.startsWith('!')) return;
    if (msg.fromMe) return;

    const userId = getUserId(msg);
    if (!userId) return;

    const args = msg.body.slice(1).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();
    console.log(`[CMD] ${userId} → ${cmd}`);

    if (!['respawn', 'awaken', 'register'].includes(cmd)) {
        try {
            const [rows] = await db.execute("SELECT hp FROM players WHERE id=?", [userId]);
            if (rows.length && rows[0].hp <= 0) {
                return msg.reply("💀 You are dead. Use !respawn");
            }
        } catch (err) {
            console.error("Death check error:", err);
        }
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

// ==================== SCHEDULED DUNGEON SPAWN ====================
const { spawnDungeon } = require('./src/engine/dungeon');

cron.schedule('0 */4 * * *', async () => {
    console.log('🕒 Scheduled dungeon spawn triggered.');
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
        if (targetChat) {
            await spawnDungeon(rank, client, targetChat);
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

// ==================== START ====================
client.initialize();