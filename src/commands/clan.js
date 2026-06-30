const db = require('../database/db');
const {
    ensureClanTables, getPlayerClan, getClanById,
    getClanMembers, getClanMemberRole, isOfficer, CLAN_BLESSINGS
} = require('../systems/clanSystem');

const MAX_MEMBERS = 15;

// Pending join requests: clanId -> Set of playerIds
const pendingRequests = new Map();

module.exports = {
    name: 'clan',
    async execute(msg, args, { userId, client }) {
        try {
            await ensureClanTables();
            const sub = args[0]?.toLowerCase();

            // ── !clan ─────────────────────────────────────────────────────────
            if (!sub) {
                const myClan = await getPlayerClan(userId);
                if (!myClan) return msg.reply(
                    `══〘 🏰 CLAN 〙══╮\n` +
                    `┃◆ You are not in a clan.\n` +
                    `┃◆ !createclan — forge your own\n` +
                    `┃◆ !clan join <name> — join one\n` +
                    `┃◆ !clanlist — see all clans\n` +
                    `╰═══════════════════════╯`
                );

                const members  = await getClanMembers(myClan.id);
                const blessing = CLAN_BLESSINGS[myClan.blessing_id] || { emoji:'❓', name:'None', condition:'—', effect:'No blessing set. Use !clan setblessing' };
                const myRole   = await getClanMemberRole(userId, myClan.id);
                const isMaster = myClan.leader_id === userId;
                const leader   = members.find(m => m.id === myClan.leader_id);

                const ROLE_ICON = { master: '👑', officer: '⚔️', member: '◆' };

                let text =
                    `╔══〘 🏰 ${myClan.name} 〙══╗\n` +
                    `┃◆\n` +
                    `┃◆ 👑 Master: ${leader?.nickname || 'Unknown'}\n` +
                    `┃◆ 👥 Members: ${members.length}/${MAX_MEMBERS}\n` +
                    `┃◆ Your role: ${ROLE_ICON[myRole] || '◆'} ${myRole}\n` +
                    `┃◆\n` +
                    `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃◆ ${blessing.emoji} *${blessing.name}*\n` +
                    `┃◆ 📌 ${blessing.condition}\n` +
                    `┃◆ ⚡ ${blessing.effect}\n` +
                    `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                    `┃◆ MEMBERS (${members.length})\n`;

                const sorted = [
                    ...members.filter(m => m.id === myClan.leader_id),
                    ...members.filter(m => m.clan_role === 'officer' && m.id !== myClan.leader_id),
                    ...members.filter(m => m.clan_role === 'member'),
                ];
                sorted.forEach(m => {
                    const icon = m.id === myClan.leader_id ? '👑' : m.clan_role === 'officer' ? '⚔️' : '◆';
                    const prestige = m.prestige_level > 0 ? '★' : '';
                    text += `┃${icon} ${m.nickname} [${m.role}] ${m.rank}${prestige}\n`;
                });

                text += `┃◆\n`;
                if (isMaster || myRole === 'officer') {
                    text +=
                        `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                        `┃◆ MANAGEMENT\n` +
                        `┃◆ !clan accept @user\n` +
                        `┃◆ !clan kick @user\n`;
                    if (isMaster) {
                        text +=
                            `┃◆ !clan assign @user <quest> — assign quest\n` +
                            `┃◆ !clan quests — view all active quests\n` +
                            `┃◆ !clan promote @user — make officer\n` +
                            `┃◆ !clan demote @user — back to member\n` +
                            `┃◆ !clan transfer @user — transfer mastership\n`;
                    }
                }
                text += `╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            // ── !clan join <name> ──────────────────────────────────────────────
            if (sub === 'join') {
                const clanName = args.slice(1).join(' ');
                if (!clanName) return msg.reply("❌ !clan join <clan name>");

                const RANK_ORDER = ['F','E','D','C','B','A','S'];
                const [rankRow] = await db.execute("SELECT `rank`, COALESCE(prestige_level,0) as pl FROM players WHERE id=?", [userId]);
                const playerRank = rankRow[0]?.rank || 'F';
                const isPrestige = rankRow[0]?.pl > 0;
                if (!isPrestige && RANK_ORDER.indexOf(playerRank) < RANK_ORDER.indexOf('D')) return msg.reply(
                    `══〘 🏰 CLAN 〙══╮\n┃◆ ❌ Rank D+ required to join a clan.\n╰═══════════════════════╯`
                );

                const existing = await getPlayerClan(userId);
                if (existing) return msg.reply(`❌ Leave *${existing.name}* first with !leaveclan.`);

                const [clans] = await db.execute("SELECT * FROM clans WHERE LOWER(name)=LOWER(?)", [clanName]);
                if (!clans.length) return msg.reply(`❌ Clan *${clanName}* not found. Try !clanlist.`);
                const clan = clans[0];

                const members = await getClanMembers(clan.id);
                if (members.length >= MAX_MEMBERS) return msg.reply(`❌ *${clan.name}* is full (${MAX_MEMBERS} members).`);

                if (!pendingRequests.has(clan.id)) pendingRequests.set(clan.id, new Set());
                pendingRequests.get(clan.id).add(userId);

                const [pRow] = await db.execute("SELECT nickname FROM players WHERE id=?", [userId]);
                const nick = pRow[0]?.nickname || userId;

                try {
                    await client.sendMessage(`${clan.leader_id}@c.us`, {
                        text: `══〘 🏰 CLAN REQUEST 〙══╮\n┃◆ *${nick}* wants to join *${clan.name}*.\n┃◆ !clan accept @${userId}\n╰═══════════════════════╯`
                    });
                } catch(e) {}

                return msg.reply(`✅ Request sent to *${clan.name}*. Waiting for master/officer to accept.`);
            }

            // ── !clan accept @user ─────────────────────────────────────────────
            if (sub === 'accept') {
                const myClan = await getPlayerClan(userId);
                if (!myClan) return msg.reply("❌ You are not in a clan.");
                const myRole = await getClanMemberRole(userId, myClan.id);
                if (!['master','officer'].includes(myRole)) return msg.reply("❌ Officers and masters only.");

                const targetRaw = msg.mentionedIds?.[0] || args[1];
                if (!targetRaw) return msg.reply("❌ !clan accept @user");
                const targetId = String(targetRaw).replace(/@s\.whatsapp\.net|@c\.us/g,'').split(':')[0];

                const pending = pendingRequests.get(myClan.id);
                if (!pending || !pending.has(targetId)) return msg.reply("❌ No pending request from that player.");

                const members = await getClanMembers(myClan.id);
                if (members.length >= MAX_MEMBERS) return msg.reply(`❌ Clan is full (${MAX_MEMBERS} members).`);

                await db.execute("INSERT INTO clan_members (player_id, clan_id, role) VALUES (?, ?, 'member')", [targetId, myClan.id]);
                await db.execute("UPDATE clans SET member_count = member_count + 1 WHERE id=?", [myClan.id]);
                pending.delete(targetId);

                // Starter pack
                await db.execute("UPDATE currency SET gold = gold + 2000 WHERE player_id=?", [targetId]);
                await db.execute("UPDATE xp SET xp = xp + 1000 WHERE player_id=?", [targetId]);

                const [newMember] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
                const blessing = CLAN_BLESSINGS[myClan.blessing_id];

                try {
                    await client.sendMessage(`${targetId}@c.us`, {
                        text:
                            `╔══〘 🏰 CLAN INDUCTION 〙══╗\n` +
                            `┃◆\n` +
                            `┃◆ You have been accepted into\n` +
                            `┃◆ *${myClan.name}*.\n` +
                            `┃◆\n` +
                            `┃◆ ${blessing.emoji} Bloodline: *${blessing.name}*\n` +
                            `┃◆ 📌 ${blessing.condition}\n` +
                            `┃◆ ⚡ ${blessing.effect}\n` +
                            `┃◆\n` +
                            `┃◆ 🎁 +2,000 Gold  +1,000 XP\n` +
                            `╚═══════════════════════════╝`
                    });
                } catch(e) {}

                return msg.reply(`✅ *${newMember[0]?.nickname}* has been inducted into *${myClan.name}*.`);
            }

            // ── !clan kick @user ───────────────────────────────────────────────
            if (sub === 'kick') {
                const myClan = await getPlayerClan(userId);
                if (!myClan) return msg.reply("❌ Not in a clan.");
                const myRole = await getClanMemberRole(userId, myClan.id);
                if (!['master','officer'].includes(myRole)) return msg.reply("❌ Officers and masters only.");

                const targetRaw = msg.mentionedIds?.[0] || args[1];
                if (!targetRaw) return msg.reply("❌ !clan kick @user");
                const targetId = String(targetRaw).replace(/@s\.whatsapp\.net|@c\.us/g,'').split(':')[0];
                if (targetId === userId) return msg.reply("❌ Cannot kick yourself.");
                if (targetId === myClan.leader_id) return msg.reply("❌ Cannot kick the clan master.");

                // Officers can only kick members, not other officers
                const targetRole = await getClanMemberRole(targetId, myClan.id);
                if (myRole === 'officer' && targetRole === 'officer') return msg.reply("❌ Only the master can kick officers.");

                await db.execute("DELETE FROM clan_members WHERE player_id=? AND clan_id=?", [targetId, myClan.id]);
                await db.execute("UPDATE clans SET member_count = GREATEST(0, member_count - 1) WHERE id=?", [myClan.id]);

                const [t] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
                return msg.reply(`✅ *${t[0]?.nickname || targetId}* removed from *${myClan.name}*.`);
            }

            // ── !clan promote @user — make officer ─────────────────────────────
            if (sub === 'promote') {
                const myClan = await getPlayerClan(userId);
                if (!myClan || myClan.leader_id !== userId) return msg.reply("❌ Clan master only.");

                const targetRaw = msg.mentionedIds?.[0] || args[1];
                const targetId  = String(targetRaw||'').replace(/@s\.whatsapp\.net|@c\.us/g,'').split(':')[0];
                if (!targetId) return msg.reply("❌ !clan promote @user");
                if (targetId === userId) return msg.reply("❌ You are already master.");

                await db.execute("UPDATE clan_members SET role='officer' WHERE player_id=? AND clan_id=?", [targetId, myClan.id]);
                const [t] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
                return msg.reply(`⚔️ *${t[0]?.nickname}* is now an Officer of *${myClan.name}*.`);
            }

            // ── !clan demote @user ─────────────────────────────────────────────
            if (sub === 'demote') {
                const myClan = await getPlayerClan(userId);
                if (!myClan || myClan.leader_id !== userId) return msg.reply("❌ Clan master only.");

                const targetRaw = msg.mentionedIds?.[0] || args[1];
                const targetId  = String(targetRaw||'').replace(/@s\.whatsapp\.net|@c\.us/g,'').split(':')[0];
                if (!targetId) return msg.reply("❌ !clan demote @user");

                await db.execute("UPDATE clan_members SET role='member' WHERE player_id=? AND clan_id=?", [targetId, myClan.id]);
                const [t] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
                return msg.reply(`◆ *${t[0]?.nickname}* demoted to member.`);
            }

            // ── !clan transfer @user ───────────────────────────────────────────
            if (sub === 'transfer') {
                const myClan = await getPlayerClan(userId);
                if (!myClan || myClan.leader_id !== userId) return msg.reply("❌ Clan master only.");

                const targetRaw = msg.mentionedIds?.[0] || args[1];
                const targetId  = String(targetRaw||'').replace(/@s\.whatsapp\.net|@c\.us/g,'').split(':')[0];
                if (!targetId) return msg.reply("❌ !clan transfer @user");

                const members = await getClanMembers(myClan.id);
                if (!members.find(m => m.id === targetId)) return msg.reply("❌ That player is not in your clan.");

                await db.execute("UPDATE clans SET leader_id=? WHERE id=?", [targetId, myClan.id]);
                await db.execute("UPDATE clan_members SET role='master' WHERE player_id=? AND clan_id=?", [targetId, myClan.id]);
                await db.execute("UPDATE clan_members SET role='officer' WHERE player_id=? AND clan_id=?", [userId, myClan.id]);

                const [t] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
                return msg.reply(`👑 *${t[0]?.nickname}* is now Clan Master of *${myClan.name}*.`);
            }

            // ── !clan assign @user <title> | <desc> | <objective> | <target> | <gold> | <xp> ──
            if (sub === 'assign') {
                const myClan = await getPlayerClan(userId);
                if (!myClan) return msg.reply("❌ Not in a clan.");
                // Only the clan master can assign quests
                if (myClan.leader_id !== userId) return msg.reply("❌ Only the clan master can assign quests.");

                const targetRaw = msg.mentionedIds?.[0] || args[1];
                if (!targetRaw) return msg.reply(
                    `══〘 🏰 ASSIGN QUEST 〙══╮\n` +
                    `┃◆ Usage:\n` +
                    `┃◆ !clan assign @user\n` +
                    `┃◆   <title> | <description>\n` +
                    `┃◆   | <objective> | <target>\n` +
                    `┃◆   | <gold reward> | <xp reward>\n` +
                    `┃◆\n` +
                    `┃◆ Objectives: dungeon_clear, kill_enemies,\n` +
                    `┃◆ stage_clear, pvp_win, boss_kill\n` +
                    `┃◆\n` +
                    `┃◆ Example:\n` +
                    `┃◆ !clan assign @user Trial of Fire\n` +
                    `┃◆ | Prove yourself in the dungeon\n` +
                    `┃◆ | dungeon_clear | 5 | 3000 | 1500\n` +
                    `╰═══════════════════════╯`
                );

                const targetId = String(targetRaw).replace(/@s\.whatsapp\.net|@c\.us/g,'').split(':')[0];
                const members  = await getClanMembers(myClan.id);
                if (!members.find(m => m.id === targetId)) return msg.reply("❌ That player is not in your clan.");

                // Parse pipe-separated args after the @mention
                const rest = args.slice(2).join(' ');
                const parts = rest.split('|').map(s => s.trim());
                if (parts.length < 6) return msg.reply(
                    `❌ Format: <title> | <desc> | <objective> | <target> | <gold> | <xp>\n` +
                    `Objectives: dungeon_clear, kill_enemies, stage_clear, pvp_win, boss_kill`
                );

                const [title, description, objective, targetNum, gold, xp] = parts;
                const VALID_OBJECTIVES = ['dungeon_clear','kill_enemies','stage_clear','pvp_win','boss_kill'];
                if (!VALID_OBJECTIVES.includes(objective)) return msg.reply(
                    `❌ Invalid objective. Use: ${VALID_OBJECTIVES.join(', ')}`
                );

                const targetCount = Math.max(1, parseInt(targetNum) || 1);
                const rewardGold  = Math.max(0, parseInt(gold) || 0);
                const rewardXp    = Math.max(0, parseInt(xp) || 0);

                // Cancel any existing active quest for this player in this clan
                await db.execute(
                    "UPDATE clan_quests SET status='failed' WHERE assigned_to=? AND clan_id=? AND status='active'",
                    [targetId, myClan.id]
                );

                await db.execute(
                    `INSERT INTO clan_quests (clan_id, assigned_to, assigned_by, title, description, objective, target, progress, reward_gold, reward_xp)
                     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
                    [myClan.id, targetId, userId, title, description, objective, targetCount, rewardGold, rewardXp]
                );

                const [assignee] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
                const [assigner] = await db.execute("SELECT nickname FROM players WHERE id=?", [userId]);

                // Notify the target
                try {
                    await client.sendMessage(`${targetId}@c.us`, {
                        text:
                            `╔══〘 📜 CLAN QUEST ASSIGNED 〙══╗\n` +
                            `┃◆\n` +
                            `┃◆ *${assigner[0]?.nickname}* has given you a trial.\n` +
                            `┃◆\n` +
                            `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                            `┃◆ 📌 *${title}*\n` +
                            `┃◆ ${description}\n` +
                            `┃◆\n` +
                            `┃◆ Objective: ${objective.replace(/_/g,' ')} ×${targetCount}\n` +
                            `┃◆ Reward: 💰 ${rewardGold.toLocaleString()} Gold  ⭐ ${rewardXp.toLocaleString()} XP\n` +
                            `┃◆\n` +
                            `┃◆ !myquest — check your progress\n` +
                            `╚═══════════════════════════╝`
                    });
                } catch(e) {}

                return msg.reply(
                    `╔══〘 📜 QUEST ASSIGNED 〙══╗\n` +
                    `┃◆ *${title}* assigned to *${assignee[0]?.nickname}*.\n` +
                    `┃◆ Objective: ${objective.replace(/_/g,' ')} ×${targetCount}\n` +
                    `┃◆ Reward: 💰 ${rewardGold.toLocaleString()}G  ⭐ ${rewardXp.toLocaleString()}XP\n` +
                    `╚═══════════════════════════╝`
                );
            }

            // ── !clan quests — view all active quests in the clan ──────────────
            if (sub === 'quests') {
                const myClan = await getPlayerClan(userId);
                if (!myClan) return msg.reply("❌ Not in a clan.");
                if (myClan.leader_id !== userId) return msg.reply("❌ Clan master only.");

                const [quests] = await db.execute(
                    `SELECT cq.*, p.nickname as assignee_nick, p2.nickname as assigner_nick
                     FROM clan_quests cq
                     JOIN players p ON p.id = cq.assigned_to
                     JOIN players p2 ON p2.id = cq.assigned_by
                     WHERE cq.clan_id=? AND cq.status='active'`,
                    [myClan.id]
                );

                if (!quests.length) return msg.reply(
                    `══〘 📜 CLAN QUESTS 〙══╮\n┃◆ No active quests.\n╰═══════════════════════╯`
                );

                let text = `╔══〘 📜 CLAN QUESTS — ${myClan.name} 〙══╗\n┃◆\n`;
                quests.forEach(q => {
                    const pct = Math.min(100, Math.floor((q.progress / q.target) * 100));
                    const bar = '🟩'.repeat(Math.floor(pct/20)) + '⬜'.repeat(5 - Math.floor(pct/20));
                    text +=
                        `┃◆ 📌 *${q.title}*\n` +
                        `┃◆ → ${q.assignee_nick}  |  by ${q.assigner_nick}\n` +
                        `┃◆ ${bar} ${q.progress}/${q.target} (${pct}%)\n` +
                        `┃◆\n`;
                });
                text += `╚═══════════════════════════╝`;
                return msg.reply(text);
            }

        } catch (err) {
            console.error('clan error:', err);
            msg.reply("❌ Clan command failed.");
        }
    }
};