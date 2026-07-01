const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
    host: process.env.DB_HOST, // Make sure this is in your .env!
    user: process.env.DB_USER,
    password: process.env.DB_PASS, // Changed from DB_PASSWORD to match your .env
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 16338,
    ssl: {
        rejectUnauthorized: false
    },
    waitForConnections: true,
    connectionLimit: 10,
    maxIdle: 10, 
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 20000 
});

// Dedicated pool for WhatsApp session persistence (wa_sessions) ONLY.
// Baileys writes Signal keys/creds constantly; if those writes get starved by
// gameplay load on the main pool during a raid, the persisted session diverges
// from the live one and the number has to be re-linked. Isolating them on their
// own connections guarantees session writes always get through.
const authPool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    port: parseInt(process.env.DB_PORT) || 16338,
    ssl: { rejectUnauthorized: false },
    waitForConnections: true,
    connectionLimit: 3,
    maxIdle: 3,
    idleTimeout: 60000,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
    connectTimeout: 20000
});

module.exports = pool;
module.exports.authPool = authPool;