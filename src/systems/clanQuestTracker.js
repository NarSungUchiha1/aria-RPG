/**
 * Clan Quest Tracker
 * Updates progress on active clan_quests for the player.
 * On completion: rewards gold/xp and notifies the player.
 */

const db = require('../database/db');

const OBJECTIVE_LABELS = {
    dungeon_clear: { label: 'Clear a full dungeon' },
    kill_enemies:  { label: 'Kill enemies in dungeons' },
    stage_clear:   { label: 'Clear dungeon stages with !onward' },
    pvp_win:       { label: 'Win PvP duels' },
    boss_kill:     { label: 'Kill dungeon bosses' },
};

const OBJECTIVE_MAP = {
    dungeon_clear: ['dungeon_clear'],
    kill_enemies:  ['kill_enemies', 'enemy_kill'],
    stage_clear:   ['stage_clear'],
    pvp_win:       ['pvp_win'],
    boss_kill:     ['boss_kill'],
};

async function updateClanQuestProgress(playerId, eventType, amount = 1, client = null) {
    try {
        const matchingObjectives = Object.entries(OBJECTIVE_MAP)
            .filter(([, events]) => events.includes(eventType))
            .map(([obj]) => obj);

        if (!matchingObjectives.length) return;

        const placeholders = matchingObjectives.map(() => '?').join(',');
        const [quests] = await db.execute(
            'SELECT * FROM clan_quests WHERE assigned_to=? AND status=\'active\' AND objective IN (' + placeholders + ')',
            [playerId, ...matchingObjectives]
        );

        for (const quest of quests) {
            const newProgress = Math.min(quest.target, quest.progress + amount);
            await db.execute('UPDATE clan_quests SET progress=? WHERE id=?', [newProgress, quest.id]);

            const info       = OBJECTIVE_LABELS[quest.objective] || { label: quest.objective };
            const oldPct     = Math.floor((quest.progress / quest.target) * 100);
            const newPct     = Math.floor((newProgress    / quest.target) * 100);
            const milestones = [25, 50, 75];
            const hitMilestone = milestones.some(function(m) { return oldPct < m && newPct >= m; });
            const oneAway    = newProgress === quest.target - 1;
            const remaining  = quest.target - newProgress;
            const bar        = '🟩'.repeat(Math.floor(newPct / 10)) + '⬜'.repeat(10 - Math.floor(newPct / 10));

            // Milestone nudge
            if (client && (hitMilestone || oneAway) && newProgress < quest.target) {
                client.sendMessage(playerId + '@s.whatsapp.net', {
                    text:
                        '══〘 📜 QUEST UPDATE 〙══╮\n' +
                        '┃◆ *' + quest.title + '*\n' +
                        '┃◆ ' + bar + '\n' +
                        '┃◆ ' + newProgress + '/' + quest.target + ' — ' + newPct + '%\n' +
                        '┃◆ ' + remaining + ' more: ' + info.label + '\n' +
                        '╰═══════════════════════╯'
                }).catch(function() {});
            }

            // Completion
            if (newProgress >= quest.target) {
                await db.execute('UPDATE clan_quests SET status=\'completed\' WHERE id=?', [quest.id]);

                if (quest.reward_gold > 0) {
                    await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [quest.reward_gold, playerId]);
                }
                if (quest.reward_xp > 0) {
                    await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [quest.reward_xp, playerId]);
                }

                // Notify player
                if (client) {
                    try {
                        const [clan] = await db.execute('SELECT name FROM clans WHERE id=?', [quest.clan_id]);
                        await client.sendMessage(playerId + '@s.whatsapp.net', {
                            text:
                                '╔══〘 ✅ CLAN QUEST COMPLETE 〙══╗\n' +
                                '┃◆\n' +
                                '┃◆ *' + quest.title + '*\n' +
                                '┃◆ Clan: ' + (clan[0] ? clan[0].name : '') + '\n' +
                                '┃◆\n' +
                                '┃◆ You have proven yourself.\n' +
                                '┃◆\n' +
                                '┃◆ 🎁 REWARDS CLAIMED\n' +
                                '┃◆ 💰 +' + Number(quest.reward_gold).toLocaleString() + ' Gold\n' +
                                '┃◆ ⭐ +' + Number(quest.reward_xp).toLocaleString() + ' XP\n' +
                                '┃◆\n' +
                                '┃◆ Ask your master for the next trial.\n' +
                                '╚═══════════════════════════╝'
                        });
                    } catch(e) {}
                }

                // Notify clan master
                if (client) {
                    try {
                        const [clanRow]   = await db.execute('SELECT leader_id, name FROM clans WHERE id=?', [quest.clan_id]);
                        const [playerRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [playerId]);
                        if (clanRow.length) {
                            await client.sendMessage(clanRow[0].leader_id + '@s.whatsapp.net', {
                                text:
                                    '══〘 📜 QUEST COMPLETED 〙══╮\n' +
                                    '┃◆ *' + (playerRow[0] ? playerRow[0].nickname : playerId) + '* completed\n' +
                                    '┃◆ "*' + quest.title + '*" in *' + clanRow[0].name + '*.\n' +
                                    '╰═══════════════════════╯'
                            });
                        }
                    } catch(e) {}
                }
            }
        }
    } catch (err) {
        console.error('[clanQuestTracker]', err.message);
    }
}

async function recordMalacharKill(playerId) {
    await db.execute(
        'INSERT IGNORE INTO malachar_kills (player_id) VALUES (?)', [playerId]
    ).catch(function() {});
}

module.exports = { updateClanQuestProgress, recordMalacharKill };