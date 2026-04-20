require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');
const db = require('./src/database/db');

/* =========================
   CLIENT SETUP
========================= */

const client = new Client({
    authStrategy: new LocalAuth({ clientId: "aria" }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox']
    }
});

/* =========================
   🔐 ADMIN SYSTEM (BOOTSTRAP)
========================= */

const ADMIN_FILE = path.join(__dirname, "admin.json");
let BOOTSTRAP_ADMIN = null;

if (fs.existsSync(ADMIN_FILE)) {
    try {
        const data = JSON.parse(fs.readFileSync(ADMIN_FILE, "utf-8"));
        BOOTSTRAP_ADMIN = data.admin;
        console.log("🔐 Loaded ADMIN:", BOOTSTRAP_ADMIN);
    } catch (err) {
        console.error("Failed to load admin.json:", err);
    }
}

/* =========================
   🧠 HELPERS
========================= */

function normalizeId(id) {
    if (!id) return "";
    return id.toString().replace(/@c\.us|@g\.us|@lid/g, "").split("@")[0];
}

function getUserId(msg) {
    const raw = msg.author || msg.from;
    return normalizeId(raw);
}

function isAdmin(msg) {
    const id = getUserId(msg);
    return BOOTSTRAP_ADMIN && id === BOOTSTRAP_ADMIN;
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
        if (cmd?.name) {
            commands.set(cmd.name, cmd);
        }
    });

/* =========================
   EVENTS
========================= */

client.on('qr', qr => {
    console.clear();
    console.log("📲 Scan QR:");
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log("✅ ARIA READY");

    if (!BOOTSTRAP_ADMIN && client.info?.wid) {
        BOOTSTRAP_ADMIN = normalizeId(client.info.wid._serialized);
        fs.writeFileSync(
            ADMIN_FILE,
            JSON.stringify({ admin: BOOTSTRAP_ADMIN }, null, 2)
        );
        console.log("🔐 BOOTSTRAP ADMIN SET:", BOOTSTRAP_ADMIN);
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

    if (cmd !== "respawn") {
        try {
            const [rows] = await db.execute(
                "SELECT hp FROM players WHERE id=?",
                [userId]
            );
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
        await command.execute(msg, args, {
            userId,
            isAdmin: isAdmin(msg),
            client
        });
    } catch (err) {
        console.error("Command Error:", err);
        msg.reply("❌ Error occurred.");
    }
});

/* =========================
   START BOT
========================= */

client.initialize();