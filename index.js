require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cron = require('node-cron');
const db = require('./src/database/db');

// ==================== EXPRESS SERVER (KEEP-ALIVE) ====================
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/ping', (req, res) => res.status(200).send('OK'));
app.listen(PORT, () => console.log(`🌐 Keep-alive server running on port ${PORT}`));

/* =========================
   CLIENT SETUP (Works on Render)
========================= */
const client = new Client({
    authStrategy: new LocalAuth({ clientId: "aria" }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ],
        // 如果环境变量设置了，就使用它；否则让 Puppeteer 自己找（本地开发）
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
    }
});
        // No executablePath or cacheDirectory needed – Puppeteer auto-detects

/* =========================
   🔐 ADMIN SYSTEM
========================= */
const ADMIN_FILE = path.join(__dirname, "admin.json");
let ADMINS = [];

if (fs.existsSync(ADMIN_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf-8"));
        ADMINS = Array.isArray(data.admins) ? data.admins : [data.admin];
        console.log("🔐 Admins loaded:", ADMINS);
    } catch (err) {
        console.error("Failed to load admin.json:", err);
    }
}

function normalizeId(id) {
    if (!id) return "";
    return id.toString().replace(/@c\.us|@g\.us|@lid/g, "").split("@")[0];
}

function getUserId(msg) {
    return normalizeId(msg.author || msg.from);
}

function isAdmin(msg) {
    return ADMINS.includes(getUserId(msg));
}

/* =========================
   📦 COMMAND LOADER
========================= */
const commands = new Map();
const commandPath = path.join(__dirname, "src/commands");

fs.readdirSync(commandPath)
    .filter(f => f.endsWith(".js"))
    .forEach(file => {
        const cmd = require('./src/commands/' + file);
        if (cmd?.name) commands.set(cmd.name, cmd);
    });

/* =========================
   EVENTS
========================= */
client.on('qr', qr => {
    console.clear();
    console.log("📲 Scan QR:");
    qrcode.generate(qr, { small: true });
});

client.on('ready', async () => {
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

/* =========================
   🔥 MAIN HANDLER
========================= */
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

/* =========================
   ⏰ SCHEDULERS
========================= */
const { spawnDungeon } = require('./src/engine/dungeon');
cron.schedule('0 */4 * * *', async () => {
    console.log('🕒 Scheduled dungeon spawn triggered.');
    const rank = ['F','E','D','C','B','A','S'][Math.floor(Math.random()*7)];
    try {
        let targetChat = null;
        if (process.env.ANNOUNCEMENT_GROUP) {
            targetChat = await client.getChatById(process.env.ANNOUNCEMENT_GROUP);
        } else if (ADMINS.length) {
            targetChat = await (await client.getContactById(ADMINS[0])).getChat();
        }
        if (targetChat) await spawnDungeon(rank, client, targetChat);
    } catch (err) {
        console.error('Scheduled spawn failed:', err);
    }
});

const { restockAllItems } = require('./src/systems/shopSystem');
cron.schedule('0 0 * * *', async () => {
    console.log('🛒 Restocking shop...');
    try {
        await restockAllItems();
    } catch (err) {
        console.error('Shop restock failed:', err);
    }
});

/* =========================
   START BOT
========================= */
client.initialize();