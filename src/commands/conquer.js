/**
 * !conquer <TERRITORY_ID>
 *
 * Works like a party duel — launches in the RAID GROUP.
 * Attacker clan members DM !enter to join the assault party.
 * If territory is held, defender clan gets notified and can field defenders.
 * Territory dungeons are isolated — no normal dungeon spawns can interfere.
 * Once the assault dungeon is locked (started), it runs independently.
 */

const db = require('../database/db');
const {
    TERRITORIES, ensureTerritoryTables,
    getTerritoryStatus, isClanInTerritoryWar,
    claimTerritory
} = require('../systems/voidTerritories');
const { getPlayerClan, getClanMemberRole, getClanMembers } = require('../systems/clanSystem');
const { addVoidResonance } = require('../systems/ascendantSystem');
const { TERRITORY_ENEMIES: territoryEnemies } = require('../data/territoryEnemies');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
const LOBBY_DURATION_MS = 60 * 60 * 1000; // 1 hour — defenders have 1 hour to respond

// Active territory assault lobbies: dungeonId → { tid, attackerClan, defenderClan, timer }
const territoryLobbies = new Map();

function clearTerritoryLobby(dungeonId) {
    const t = territoryLobbies.get(dungeonId);
    if (t) { clearTimeout(t.timer); territoryLobbies.delete(dungeonId); }
}

module.exports = {
    name: 'conquer',
    clearTerritoryLobby,
    async execute(msg, args, { userId, client }) {
        try {
            await ensureTerritoryTables();

            const myClan = await getPlayerClan(userId);
            if (!myClan) return msg.reply(
                '══〘 🌑 CONQUER 〙══╮\n' +
                '┃★ ❌ You must be in a clan.\n' +
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
                '┃★ ❌ Specify a territory:\n' +
                '┃★ ASSEMBLY, WRATHBORNE or REMNANTS\n' +
                '┃★ Use !territory to check status.\n' +
                '╰═══════════════════════╯'
            );

            const territory = TERRITORIES[tid];
            const status    = await getTerritoryStatus();
            const terr      = status[tid] || {};

            if (terr.clan_id === myClan.id) return msg.reply(
                '══〘 🌑 CONQUER 〙══╮\n' +
                '┃★ ❌ Your clan already controls\n' +
                '┃★ ' + territory.name + '.\n' +
                '╰═══════════════════════╯'
            );

            // Block if ANY territory dungeon is currently active
            const [anyActiveTerr] = await db.execute(
                "SELECT id, dungeon_rank FROM dungeon WHERE dungeon_rank LIKE 'TERRITORY_%' AND is_active=1 LIMIT 1"
            );
            if (anyActiveTerr.length) {
                const activeTid = anyActiveTerr[0].dungeon_rank.replace('TERRITORY_', '');
                const { TERRITORIES: T } = require('../systems/voidTerritories');
                const activeName = T[activeTid]?.name || activeTid;
                return msg.reply(
                    '══〘 🌑 CONQUER 〙══╮\n' +
                    '┃★ ❌ A territory assault is already active.\n' +
                    '┃★ ' + activeName + ' is under siege.\n' +
                    '┃★ Wait for it to end first.\n' +
                    '╰═══════════════════════╯'
                );
            }

            const inWar = await isClanInTerritoryWar(myClan.id);
            if (inWar) return msg.reply(
                '══〘 🌑 CONQUER 〙══╮\n' +
                '┃★ ❌ Your clan is already in a territory war.\n' +
                '╰═══════════════════════╯'
            );

            // 48hr cooldown
            if (terr.last_attacked) {
                const hoursSince = (Date.now() - new Date(terr.last_attacked)) / (1000 * 60 * 60);
                if (hoursSince < 48) {
                    const hoursLeft = Math.ceil(48 - hoursSince);
                    return msg.reply(
                        '══〘 🌑 CONQUER 〙══╮\n' +
                        '┃★ ❌ Territory on cooldown.\n' +
                        '┃★ ⏳ ' + hoursLeft + ' hours remaining.\n' +
                        '╰═══════════════════════╯'
                    );
                }
            }

            const isUnclaimed  = !terr.clan_id;
            const defenderClan = terr.clan_id   || null;
            const defenderName = terr.clan_name || null;

            // ── Spawn territory dungeon ───────────────────────────────────────
            await db.execute('ALTER TABLE dungeon MODIFY COLUMN dungeon_rank VARCHAR(40)').catch(() => {});

            const [result] = await db.execute(
                'INSERT INTO dungeon (dungeon_rank, stage, max_stage, boss_name, is_active, stage_cleared, in_combat, locked) VALUES (?, 1, ?, ?, 1, 0, 0, 0)',
                ['TERRITORY_' + tid, territory.stages, territory.guardian]
            );
            const dungeonId = result.insertId;

            // Spawn first stage enemies
            const enemyData = territoryEnemies[tid];
            if (enemyData) {
                const count = Math.floor(Math.random() * 3) + 3;
                for (let i = 0; i < count; i++) {
                    const mini = enemyData.miniBosses[Math.floor(Math.random() * enemyData.miniBosses.length)];
                    await db.execute(
                        'INSERT INTO dungeon_enemies (dungeon_id, name, max_hp, current_hp, atk, def, exp, gold, evasion, moves) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                        [dungeonId, mini.name, mini.hp, mini.hp, mini.atk, mini.def, mini.exp, mini.gold, mini.evasion || 0, JSON.stringify(mini.moves || [])]
                    );
                }
            }

            // Mark last attacked
            await db.execute('UPDATE void_territories SET last_attacked=NOW() WHERE territory_id=?', [tid]);

            // Record territory war if contested
            if (!isUnclaimed) {
                await db.execute(
                    "INSERT INTO territory_wars (territory_id, attacker_clan, defender_clan, status, started_at) VALUES (?, ?, ?, 'pending', NOW())",
                    [tid, myClan.id, defenderClan]
                );
            }

            // Store conquest context
            await db.execute('CREATE TABLE IF NOT EXISTS dungeon_flags (dungeon_id INT PRIMARY KEY, unlimited_entry TINYINT DEFAULT 0, no_rank_check TINYINT DEFAULT 0, territory_id VARCHAR(30) DEFAULT NULL, conquering_clan INT DEFAULT NULL, defending_clan INT DEFAULT NULL)').catch(() => {});
            await db.execute('ALTER TABLE dungeon_flags ADD COLUMN IF NOT EXISTS defending_clan INT DEFAULT NULL').catch(() => {});
            await db.execute(
                'INSERT INTO dungeon_flags (dungeon_id, unlimited_entry, no_rank_check, territory_id, conquering_clan, defending_clan) VALUES (?, 0, 1, ?, ?, ?) ON DUPLICATE KEY UPDATE territory_id=?, conquering_clan=?, defending_clan=?',
                [dungeonId, tid, myClan.id, defenderClan, tid, myClan.id, defenderClan]
            );

            // ── Lobby timer — closes after 10 minutes if nobody enters ────────
            const lobbyTimer = setTimeout(async () => {
                try {
                    const [active] = await db.execute('SELECT id FROM dungeon WHERE id=? AND is_active=1 AND locked=0', [dungeonId]);
                    if (active.length) {
                        await db.execute('UPDATE dungeon SET is_active=0 WHERE id=?', [dungeonId]);
                        if (!isUnclaimed) {
                            await db.execute(
                                "UPDATE territory_wars SET status='completed' WHERE territory_id=? AND attacker_clan=? AND status='pending'",
                                [tid, myClan.id]
                            );
                        }

                        // Lock dungeon so attackers must now fight through the guards
                        await db.execute('UPDATE dungeon SET locked=1 WHERE id=?', [dungeonId]).catch(() => {});
                        const { lockDungeon, beginDungeon } = require('../engine/dungeon');
                        await beginDungeon(dungeonId, client).catch(() => {});

                        await client.sendMessage(RAID_GROUP, {
                            text:
                                '╔══〘 🌑 NO DEFENDERS CAME 〙══╗\n' +
                                '┃★ ' + territory.emoji + ' ' + territory.name + '\n' +
                                '┃★ No clan answered the call.\n' +
                                '┃★ But the territory is not unguarded.\n' +
                                '┃★\n' +
                                '┃★ ⚔️ Fight through the void guards\n' +
                                '┃★ to claim what is yours.\n' +
                                '┃★ Use !skill <move> to attack!\n' +
                                '╚═══════════════════════════╝'
                        });
                    }
                } catch(e) {}
                territoryLobbies.delete(dungeonId);
            }, LOBBY_DURATION_MS);

            territoryLobbies.set(dungeonId, {
                tid, attackerClan: myClan.id, defenderClan, timer: lobbyTimer
            });

            // ── Announce to RAID GROUP ────────────────────────────────────────
            const isWar = !isUnclaimed;

            // Get attacker members for mentions — safe fallback if query fails
            let attackerMentions = [];
            try {
                const attackerMembers = await getClanMembers(myClan.id);
                attackerMentions = attackerMembers.map(m => m.id + '@s.whatsapp.net');
            } catch(e) { console.error('getClanMembers attacker error:', e.message); }

            await client.sendMessage(RAID_GROUP, {
                text:
                    '╔══〘 🌑 TERRITORY ASSAULT 〙══╗\n' +
                    '┃★\n' +
                    '┃★ ' + territory.emoji + ' *' + territory.name + '*\n' +
                    '┃★ 〝' + territory.lore + '〞\n' +
                    '┃★\n' +
                    (isWar
                        ? '┃★ ⚔️ *' + myClan.name + '* challenges\n' +
                          '┃★ *' + defenderName + '* for control!\n' +
                          '┃★\n' +
                          '┃★ ⚠️ *' + defenderName + '* — field your\n' +
                          '┃★ defenders! DM !defend to hold\n' +
                          '┃★ your territory.\n'
                        : '┃★ ⚔️ *' + myClan.name + '* claims\n' +
                          '┃★ unclaimed territory.\n'
                    ) +
                    '┃★\n' +
                    '┃★ ' + territory.stages + ' stages.\n' +
                    '┃★ Guardian: *' + territory.guardian + '*\n' +
                    '┃★\n' +
                    '┃★ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n' +
                    '┃★ ⚔️ *' + myClan.name + '* ATTACKERS:\n' +
                    '┃★ DM ARIA *!enter* to join the assault.\n' +
                    (isWar ? '┃★\n┃★ 🛡️ DEFENDERS:\n┃★ DM ARIA *!defend ' + tid + '* to hold.\n' : '') +
                    '┃★ ▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n' +
                    '┃★ ⏳ Lobby open for 1 hour.\n' +
                    '┃★\n' +
                    '╚═══════════════════════════╝',
                mentions: attackerMentions
            });

            // If contested — also notify defender clan members
            if (isWar && defenderClan) {
                let defenderMentions = [];
                try {
                    const defenderMembers = await getClanMembers(defenderClan);
                    defenderMentions = defenderMembers.map(m => m.id + '@s.whatsapp.net');
                } catch(e) { console.error('getClanMembers defender error:', e.message); }
                await client.sendMessage(RAID_GROUP, {
                    text:
                        '╔══〘 🛡️ TERRITORY UNDER ATTACK 〙══╗\n' +
                        '┃★\n' +
                        '┃★ *' + defenderName + '* —\n' +
                        '┃★ your territory is being challenged.\n' +
                        '┃★\n' +
                        '┃★ DM the bot *!defend ' + tid + '* to\n' +
                        '┃★ enter the defense dungeon and\n' +
                        '┃★ hold your ground.\n' +
                        '┃★\n' +
                        '┃★ If no defenders enter — the\n' +
                        '┃★ territory falls uncontested.\n' +
                        '┃★\n' +
                        '╚═══════════════════════════╝',
                    mentions: defenderMentions
                });
            }

            return msg.reply(
                '╔══〘 🌑 CONQUEST LAUNCHED 〙══╗\n' +
                '┃★ ' + territory.emoji + ' ' + territory.name + '\n' +
                '┃★ ' + territory.stages + ' stages.\n' +
                '┃★ Announced in group.\n' +
                '┃★ Your clan members DM !enter.\n' +
                (isWar ? '┃★ Defenders DM !defend ' + tid + '.\n' : '') +
                '╚═══════════════════════════╝'
            );

        } catch (err) {
            console.error('conquer error:', err);
            msg.reply('❌ Conquest failed: ' + err.message);
        }
    }
};