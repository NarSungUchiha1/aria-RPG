/**
 * !defend <TERRITORY_ID>
 * Defender clan members DM the bot to join the defense.
 *
 * Flow:
 * 1. Defender DMs !defend ASSEMBLY/WRATHBORNE/REMNANTS
 * 2. Added to territory dungeon as is_defender=1
 * 3. When both sides have players AND dungeon is locked → party PvP starts in raid GC
 * 4. Uses real pvpsystem (setDuelActive + setTurn) — not a stub
 * 5. handleVictory in pvpsystem resolves the territory claim
 */

const db = require('../database/db');
const { TERRITORIES, ensureTerritoryTables, getTerritoryStatus } = require('../systems/voidTerritories');
const { getPlayerClan } = require('../systems/clanSystem');
const { setDuelActive, setTurn, territoryWars, getDuelKey } = require('../systems/pvpsystem');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

// Track which territory dungeons have had war triggered already
const warStarted = new Map();

// Track defenders per dungeon: dungeonId → Set of playerIds
const defenderPool = new Map();

async function tryStartTerritoryWar(dungeonId, tid, attackerClanId, defenderClanId, client) {
    if (warStarted.get(dungeonId)) return;
    warStarted.set(dungeonId, true);

    try {
        const territory = TERRITORIES[tid];

        // Get all players in dungeon
        const [allPlayers] = await db.execute(
            'SELECT dp.player_id, dp.is_defender, p.nickname FROM dungeon_players dp JOIN players p ON p.id=dp.player_id WHERE dp.dungeon_id=? AND dp.is_alive=1',
            [dungeonId]
        );

        const attackers = allPlayers.filter(p => !p.is_defender).map(p => String(p.player_id));
        const defenders = allPlayers.filter(p =>  p.is_defender).map(p => String(p.player_id));

        if (!attackers.length || !defenders.length) {
            warStarted.delete(dungeonId);
            return;
        }

        const attackerNames = allPlayers.filter(p => !p.is_defender).map(p => p.nickname).join(', ');
        const defenderNames = allPlayers.filter(p =>  p.is_defender).map(p => p.nickname).join(', ');

        const [aClan] = await db.execute('SELECT name FROM clans WHERE id=?', [attackerClanId]);
        const [dClan] = await db.execute('SELECT name FROM clans WHERE id=?', [defenderClanId]);
        const attackerClanName = aClan[0]?.name || 'Attackers';
        const defenderClanName = dClan[0]?.name || 'Defenders';

        // Lock the territory dungeon and CLEAR all enemies — PvP replaces the dungeon run
        await db.execute('UPDATE dungeon SET locked=1 WHERE id=?', [dungeonId]);
        await db.execute('DELETE FROM dungeon_enemies WHERE dungeon_id=?', [dungeonId]);
        // Remove all players from dungeon_players so !skill doesn't route to dungeon
        // PvP is handled entirely by pvpsystem in-memory
        await db.execute('UPDATE dungeon_players SET is_alive=0 WHERE dungeon_id=?', [dungeonId]);

        const allMentions = [...attackers, ...defenders].map(id => id + '@s.whatsapp.net');

        // Announce
        await client.sendMessage(RAID_GROUP, {
            text:
                '╔══〘 ⚔️ TERRITORY WAR 〙══╗\n' +
                '┃★\n' +
                '┃★ ' + territory.emoji + ' *' + territory.name + '*\n' +
                '┃★\n' +
                '┃★ The two sides have assembled.\n' +
                '┃★ There will be no dungeon.\n' +
                '┃★ There will only be war.\n' +
                '┃★\n' +
                '┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n' +
                '┃★ ⚔️ ATTACKERS — *' + attackerClanName + '*\n' +
                '┃★ ' + attackerNames + '\n' +
                '┃★\n' +
                '┃★ 🛡️ DEFENDERS — *' + defenderClanName + '*\n' +
                '┃★ ' + defenderNames + '\n' +
                '┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n' +
                '┃★\n' +
                '┃★ First clan fully defeated loses.\n' +
                '┃★ Use !attack <move> to fight.\n' +
                '┃★\n' +
                '┃★ Starting in 30 seconds...\n' +
                '┃★\n' +
                '╚═══════════════════════════╝',
            mentions: allMentions
        });

        await new Promise(r => setTimeout(r, 30000));

        // Build turn order (alternating attacker/defender)
        const turnOrder = [];
        const maxLen = Math.max(attackers.length, defenders.length);
        for (let i = 0; i < maxLen; i++) {
            if (attackers[i]) turnOrder.push(attackers[i]);
            if (defenders[i]) turnOrder.push(defenders[i]);
        }

        // Register duel in pvpsystem
        const fakeChat = {
            sendMessage: (opts) => client.sendMessage(RAID_GROUP, opts),
            client: client  // expose client so pvpsystem can demote players on death
        };

        await setDuelActive(attackers, defenders, fakeChat, 0, turnOrder);

        // Store territory war context — resolved in handleVictory
        const duelKey = getDuelKey(attackers, defenders);
        territoryWars.set(duelKey, {
            tid,
            attackerClan: attackerClanId,
            defenderClan: defenderClanId,
            attackers,
            defenders,
            dungeonId
        });

        // Start first turn
        setTurn(duelKey, turnOrder[0]);

        // Announce first turn
        const [firstPlayer] = await db.execute('SELECT nickname FROM players WHERE id=?', [turnOrder[0]]);
        await client.sendMessage(RAID_GROUP, {
            text:
                '╔══〘 ⚔️ WAR BEGINS 〙══╗\n' +
                '┃★\n' +
                '┃★ ⚔️ First to move:\n' +
                '┃★ *' + (firstPlayer[0]?.nickname || turnOrder[0]) + '*\n' +
                '┃★\n' +
                '┃★ Use !attack <move> to fight.\n' +
                '┃★ Use !moveset to see your moves.\n' +
                '┃★\n' +
                '╚═══════════════════════════╝'
        });

        defenderPool.delete(dungeonId);

    } catch(e) {
        console.error('[TerritoryWar] start error:', e.message);
        warStarted.delete(dungeonId);
    }
}

module.exports = {
    name: 'defend',
    defenderPool,
    tryStartTerritoryWar,
    async execute(msg, args, { userId, client }) {
        try {
            await ensureTerritoryTables();

            const tid = args[0]?.toUpperCase();
            if (!tid || !TERRITORIES[tid]) return msg.reply(
                '══〘 🛡️ DEFEND 〙══╮\n' +
                '┃★ ❌ !defend ASSEMBLY / WRATHBORNE / REMNANTS\n' +
                '╰═══════════════════════╯'
            );

            const myClan = await getPlayerClan(userId);
            if (!myClan) return msg.reply('❌ You are not in a clan.');

            const status = await getTerritoryStatus();
            const terr   = status[tid] || {};

            if (terr.clan_id !== myClan.id) return msg.reply(
                '══〘 🛡️ DEFEND 〙══╮\n' +
                '┃★ ❌ Your clan does not hold ' + TERRITORIES[tid].name + '.\n' +
                '╰═══════════════════════╯'
            );

            // Find active territory dungeon
            const [dungeonRows] = await db.execute(
                "SELECT d.*, df.conquering_clan, df.defending_clan FROM dungeon d LEFT JOIN dungeon_flags df ON df.dungeon_id=d.id WHERE d.is_active=1 AND d.dungeon_rank=? ORDER BY d.id DESC LIMIT 1",
                ['TERRITORY_' + tid]
            );
            if (!dungeonRows.length) return msg.reply(
                '══〘 🛡️ DEFEND 〙══╮\n' +
                '┃★ ❌ No active assault on this territory.\n' +
                '╰═══════════════════════╯'
            );

            const dungeon = dungeonRows[0];

            if (dungeon.locked) return msg.reply(
                '══〘 🛡️ DEFEND 〙══╮\n' +
                '┃★ ❌ The war has already started.\n' +
                '╰═══════════════════════╯'
            );

            const [already] = await db.execute(
                'SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND player_id=?',
                [dungeon.id, userId]
            );
            if (already.length) return msg.reply('❌ You are already registered for this war.');

            // Add as defender
            await db.execute(
                'INSERT INTO dungeon_players (player_id, dungeon_id, is_alive, is_defender, session_gold, session_xp) VALUES (?, ?, 1, 1, 0, 0)',
                [userId, dungeon.id]
            );

            if (!defenderPool.has(dungeon.id)) defenderPool.set(dungeon.id, new Set());
            defenderPool.get(dungeon.id).add(userId);

            const [pRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [userId]);
            const territory = TERRITORIES[tid];

            await client.sendMessage(RAID_GROUP, {
                text:
                    '══〘 🛡️ DEFENDER JOINED 〙══╮\n' +
                    '┃★ *' + (pRow[0]?.nickname || userId) + '*\n' +
                    '┃★ stands for *' + myClan.name + '*.\n' +
                    '┃★ ' + territory.emoji + ' ' + territory.name + '\n' +
                    '╰═══════════════════════╯'
            });

            // Check if attackers already in — trigger war
            const [attackerRows] = await db.execute(
                'SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=? AND is_defender=0 AND is_alive=1',
                [dungeon.id]
            );

            if (attackerRows[0].cnt > 0) {
                tryStartTerritoryWar(
                    dungeon.id, tid,
                    Number(dungeon.conquering_clan),
                    myClan.id,
                    client
                ).catch(e => console.error('[TerritoryWar] defend trigger error:', e.message));
            }

            return msg.reply(
                '╔══〘 🛡️ DEFENDING 〙══╗\n' +
                '┃★ *' + (pRow[0]?.nickname || userId) + '*\n' +
                '┃★ You stand for *' + myClan.name + '*.\n' +
                '┃★\n' +
                '┃★ ' + territory.emoji + ' ' + territory.name + '\n' +
                '┃★ Hold it.\n' +
                '┃★\n' +
                '┃★ War triggers when attackers enter.\n' +
                '╚═══════════════════════════╝'
            );

        } catch (err) {
            console.error('defend error:', err);
            msg.reply('❌ Defense failed: ' + err.message);
        }
    }
};