const db = require('../database/db');
const { ensureClanTables, getPlayerClan, getClanById, getClanMembers, CLAN_BLESSINGS } = require('../systems/clanSystem');

const CLAN_STARTER_GOLD = 2000;
const CLAN_STARTER_XP   = 1000;
const MAX_MEMBERS       = 10;

// Pending join requests: clanId -> Set of playerIds
const pendingRequests = new Map();

module.exports = {
    name: 'clan',
    async execute(msg, args, { userId }) {
        try {
            await ensureClanTables();

            const sub = args[0]?.toLowerCase();

            // ── !clan ─────────────────────────────────────────────────────────
            if (!sub) {
                const myClan = await getPlayerClan(userId);
                if (!myClan) return msg.reply(
                    `══〘 🏰 CLAN 〙══╮\n` +
                    `┃◆ You are not in a clan.\n` +
                    `┃◆ !createclan — start your own\n` +
                    `┃◆ !clan join <name> — join one\n` +
                    `╰═══════════════════════╯`
                );

                const members  = await getClanMembers(myClan.id);
                const blessing = CLAN_BLESSINGS[myClan.blessing_id];
                const isLeader = myClan.leader_id === userId;

                let text =
                    `══〘 🏰 ${myClan.name.toUpperCase()} 〙══╮\n` +
                    `┃◆ 👑 Leader: ${members.find(m => m.id === myClan.leader_id)?.nickname || 'Unknown'}\n` +
                    `┃◆ 👥 Members: ${members.length}/${MAX_MEMBERS}\n` +
                    `┃◆────────────\n` +
                    `┃◆ ${blessing.emoji} *${blessing.name}*\n` +
                    `┃◆ 📌 ${blessing.condition}\n` +
                    `┃◆ ⚡ ${blessing.effect}\n` +
                    `┃◆────────────\n` +
                    `┃◆ MEMBERS:\n`;

                members.forEach(m => {
                    const crown = m.id === myClan.leader_id ? '👑 ' : '┃◆   ';
                    text += `${crown}${m.nickname} [${m.role}] Rank ${m.rank}\n`;
                });

                if (isLeader) {
                    text += `┃◆────────────\n┃◆ !clan accept @user — accept request\n┃◆ !clan kick @user — remove member\n┃◆ !clan promote @user — transfer lead\n`;
                }
                text += `╰═══════════════════════╯`;
                return msg.reply(text);
            }

            // ── !clan join <name> ──────────────────────────────────────────────
            if (sub === 'join') {
                const clanName = args.slice(1).join(' ');
                if (!clanName) return msg.reply("❌ !clan join <clan name>");

                // Rank D+ required to join
                const [rankRow] = await db.execute("SELECT `rank`, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?", [userId]);
                const RANK_ORDER = ['F','E','D','C','B','A','S'];
                const playerRank = rankRow[0]?.rank || 'F';
                const isPrestigePlayer = (rankRow[0]?.prestige_level || 0) > 0;
                if (!isPrestigePlayer && RANK_ORDER.indexOf(playerRank) < RANK_ORDER.indexOf('D')) return msg.reply(
                    `══〘 🏰 CLAN 〙══╮\n┃◆ ❌ Reach Rank D to join a clan.\n╰═══════════════════════╯`
                );

                const existing = await getPlayerClan(userId);
                if (existing) return msg.reply(`❌ Leave *${existing.name}* first with !leaveclan.`);

                const [clans] = await db.execute("SELECT * FROM clans WHERE LOWER(name)=LOWER(?)", [clanName]);
                if (!clans.length) return msg.reply(`❌ Clan *${clanName}* not found.`);
                const clan = clans[0];

                const members = await getClanMembers(clan.id);
                if (members.length >= MAX_MEMBERS) return msg.reply(`❌ *${clan.name}* is full (${MAX_MEMBERS} members).`);

                // Add to pending
                if (!pendingRequests.has(clan.id)) pendingRequests.set(clan.id, new Set());
                pendingRequests.get(clan.id).add(userId);

                const [pRow] = await db.execute("SELECT nickname FROM players WHERE id=?", [userId]);
                const nick = pRow[0]?.nickname || userId;

                // Notify leader
                const leaderJid = `${clan.leader_id}@s.whatsapp.net`;
                try {
                    await msg.reply(`✅ Join request sent to *${clan.name}*. Wait for the leader to accept.`);
                } catch(e) {}

                return;
            }

            // ── !clan accept @user ─────────────────────────────────────────────
            if (sub === 'accept') {
                const myClan = await getPlayerClan(userId);
                if (!myClan || myClan.leader_id !== userId) return msg.reply("❌ You are not a clan leader.");

                const targetId = msg.mentionedIds?.[0] || args[1];
                if (!targetId) return msg.reply("❌ !clan accept @user");

                const pending = pendingRequests.get(myClan.id);
                if (!pending || !pending.has(targetId)) return msg.reply("❌ No pending request from that player.");

                const members = await getClanMembers(myClan.id);
                if (members.length >= MAX_MEMBERS) return msg.reply(`❌ Clan is full (${MAX_MEMBERS} members).`);

                await db.execute("INSERT INTO clan_members (player_id, clan_id) VALUES (?, ?)", [targetId, myClan.id]);
                await db.execute("UPDATE clans SET member_count = member_count + 1 WHERE id=?", [myClan.id]);
                pending.delete(targetId);

                // Clan starter pack
                await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [CLAN_STARTER_GOLD, targetId]);
                await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?",           [CLAN_STARTER_XP,   targetId]);

                const [newMember] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
                const blessing = CLAN_BLESSINGS[myClan.blessing_id];

                return msg.reply(
                    `══〘 🏰 ${myClan.name} 〙══╮\n` +
                    `┃◆ ✅ ${newMember[0]?.nickname} has joined!\n` +
                    `┃◆────────────\n` +
                    `┃◆ 🎁 STARTER PACK\n` +
                    `┃◆ 💰 +${CLAN_STARTER_GOLD.toLocaleString()} Gold\n` +
                    `┃◆ ⭐ +${CLAN_STARTER_XP.toLocaleString()} XP\n` +
                    `┃◆────────────\n` +
                    `┃◆ ${blessing.emoji} Clan Blessing: *${blessing.name}*\n` +
                    `┃◆ ${blessing.effect}\n` +
                    `╰═══════════════════════╯`
                );
            }

            // ── !clan kick @user ───────────────────────────────────────────────
            if (sub === 'kick') {
                const myClan = await getPlayerClan(userId);
                if (!myClan || myClan.leader_id !== userId) return msg.reply("❌ Leaders only.");

                const targetId = msg.mentionedIds?.[0] || args[1];
                if (!targetId || targetId === userId) return msg.reply("❌ Cannot kick yourself.");

                await db.execute("DELETE FROM clan_members WHERE player_id=? AND clan_id=?", [targetId, myClan.id]);
                await db.execute("UPDATE clans SET member_count = member_count - 1 WHERE id=?", [myClan.id]);
                return msg.reply(`✅ Member removed from *${myClan.name}*.`);
            }

            // ── !clan promote @user ────────────────────────────────────────────
            if (sub === 'promote') {
                const myClan = await getPlayerClan(userId);
                if (!myClan || myClan.leader_id !== userId) return msg.reply("❌ Leaders only.");

                const targetId = msg.mentionedIds?.[0] || args[1];
                if (!targetId) return msg.reply("❌ !clan promote @user");

                const members = await getClanMembers(myClan.id);
                if (!members.find(m => m.id === targetId)) return msg.reply("❌ That player is not in your clan.");

                await db.execute("UPDATE clans SET leader_id=? WHERE id=?", [targetId, myClan.id]);
                const [t] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
                return msg.reply(`👑 *${t[0]?.nickname}* is now leader of *${myClan.name}*.`);
            }

        } catch (err) {
            console.error('clan error:', err);
            msg.reply("❌ Clan command failed.");
        }
    }
};