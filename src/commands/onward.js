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
const { recordMalacharKill } = require('../systems/clanQuestTracker');
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
                const [participants] = await db.execute(
                    "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                    [dungeon.id]
                );

                // Record Malachar kills for clan creation requirement
                if (d.dungeon_rank === 'MALACHAR') {
                    for (const p of participants) {
                        recordMalacharKill(p.player_id).catch(() => {});
                    }
                }

                // Malachar clear announcement
                if (d.dungeon_rank === 'MALACHAR') {
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
                            `┃★   MALACHAR HAS FALLEN.              
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

                const rewardGold = d.dungeon_rank === 'MALACHAR' ? 500000 : Math.floor(Math.random() * 20) + 90;
                const rewardXp   = d.dungeon_rank === 'MALACHAR' ? 200000 : Math.floor(Math.random() * 15) + 82;

                const { applyGoldBonus, applyXpBonus } = require('../systems/territoryBonusSystem');
                const isPrestige = d.dungeon_rank && d.dungeon_rank.startsWith('P');
                for (const p of participants) {
                    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [rewardGold, p.player_id]);
                    await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?",           [rewardXp,   p.player_id]);
                    // Direct dungeon clear counter for resonance tracking
                    await db.execute("UPDATE players SET dungeons_cleared = COALESCE(dungeons_cleared, 0) + 1 WHERE id=?", [p.player_id]).catch(() => {});
                    // Apply territory bonuses on top
                    await applyGoldBonus(p.player_id, rewardGold).catch(() => {});
                    await applyXpBonus(p.player_id, rewardXp).catch(() => {});
                    (async () => {
                        try {
                            await updateQuestProgress(p.player_id, 'dungeon_clear',   1, client);
                            if (isPrestige) await updateQuestProgress(p.player_id, 'prestige_clear', 1, client).catch(() => {});
                            await updateQuestProgress(p.player_id, 'dungeon_survive', 1, client);
                            await updateQuestProgress(p.player_id, 'dungeon_enter',   1, client);
                            if (d.dungeon_rank === 'S') {
                                await updateQuestProgress(p.player_id, 'srank_clear', 1, client);
                            }
                            if (d.dungeon_rank === 'MALACHAR') {
                                await updateQuestProgress(p.player_id, 'malachar_clear', 1, client);
                            }
                        } catch (e) {}
                    })();
                }

                // Void resonance + PS clear tracking — awaited so it doesn't get dropped
                try {
                    const isPS = d.dungeon_rank === 'PS';
                    const isRemnants = d.dungeon_rank === 'TERRITORY_REMNANTS';
                    const isMalacharEcho = d.boss_name === "Malachar's Echo";
                    for (const p of participants) {
                        if (isPrestige) await addVoidResonance(p.player_id, 'prestige_dungeon_clear', client).catch(() => {});
                        if (isPS) {
                            await recordPsDungeonClear(p.player_id).catch(e => console.error('PS clear record error:', e.message));
                            await updateQuestProgress(p.player_id, 'prestige_clear', 1, client).catch(() => {});
                        }
                        if (isRemnants) await addVoidResonance(p.player_id, 'remnant_sanctum_clear', client).catch(() => {});
                        if (isMalacharEcho) await addVoidResonance(p.player_id, 'malachar_echo_kill', client).catch(() => {});
                    }
                } catch(e) { console.error('Resonance gain error:', e.message); }

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

            // ── MALACHAR GRAND ENTRY + PHASE INIT ────────────────────────────
            const next = d.stage + 1;
            // FIX: Wrap advanceStage in try/catch and ALWAYS reset stage_cleared on failure
            try {
                await advanceStage(dungeon.id, next);
            } catch(advErr) {
                console.error('advanceStage failed — resetting stage_cleared:', advErr.message);
                await db.execute('UPDATE dungeon SET stage_cleared=0 WHERE id=?', [dungeon.id]);
                return msg.reply('══〘 🧭 ONWARD 〙══╮\n┃◆ ❌ Failed to advance stage. Try again.\n╰═══════════════════════╯');
            }

            const isMalacharFinal = d.dungeon_rank === 'MALACHAR' && next === maxStage;

            if (isMalacharFinal) {

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