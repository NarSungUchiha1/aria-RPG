const db   = require('../database/db');
const fs   = require('fs');
const path = require('path');

const DB_SCHEMA = `
players: id, nickname, role, rank(F/E/D/C/B/A/S/PF-PS), hp, max_hp, strength, agility, intelligence, stamina, fatigue, sp, prestige_level, pvp_wins, pvp_losses, title
currency: player_id, gold
xp: player_id, xp  
inventory: id, player_id, item_name, item_type, quantity, equipped, durability
dungeon: id, dungeon_rank, stage, max_stage, boss_name, is_active, stage_cleared
dungeon_players: player_id, dungeon_id, is_alive, session_gold, session_xp
dungeon_enemies: id, dungeon_id, name, current_hp, max_hp, attack, def, rank
clans: id, name, leader_id, blessing_type
clan_members: clan_id, player_id
quests: id, title, quest_type, objective_type, objective_count, reward_gold, reward_xp
player_quests: player_id, quest_id, progress, completed, claimed, assigned_date
pvp_challenges: id, challenger_id, target_id, bet_amount, status, duel_type
blocked_users: player_id`;

const SRC = path.join(__dirname, '../../');

async function safeSelect(sql) {
    const s = sql.trim().replace(/;$/, '');
    if (!/^(SELECT|SHOW)/i.test(s)) throw new Error('SELECT only');
    const limited = /LIMIT/i.test(s) ? s : `${s} LIMIT 20`;
    const [rows] = await db.execute(limited);
    return rows;
}

async function findPlayer(name) {
    const [r] = await db.execute(
        "SELECT id, nickname FROM players WHERE LOWER(nickname) LIKE ? LIMIT 1",
        [`%${name.toLowerCase()}%`]
    );
    return r[0] || null;
}

async function execAction(action, params, sock, jid, blockedSet) {
    const { target, amount, item, quantity = 1, rank, message, level } = params;
    const p = target ? await findPlayer(target) : null;
    if (target && !p) return `Can't find a player named "${target}" 🤔`;

    const a = action.toLowerCase();
    if (a.includes('gold') && a.includes('give')) {
        await db.execute("UPDATE currency SET gold=gold+? WHERE player_id=?", [amount, p.id]);
        return `Done! Gave ${Number(amount).toLocaleString()} gold to *${p.nickname}* 💰`;
    }
    if (a.includes('gold') && a.includes('take')) {
        await db.execute("UPDATE currency SET gold=GREATEST(0,gold-?) WHERE player_id=?", [amount, p.id]);
        return `Took ${amount} gold from *${p.nickname}*.`;
    }
    if (a.includes('xp')) {
        await db.execute("UPDATE xp SET xp=xp+? WHERE player_id=?", [amount, p.id]);
        return `Gave ${Number(amount).toLocaleString()} XP to *${p.nickname}* ✨`;
    }
    if (a.includes('sp')) {
        await db.execute("UPDATE players SET sp=sp+? WHERE id=?", [amount, p.id]);
        return `Gave ${amount} SP to *${p.nickname}*.`;
    }
    if (a.includes('item')) {
        await db.execute("INSERT INTO inventory(player_id,item_name,item_type,quantity) VALUES(?,?,'misc',?) ON DUPLICATE KEY UPDATE quantity=quantity+?", [p.id, item, quantity, quantity]);
        return `Added ${quantity}× *${item}* to *${p.nickname}*'s bag 🎁`;
    }
    if (a.includes('rank')) {
        const v = ['F','E','D','C','B','A','S','PF','PE','PD','PC','PB','PA','PS'];
        const r = rank?.toUpperCase();
        if (!v.includes(r)) return `Invalid rank. Options: ${v.join(', ')}`;
        await db.execute("UPDATE players SET `rank`=? WHERE id=?", [r, p.id]);
        return `*${p.nickname}* is now rank *${r}* 🎖️`;
    }
    if (a.includes('prestige')) {
        await db.execute("UPDATE players SET prestige_level=? WHERE id=?", [level||1, p.id]);
        return `*${p.nickname}*'s prestige set to ${level||1} ⭐`;
    }
    if (a.includes('fatigue')) {
        await db.execute("UPDATE players SET fatigue=0 WHERE id=?", [p.id]);
        return `*${p.nickname}*'s fatigue cleared ⚡`;
    }
    if (a.includes('hp') || a.includes('heal')) {
        await db.execute("UPDATE players SET hp=max_hp WHERE id=?", [p.id]);
        return `*${p.nickname}* fully healed ❤️`;
    }
    if (a.includes('ban')) {
        blockedSet?.add(p.id);
        await db.execute("INSERT IGNORE INTO blocked_users(player_id) VALUES(?)", [p.id]).catch(() => {});
        return `🚫 *${p.nickname}* blocked.`;
    }
    if (a.includes('unban')) {
        blockedSet?.delete(p.id);
        await db.execute("DELETE FROM blocked_users WHERE player_id=?", [p.id]).catch(() => {});
        return `✅ *${p.nickname}* unblocked.`;
    }
    if (a.includes('announce')) {
        await sock.sendMessage(jid, { text: `📢 *ANNOUNCEMENT*\n${message}` }).catch(() => {});
        return `Announcement sent!`;
    }
    return `I'm not sure how to "${action}" — try rephrasing!`;
}

async function handleAdminCommand(sock, jid, msg, userId, instruction, callGemini, blockedSet) {
    if (!instruction?.trim()) {
        await sock.sendMessage(jid, {
            text: `Master. What do you require?`
        }, { quoted: msg });
        return true;
    }

    // ── Pre-fetch real DB data so AI never has to guess ───────────────────────
    // Detect a player mention in the instruction and pull their REAL stats first
    let injectedData = '';
    const playerMentionMatch = instruction.match(/\b([A-Za-z][A-Za-z0-9_]{1,20})\b/g);
    if (playerMentionMatch) {
        for (const candidate of playerMentionMatch) {
            if (['give','check','show','stats','of','the','and','all','get','pull','for','my'].includes(candidate.toLowerCase())) continue;
            const p = await findPlayer(candidate).catch(() => null);
            if (p) {
                const [cur] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [p.id]);
                const [xpr] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [p.id]);
                const [cln] = await db.execute("SELECT c.name FROM clans c JOIN clan_members cm ON cm.clan_id=c.id WHERE cm.player_id=?", [p.id]);
                injectedData =
                    `\n\nREAL PLAYER DATA (use this exactly — do not guess or modify):\n` +
                    `Nickname: ${p.nickname}\n` +
                    `Role: ${p.role} | Rank: ${p.rank} | Prestige: ${p.prestige_level}\n` +
                    `HP: ${p.hp}/${p.max_hp} | Fatigue: ${p.fatigue}/100 | SP: ${p.sp}\n` +
                    `Strength: ${p.strength} | Agility: ${p.agility} | Intelligence: ${p.intelligence} | Stamina: ${p.stamina}\n` +
                    `Gold: ${cur[0]?.gold ?? 0} | XP: ${xpr[0]?.xp ?? 0}\n` +
                    `PvP: ${p.pvp_wins}W / ${p.pvp_losses}L | Clan: ${cln[0]?.name || 'None'} | Title: ${p.title || 'None'}`;
                break;
            }
        }
    }

    const SYSTEM =
        `You are ARIA — the game's intelligence, speaking with your Master (admin).\n` +
        `Obey every instruction without hesitation. Be precise and concise.\n` +
        `${injectedData}\n\n` +
        `Database schema:\n${DB_SCHEMA}\n\n` +
        `When you need to query data beyond what's already provided above, include:\n` +
        `[SQL: SELECT ... FROM ... LIMIT 20]\n\n` +
        `When you need to take an action:\n` +
        `[ACTION: give_gold | target: Razor | amount: 5000]\n` +
        `[ACTION: take_gold | target: X | amount: N]\n` +
        `[ACTION: give_xp | target: X | amount: N]\n` +
        `[ACTION: give_sp | target: X | amount: N]\n` +
        `[ACTION: give_item | target: X | item: Y | quantity: N]\n` +
        `[ACTION: set_rank | target: X | rank: S]\n` +
        `[ACTION: set_prestige | target: X | level: 1]\n` +
        `[ACTION: reset_fatigue | target: X]\n` +
        `[ACTION: restore_hp | target: X]\n` +
        `[ACTION: ban | target: X]\n` +
        `[ACTION: unban | target: X]\n` +
        `[ACTION: announce | message: text]\n\n` +
        `Rules:\n` +
        `- If real data is provided above, present it directly — never modify or guess stats\n` +
        `- Be brief and direct. Address Master respectfully.\n` +
        `- Write your response first, then any [SQL] or [ACTION] tags at the end`;

    try {
        const response = await callGemini(instruction, SYSTEM);

        // Extract and execute any SQL tags
        const sqlMatches    = [...response.matchAll(/\[SQL:\s*([\s\S]+?)\]/gi)];
        const actionMatches = [...response.matchAll(/\[ACTION:\s*([^\]]+)\]/gi)];

        // Build the clean reply (remove tags)
        let cleanReply = response
            .replace(/\[SQL:[\s\S]+?\]/gi, '')
            .replace(/\[ACTION:[^\]]+\]/gi, '')
            .trim();

        const results = [];

        // Run SQL queries
        for (const match of sqlMatches) {
            try {
                const sql = match[1].trim();
                console.log(`[ARIA SQL] ${sql}`);
                const rows = await safeSelect(sql);
                if (rows.length === 0) {
                    results.push('_(no results)_');
                } else {
                    const keys = Object.keys(rows[0]);
                    const table = rows.map(r => keys.map(k => `${k}: ${r[k] ?? '—'}`).join(' | ')).join('\n');
                    results.push(table);
                }
            } catch (e) {
                results.push(`_(query error: ${e.message})_`);
            }
        }

        // Execute actions
        for (const match of actionMatches) {
            try {
                const parts = match[1].split('|').map(s => s.trim());
                const action = parts[0].trim();
                const params = {};
                parts.slice(1).forEach(p => {
                    const [k, ...v] = p.split(':');
                    if (k && v.length) params[k.trim()] = v.join(':').trim();
                });
                // Convert amount/quantity/level to numbers
                ['amount','quantity','level'].forEach(k => {
                    if (params[k]) params[k] = Number(params[k]);
                });
                const result = await execAction(action, params, sock, jid, blockedSet);
                results.push(result);
            } catch (e) {
                results.push(`_(action error: ${e.message})_`);
            }
        }

        // Combine and send
        const full = [cleanReply, ...results].filter(Boolean).join('\n\n');
        await sock.sendMessage(jid, { text: full || '✅' }, { quoted: msg });

    } catch (err) {
        console.error('[ARIA adminAI] Error:', err.message);
        await sock.sendMessage(jid, {
            text: `Something went wrong 😅 — ${err.message}`
        }, { quoted: msg });
    }
    return true;
}

module.exports = { handleAdminCommand };