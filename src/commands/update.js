const { execSync } = require('child_process');

module.exports = {
    name: 'update',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");

        try {
            // Get latest Git commit info locally (optional, graceful fallback)
            let commitInfo = '';
            try {
                const hash = execSync('git rev-parse --short HEAD').toString().trim();
                const message = execSync('git log -1 --pretty=%B').toString().trim();
                commitInfo = `${hash}: ${message}`;
            } catch (e) {
                commitInfo = 'Latest commit (details unavailable)';
            }

            // Notify that update has started
            await msg.reply(`🔄 Update initiated...\n📦 ${commitInfo}\n⏳ Triggering Render deploy...`);

            // Call Render Deploy Hook (requires environment variables)
            const serviceId = process.env.RENDER_SERVICE_ID;
            const apiKey = process.env.RENDER_API_KEY;

            if (!serviceId || !apiKey) {
                return msg.reply("❌ Render API credentials not configured. Set RENDER_SERVICE_ID and RENDER_API_KEY.");
            }

            const response = await fetch(`https://api.render.com/v1/services/${serviceId}/deploys`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ clearCache: 'clear' }) // clear build cache for a fresh deploy
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Render API error: ${response.status} - ${errText}`);
            }

            const deploy = await response.json();
            const deployId = deploy.id;

            await msg.reply(`✅ Deploy triggered!\n🔧 Deploy ID: ${deployId}\n⏱️ The bot will restart in ~2 minutes with the latest changes.`);

        } catch (err) {
            console.error('Update command error:', err);
            msg.reply(`❌ Update failed: ${err.message}`);
        }
    }
};