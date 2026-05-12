/**
 * ARIA Admin Command Interpreter
 * Owner and admins can give ARIA natural language instructions
 * and she'll figure out what to do and execute it.
 *
 * Examples:
 *   @Aria give Razor 5000 gold
 *   @Aria ban ShadowTroll
 *   @Aria reset Volt's fatigue
 *   @Aria set Blaze's rank to S
 *   @Aria give everyone a Fatigue Potion
 *   @Aria check Nova's profile
 *   @Aria announce: Dungeon opens in 5 minutes!
 */

const db = require('../database/db');

// ── Find a player by nickname ─────────────────────────────────────────────────
async function findPlayer(nickname) {
    if (!nickname) return null;
    const [rows] = await db.execute(
        "SELECT id, nickname, `rank`, role, hp, max_hp, fatigue, sp, prestige_level FROM players WHERE nickname LIKE ? LIMIT 1",
        [`%${nickname}%`]
    );
    return rows[0] || null;
}

// ── Admin action registry ─────────────────────────────────────────────────────
const ACTIONS = {
    give_gold: {
        desc: 'Give gold to a player',
        exec: async ({ target, amount }, sock, jid) => {
            const p = await findPlayer(target);
            if (!p) return `❌ Player "${target}" not found.`;
            await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [amount, p.id]);
            return `✅ Gave ${amount} gold to *${p.nickname}*.`;
        }
    },
    take_gold: {
        desc: 'Remove gold from a player',
        exec: async ({ target, amount }) => {
            const p = await findPlayer(target);
            if (!p) return `❌ Player "${target}" not found.`;
            await db.execute("UPDATE currency SET gold = GREATEST(0, gold - ?) WHERE player_id=?", [amount, p.id]);
            return `✅ Removed ${amount} gold from *${p.nickname}*.`;
        }
    },
    give_xp: {
        desc: 'Give XP to a player',
        exec: async ({ target, amount }) => {
            const p = await findPlayer(target);
            if (!p) return `❌ Player "${target}" not found.`;
            await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [amount, p.id]);
            return `✅ Gave ${amount} XP to *${p.nickname}*.`;
        }
    },
    give_sp: {
        desc: 'Give SP (skill points) to a player',
        exec: async ({ target, amount }) => {
            const p = await findPlayer(target);
            if (!p) return `❌ Player "${target}" not found.`;
            await db.execute("UPDATE players SET sp = sp + ? WHERE id=?", [amount, p.id]);
            return `✅ Gave ${amount} SP to *${p.nickname}*.`;
        }
    },
    give_item: {
        desc: 'Add an item to a player\'s inventory',
        exec: async ({ target, item, quantity = 1 }) => {
            const p = await findPlayer(target);
            if (!p) return `❌ Player "${target}" not found.`;
            await db.execute(
                "INSERT INTO inventory (player_id, item_name, item_type, quantity) VALUES (?, ?, 'misc', ?) ON DUPLICATE KEY UPDATE quantity = quantity + ?",
                [p.id, item, quantity, quantity]
            );
            return `✅ Gave ${quantity}× *${item}* to *${p.nickname}*.`;
        }
    },
    set_rank: {
        desc: 'Change a player\'s rank',
        exec: async ({ target, rank }) => {
            const valid = ['F','E','D','C','B','A','S','PF','PE','PD','PC','PB','PA','PS'];
            if (!valid.includes(rank?.toUpperCase())) return `❌ Invalid rank. Valid: ${valid.join(', ')}`;
            const p = await findPlayer(target);
            if (!p) return `❌ Player "${target}" not found.`;
            await db.execute("UPDATE players SET `rank`=? WHERE id=?", [rank.toUpperCase(), p.id]);
            return `✅ *${p.nickname}*'s rank set to *${rank.toUpperCase()}*.`;
        }
    },
    reset_fatigue: {
        desc: 'Reset a player\'s fatigue to 0',
        exec: async ({ target }) => {
            const p = await findPlayer(target);
            if (!p) return `❌ Player "${target}" not found.`;
            await db.execute("UPDATE players SET fatigue=0 WHERE id=?", [p.id]);
            return `✅ *${p.nickname}*'s fatigue reset to 0.`;
        }
    },
    restore_hp: {
        desc: 'Restore a player\'s HP to full',
        exec: async ({ target }) => {
            const p = await findPlayer(target);
            if (!p) return `❌ Player "${target}" not found.`;
            await db.execute("UPDATE players SET hp=max_hp WHERE id=?", [p.id]);
            return `✅ *${p.nickname}*'s HP fully restored.`;
        }
    },
    set_hp: {
        desc: 'Set a player\'s HP to a specific value',
        exec: async ({ target, amount }) => {
            const p = await findPlayer(target);
            if (!p) return `❌ Player "${target}" not found.`;
            await db.execute("UPDATE players SET hp=LEAST(max_hp, ?) WHERE id=?", [amount, p.id]);
            return `✅ *${p.nickname}*'s HP set to ${amount}.`;
        }
    },
    player_info: {
        desc: 'Show full profile of a player',
        exec: async ({ target }) => {
            const p = await findPlayer(target);
            if (!p) return `❌ Player "${target}" not found.`;
            const [cur] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [p.id]);
            const [xpr] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [p.id]);
            const gold = cur[0]?.gold || 0;
            const xp   = xpr[0]?.xp   || 0;
            return `📋 *${p.nickname}*\n` +
                   `Role: ${p.role} | Rank: ${p.rank}\n` +
                   `HP: ${p.hp}/${p.max_hp} | Fatigue: ${p.fatigue}/100\n` +
                   `Prestige: ${p.prestige_level} | SP: ${p.sp}\n` +
                   `Gold: ${gold} | XP: ${xp}`;
        }
    },
    ban_player: {
        desc: 'Block a player from using bot commands',
        exec: async ({ target }, sock, jid, blockedSet) => {
            const p = await findPlayer(target);
            if (!p) return `❌ Player "${target}" not found.`;
            blockedSet?.add(p.id);
            await db.execute(
                "INSERT IGNORE INTO blocked_users (player_id) VALUES (?)", [p.id]
            ).catch(() => {});
            return `🚫 *${p.nickname}* has been blocked from the bot.`;
        }
    },
    unban_player: {
        desc: 'Unblock a player',
        exec: async ({ target }, sock, jid, blockedSet) => {
            const p = await findPlayer(target);
            if (!p) return `❌ Player "${target}" not found.`;
            blockedSet?.delete(p.id);
            await db.execute("DELETE FROM blocked_users WHERE player_id=?", [p.id]).catch(() => {});
            return `✅ *${p.nickname}* has been unblocked.`;
        }
    },
    announce: {
        desc: 'Send an announcement to the current group',
        exec: async ({ message }, sock, jid) => {
            const text =
                `╔══════════════════════════════╗\n` +
                `     📢  ARIA ANNOUNCEMENT\n` +
                `╚══════════════════════════════╝\n` +
                `${message}`;
            await sock.sendMessage(jid, { text }).catch(() => {});
            return `✅ Announcement sent.`;
        }
    },
    list_actions: {
        desc: 'Show available admin actions',
        exec: async () => {
            const list = Object.entries(ACTIONS)
                .filter(([k]) => k !== 'list_actions')
                .map(([k, v]) => `• *${k}* — ${v.desc}`)
                .join('\n');
            return `🛠️ *Available ARIA Admin Actions*\n${list}`;
        }
    }
};

// ── Parse intent with Claude ──────────────────────────────────────────────────
async function parseAdminIntent(instruction, callGemini) {
    const actionList = Object.entries(ACTIONS)
        .filter(([k]) => k !== 'list_actions')
        .map(([k]) => k)
        .join(', ');

    const sysPrompt =
        `You are ARIA's admin command parser. Parse the instruction into a JSON object.\n` +
        `Available actions: ${actionList}\n\n` +
        `Respond with ONLY valid JSON — no markdown, no explanation:\n` +
        `{"action":"<action>","params":{"target":"<nickname>","amount":<number>,"item":"<name>","rank":"<rank>","message":"<text>"}}\n\n` +
        `Rules:\n` +
        `- "target" is the player nickname (keep it as given, do not modify)\n` +
        `- "amount" must be a number when relevant\n` +
        `- For announce: put the full announcement text in "message"\n` +
        `- If you can't match an action, use "unknown"\n` +
        `- Only include params that are relevant to the action`;

    const raw = await callGemini(instruction, sysPrompt);

    // Strip markdown code fences if Claude added them
    const cleaned = raw.replace(/```json|```/g, '').trim();
    return JSON.parse(cleaned);
}

// ── Main entry point ──────────────────────────────────────────────────────────
async function handleAdminCommand(sock, jid, msg, userId, instruction, callGemini, blockedSet) {
    if (!instruction?.trim()) {
        await sock.sendMessage(jid, {
            text: `🛠️ Tell me what to do, Master.\nExample: "@Aria give Razor 2000 gold"\nType "@Aria list actions" to see everything I can do.`
        }, { quoted: msg });
        return true;
    }

    if (instruction.toLowerCase().includes('list action')) {
        const result = await ACTIONS.list_actions.exec({});
        await sock.sendMessage(jid, { text: result }, { quoted: msg });
        return true;
    }

    let parsed;
    try {
        parsed = await parseAdminIntent(instruction, callGemini);
    } catch (e) {
        await sock.sendMessage(jid, {
            text: `❌ Couldn't parse that instruction. Try being more specific.\nExample: "give Razor 1000 gold"`
        }, { quoted: msg });
        return true;
    }

    const { action, params = {} } = parsed;

    if (!action || action === 'unknown' || !ACTIONS[action]) {
        await sock.sendMessage(jid, {
            text: `❓ I'm not sure what you want me to do with: "${instruction}"\nType "@Aria list actions" to see what I can do.`
        }, { quoted: msg });
        return true;
    }

    let result;
    try {
        result = await ACTIONS[action].exec(params, sock, jid, blockedSet);
    } catch (err) {
        result = `❌ Action failed: ${err.message}`;
    }

    await sock.sendMessage(jid, { text: result }, { quoted: msg });
    return true;
}

module.exports = { handleAdminCommand };