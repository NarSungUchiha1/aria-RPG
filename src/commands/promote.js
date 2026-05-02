const db = require('../database/db');
const path = require('path');
const fs = require('fs');

const ADMIN_FILE = path.join(__dirname, '../../admin.json');

module.exports = {
    name: 'promote',
    async execute(msg, args, { isAdmin, userId }) {
        if (!isAdmin) return msg.reply('❌ Only admins can use this command.');

        let targetId = null;
        if (msg.mentionedIds?.length > 0) {
            targetId = msg.mentionedIds[0].replace(/@c\.us/g, '').split('@')[0];
        } else if (args[0]) {
            targetId = args[0].replace(/\D/g, '');
        }
        if (!targetId) return msg.reply('❌ Usage: !promote @user');

        try {
            // Read current admins
            let admins = [];
            if (fs.existsSync(ADMIN_FILE)) {
                const data = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf-8'));
                admins = data.admins || (data.admin ? [data.admin] : []);
            }

            if (admins.includes(targetId)) return msg.reply('❌ Already an admin.');

            admins.push(targetId);
            fs.writeFileSync(ADMIN_FILE, JSON.stringify({ admins }, null, 2));

            // ✅ Also update in-memory ADMINS via global
            if (global.ADMINS) global.ADMINS.push(targetId);

            const [player] = await db.execute('SELECT nickname FROM players WHERE id=?', [targetId]);
            const name = player[0]?.nickname || targetId;

            console.log(`👑 Promoted ${name} (${targetId}) to admin`);
            return msg.reply(
                `══〘 👑 PROMOTED 〙══╮\n` +
                `┃◆ ✅ *${name}* is now an admin.\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply('❌ Promotion failed.');
        }
    }
};