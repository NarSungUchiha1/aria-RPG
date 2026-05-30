/**
 * !ban @user — ban a player from using the bot
 * !ban @user erase — ban + wipe all their data
 * !unban @user — lift the ban
 * !banclan <name> — ban all members of a clan
 * !banclan <name> erase — ban + wipe entire clan
 * !bans — list all banned players
 */
const db = require('../database/db');

async function ensureBanTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS banned_players (
            player_id   VARCHAR(60) NOT NULL PRIMARY KEY,
            nickname    VARCHAR(60),
            banned_by   VARCHAR(60),
            reason      TEXT,
            banned_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `).catch(() => {});
}

async function erasePlayer(playerId) {
    const id = String(playerId).replace(/@s\.whatsapp\.net|@c\.us/g,'').split(':')[0];
    const tables = [
        ['players',          'id'],
        ['currency',         'player_id'],
        ['xp',               'player_id'],
        ['inventory',        'player_id'],
        ['dungeon_players',  'player_id'],
        ['clan_members',     'player_id'],
        ['player_materials', 'player_id'],
        ['void_resonance',   'player_id'],
        ['player_quests',    'player_id'],
        ['player_achievements','player_id'],
        ['potion_inventory', 'player_id'],
        ['dungeon_entry_log','player_id'],
        ['healer_listings',  'healer_id'],
        ['healer_contracts', 'healer_id'],
        ['explorer_listings','explorer_id'],
        ['forged_weapons',   'player_id'],
        ['exploration_materials','player_id'],
        ['explorations',     'player_id'],
    ];
    for (const [table, col] of tables) {
        await db.execute(`DELETE FROM ${table} WHERE ${col}=?`, [id]).catch(() => {});
    }
    console.log('[BAN] Erased player:', id);
}

module.exports = {
    name: 'ban',
    async execute(msg, args, { userId, isAdmin, client }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');
        await ensureBanTable();

        const sub = args[0]?.toLowerCase();

        // ── !bans ──────────────────────────────────────────────────────────
        if (sub === 'bans' || sub === 'list') {
            const [bans] = await db.execute('SELECT * FROM banned_players ORDER BY banned_at DESC LIMIT 20');
            if (!bans.length) return msg.reply('══〘 🚫 BANS 〙══╮\n┃◆ No banned players.\n╰═══════════════╯');
            let text = '╔══〘 🚫 BANNED PLAYERS 〙══╗\n┃◆\n';
            bans.forEach((b, i) => {
                text += `┃◆ ${i+1}. ${b.nickname || b.player_id}\n`;
            });
            text += '┃◆\n╚═══════════════════════════╝';
            return msg.reply(text);
        }

        // ── !banclan ───────────────────────────────────────────────────────
        if (sub === 'banclan') {
            const clanName = args.slice(1).filter(a => a.toLowerCase() !== 'erase').join(' ');
            const shouldErase = args.includes('erase');
            if (!clanName) return msg.reply('❌ !ban banclan <clan name> [erase]');

            const [members] = await db.execute(
                'SELECT p.id, p.nickname FROM players p JOIN clan_members cm ON cm.player_id = p.id JOIN clans c ON c.id = cm.clan_id WHERE c.name = ?',
                [clanName]
            );
            if (!members.length) return msg.reply('❌ Clan not found or has no members.');

            for (const m of members) {
                await db.execute(
                    'INSERT INTO banned_players (player_id, nickname, banned_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE nickname=?, banned_by=?',
                    [m.id, m.nickname, userId, m.nickname, userId]
                );
                if (shouldErase) await erasePlayer(m.id);
            }

            // Also delete the clan itself if erasing
            if (shouldErase) {
                await db.execute('DELETE FROM clan_members WHERE clan_id IN (SELECT id FROM clans WHERE name=?)', [clanName]).catch(() => {});
                await db.execute('DELETE FROM clans WHERE name=?', [clanName]).catch(() => {});
            }

            return msg.reply(
                '╔══〘 🚫 CLAN BANNED 〙══╗\n' +
                '┃◆ Clan: ' + clanName + '\n' +
                '┃◆ Members banned: ' + members.length + '\n' +
                (shouldErase ? '┃◆ ⚠️ All data erased.\n' : '┃◆ Data kept — use erase to wipe.\n') +
                '╚═══════════════════════════╝'
            );
        }

        // ── !unban @user ───────────────────────────────────────────────────
        if (sub === 'unban') {
            const mention = msg.mentionedJids?.[0] || args[1];
            if (!mention) return msg.reply('❌ Tag a player: !ban unban @user');
            const targetId = String(mention).replace(/@s\.whatsapp\.net|@c\.us/g, '').split(':')[0];
            await db.execute('DELETE FROM banned_players WHERE player_id=?', [targetId]);
            return msg.reply('══〘 ✅ UNBANNED 〙══╮\n┃◆ Player ' + targetId + ' unbanned.\n╰═══════════════╯');
        }

        // ── !ban @user [erase] ─────────────────────────────────────────────
        const mention = msg.mentionedJids?.[0] || args[0];
        if (!mention) return msg.reply(
            '══〘 🚫 BAN 〙══╮\n' +
            '┃◆ !ban @user — ban player\n' +
            '┃◆ !ban @user erase — ban + wipe data\n' +
            '┃◆ !ban unban @user — lift ban\n' +
            '┃◆ !ban banclan <name> — ban whole clan\n' +
            '┃◆ !ban banclan <name> erase — ban + wipe clan\n' +
            '┃◆ !ban bans — list all bans\n' +
            '╰═══════════════════════╯'
        );

        const targetId = String(mention).replace(/@s\.whatsapp\.net|@c\.us/g, '').split(':')[0];
        const shouldErase = args.includes('erase');

        const [pRows] = await db.execute('SELECT nickname FROM players WHERE id=?', [targetId]);
        const nick = pRows[0]?.nickname || targetId;

        await db.execute(
            'INSERT INTO banned_players (player_id, nickname, banned_by) VALUES (?,?,?) ON DUPLICATE KEY UPDATE nickname=?, banned_by=?',
            [targetId, nick, userId, nick, userId]
        );

        if (shouldErase) await erasePlayer(targetId);

        return msg.reply(
            '╔══〘 🚫 BANNED 〙══╗\n' +
            '┃◆ *' + nick + '*\n' +
            (shouldErase ? '┃◆ ⚠️ All data erased.\n' : '┃◆ Banned from using the bot.\n') +
            '╚═══════════════════════════╝'
        );
    }
};