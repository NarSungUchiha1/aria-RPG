const db = require('../database/db');
const { ensureClanTables, getPlayerClan, getBlessingDisplay, CLAN_BLESSINGS } = require('../systems/clanSystem');

const CREATE_COST = 5000;

module.exports = {
    name: 'createclan',
    async execute(msg, args, { userId }) {
        try {
            await ensureClanTables();

            const [player] = await db.execute("SELECT nickname FROM players WHERE id=?", [userId]);
            if (!player.length) return msg.reply("❌ Not registered.");

            // Only prestige players can create clans
            const [presRow] = await db.execute("SELECT COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?", [userId]);
            if ((presRow[0]?.prestige_level || 0) < 1) return msg.reply(
                `══〘 🏰 CREATE CLAN 〙══╮\n┃◆ ❌ Only Prestige players can\n┃◆ create a clan.\n╰═══════════════════════╯`
            );

            // Max 3 clans globally
            const [clanCount] = await db.execute("SELECT COUNT(*) as cnt FROM clans");
            if (clanCount[0].cnt >= 3) return msg.reply(
                `══〘 🏰 CREATE CLAN 〙══╮\n┃◆ ❌ The world already has 3 clans.\n┃◆ No more can be forged.\n╰═══════════════════════╯`
            );

            const existing = await getPlayerClan(userId);
            if (existing) return msg.reply(
                `══〘 🏰 CLAN 〙══╮\n┃◆ ❌ You are already in *${existing.name}*.\n┃◆ !leaveclan first.\n╰═══════════════════════╯`
            );

            // Step 1 — no args: show blessing list
            if (!args[0]) {
                let text =
                    `══〘 🏰 CREATE CLAN 〙══╮\n` +
                    `┃◆ Cost: ${CREATE_COST.toLocaleString()} Gold\n` +
                    `┃◆────────────\n` +
                    `┃◆ Choose your clan blessing:\n` +
                    `┃◆────────────\n` +
                    getBlessingDisplay() + '\n' +
                    `┃◆ CMD: !createclan <name> <blessing #>\n` +
                    `╰═══════════════════════╯`;
                return msg.reply(text);
            }

            // Step 2 — args provided: create clan
            const blessingId = parseInt(args[args.length - 1]);
            const clanName   = args.slice(0, args.length - 1).join(' ').trim();

            if (!clanName) return msg.reply("❌ !createclan <name> <blessing #>");
            if (!CLAN_BLESSINGS[blessingId]) return msg.reply(
                `❌ Invalid blessing number. Choose 1-${Object.keys(CLAN_BLESSINGS).length}.`
            );
            if (clanName.length > 30) return msg.reply("❌ Clan name too long. Max 30 chars.");

            const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            if ((gold[0]?.gold || 0) < CREATE_COST) return msg.reply(
                `══〘 🏰 CREATE CLAN 〙══╮\n┃◆ ❌ Need ${CREATE_COST.toLocaleString()} Gold.\n╰═══════════════════════╯`
            );

            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [CREATE_COST, userId]);

            const [result] = await db.execute(
                "INSERT INTO clans (name, leader_id, blessing_id) VALUES (?, ?, ?)",
                [clanName, userId, blessingId]
            );
            const clanId = result.insertId;

            await db.execute(
                "INSERT INTO clan_members (player_id, clan_id) VALUES (?, ?)",
                [userId, clanId]
            );

            const blessing = CLAN_BLESSINGS[blessingId];
            return msg.reply(
                `══〘 🏰 CLAN FORGED 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ *${clanName}* rises.\n` +
                `┃◆ Led by: ${player[0].nickname}\n` +
                `┃◆────────────\n` +
                `┃◆ ${blessing.emoji} Blessing: *${blessing.name}*\n` +
                `┃◆ 📌 ${blessing.condition}\n` +
                `┃◆ ⚡ ${blessing.effect}\n` +
                `┃◆────────────\n` +
                `┃◆ !joinclan ${clanName} — share the link\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error('createclan error:', err);
            if (err.code === 'ER_DUP_ENTRY') return msg.reply("❌ Clan name already taken.");
            msg.reply("❌ Failed to create clan.");
        }
    }
};