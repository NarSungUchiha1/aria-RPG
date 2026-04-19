const fs = require('fs');
const path = require('path');
const getUserId = require('../utils/getUserId');

const ADMIN_FILE = path.join(__dirname, '../../admin.json');

module.exports = {
    name: 'promote',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) {
            return msg.reply("❌ Only admins can use this command.");
        }

        // Extract target ID from mention or numeric argument
        let targetId = null;
        if (msg.mentionedIds.length > 0) {
            targetId = msg.mentionedIds[0].replace(/@c\.us/g, "").split("@")[0];
        } else if (args[0]) {
            targetId = args[0].replace(/\D/g, '');
        }

        if (!targetId) {
            return msg.reply("❌ Usage: !promote @user");
        }

        try {
            // Load current admins (supports old format just in case)
            let admins = [];
            if (fs.existsSync(ADMIN_FILE)) {
                const data = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf-8'));
                if (Array.isArray(data.admins)) {
                    admins = data.admins;
                } else if (data.admin) {
                    admins = [data.admin];
                }
            }

            if (admins.includes(targetId)) {
                return msg.reply("❌ User is already an admin.");
            }

            admins.push(targetId);
            // Always save in the new array format
            fs.writeFileSync(ADMIN_FILE, JSON.stringify({ admins }, null, 2));

            return msg.reply(`✅ User ${targetId} has been promoted to admin.`);
        } catch (err) {
            console.error(err);
            return msg.reply("❌ Failed to promote user.");
        }
    }
};