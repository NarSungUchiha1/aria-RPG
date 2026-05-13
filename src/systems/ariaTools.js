/**
 * ARIA Tool Registry
 * Fixed, reliable DB queries. ARIA picks a tool by name.
 * She never writes SQL. We run the queries. She gets real data.
 */

const db = require('../database/db');

const TOOLS = {

    get_player: {
        desc: 'Full stats of a player by nickname',
        async run({ name }) {
            const [rows] = await db.execute(`
                SELECT p.nickname, p.role, p.\`rank\`, p.prestige_level,
                       p.hp, p.max_hp, p.strength, p.agility, p.intelligence,
                       p.stamina, p.fatigue, p.sp, p.pvp_wins, p.pvp_losses,
                       p.title, c.gold, x.xp, cl.name as clan
                FROM players p
                LEFT JOIN currency c ON c.player_id = p.id
                LEFT JOIN xp x ON x.player_id = p.id
                LEFT JOIN clan_members cm ON cm.player_id = p.id
                LEFT JOIN clans cl ON cl.id = cm.clan_id
                WHERE LOWER(p.nickname) = LOWER(?) LIMIT 1`,
                [name]
            );
            if (!rows[0]) {
                // Try partial match
                const [rows2] = await db.execute(`
                    SELECT p.nickname, p.role, p.\`rank\`, p.prestige_level,
                           p.hp, p.max_hp, p.strength, p.agility, p.intelligence,
                           p.stamina, p.fatigue, p.sp, p.pvp_wins, p.pvp_losses,
                           p.title, c.gold, x.xp, cl.name as clan
                    FROM players p
                    LEFT JOIN currency c ON c.player_id = p.id
                    LEFT JOIN xp x ON x.player_id = p.id
                    LEFT JOIN clan_members cm ON cm.player_id = p.id
                    LEFT JOIN clans cl ON cl.id = cm.clan_id
                    WHERE LOWER(p.nickname) LIKE LOWER(?) LIMIT 1`,
                    [`%${name}%`]
                );
                if (!rows2[0]) return `No player found with name "${name}".`;
                rows[0] = rows2[0];
            }
            const p = rows[0];
            return `${p.nickname} | ${p.role} | Rank ${p.rank}${p.prestige_level > 0 ? ` (Prestige ${p.prestige_level})` : ''}\n` +
                   `HP: ${p.hp}/${p.max_hp} | Fatigue: ${p.fatigue}/100 | SP: ${p.sp}\n` +
                   `STR: ${p.strength} | AGI: ${p.agility} | INT: ${p.intelligence} | STA: ${p.stamina}\n` +
                   `Gold: ${Number(p.gold||0).toLocaleString()} | XP: ${Number(p.xp||0).toLocaleString()}\n` +
                   `PvP: ${p.pvp_wins}W / ${p.pvp_losses}L | Clan: ${p.clan || 'None'} | Title: ${p.title || 'None'}`;
        }
    },

    get_pvp: {
        desc: 'PvP record of a player',
        async run({ name }) {
            const [rows] = await db.execute(
                `SELECT nickname, pvp_wins, pvp_losses, \`rank\`, prestige_level
                 FROM players WHERE LOWER(nickname) LIKE LOWER(?) LIMIT 1`,
                [`%${name}%`]
            );
            if (!rows[0]) return `No player found with name "${name}".`;
            const p = rows[0];
            const total = p.pvp_wins + p.pvp_losses;
            const rate  = total > 0 ? Math.round((p.pvp_wins / total) * 100) : 0;
            return `${p.nickname} [${p.rank}${p.prestige_level > 0 ? ` P${p.prestige_level}` : ''}] — PvP: ${p.pvp_wins}W / ${p.pvp_losses}L (${rate}% win rate)`;
        }
    },

    get_clan: {
        desc: 'Info about a clan',
        async run({ name }) {
            const whereClause = name ? 'WHERE LOWER(c.name) LIKE LOWER(?)' : '';
            const params = name ? [`%${name}%`] : [];
            const [rows] = await db.execute(`
                SELECT c.name, c.blessing_type, p.nickname as leader,
                       COUNT(cm.player_id) as members
                FROM clans c
                LEFT JOIN players p ON p.id = c.leader_id
                LEFT JOIN clan_members cm ON cm.clan_id = c.id
                ${whereClause}
                GROUP BY c.id ORDER BY members DESC LIMIT 5`,
                params
            );
            if (!rows.length) return name ? `No clan found named "${name}".` : 'No clans exist yet.';
            return rows.map(r =>
                `"${r.name}" — Leader: ${r.leader || '?'} | Members: ${r.members} | Blessing: ${r.blessing_type || 'None'}`
            ).join('\n');
        }
    },

    get_leaderboard: {
        desc: 'Top 10 players by xp, gold, or pvp',
        async run({ type = 'xp' }) {
            const orderBy = { xp: 'x.xp', gold: 'c.gold', pvp: 'p.pvp_wins' }[type] || 'x.xp';
            const [rows] = await db.execute(`
                SELECT p.nickname, p.\`rank\`, p.prestige_level, p.pvp_wins,
                       c.gold, x.xp
                FROM players p
                LEFT JOIN currency c ON c.player_id = p.id
                LEFT JOIN xp x ON x.player_id = p.id
                ORDER BY ${orderBy} DESC LIMIT 10`
            );
            return `Top 10 by ${type}:\n` + rows.map((r, i) =>
                `${i+1}. ${r.nickname} [${r.rank}]${r.prestige_level > 0 ? '⭐' : ''} — XP: ${Number(r.xp||0).toLocaleString()} | Gold: ${Number(r.gold||0).toLocaleString()} | PvP: ${r.pvp_wins}W`
            ).join('\n');
        }
    },

    get_dungeon_history: {
        desc: 'Recent dungeon runs in the last 24 hours',
        async run() {
            const [rows] = await db.execute(`
                SELECT d.dungeon_rank, d.stage, d.max_stage, d.is_active,
                       d.created_at,
                       GROUP_CONCAT(p.nickname ORDER BY p.nickname SEPARATOR ', ') as players
                FROM dungeon d
                LEFT JOIN dungeon_players dp ON dp.dungeon_id = d.id
                LEFT JOIN players p ON p.id = dp.player_id
                WHERE d.created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
                GROUP BY d.id ORDER BY d.created_at DESC LIMIT 10`
            );
            if (!rows.length) return 'No dungeon runs in the last 24 hours.';
            return rows.map(r =>
                `Rank ${r.dungeon_rank} | Stage ${r.stage}/${r.max_stage} | ${r.is_active ? 'ACTIVE' : 'Done'} | Players: ${r.players || 'none'} | ${new Date(r.created_at).toLocaleString()}`
            ).join('\n');
        }
    },

    get_active_dungeon: {
        desc: 'What dungeon is currently active and who is in it',
        async run() {
            const [rows] = await db.execute(`
                SELECT d.dungeon_rank, d.stage, d.max_stage, d.stage_cleared,
                       GROUP_CONCAT(p.nickname SEPARATOR ', ') as raiders
                FROM dungeon d
                LEFT JOIN dungeon_players dp ON dp.dungeon_id = d.id AND dp.is_alive = 1
                LEFT JOIN players p ON p.id = dp.player_id
                WHERE d.is_active = 1
                GROUP BY d.id LIMIT 1`
            );
            if (!rows[0]) return 'No dungeon is currently active.';
            const d = rows[0];
            return `Rank ${d.dungeon_rank} dungeon | Stage ${d.stage}/${d.max_stage} ${d.stage_cleared ? '(cleared)' : '(in progress)'} | Raiders: ${d.raiders || 'none'}`;
        }
    },

    get_inventory: {
        desc: "A player's inventory",
        async run({ name }) {
            const [player] = await db.execute(
                "SELECT id, nickname FROM players WHERE LOWER(nickname) LIKE LOWER(?) LIMIT 1",
                [`%${name}%`]
            );
            if (!player[0]) return `No player found named "${name}".`;
            const [items] = await db.execute(
                "SELECT item_name, item_type, quantity, equipped FROM inventory WHERE player_id = ? ORDER BY equipped DESC, item_type",
                [player[0].id]
            );
            if (!items.length) return `${player[0].nickname} has an empty inventory.`;
            return `${player[0].nickname}'s inventory:\n` +
                items.map(i => `${i.equipped ? '✅ ' : ''}${i.item_name} (${i.item_type}) x${i.quantity}`).join('\n');
        }
    },

    get_quests: {
        desc: "A player's quest progress",
        async run({ name }) {
            const [player] = await db.execute(
                "SELECT id, nickname FROM players WHERE LOWER(nickname) LIKE LOWER(?) LIMIT 1",
                [`%${name}%`]
            );
            if (!player[0]) return `No player found named "${name}".`;
            const [rows] = await db.execute(`
                SELECT q.title, q.quest_type, pq.progress, q.objective_count,
                       pq.completed, pq.claimed
                FROM player_quests pq
                JOIN quests q ON q.id = pq.quest_id
                WHERE pq.player_id = ?
                ORDER BY pq.completed ASC, pq.progress DESC LIMIT 10`,
                [player[0].id]
            );
            if (!rows.length) return `${player[0].nickname} has no active quests.`;
            return `${player[0].nickname}'s quests:\n` +
                rows.map(q =>
                    `${q.completed ? (q.claimed ? '✅' : '🎁') : '🔄'} ${q.title} — ${q.progress}/${q.objective_count} (${q.quest_type})`
                ).join('\n');
        }
    },

    get_server_stats: {
        desc: 'Overall server statistics',
        async run() {
            const [[{ players }]] = await db.execute("SELECT COUNT(*) as players FROM players");
            const [[{ clans }]]   = await db.execute("SELECT COUNT(*) as clans FROM clans");
            const [[{ active }]]  = await db.execute("SELECT COUNT(*) as active FROM dungeon WHERE is_active=1");
            const [[{ duels }]]   = await db.execute("SELECT COUNT(*) as duels FROM pvp_challenges WHERE status='pending' AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)");
            return `Server stats — Players: ${players} | Clans: ${clans} | Active dungeons: ${active} | Pending duels: ${duels}`;
        }
    }

};

// ── Run a tool by name ────────────────────────────────────────────────────────
async function runTool(toolName, params = {}) {
    const tool = TOOLS[toolName];
    if (!tool) return `Unknown tool: ${toolName}`;
    try {
        return await tool.run(params);
    } catch (e) {
        console.error(`[ARIA tool ${toolName}]`, e.message);
        return `Couldn't fetch that data right now.`;
    }
}

// ── Tool descriptions for the system prompt ───────────────────────────────────
function toolList() {
    return Object.entries(TOOLS).map(([name, t]) =>
        `[TOOL: ${name} | param: value] — ${t.desc}`
    ).join('\n');
}

module.exports = { runTool, toolList };