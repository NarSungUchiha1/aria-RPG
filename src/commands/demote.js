const fs = require('fs');
const path = require('path');

const ADMIN_FILE = path.join(__dirname, '../../admin.json');

module.exports = {
    name: 'demote',
    async execute(msg, args, { isAdmin, userId }) {
        if (!isAdmin) {
            return msg.reply("❌ Only admins can use this command.");
        }

        let targetId = null;
        if (msg.mentionedIds.length > 0) {
            targetId = msg.mentionedIds[0].replace(/@c\.us/g, "").split("@")[0];
        } else if (args[0]) {
            targetId = args[0].replace(/\D/g, '');
        }

        if (!targetId) {
            return msg.reply("❌ Usage: !demote @user");
        }

        // Prevent self-demotion (optional safety)
        if (targetId === userId) {
            return msg.reply("❌ You cannot demote yourself.");
        }

        try {
            let admins = [];
            if (fs.existsSync(ADMIN_FILE)) {
                const data = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf-8'));
                if (Array.isArray(data.admins)) {
                    admins = data.admins;
                } else if (data.admin) {
                    admins = [data.admin];
                }
            }

            if (!admins.includes(targetId)) {
                return msg.reply("❌ User is not an admin.");
            }

            admins = admins.filter(id => id !== targetId);
            fs.writeFileSync(ADMIN_FILE, JSON.stringify({ admins }, null, 2));

            return msg.reply(`✅ User ${targetId} has been demoted.`);
        } catch (err) {
            console.error(err);
            return msg.reply("❌ Failed to demote user.");
        }
    }
};