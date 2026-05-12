const fs = require('fs');
const path = require('path');
const ADMIN_FILE = path.join(__dirname, '../../admin.json');

module.exports = {
    name: 'demote',
    async execute(msg, args, { isAdmin, userId }) {
        if (!isAdmin) return msg.reply(
            `══〘 🔐 DEMOTE 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );
        let targetId = null;
        if (msg.mentionedIds.length > 0) {
            targetId = msg.mentionedIds[0].replace(/@c\.us/g, "").split("@")[0];
        } else if (args[0]) {
            targetId = args[0].replace(/\D/g, '');
        }
        if (!targetId) return msg.reply(
            `══〘 🔐 DEMOTE 〙══╮\n┃◆ ❌ Use: !demote @user\n╰═══════════════════════╯`
        );
        if (targetId === userId) return msg.reply(
            `══〘 🔐 DEMOTE 〙══╮\n┃◆ ❌ You cannot demote yourself.\n╰═══════════════════════╯`
        );
        try {
            let admins = [];
            if (fs.existsSync(ADMIN_FILE)) {
                const data = JSON.parse(fs.readFileSync(ADMIN_FILE, 'utf-8'));
                admins = Array.isArray(data.admins) ? data.admins : (data.admin ? [data.admin] : []);
            }
            if (!admins.includes(targetId)) return msg.reply(
                `══〘 🔐 DEMOTE 〙══╮\n┃◆ ❌ User is not an admin.\n╰═══════════════════════╯`
            );
            admins = admins.filter(id => id !== targetId);
            fs.writeFileSync(ADMIN_FILE, JSON.stringify({ admins }, null, 2));
            return msg.reply(
                `══〘 🔐 DEMOTE 〙══╮\n┃◆ ✅ ${targetId} demoted.\n╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            return msg.reply(`══〘 🔐 DEMOTE 〙══╮\n┃◆ ❌ Failed to demote.\n╰═══════════════════════╯`);
        }
    }
};