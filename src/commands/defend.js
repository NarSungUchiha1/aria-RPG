/**
 * !defend <TERRITORY_ID>
 * Defender clan members DM this to enter the defense side of a territory war.
 * Only members of the clan that holds the territory can use this.
 */

const db = require('../database/db');
const { TERRITORIES, ensureTerritoryTables, getTerritoryStatus } = require('../systems/voidTerritories');
const { getPlayerClan } = require('../systems/clanSystem');

module.exports = {
    name: 'defend',
    async execute(msg, args, { userId, client }) {
        try {
            await ensureTerritoryTables();

            const tid = args[0]?.toUpperCase();
            if (!tid || !TERRITORIES[tid]) return msg.reply(
                '══〘 🛡️ DEFEND 〙══╮\n' +
                '┃★ ❌ Specify territory: !defend ASSEMBLY / WRATHBORNE / REMNANTS\n' +
                '╰═══════════════════════╯'
            );

            const myClan = await getPlayerClan(userId);
            if (!myClan) return msg.reply('❌ You are not in a clan.');

            const status = await getTerritoryStatus();
            const terr   = status[tid] || {};

            // Only the holding clan can defend
            if (terr.clan_id !== myClan.id) return msg.reply(
                '══〘 🛡️ DEFEND 〙══╮\n' +
                '┃★ ❌ Your clan does not hold ' + TERRITORIES[tid].name + '.\n' +
                '╰═══════════════════════╯'
            );

            // Find the active territory dungeon for this territory
            const [dungeon] = await db.execute(
                "SELECT id, locked FROM dungeon WHERE dungeon_rank=? AND is_active=1 ORDER BY id DESC LIMIT 1",
                ['TERRITORY_' + tid]
            );
            if (!dungeon.length) return msg.reply(
                '══〘 🛡️ DEFEND 〙══╮\n' +
                '┃★ ❌ No active assault on this territory.\n' +
                '╰═══════════════════════╯'
            );

            if (dungeon[0].locked) return msg.reply(
                '══〘 🛡️ DEFEND 〙══╮\n' +
                '┃★ ❌ The assault has already started.\n' +
                '┃★ Defense window has closed.\n' +
                '╰═══════════════════════╯'
            );

            // Check not already in dungeon
            const [already] = await db.execute(
                'SELECT id FROM dungeon_players WHERE dungeon_id=? AND player_id=?',
                [dungeon[0].id, userId]
            );
            if (already.length) return msg.reply('❌ You are already in the dungeon.');

            // Add to dungeon as defender
            await db.execute(
                'INSERT INTO dungeon_players (player_id, dungeon_id, is_alive, session_gold, session_xp) VALUES (?, ?, 1, 0, 0)',
                [userId, dungeon[0].id]
            );

            // Flag them as defender in dungeon_flags context (for reward routing)
            await db.execute(
                'ALTER TABLE dungeon_players ADD COLUMN IF NOT EXISTS is_defender TINYINT DEFAULT 0'
            ).catch(() => {});
            await db.execute(
                'UPDATE dungeon_players SET is_defender=1 WHERE player_id=? AND dungeon_id=?',
                [userId, dungeon[0].id]
            );

            const territory = TERRITORIES[tid];
            const [pRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [userId]);

            return msg.reply(
                '╔══〘 🛡️ DEFENDING 〙══╗\n' +
                '┃★ *' + (pRow[0]?.nickname || userId) + '*\n' +
                '┃★ You stand for *' + myClan.name + '*.\n' +
                '┃★\n' +
                '┃★ ' + territory.emoji + ' ' + territory.name + '\n' +
                '┃★ Hold it.\n' +
                '╚═══════════════════════════╝'
            );

        } catch (err) {
            console.error('defend error:', err);
            msg.reply('❌ Defense failed: ' + err.message);
        }
    }
};