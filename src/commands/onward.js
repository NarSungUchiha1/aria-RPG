const db = require('../database/db');
const {
    getActiveDungeon,
    isPlayerInDungeon,
    isPlayerInAnyDungeon,
    advanceStage,
    getMaxStageForDungeon,
    getDungeonStatusText,
    getCurrentEnemies,
    demoteAllRaiders,
    getDungeonGroup
} = require('../engine/dungeon');
const { handleShardDrop } = require('./event');
const { getPlayerBag } = require('../systems/bagSystem');
const { resetStageTimer, clearDungeonTimers } = require('../engine/dungeonTimer');
const { rollMaterialDrop } = require('../systems/materialSystem');
const { initStage } = require('../systems/contributionSystem');
const { updateQuestProgress } = require('../systems/questSystem');
const { trySpawnPrestigeDungeon } = require('../engine/prestigeDungeon');
const { tickShields } = require('../systems/activeBuffs');
const { recordWorldBossKill } = require('../systems/clanQuestTracker');
const { addVoidResonance, recordPsDungeonClear } = require('../systems/ascendantSystem');

const getRaidGroup = () => process.env.RAID_GROUP_JID || '120363213735662100@g.us';

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = {
    name: 'onward',
    async execute(msg, args, { userId, client }) {
        try {
            // FIX: find the dungeon the player is actually IN first (handles territory dungeons)
            const playerDungeonId = await isPlayerInAnyDungeon(userId);
            let dungeon = null;
            if (playerDungeonId) {
                const [dRows] = await db.execute('SELECT * FROM dungeon WHERE id=? AND is_active=1', [playerDungeonId]);
                dungeon = dRows[0] || null;
            }
            if (!dungeon) dungeon = await getActiveDungeon(); // fallback — scoped to group via AsyncLocalStorage

            if (!dungeon) return msg.reply(
                `══〘 🧭 ONWARD 〙══╮
┃◆ ❌ No active dungeon.
╰═══════════════════════╯`
            );
            if (!dungeon.locked) return msg.reply(
                `══〘 🧭 ONWARD 〙══╮
┃◆ ❌ Dungeon hasn't started yet.
┃◆ Wait for auto-start or ask an admin.
╰═══════════════════════╯`
            );

            if (!(await isPlayerInDungeon(userId, dungeon.id))) {
                return msg.reply(
                    `══〘 🧭 ONWARD 〙══╮
┃◆ ❌ You are not inside the dungeon.
╰═══════════════════════╯`
                );
            }

            // FIX: Always re-read the freshest dungeon state from DB
            const [freshDungeon] = await db.execute(
                "SELECT stage, max_stage, stage_cleared, dungeon_rank, boss_name, locked, is_active FROM dungeon WHERE id=?",
                [dungeon.id]
            );
            if (!freshDungeon.length || !freshDungeon[0].is_active) {
                return msg.reply(`══〘 🧭 ONWARD 〙══╮
┃◆ ❌ Dungeon no longer active.
╰═══════════════════════╯`);
            }
            const d = freshDungeon[0];

            // ── SUNSHARD INVASION GATE ─────────────────────────────────────
            // You cannot leave a stage while your own reflection still stands.
            // This is per-player on purpose: whoever breaks their mirror first
            // can push ahead alone, splitting the party mid-dungeon.
            try {
                const { getReflection, livingReflectionCount } = require('../systems/reflectionSystem');
                const myRefl = await getReflection(userId, dungeon.id);
                // A Sunshard invasion adds a gate ON TOP of the normal rules:
                // you still have to kill the stage's mobs to progress, AND
                // your own mirror has to be broken.
                if (myRefl) {
                    return msg.reply(
                        `╔══〘 🪞 BLOCKED 〙══╗\n` +
                        `┃◆ Your reflection still stands.\n` +
                        `┃◆ 🪞 ${myRefl.current_hp.toLocaleString()}/${myRefl.max_hp.toLocaleString()} HP\n` +
                        `┃◆\n` +
                        `┃◆ There is no way past yourself.\n` +
                        `┃◆ ⚔️ !skill <move> to fight it.\n` +
                        `┃◆ 🤝 Allies can help: !skill <move> ${myRefl.nickname || 'you'}\n` +
                        `╚═══════════════════════════╝`
                    );
                }
                // Mirror broken but others are still duelling → you go on ALONE.
                const stillDuelling = await livingReflectionCount(dungeon.id);
                if (stillDuelling > 0) {
                    const [meRow] = await db.execute('SELECT nickname FROM players WHERE id=?', [userId]).catch(() => [[]]);
                    const meNick = meRow[0]?.nickname || 'A hunter';
                    await client.sendMessage(getRaidGroup(), {
                        text:
                            `╔══〘 🪞 PUSHING AHEAD 〙══╗\n` +
                            `┃◆ *${meNick}* broke their mirror\n` +
                            `┃◆ and pressed on without the others.\n` +
                            `┃◆ ⏳ ${stillDuelling} still trapped with themselves.\n` +
                            `╚═══════════════════════════╝`
                    }).catch(() => {});
                }
            } catch(reflErr) { console.error('Reflection gate error:', reflErr.message); }

            // FIX: Cross-check enemies in DB — stage_cleared flag can desync.
            // If enemies still exist, the stage is NOT actually cleared regardless of flag.
            const liveEnemies = await getCurrentEnemies(dungeon.id);

            if (liveEnemies.length > 0) {
                // There are still enemies — if stage_cleared is incorrectly set, fix it
                if (d.stage_cleared !== 0) {
                    await db.execute("UPDATE dungeon SET stage_cleared=0 WHERE id=?", [dungeon.id]);
                }
                return msg.reply(
                    `══〘 ⚠️ BLOCKED 〙══╮
` +
                    `┃◆ There are still ${liveEnemies.length} enemy/enemies alive!
` +
                    `┃◆ Defeat them first before advancing.
` +
                    `┃◆ Use !dungeon to check status.
` +
                    `╰═══════════════════════╯`
                );
            }

            // Enemies are all dead. Ensure the flag is set.
            if (d.stage_cleared !== 1) {
                await db.execute("UPDATE dungeon SET stage_cleared=1 WHERE id=?", [dungeon.id]);
            }

            const maxStage = d.max_stage;

            // ── DUNGEON CLEARED ──────────────────────────────────────────────
            if (d.stage >= maxStage) {
                const [aliveRows] = await db.execute(
                    "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                    [dungeon.id]
                );
                // Anyone still trapped in their mirror when the boss falls never
                // escaped their trial — they don't share the clear. Rushing ahead
                // and finishing solo genuinely leaves them with nothing.
                let participants = aliveRows;
                let leftBehind = [];
                try {
                    const [trapped] = await db.execute(
                        'SELECT player_id, nickname FROM dungeon_reflections WHERE dungeon_id=? AND defeated=0',
                        [dungeon.id]
                    ).catch(() => [[]]);
                    if (trapped.length) {
                        const trappedIds = new Set(trapped.map(t => String(t.player_id)));
                        participants = aliveRows.filter(p => !trappedIds.has(String(p.player_id)));
                        leftBehind = trapped;
                    }
                } catch(e) {}

                // Record the Hollow King kills for clan creation requirement
                if (d.dungeon_rank === 'HOLLOWKING') {
                    for (const p of participants) {
                        recordWorldBossKill(p.player_id).catch(() => {});
                    }
                }

                // the Hollow King clear announcement
                if (d.dungeon_rank === 'HOLLOWKING') {
                    await client.sendMessage(getRaidGroup(), {
                        text:
                            `╔══════════════════════════════════════╗
` +
                            `┃★                                     
` +
                            `┃★   He is gone.                       
` +
                            `┃★                                     
` +
                            `┃★   The void retreats.                
` +
                            `┃★   The fractures begin to seal.      
` +
                            `┃★                                     
` +
                            `┃★   THE HOLLOW KING HAS FALLEN.              
` +
                            `┃★                                     
` +
                            `┃★   The hunters who stood here today  
` +
                            `┃★   will be remembered.               
` +
                            `┃★                                     
` +
                            `┃★   The world breathes again.         
` +
                            `┃★                                     
` +
                            `╚══════════════════════════════════════╝`
                    });
                }

                const STORY_REWARDS = { HOLLOWKING: [500000, 200000], VESPERION: [25000, 10000], CINDERMAW: [60000, 25000], UMBRYSS: [150000, 60000] };
                const rewardGold = STORY_REWARDS[d.dungeon_rank]?.[0] ?? (Math.floor(Math.random() * 20) + 90);
                const rewardXp   = STORY_REWARDS[d.dungeon_rank]?.[1] ?? (Math.floor(Math.random() * 15) + 82);

                const { applyGoldBonus, applyXpBonus } = require('../systems/territoryBonusSystem');
                const { addFactionPoints, championXpBonus } = require('../systems/factionSystem');
                const isPrestige = d.dungeon_rank && d.dungeon_rank.startsWith('P');

                // Newcomer ramp: players registered <3 days ago earn DOUBLE XP.
                let newbieIds = new Set();
                try {
                    if (participants.length) {
                        const ids = participants.map(p => p.player_id);
                        const [nb] = await db.execute(
                            `SELECT id FROM players WHERE id IN (${ids.map(() => '?').join(',')}) AND created_at > DATE_SUB(NOW(), INTERVAL 3 DAY)`,
                            ids
                        );
                        newbieIds = new Set(nb.map(r => r.id));
                    }
                } catch(e) {}

                for (const p of participants) {
                    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [rewardGold, p.player_id]);
                    await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?",           [rewardXp,   p.player_id]);
                    // Direct dungeon clear counter for resonance tracking
                    await db.execute("UPDATE players SET dungeons_cleared = COALESCE(dungeons_cleared, 0) + 1 WHERE id=?", [p.player_id]).catch(() => {});
                    // Apply territory bonuses on top
                    await applyGoldBonus(p.player_id, rewardGold).catch(() => {});
                    await applyXpBonus(p.player_id, rewardXp).catch(() => {});
                    // Faction war: +10 pts per clear; champion faction gets +10% XP
                    addFactionPoints(p.player_id, 10).catch(() => {});
                    championXpBonus(p.player_id, rewardXp).catch(() => {});
                    // Newcomer double XP (first 3 days)
                    if (newbieIds.has(p.player_id)) {
                        await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [rewardXp, p.player_id]).catch(() => {});
                    }
                    (async () => {
                        try {
                            await updateQuestProgress(p.player_id, 'dungeon_clear',   1, client);
                            if (isPrestige) await updateQuestProgress(p.player_id, 'prestige_clear', 1, client).catch(() => {});
                            await updateQuestProgress(p.player_id, 'dungeon_survive', 1, client);
                            await updateQuestProgress(p.player_id, 'dungeon_enter',   1, client);
                            if (d.dungeon_rank === 'S') {
                                await updateQuestProgress(p.player_id, 'srank_clear', 1, client);
                            }
                            if (d.dungeon_rank === 'HOLLOWKING') {
                                await updateQuestProgress(p.player_id, 'worldboss_clear', 1, client);
                            }
                        } catch (e) {}
                    })();
                }

                // Void resonance + PS clear tracking — awaited so it doesn't get dropped
                try {
                    const isPS = d.dungeon_rank === 'PS';
                    const isRemnants = d.dungeon_rank === 'TERRITORY_REMNANTS';
                    const isFirstSunshard = d.boss_name === 'The First Sunshard';
                    for (const p of participants) {
                        if (isPrestige) await addVoidResonance(p.player_id, 'prestige_dungeon_clear', client).catch(() => {});
                        if (isPS) {
                            await recordPsDungeonClear(p.player_id).catch(e => console.error('PS clear record error:', e.message));
                            await updateQuestProgress(p.player_id, 'prestige_clear', 1, client).catch(() => {});
                        }
                        if (isRemnants) await addVoidResonance(p.player_id, 'remnant_sanctum_clear', client).catch(() => {});
                        if (isFirstSunshard) await addVoidResonance(p.player_id, 'sunshard_kill', client).catch(() => {});
                    }
                } catch(e) { console.error('Resonance gain error:', e.message); }

                // ── TERRITORY CONQUERED — the missing claim! ──────────────────
                // Clearing the assault dungeon is the PvE victory path; it never
                // claimed the territory (only the PvP war mode did).
                if (d.dungeon_rank && d.dungeon_rank.startsWith('TERRITORY_')) {
                    try {
                        const tid = d.dungeon_rank.replace('TERRITORY_', '');
                        const [flags] = await db.execute('SELECT conquering_clan FROM dungeon_flags WHERE dungeon_id=?', [dungeon.id]);
                        const winnerClan = flags[0]?.conquering_clan || null;
                        if (winnerClan) {
                            const { claimTerritory, TERRITORIES } = require('../systems/voidTerritories');
                            await claimTerritory(tid, winnerClan);
                            await db.execute(
                                "UPDATE territory_wars SET status='completed', winner_clan=? WHERE territory_id=? AND status IN ('pending','active')",
                                [winnerClan, tid]
                            ).catch(() => {});
                            try { require('./conquer').clearTerritoryLobby(dungeon.id); } catch(e) {}

                            // Buffs apply immediately — clear participants' bonus cache
                            // and award the territory-war resonance gain.
                            const { clearBonusCache } = require('../systems/territoryBonusSystem');
                            for (const p of participants) {
                                clearBonusCache(p.player_id);
                                await addVoidResonance(p.player_id, 'territory_war_win', client).catch(() => {});
                            }

                            const t = TERRITORIES[tid];
                            const [cl] = await db.execute('SELECT name FROM clans WHERE id=?', [winnerClan]).catch(() => [[]]);
                            await client.sendMessage(getRaidGroup(), {
                                text:
                                    '╔══〘 🌑 TERRITORY CONQUERED 〙══╗\n' +
                                    '┃★\n' +
                                    '┃★ ' + (t ? t.emoji + ' *' + t.name + '*' : tid) + '\n' +
                                    '┃★ now belongs to *' + (cl[0]?.name || 'the conquerors') + '*.\n' +
                                    '┃★\n' +
                                    (t ? '┃★ 🎁 Clan bonus unlocked:\n┃★ *' + t.bonus.label + '*\n┃★ ' + t.bonus.description + '\n' : '') +
                                    '┃★\n' +
                                    '╚═══════════════════════════╝'
                            }).catch(() => {});
                        }
                    } catch(terrErr) { console.error('Territory claim error:', terrErr.message); }
                }
                // Called out publicly — the cost of being outrun by your party.
                if (leftBehind.length) {
                    await client.sendMessage(getRaidGroup(), {
                        text:
                            '╔══〘 🪞 LEFT BEHIND 〙══╗\n' +
                            '┃◆ The dungeon fell without them.\n' +
                            leftBehind.map(t => `┃◆ 🪞 *${t.nickname}* never broke their mirror.`).join('\n') + '\n' +
                            '┃◆ No clear. No rewards.\n' +
                            '╚═══════════════════════════╝'
                    }).catch(() => {});
                }

                // ── STORY MODE: chapter boss slain → epilogue + next chapter ──
                try {
                    const STORY_NEXT = { VESPERION: 2, CINDERMAW: 3, UMBRYSS: 4 };
                    const nextCh = STORY_NEXT[d.dungeon_rank];
                    if (nextCh) {
                        const { setChapter, getCurrentChapter } = require('../systems/loreSystem');
                        const { CHAPTER_EPILOGUE } = require('../systems/storyEvents');
                        const cur = await getCurrentChapter();
                        if (cur < nextCh) {
                            await setChapter(nextCh);
                            const epilogue = CHAPTER_EPILOGUE[nextCh - 1];
                            if (epilogue) await client.sendMessage(getRaidGroup(), { text: epilogue }).catch(() => {});
                            console.log('📖 Story advanced to chapter ' + nextCh + ' (boss ' + d.dungeon_rank + ' slain).');
                        }
                    }
                } catch(storyErr) { console.error('Story advance error:', storyErr.message); }

                // MVP
                try {
                    const { calculateMvp } = require('../systems/mvpSystem');
                    // FIX: normalize IDs — strip WhatsApp suffix so they match what recordDamage stored
                    const playerIds = participants.map(p =>
                        String(p.player_id).replace(/@s\.whatsapp\.net|@c\.us|@g\.us/g, '').split(':')[0]
                    );
                    const mvpResult = await calculateMvp(`dungeon_${dungeon.id}`, playerIds, 'dungeon');
                    if (mvpResult?.message) {
                        await client.sendMessage(getRaidGroup(), { text: mvpResult.message }).catch(() => {});
                    } else {
                        console.log('[MVP] No result — stats may be empty for key dungeon_' + dungeon.id);
                    }
                } catch (e) { console.error('[MVP dungeon]', e.message); }

                // ── MATERIAL DROPS ────────────────────────────────────────
                (async () => {
                    try {
                        const { rollMaterialDrop } = require('../systems/materialSystem');
                        const raidG = getDungeonGroup(dungeon.id);
                        const matLines = [];
                        for (const p of participants) {
                            const drop = await rollMaterialDrop(d.dungeon_rank, p.player_id, client, raidG);
                            if (drop) {
                                const [pl] = await db.execute('SELECT nickname FROM players WHERE id=?', [p.player_id]);
                                const rarityEmoji = { common: '⚪', uncommon: '🟢', rare: '🔵', legendary: '🟣' }[drop.rarity] || '⚪';
                                matLines.push(`┃◆ ${rarityEmoji} *${pl[0]?.nickname}* → ${drop.material}`);
                            }
                        }
                        if (matLines.length) {
                            await client.sendMessage(raidG, {
                                text:
                                    `╔══〘 🎒 MATERIAL DROPS 〙══╗
` +
                                    `┃◆
` +
                                    matLines.join('\n') + '\n' +
                                    `┃◆
` +
                                    `┃◆ Use !materials to see your stash.
` +
                                    `╚═══════════════════════════╝`
                            }).catch(() => {});
                        }
                    } catch(e) { console.error('Material drop error:', e.message); }
                })();

            } // end dungeon clear rewards block

            // ── If dungeon is fully cleared — close it and stop ──────────
            if (d.stage >= maxStage) {
                // Reset clan blessings
                await db.execute(
                    `UPDATE clan_blessing_state SET skill_count=0, blessing_used=0, damage_boost=0
                     WHERE dungeon_id=?`,
                    [dungeon.id]
                ).catch(() => {});

                // Demote all raiders BEFORE deleting dungeon_players rows
                await demoteAllRaiders(client, dungeon.id).catch(() => {});

                // Close dungeon
                await db.execute('UPDATE dungeon SET is_active=0, locked=0 WHERE id=?', [dungeon.id]);
                await db.execute('DELETE FROM dungeon_players WHERE dungeon_id=?', [dungeon.id]);
                try { await require('../systems/reflectionSystem').clearReflections(dungeon.id); } catch(e) {}

                const { clearDungeonTimers } = require('../engine/dungeonTimer');
                clearDungeonTimers(dungeon.id);

                // Spawn prestige dungeon if eligible
                const { trySpawnPrestigeDungeon } = require('../engine/prestigeDungeon');
                const isP = d.dungeon_rank?.startsWith('P');
                if (!isP) {
                    trySpawnPrestigeDungeon(client, (global.overrideRaidGroup || process.env.RAID_GROUP_JID) || (global.overrideRaidGroup || '120363213735662100@g.us')).catch(() => {});
                }

                return msg.reply(
                    d.dungeon_rank?.startsWith('P')
                        ? `╔══〘 ✦ DUNGEON CLEARED 〙══╗
┃★
┃★ All stages complete.
┃★ The void yields.
┃★
╚═══════════════════════════╝`
                        : `══〘 ✅ DUNGEON CLEARED 〙══╮
┃◆ All stages complete!
┃◆ The dungeon crumbles.
╰═══════════════════════╯`
                );
            }

            try {
                await db.execute(
                    `UPDATE clan_blessing_state SET skill_count=0, blessing_used=0
                     WHERE dungeon_id=? AND player_id IN (
                         SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1
                     )`,
                    [dungeon.id, dungeon.id]
                );
            } catch(e) {}

            // Check if story should auto-advance
            try {
                const { checkStoryProgress } = require('../systems/loreSystem');
                const RAID_G = (global.overrideRaidGroup || process.env.RAID_GROUP_JID) || (global.overrideRaidGroup || '120363213735662100@g.us');
                checkStoryProgress(client, RAID_G).catch(() => {});
            } catch(e) {}

            (async () => {
                try {
                    const [alive] = await db.execute(
                        "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1", [dungeon.id]
                    );
                    for (const p of alive) {
                        await updateQuestProgress(p.player_id, 'stage_clear', 1, client);
                        // Tick shield duration — shields last per stage not per attack
                        try { tickShields('player', p.player_id); } catch(e) {}
                    }
                } catch (e) {}
            })();

            const targetChat = await msg.getChat();

            const isTerritory = d.dungeon_rank && d.dungeon_rank.startsWith('TERRITORY_');
            const territoryId  = isTerritory ? d.dungeon_rank.replace('TERRITORY_', '') : null;

            const failCallback = async () => {
                try {
                    const [players] = await db.execute(
                        "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1", [dungeon.id]
                    );
                    for (const p of players) {
                        await db.execute("UPDATE players SET hp = 0 WHERE id=?", [p.player_id]);
                    }
                    await demoteAllRaiders(client, dungeon.id);
                    await db.execute("DELETE FROM dungeon_players WHERE dungeon_id=?", [dungeon.id]);
                    await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [dungeon.id]);
                    clearDungeonTimers(dungeon.id);

                    // FIX: Territory dungeon timeout — clean up war record and notify group
                    if (isTerritory && territoryId) {
                        await db.execute(
                            "UPDATE territory_wars SET status='completed' WHERE territory_id=? AND status IN ('pending','active')",
                            [territoryId]
                        ).catch(() => {});
                        const { TERRITORIES } = require('../systems/voidTerritories');
                        const terr = TERRITORIES[territoryId];
                        await client.sendMessage(getRaidGroup(), {
                            text:
                                '╔══〘 🌑 ASSAULT FAILED 〙══╗\n' +
                                '┃★\n' +
                                '┃★ ' + (terr ? terr.emoji + ' *' + terr.name + '*' : territoryId) + '\n' +
                                '┃★ The assault party was overwhelmed.\n' +
                                '┃★ The territory holds.\n' +
                                '┃★\n' +
                                '╚═══════════════════════════╝'
                        }).catch(() => {});
                    } else {
                        await targetChat.sendMessage(
                            '══〘 💀 STAGE FAILED 〙══╮\n┃◆ Reinforcements have arrived!\n┃◆ The dungeon overwhelms you. You have died.\n╰═══════════════════════╯'
                        );
                    }
                } catch (err) { console.error("Onward failCallback error:", err); }
            };

            await resetStageTimer(dungeon.id, client, targetChat, failCallback, d.dungeon_rank);

            // ── HOLLOW KING GRAND ENTRY + PHASE INIT ────────────────────────────
            const next = d.stage + 1;
            // FIX: Wrap advanceStage in try/catch and ALWAYS reset stage_cleared on failure
            try {
                await advanceStage(dungeon.id, next, client);
            } catch(advErr) {
                console.error('advanceStage failed — resetting stage_cleared:', advErr.message);
                await db.execute('UPDATE dungeon SET stage_cleared=0 WHERE id=?', [dungeon.id]);
                return msg.reply('══〘 🧭 ONWARD 〙══╮\n┃◆ ❌ Failed to advance stage. Try again.\n╰═══════════════════════╯');
            }

            const isHollowKingFinal = d.dungeon_rank === 'HOLLOWKING' && next === maxStage;

            if (isHollowKingFinal) {

                await client.sendMessage(getRaidGroup(), {
                    text:
                        `╔══════════════════════════════════════╗
` +
                        `┃★                                     
` +
                        `┃★   The generals are gone.            
` +
                        `┃★   The silence is total.             
` +
                        `┃★                                     
` +
                        `┃★   Something watches from the dark.  
` +
                        `┃★                                     
` +
                        `╚══════════════════════════════════════╝`
                });

                await sleep(3000);

                await client.sendMessage(getRaidGroup(), {
                    text:
                        `╔══════════════════════════════════════╗
` +
                        `┃★                                     
` +
                        `┃★   The walls begin to crack.         
` +
                        `┃★   The void bleeds through.          
` +
                        `┃★                                     
` +
                        `┃★   You feel him before you see him.  
` +
                        `┃★                                     
` +
                        `╚══════════════════════════════════════╝`
                });

                await sleep(3000);

                await client.sendMessage(getRaidGroup(), {
                    text:
                        `╔══════════════════════════════════════╗
` +
                        `┃★                                     
` +
                        `┃★   👁️  H E   I S   H E R E.         
` +
                        `┃★                                     
` +
                        `┃★        M A L A C H A R             
` +
                        `┃★                                     
` +
                        `┃★   ❤️  HP: 1,000,000,000             
` +
                        `┃★   ⚔️  This is what you came for.    
` +
                        `┃★                                     
` +
                        `┃★   Phase 1 — The Void Awakens        
` +
                        `┃★   He is not yet at full power.      
` +
                        `┃★   Do not be fooled.                 
` +
                        `┃★                                     
` +
                        `╚══════════════════════════════════════╝`
                });

                await msg.reply(
                    `╔══〘 ★ FINAL STAGE 〙══╗
` +
                    `┃★ Stage ${next}/${maxStage} — The End.
` +
                    `┃★ He stands before you.
` +
                    `┃★ Use !dungeon to see his stats.
` +
                    `╚═══════════════════════╝`
                );
            } else {
                await msg.reply(
                    `══〘 🧭 STAGE ${next}/${maxStage} 〙══╮
` +
                    `┃◆ The stone door grinds open, revealing a deeper darkness.
` +
                    `┃◆ The air grows colder, and new threats stir in the shadows.
` +
                    `╰═══════════════════════╯`
                );
            }

            const statusText = await getDungeonStatusText(dungeon.id);
            return msg.reply(statusText);

        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🧭 ONWARD 〙══╮
┃◆ ❌ Onward failed.
╰═══════════════════════╯`);
        }
    }
};