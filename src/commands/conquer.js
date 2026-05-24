/**
 * !conquer <TERRITORY_ID>
 * Starts a territory conquest dungeon.
 * If territory is unclaimed → clan claims it on clear.
 * If territory is held by another clan → territory war starts.
 */

const db = require('../database/db');
const {
    TERRITORIES, ensureTerritoryTables,
    getTerritoryStatus, isClanInTerritoryWar,
    claimTerritory
} = require('../systems/voidTerritories');
const { getPlayerClan, getClanMemberRole } = require('../systems/clanSystem');
const { spawnDungeon, lockDungeon, getActiveDungeon, startLobbyTimer } = require('../engine/dungeon');
const territoryEnemies = require('../data/territoryEnemies');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

module.exports = {
    name: 'conquer',
    async execute(msg, args, { userId, client }) {
        try {
            await ensureTerritoryTables();

            const myClan = await getPlayerClan(userId);
            if (!myClan) return msg.reply(
                '══〘 🌑 CONQUER 〙══╮\n' +
                '┃★ ❌ You must be in a clan to challenge a territory.\n' +
                '╰═══════════════════════╯'
            );

            const myRole = await getClanMemberRole(userId, myClan.id);
            if (!['master', 'officer'].includes(myRole)) return msg.reply(
                '══〘 🌑 CONQUER 〙══╮\n' +
                '┃★ ❌ Only clan masters and officers can launch a conquest.\n' +
                '╰═══════════════════════╯'
            );

            const tid = args[0]?.toUpperCase();
            if (!tid || !TERRITORIES[tid]) return msg.reply(
                '══〘 🌑 CONQUER 〙══╮\n' +
                '┃★ ❌ Specify a territory: ASSEMBLY, WRATHBORNE, or REMNANTS\n' +
                '┃★ Check !territory for details.\n' +
                '╰═══════════════════════╯'
            );

            const territory = TERRITORIES[tid];
            const status    = await getTerritoryStatus();
            const terr      = status[tid] || {};

            // Already own it
            if (terr.clan_id === myClan.id) return msg.reply(
                '══〘 🌑 CONQUER 〙══╮\n' +
                '┃★ ❌ Your clan already controls ' + territory.name + '.\n' +
                '╰═══════════════════════╯'
            );

            // Check no active dungeon
            const active = await getActiveDungeon();
            if (active) return msg.reply(
                '══〘 🌑 CONQUER 〙══╮\n' +
                '┃★ ❌ A dungeon is already active. Wait for it to end.\n' +
                '╰═══════════════════════╯'
            );

            // Check not already in territory war
            const inWar = await isClanInTerritoryWar(myClan.id);
            if (inWar) return msg.reply(
                '══〘 🌑 CONQUER 〙══╮\n' +
                '┃★ ❌ Your clan is already in a territory war.\n' +
                '╰═══════════════════════╯'
            );

            // Check cooldown — can only attempt conquest once every 48 hours
            if (terr.last_attacked) {
                const hoursSince = (Date.now() - new Date(terr.last_attacked)) / (1000 * 60 * 60);
                if (hoursSince < 48) {
                    const hoursLeft = Math.ceil(48 - hoursSince);
                    return msg.reply(
                        '══〘 🌑 CONQUER 〙══╮\n' +
                        '┃★ ❌ This territory was recently contested.\n' +
                        '┃★ ⏳ Cooldown: ' + hoursLeft + ' hours remaining.\n' +
                        '╰═══════════════════════╯'
                    );
                }
            }

            const isUnclaimed  = !terr.clan_id;
            const defenderClan = terr.clan_id || null;
            const defenderName = terr.clan_name || null;

            // Spawn territory dungeon
            const dungeonRank   = 'TERRITORY_' + tid;
            const maxStage      = territory.stages;
            const guardian      = territory.guardian;

            await db.execute(
                'ALTER TABLE dungeon MODIFY COLUMN dungeon_rank VARCHAR(40)'
            ).catch(() => {});

            const [result] = await db.execute(
                'INSERT INTO dungeon (dungeon_rank, stage, max_stage, boss_name, is_active, stage_cleared, in_combat, locked) VALUES (?, 1, ?, ?, 1, 0, 0, 0)',
                [dungeonRank, maxStage, guardian]
            );
            const dungeonId = result.insertId;

            // Spawn first stage enemies
            const enemyData = territoryEnemies[tid];
            if (enemyData) {
                const count   = Math.floor(Math.random() * 3) + 3;
                for (let i = 0; i < count; i++) {
                    const mini = enemyData.miniBosses[Math.floor(Math.random() * enemyData.miniBosses.length)];
                    await db.execute(
                        'INSERT INTO dungeon_enemies (dungeon_id, name, max_hp, current_hp, atk, def, exp, gold, evasion, moves) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [dungeonId, mini.name, mini.hp, mini.hp, mini.atk, mini.def, mini.exp, mini.gold, mini.evasion || 0, JSON.stringify(mini.moves || [])]
                    );
                }
            }

            // Set territory as attacked
            await db.execute(
                'UPDATE void_territories SET last_attacked=NOW() WHERE territory_id=?',
                [tid]
            );

            // Record territory war if contested
            if (!isUnclaimed) {
                await db.execute(
                    'INSERT INTO territory_wars (territory_id, attacker_clan, defender_clan, status, started_at) VALUES (?, ?, ?, \'active\', NOW())',
                    [tid, myClan.id, defenderClan]
                );
            }

            // Store conquest context on the dungeon via flags table
            await db.execute('CREATE TABLE IF NOT EXISTS dungeon_flags (dungeon_id INT PRIMARY KEY, unlimited_entry TINYINT DEFAULT 0, no_rank_check TINYINT DEFAULT 0, territory_id VARCHAR(30) DEFAULT NULL, conquering_clan INT DEFAULT NULL) ').catch(() => {});
            await db.execute(
                'INSERT INTO dungeon_flags (dungeon_id, unlimited_entry, no_rank_check, territory_id, conquering_clan) VALUES (?, 0, 1, ?, ?) ON DUPLICATE KEY UPDATE territory_id=?, conquering_clan=?',
                [dungeonId, tid, myClan.id, tid, myClan.id]
            );

            // Announce
            const isWar = !isUnclaimed;
            await client.sendMessage(RAID_GROUP, {
                text:
                    '╔══〘 🌑 TERRITORY ASSAULT 〙══╗\n' +
                    '┃★\n' +
                    '┃★ ' + territory.emoji + ' *' + territory.name + '*\n' +
                    '┃★ 〝' + territory.lore + '〞\n' +
                    '┃★\n' +
                    (isWar
                        ? '┃★ ⚔️ *' + myClan.name + '* challenges\n' +
                          '┃★ *' + defenderName + '* for control!\n'
                        : '┃★ *' + myClan.name + '* moves to claim\n' +
                          '┃★ unclaimed territory.\n'
                    ) +
                    '┃★\n' +
                    '┃★ ' + territory.stages + ' stages.\n' +
                    '┃★ Guardian: *' + guardian + '*\n' +
                    '┃★\n' +
                    '┃★ Only *' + myClan.name + '* members can enter.\n' +
                    '┃★ DM the bot !enter to join.\n' +
                    '┃★ ⏳ Portal closes in 10 minutes.\n' +
                    '┃★\n' +
                    '╚═══════════════════════════╝'
            });

            startLobbyTimer(dungeonId, client);

            return msg.reply(
                '╔══〘 🌑 CONQUEST LAUNCHED 〙══╗\n' +
                '┃★ ' + territory.name + '\n' +
                '┃★ ' + territory.stages + ' stages — clear to ' + (isWar ? 'take control.' : 'claim it.') + '\n' +
                '┃★ Announcement sent to the group.\n' +
                '╚═══════════════════════════╝'
            );

        } catch (err) {
            console.error('conquer error:', err);
            msg.reply('❌ Conquest failed.');
        }
    }
};