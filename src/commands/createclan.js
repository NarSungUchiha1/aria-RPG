const db = require('../database/db');
const {
    ensureClanTables,
    getPlayerClan,
    CLAN_BLESSINGS,
    CREATION_REQUIREMENTS,
    checkCreationRequirements,
} = require('../systems/clanSystem');

module.exports = {
    name: 'createclan',
    async execute(msg, args, { userId }) {
        try {
            await ensureClanTables();

            // ── Show blessing menu if no args ─────────────────────────────────
            if (!args[0]) {
                const check = await checkCreationRequirements(userId);

                // Show requirements if not met
                if (!check.pass) {
                    const RANK_ORDER = ['F','E','D','C','B','A','S'];
                    let text =
                        `╔══〘 🏰 CREATE CLAN 〙══╗\n` +
                        `┃◆\n` +
                        `┃◆ You must meet these requirements:\n` +
                        `┃◆\n` +
                        `┃◆ ${check.p?.prestige_level > 0 ? '✅' : '❌'} Be a Prestige hunter\n` +
                        `┃◆ ${(RANK_ORDER.indexOf(check.p?.rank) >= RANK_ORDER.indexOf('A') || check.p?.rank?.startsWith('P')) ? '✅' : '❌'} Rank A or higher\n` +
                        `┃◆ ${Number(check.clearCount) >= CREATION_REQUIREMENTS.minDungeons ? '✅' : '❌'} ${CREATION_REQUIREMENTS.minDungeons} dungeon clears (${check.clearCount || 0} done)\n` +
                        `┃◆ ${Number(check.playerGold) >= CREATION_REQUIREMENTS.minGold ? '✅' : '❌'} ${CREATION_REQUIREMENTS.minGold.toLocaleString()} Gold (you: ${Number(check.playerGold||0).toLocaleString()})\n` +
                        `┃◆\n` +
                        `┃◆ You do not yet qualify.\n` +
                        `┃◆ Return when you are ready.\n` +
                        `╚═══════════════════════════╝`;
                    return msg.reply(text);
                }

                // Show blessing selection menu
                let text =
                    `══〘 🏰 CREATE CLAN 〙══╮\n` +
                    `┃◆ Cost: ${CREATION_REQUIREMENTS.minGold.toLocaleString()} Gold\n` +
                    `┃◆────────────\n` +
                    `┃◆ Choose your clan blessing:\n` +
                    `┃◆────────────\n`;

                Object.entries(CLAN_BLESSINGS).forEach(([id, b]) => {
                    text +=
                        `┃◆ ${id}. ${b.emoji} *${b.name}*\n` +
                        `┃◆    📌 ${b.condition}\n` +
                        `┃◆    ⚡ ${b.effect}\n` +
                        `┃◆────────────\n`;
                });

                text +=
                    `┃◆ CMD: !createclan <name> <blessing #>\n` +
                    `╰═══════════════════════╯`;

                return msg.reply(text);
            }

            // ── Parse: !createclan <name> <blessing#> ────────────────────────
            // Last arg is the blessing number, everything before is the clan name
            const blessingNum = parseInt(args[args.length - 1]);
            if (isNaN(blessingNum) || !CLAN_BLESSINGS[blessingNum]) {
                return msg.reply(
                    `══〘 🏰 CREATE CLAN 〙══╮\n` +
                    `┃◆ ❌ Invalid blessing number.\n` +
                    `┃◆ Use !createclan to see options.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const clanName = args.slice(0, args.length - 1).join(' ').trim().toUpperCase();
            if (!clanName || clanName.length < 2 || clanName.length > 40) {
                return msg.reply(
                    `══〘 🏰 CREATE CLAN 〙══╮\n` +
                    `┃◆ ❌ Clan name must be 2-40 characters.\n` +
                    `┃◆ Example: !createclan VOID HUNTERS 3\n` +
                    `╰═══════════════════════╯`
                );
            }

            // Check requirements
            const check = await checkCreationRequirements(userId);
            if (!check.pass) return msg.reply(
                `╔══〘 🏰 CREATE CLAN 〙══╗\n` +
                `┃◆ ❌ Requirements not met:\n` +
                check.fails.map(f => `┃◆ ${f}`).join('\n') +
                `\n╚═══════════════════════════╝`
            );

            // Check not already in a clan
            const existing = await getPlayerClan(userId);
            if (existing) return msg.reply(`❌ Leave *${existing.name}* first with !leaveclan.`);

            // Check name not taken
            const [nameTaken] = await db.execute('SELECT id FROM clans WHERE name=?', [clanName]);
            if (nameTaken.length) return msg.reply(`❌ The name *${clanName}* is already taken. Choose another.`);

            // Check gold
            const [goldRow] = await db.execute('SELECT gold FROM currency WHERE player_id=?', [userId]);
            const gold = Number(goldRow[0]?.gold || 0);
            if (gold < CREATION_REQUIREMENTS.minGold) return msg.reply(
                `❌ Not enough gold. Need ${CREATION_REQUIREMENTS.minGold.toLocaleString()}G, have ${gold.toLocaleString()}G.`
            );

            // Deduct gold and create clan
            await db.execute('UPDATE currency SET gold = gold - ? WHERE player_id=?', [CREATION_REQUIREMENTS.minGold, userId]);

            const [result] = await db.execute(
                'INSERT INTO clans (name, leader_id, blessing_id, member_count) VALUES (?, ?, ?, 1)',
                [clanName, userId, blessingNum]
            );
            const clanId = result.insertId;

            await db.execute(
                "INSERT INTO clan_members (player_id, clan_id, role) VALUES (?, ?, 'master')",
                [userId, clanId]
            );

            const blessing = CLAN_BLESSINGS[blessingNum];
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
                `┃◆ !clan — view your clan\n` +
                `┃◆ !clan invite @member — recruit\n` +
                `┃◆\n` +
                `╚═══════════════════════════╝`
            );

        } catch (err) {
            console.error('createclan error:', err);
            if (err.code === 'ER_DUP_ENTRY') return msg.reply('❌ Clan name already taken.');
            msg.reply('❌ Failed to create clan.');
        }
    }
};