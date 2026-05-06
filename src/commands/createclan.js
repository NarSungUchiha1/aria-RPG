const db = require('../database/db');
const { ensureClanTables, getPlayerClan, getBlessingDisplay, CLAN_BLESSINGS } = require('../systems/clanSystem');

const CREATE_COST = 5000;
const { PRESET_CLANS } = require('../systems/clanSystem');

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

            // Show available preset clans
            const [existingClans] = await db.execute("SELECT name FROM clans");
            const taken = existingClans.map(r => r.name);
            const available = PRESET_CLANS.filter(p => !taken.includes(p.name));

            if (!args[0]) {
                if (!available.length) return msg.reply(
                    `══〘 🏰 CREATE CLAN 〙══╮\n┃◆ All 3 clans have been claimed.\n╰═══════════════════════╯`
                );
                let text =
                    `══〘 🏰 FORGE A CLAN 〙══╮\n` +
                    `┃◆ Cost: ${CREATE_COST.toLocaleString()} Gold\n` +
                    `┃◆────────────\n` +
                    `┃◆ Available clans:\n`;
                available.forEach((p, i) => {
                    const b = CLAN_BLESSINGS[p.blessing_id];
                    text += `┃◆ ${i+1}. ${p.name}\n┃◆    ${b.emoji} ${b.name} — ${b.condition}\n┃◆\n`;
                });
                text += `┃◆ CMD: !createclan <number>\n╰═══════════════════════╯`;
                return msg.reply(text);
            }

            const pick = parseInt(args[0]) - 1;
            if (isNaN(pick) || !available[pick]) return msg.reply("❌ Invalid number.");
            const chosen    = available[pick];
            const clanName  = chosen.name;
            const blessingId = chosen.blessing_id;

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