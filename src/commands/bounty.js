const db = require('../database/db');
const { getActiveBounties, ensureBountyTable } = require('../systems/bountySystem');

module.exports = {
    name: 'bounty',
    async execute(msg, args, { userId, isAdmin }) {
        try {
            await ensureBountyTable();
            const sub = args[0]?.toLowerCase();

            // ── Admin: post bounty ────────────────────────────────────────────
            // !bounty post <title> | <desc> | <objective> | <count> | <gold> | <xp>
            // Objectives: dungeon_clear, boss_kill, enemy_kill, stage_clear, forge_item
            if (sub === 'post' && isAdmin) {
                const raw = args.slice(1).join(' ').split('|').map(s => s.trim());
                if (raw.length < 6) return msg.reply(
                    "❌ !bounty post <title> | <desc> | <objective> | <count> | <gold> | <xp>"
                );
                const [title, desc, objective, count, gold, xp] = raw;
                await db.execute(
                    "INSERT INTO bounties (title, description, objective, count, reward_gold, reward_xp) VALUES (?, ?, ?, ?, ?, ?)",
                    [title, desc, objective, parseInt(count), parseInt(gold), parseInt(xp)]
                );
                const RAID_GROUP = process.env.RAID_GROUP_JID;
                if (msg.client && RAID_GROUP) {
                    await msg.client?.sendMessage?.(RAID_GROUP, {
                        text:
                            `╔══〘 📋 NEW BOUNTY 〙══╗\n` +
                            `┃◆\n` +
                            `┃◆ *${title}*\n` +
                            `┃◆ ${desc}\n` +
                            `┃◆\n` +
                            `┃◆ 🎯 ${objective.replace(/_/g,' ')} ×${count}\n` +
                            `┃◆ 💰 Reward: ${parseInt(gold).toLocaleString()}G + ${parseInt(xp).toLocaleString()}XP\n` +
                            `┃◆\n` +
                            `┃◆ First to complete claims it.\n` +
                            `╚═══════════════════════════╝`
                    }).catch(() => {});
                }
                return msg.reply(`✅ Bounty posted: *${title}*`);
            }

            // ── View bounties ─────────────────────────────────────────────────
            const bounties = await getActiveBounties();
            if (!bounties.length) return msg.reply(
                `╔══〘 📋 BOUNTY BOARD 〙══╗\n┃◆ No active bounties.\n╚═══════════════════════════╝`
            );

            let text = `╔══〘 📋 BOUNTY BOARD 〙══╗\n┃◆\n`;
            for (const [i, b] of bounties.entries()) {
                // Get player progress
                const [prog] = await db.execute(
                    "SELECT progress FROM bounty_progress WHERE player_id=? AND bounty_id=?",
                    [userId, b.id]
                );
                const current = prog[0]?.progress || 0;
                const pct     = Math.min(100, Math.floor((current / b.count) * 100));
                const filled  = Math.floor(pct / 10);
                const bar     = '🟩'.repeat(filled) + '⬛'.repeat(10 - filled);

                text +=
                    `┃◆ ${i+1}. *${b.title}*\n` +
                    `┃◆ ${b.description}\n` +
                    `┃◆ 🎯 ${b.objective.replace(/_/g,' ')} (${current}/${b.count})\n` +
                    `┃◆ ${bar} ${pct}%\n` +
                    `┃◆ 💰 ${b.reward_gold.toLocaleString()}G  ⭐ ${b.reward_xp.toLocaleString()}XP\n` +
                    `┃◆\n`;
            }
            text += `╚═══════════════════════════╝`;
            return msg.reply(text);
        } catch (err) {
            console.error('bounty error:', err);
            msg.reply('❌ Bounty command failed.');
        }
    }
};