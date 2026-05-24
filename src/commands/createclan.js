const db = require('../database/db');
const {
    ensureClanTables,
    getPlayerClan,
    CLAN_BLESSINGS,
    PRESET_CLANS,
    CREATION_REQUIREMENTS,
    checkCreationRequirements,
} = require('../systems/clanSystem');

module.exports = {
    name: 'createclan',
    async execute(msg, args, { userId }) {
        try {
            await ensureClanTables();

            // ── Show requirements if no args ──────────────────────────────────
            if (!args[0]) {
                const check = await checkCreationRequirements(userId);
                const RANK_ORDER = ['F','E','D','C','B','A','S'];

                let text =
                    `╔══〘 🏰 FORGE A CLAN 〙══╗\n` +
                    `┃◆\n` +
                    `┃◆ Creating a clan is not a privilege.\n` +
                    `┃◆ It is earned. These are the terms:\n` +
                    `┃◆\n` +
                    `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃◆ REQUIREMENTS\n` +
                    `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃◆ ${check.p?.prestige_level > 0 ? '✅' : '❌'} Be a Prestige hunter\n` +
                    `┃◆ ${(RANK_ORDER.indexOf(check.p?.rank) >= RANK_ORDER.indexOf('A') || check.p?.rank?.startsWith('P')) ? '✅' : '❌'} Rank A or higher\n` +
                    `┃◆ ${Number(check.clearCount) >= CREATION_REQUIREMENTS.minDungeons ? '✅' : '❌'} ${CREATION_REQUIREMENTS.minDungeons} dungeon clears (${check.clearCount || 0} done)\n` +
                    `┃◆ ${check.fails.some(f => f.includes('Malachar')) ? '❌' : '✅'} Have slain Malachar\n` +
                    `┃◆ ${Number(check.playerGold) >= CREATION_REQUIREMENTS.minGold ? '✅' : '❌'} ${CREATION_REQUIREMENTS.minGold.toLocaleString()} Gold (you: ${Number(check.playerGold||0).toLocaleString()})\n` +
                    `┃◆\n`;

                if (!check.pass) {
                    text +=
                        `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                        `┃◆ You do not yet qualify.\n` +
                        `┃◆ Return when you are ready.\n` +
                        `╚═══════════════════════════╝`;
                    return msg.reply(text);
                }

                // Show available clan slots
                const [existingClans] = await db.execute("SELECT name FROM clans");
                const taken     = existingClans.map(r => r.name);
                const available = PRESET_CLANS.filter(p => !taken.includes(p.name));

                if (!available.length) {
                    text +=
                        `┃◆ All clan names are taken.\n` +
                        `┃◆ Ask an admin to add more.\n` +
                        `╚═══════════════════════════╝`;
                    return msg.reply(text);
                }

                text +=
                    `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃◆ ✅ You qualify. Choose your clan:\n` +
                    `┃◆\n`;
                available.forEach((p, i) => {
                    const b = CLAN_BLESSINGS[p.blessing_id];
                    text += `┃◆ ${i+1}. *${p.name}*\n┃◆    ${b.emoji} ${b.name}\n┃◆    📌 ${b.condition}\n┃◆\n`;
                });
                text +=
                    `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃◆ Cost: ${CREATION_REQUIREMENTS.minGold.toLocaleString()} Gold\n` +
                    `┃◆ CMD: !createclan <number>\n` +
                    `╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            // ── Attempt creation ──────────────────────────────────────────────
            const check = await checkCreationRequirements(userId);
            if (!check.pass) return msg.reply(
                `╔══〘 🏰 CREATE CLAN 〙══╗\n` +
                `┃◆ ❌ Requirements not met:\n` +
                check.fails.map(f => `┃◆ ${f}`).join('\n') +
                `\n╚═══════════════════════════╝`
            );

            const existing = await getPlayerClan(userId);
            if (existing) return msg.reply(`❌ Leave *${existing.name}* first with !leaveclan.`);

            const [existingClans] = await db.execute("SELECT name FROM clans");
            const taken     = existingClans.map(r => r.name);
            const available = PRESET_CLANS.filter(p => !taken.includes(p.name));

            const pick = parseInt(args[0]) - 1;
            if (isNaN(pick) || !available[pick]) return msg.reply("❌ Invalid number. Type !createclan to see options.");

            const chosen     = available[pick];
            const clanName   = chosen.name;
            const blessingId = chosen.blessing_id;

            // Deduct gold
            await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [CREATION_REQUIREMENTS.minGold, userId]);

            const [result] = await db.execute(
                "INSERT INTO clans (name, leader_id, blessing_id, member_count) VALUES (?, ?, ?, 1)",
                [clanName, userId, blessingId]
            );
            const clanId = result.insertId;

            await db.execute(
                "INSERT INTO clan_members (player_id, clan_id, role) VALUES (?, ?, 'master')",
                [userId, clanId]
            );

            const blessing = CLAN_BLESSINGS[blessingId];
            return msg.reply(
                `╔══〘 🏰 CLAN FORGED 〙══╗\n` +
                `┃◆\n` +
                `┃◆ *${clanName}* rises from the fracture.\n` +
                `┃◆ Led by: *${check.p.nickname}*\n` +
                `┃◆\n` +
                `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃◆ ${blessing.emoji} *${blessing.name}*\n` +
                `┃◆ 📌 ${blessing.condition}\n` +
                `┃◆ ⚡ ${blessing.effect}\n` +
                `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃◆ You are now Clan Master.\n` +
                `┃◆ Use !clan assign @member <quest>\n` +
                `┃◆ to give members their trials.\n` +
                `┃◆\n` +
                `┃◆ !clan — view your clan\n` +
                `╚═══════════════════════════╝`
            );

        } catch (err) {
            console.error('createclan error:', err);
            if (err.code === 'ER_DUP_ENTRY') return msg.reply("❌ Clan name already taken.");
            msg.reply("❌ Failed to create clan.");
        }
    }
};