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

module.exports = pool;