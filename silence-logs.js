/**
 * Patches libsignal to remove noisy session logs.
 * Runs automatically after npm install via postinstall in package.json.
 */
const fs   = require('fs');
const path = require('path');

const targets = [
    'node_modules/libsignal/src/session_cipher.js',
    'node_modules/libsignal/src/session_record.js',
    'node_modules/libsignal/src/SessionStore.js',
    'node_modules/@whiskeysockets/baileys/lib/Utils/signal.js',
];

let patched = 0;
for (const rel of targets) {
    const full = path.join(__dirname, rel);
    if (!fs.existsSync(full)) continue;
    let src = fs.readFileSync(full, 'utf8');
    const before = src;
    // Remove all console.log / console.warn / console.error calls
    src = src.replace(/console\.(log|warn|error|info|debug)\s*\([^;]*\);?/g, '');
    if (src !== before) {
        fs.writeFileSync(full, src);
        console.log(`✅ Patched: ${rel}`);
        patched++;
    }
}
console.log(`🔇 Silenced ${patched} files.`);