const { execSync } = require('child_process');

module.exports = {
    name: 'update',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply(
            `══〘 🔄 UPDATE 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );
        try {
            let commitInfo = 'Latest commit';
            try {
                const hash = execSync('git rev-parse --short HEAD').toString().trim();
                const message = execSync('git log -1 --pretty=%B').toString().trim();
                commitInfo = `${hash}: ${message}`;
            } catch (e) {}
            await msg.reply(
                `══〘 🔄 UPDATE 〙══╮\n┃◆ 🔄 Initiating deploy...\n┃◆ 📦 ${commitInfo}\n╰═══════════════════════╯`
            );
            const serviceId = process.env.RENDER_SERVICE_ID;
            const apiKey    = process.env.RENDER_API_KEY;
            if (!serviceId || !apiKey) return msg.reply(
                `══〘 🔄 UPDATE 〙══╮\n┃◆ ❌ RENDER_SERVICE_ID or RENDER_API_KEY not set.\n╰═══════════════════════╯`
            );
            const response = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ clearCache: 'clear' })
            });
            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Render API error: ${response.status} - ${errText}`);
            }
            const deploy = await response.json();
            return msg.reply(
                `══〘 🔄 UPDATE 〙══╮\n┃◆ ✅ Deploy triggered!\n┃◆ ID: ${deploy.id}\n┃◆ ⏱️ Restarting in ~2 minutes.\n╰═══════════════════════╯`
            );
        } catch (err) {
            console.error('Update command error:', err);
            msg.reply(`══〘 🔄 UPDATE 〙══╮\n┃◆ ❌ ${err.message}\n╰═══════════════════════╯`);
        }
    }
};