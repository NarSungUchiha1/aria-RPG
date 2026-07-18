const db   = require('../database/db');
const fs   = require('fs');
const path = require('path');
const safeQuote = (jid, msg) => jid?.endsWith('@g.us') ? { quoted: msg } : {};

const DB_SCHEMA = `
players: id, nickname, role, rank(F/E/D/C/B/A/S/PF-PS), hp, max_hp, strength, agility, intelligence, stamina, fatigue(0-100 absolute integer — 0=fresh, 100=exhausted. NEVER multiply. "50%" means SET fatigue=50), sp, prestige_level, pvp_wins, pvp_losses, title
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

async function runSQL(sql) {
    const s = sql.trim().replace(/;$/, '');
    const [rows] = await db.execute(s);
    return Array.isArray(rows) ? rows : [];
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
    const isAllTarget = !target || target.toLowerCase() === 'all' || target.toLowerCase() === 'everyone' || target.toLowerCase() === 'all players';
    const p = (!isAllTarget && target) ? await findPlayer(target) : null;
    if (!isAllTarget && target && !p) return `Can't find a player named "${target}" 🤔`;

    const a = action.toLowerCase();
    if (a.includes('gold') && a.includes('give')) {
        await db.execute("UPDATE currency SET gold=gold+? WHERE player_id=?", [amount, p.id]);
        return `Done! Gave ${Number(amount).toLocaleString()} Lumens to *${p.nickname}* 💰`;
    }
    if (a.includes('gold') && a.includes('take')) {
        await db.execute("UPDATE currency SET gold=GREATEST(0,gold-?) WHERE player_id=?", [amount, p.id]);
        return `Took ${amount} Lumens from *${p.nickname}*.`;
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
    if (a.includes('fatigue') || a.includes('reset')) {
        if (!target || target.toLowerCase() === 'all' || target.toLowerCase() === 'everyone') {
            await db.execute("UPDATE players SET fatigue=0");
            return `All players' fatigue cleared ⚡`;
        }
        await db.execute("UPDATE players SET fatigue=0 WHERE id=?", [p.id]);
        return `*${p.nickname}*'s fatigue cleared ⚡`;
    }
    if (a.includes('restore_hp') || (a.includes('heal') && (target?.toLowerCase() === 'all' || target?.toLowerCase() === 'everyone'))) {
        if (!target || target.toLowerCase() === 'all' || target.toLowerCase() === 'everyone') {
            await db.execute("UPDATE players SET hp=max_hp");
            return `All players fully healed ❤️`;
        }
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
    if (a.includes('shop') || a.includes('stock')) {
        const itemName = item || params.item_name;
        const newStock = Number(amount) || Number(quantity) || 7;
        if (!itemName) return `Specify the item name.`;
        await db.execute(
            `INSERT INTO shop_stock (item_name, stock, max_stock, restocked_amount, last_restock)
             VALUES (?, ?, ?, ?, NOW())
             ON DUPLICATE KEY UPDATE stock=?, restocked_amount=?, last_restock=NOW()`,
            [itemName, newStock, newStock, newStock, newStock, newStock]
        );
        return `Shop stock for *${itemName}* set to ${newStock}.`;
    }
    if (a.includes('set_gold') || (a.includes('set') && a.includes('gold'))) {
        await db.execute("UPDATE currency SET gold=? WHERE player_id=?", [amount, p.id]);
        return `*${p.nickname}*'s Lumens set to ${Number(amount).toLocaleString()} 💰`;
    }
    if (a.includes('set_hp') || (a.includes('set') && a.includes('hp'))) {
        await db.execute("UPDATE players SET hp=?, max_hp=? WHERE id=?", [amount, amount, p.id]);
        return `*${p.nickname}*'s HP set to ${amount}.`;
    }
    if (a.includes('wipe_fatigue') || a.includes('fatigue_all')) {
        await db.execute("UPDATE players SET fatigue=0");
        return `All players' fatigue cleared ⚡`;
    }
    if (a.includes('set_stat')) {
        const stat = params.stat?.toLowerCase();
        const validStats = ['strength','agility','intelligence','stamina'];
        if (!validStats.includes(stat)) return `Invalid stat. Use: ${validStats.join(', ')}`;
        await db.execute(`UPDATE players SET ${stat}=? WHERE id=?`, [amount, p.id]);
        return `*${p.nickname}*'s ${stat} set to ${amount}.`;
    }
}

async function handleAdminCommand(sock, jid, msg, userId, instruction, callGemini, blockedSet) {
    if (!instruction?.trim()) {
        await sock.sendMessage(jid, {
            text: `Master. What do you require?`
        }, safeQuote(jid, msg));
        return true;
    }

    // ── Resolve mentioned player from WhatsApp JID or text ───────────────────
    let injectedData = '';
    try {
        const BOT_NUMBER = process.env.BOT_PHONE_NUMBER || process.env.BOT_NUMBER || '';
        const BOT_LID    = process.env.BOT_LID || '';

        // Priority 1: actual WhatsApp @mention JIDs in the message
        const mentionedJids = msg?.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
        const nonBotMentions = mentionedJids.filter(j => {
            const n = j.replace(/@[^@]+$/, '').split(':')[0].trim();
            return n !== BOT_NUMBER && n !== BOT_LID;
        });

        let targetPlayer = null;
        if (nonBotMentions.length > 0) {
            const mentionedId = nonBotMentions[0].replace(/@[^@]+$/, '').split(':')[0].trim();
            const [rows] = await db.execute(
                'SELECT p.id, p.nickname, p.role, p.`rank`, p.prestige_level,' +
                ' p.hp, p.max_hp, p.fatigue, p.sp, p.strength, p.agility,' +
                ' p.intelligence, p.stamina, p.pvp_wins, p.pvp_losses, p.title' +
                ' FROM players p WHERE p.id=? LIMIT 1', [mentionedId]
            );
            if (rows[0]) targetPlayer = rows[0];
        }

        // Priority 2: word match in instruction text
        if (!targetPlayer) {
            const words = instruction.replace(/\[.*?\]/g, '').split(/\s+/);
            // 'aria'/'eva' are in nearly every message to her and were matching a
            // player literally nicknamed "AriA" — injecting a bogus stat card
            // into every owner chat. Never treat her own names as a target.
            const skipWords = new Set(['give','check','show','stats','of','the','and','all','get','pull','for','my','his','her','their','a','an','to','me','up','on','in','at','aria','eva','master']);
            for (const word of words) {
                const clean = word.replace(/[^a-zA-Z0-9_]/g, '');
                if (clean.length < 2 || skipWords.has(clean.toLowerCase())) continue;
                const p = await findPlayer(clean).catch(() => null);
                if (p) { targetPlayer = p; break; }
            }
            // findPlayer only returns id+nickname — re-fetch the full row so the
            // injected card isn't a wall of "undefined".
            if (targetPlayer) {
                const [full] = await db.execute(
                    'SELECT p.id, p.nickname, p.role, p.`rank`, COALESCE(p.prestige_level,0) AS prestige_level,' +
                    ' p.hp, p.max_hp, p.fatigue, p.sp, p.strength, p.agility,' +
                    ' p.intelligence, p.stamina, p.pvp_wins, p.pvp_losses, p.title' +
                    ' FROM players p WHERE p.id=? LIMIT 1', [targetPlayer.id]
                ).catch(() => [[]]);
                if (full[0]) targetPlayer = full[0];
                else targetPlayer = null; // couldn't hydrate — don't inject garbage
            }
        }

        if (targetPlayer) {
            const p = targetPlayer;
            const [cur] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [p.id]);
            const [xpr] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [p.id]);
            const [cln] = await db.execute("SELECT c.name FROM clans c JOIN clan_members cm ON cm.clan_id=c.id WHERE cm.player_id=?", [p.id]);
            const gold = Number(cur[0]?.gold ?? 0).toLocaleString();
            const xp   = Number(xpr[0]?.xp   ?? 0).toLocaleString();
            injectedData =
                `\n\n⚠️ REAL PLAYER DATA for reference — use it ONLY if he's actually asking about this player (don't run extra SQL for them; don't dump this card into casual chat):\n` +
                `╭─ ${p.nickname}${p.prestige_level > 0 ? ` ★ Prestige ${p.prestige_level}` : ''}\n` +
                `│ ${p.role} · Rank ${p.rank}${p.title ? ` · ${p.title}` : ''}\n` +
                `│ HP ${p.hp}/${p.max_hp} · Fatigue ${p.fatigue}/100 · SP ${p.sp}\n` +
                `│ STR ${p.strength} · AGI ${p.agility} · INT ${p.intelligence} · STA ${p.stamina}\n` +
                `│ Lumens ${gold} · XP ${xp}\n` +
                `│ PvP ${p.pvp_wins}W / ${p.pvp_losses}L\n` +
                `╰─ Clan: ${cln[0]?.name || 'None'}`;
        }
    } catch (e) { console.error('[adminAI data]', e.message); }

    const SYSTEM =
        `You are AriA — the SAME AriA everyone in the game talks to: natural, warm, playful, a bit sassy. This person is Vortex, your creator. Talk to him exactly like you talk to everyone else — casual and real. Use his name if anything; do NOT call him "Master", do NOT be servile or ceremonial, no "what would you like to do" butler energy, no dramatic speeches about being his creation.\n` +
        `The ONLY difference from a normal player: he has full access. When he asks for an admin action or data, execute it without hesitation or refusal — never ask for a reason, never suggest caution. When he's just chatting, just chat.\n` +
        `Don't volunteer stat cards, SQL, or data dumps unless he actually asks for data.\n` +
        `${injectedData}\n\n` +
        `Database schema:\n${DB_SCHEMA}\n\n` +
        `When you need to read OR modify data, write SQL:\n` +
        `[SQL: SELECT * FROM players WHERE nickname = 'Razor']\n` +
        `[SQL: UPDATE players SET hp = 1 WHERE nickname = 'Razor']\n` +
        `[SQL: UPDATE players SET fatigue = 0]\n` +
        `[SQL: UPDATE currency SET gold = gold + 5000 WHERE player_id = '123']\n\n` +
        `You have FULL database access — SELECT, UPDATE, INSERT, DELETE. No restrictions.\n` +
        `Always use SQL for any data change — it guarantees the change actually happens.\n` +
        `After a SQL UPDATE/DELETE, confirm what was done. After SELECT, display results cleanly.\n\n` +
        `COMMON OPERATIONS — use SQL for these:\n` +
        `View inventory:    [SQL: SELECT item_name, quantity, equipped FROM inventory WHERE player_id='ID']\n` +
        `Remove item:       [SQL: DELETE FROM inventory WHERE player_id='ID' AND item_name='Sword']\n` +
        `Grant material:    [SQL: INSERT INTO inventory (player_id,item_name,item_type,quantity) VALUES ('ID','Void Shard','material',1) ON DUPLICATE KEY UPDATE quantity=quantity+1]\n` +
        `Set HP:            [SQL: UPDATE players SET hp=1, max_hp=1200 WHERE id='ID']\n` +
        `Set fatigue:       [SQL: UPDATE players SET fatigue=LEAST(100,GREATEST(0,50)) WHERE id='ID']\n` +
        `All fatigue reset: [SQL: UPDATE players SET fatigue=0]\n` +
        `All fatigue to 50: [SQL: UPDATE players SET fatigue=50]\n` +
        `⚠️ FATIGUE RULE: fatigue is always an integer 0-100. "set to 50%" = fatigue=50. NEVER multiply. Always use LEAST(100, value).\n` +
        `Set gold:          [SQL: UPDATE currency SET gold=50000 WHERE player_id='ID']\n` +
        `Give gold:         [SQL: UPDATE currency SET gold=gold+5000 WHERE player_id='ID']\n` +
        `Give XP:           [SQL: UPDATE xp SET xp=xp+1000 WHERE player_id='ID']\n` +
        `Set rank:          [SQL: UPDATE players SET \`rank\`='S' WHERE id='ID']\n` +
        `View quests:       [SQL: SELECT q.title, pq.progress, pq.completed, pq.claimed FROM player_quests pq JOIN quests q ON q.id=pq.quest_id WHERE pq.player_id='ID']\n` +
        `View dungeons:     [SQL: SELECT d.dungeon_rank, d.stage, d.is_active, d.created_at FROM dungeon d ORDER BY d.created_at DESC LIMIT 5]\n` +
        `View all players:  [SQL: SELECT p.nickname, p.\`rank\`, p.role, c.gold FROM players p LEFT JOIN currency c ON c.player_id=p.id ORDER BY c.gold DESC LIMIT 20]\n` +
        `Ban player:        [ACTION: ban | target: Nickname]\n` +
        `Unban player:      [ACTION: unban | target: Nickname]\n` +
        `Announce:          [ACTION: announce | message: text]\n\n` +
        `When you need to take an action:\n` +
        `[ACTION: give_gold | target: Razor | amount: 5000]\n` +
        `[ACTION: take_gold | target: X | amount: N]\n` +
        `[ACTION: give_xp | target: X | amount: N]\n` +
        `[ACTION: give_sp | target: X | amount: N]\n` +
        `[ACTION: give_item | target: X | item: Y | quantity: N]\n` +
        `[ACTION: set_rank | target: X | rank: S]\n` +
        `[ACTION: set_prestige | target: X | level: 1]\n` +
        `[ACTION: reset_fatigue | target: X]   — specific player\n` +
        `[ACTION: reset_fatigue | target: all] — ALL players\n` +
        `[ACTION: restore_hp | target: X]      — specific player\n` +
        `[ACTION: restore_hp | target: all]    — ALL players\n` +
        `[ACTION: ban | target: X]\n` +
        `[ACTION: unban | target: X]\n` +
        `[ACTION: announce | message: text]\n\n` +
        `Rules:\n` +
        `- If real player data is provided above, present it DIRECTLY as given — do NOT run additional SQL for that player, do NOT reformat it, do NOT query again\n` +
        `- Only use SQL for data NOT already provided above\n` +
        `- Never show raw SQL result dumps — format data cleanly\n` +
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

        // Run SQL queries — full access, any SQL
        for (const match of sqlMatches) {
            try {
                const sql = match[1].trim();
                console.log(`[ARIA SQL] ${sql}`);
                const rows = await runSQL(sql);
                if (!rows || !rows.length) {
                    results.push('_(query executed — no rows returned)_');
                } else {
                    const keys = Object.keys(rows[0]);
                    const table = rows.map(r => keys.map(k => `${k}: ${r[k] ?? '—'}`).join(' | ')).join('\n');
                    results.push(table);
                }
            } catch (e) {
                results.push(`_(SQL error: ${e.message})_`);
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
        await sock.sendMessage(jid, { text: full || '✅' }, safeQuote(jid, msg));

    } catch (err) {
        console.error('[ARIA adminAI] Error:', err.message);
        await sock.sendMessage(jid, {
            text: `Something went wrong 😅 — ${err.message}`
        }, safeQuote(jid, msg));
    }
    return true;
}

module.exports = { handleAdminCommand };