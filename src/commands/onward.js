const db = require('../database/db');
const {
    getActiveDungeon,
    isPlayerInDungeon,
    isPlayerInAnyDungeon,
    advanceStage,
    getMaxStageForDungeon,
    getDungeonStatusText,
    getCurrentEnemies,
    demoteAllRaiders
} = require('../engine/dungeon');
const { handleShardDrop } = require('./event');
const { getPlayerBag } = require('../systems/bagSystem');
const { resetStageTimer, clearDungeonTimers } = require('../engine/dungeonTimer');
const { getActiveWar, addWarDamage, endVoidWar } = require('../systems/voidwar');
const { rollMaterialDrop } = require('../systems/materialSystem');
const { initStage } = require('../systems/contributionSystem');
const { updateQuestProgress } = require('../systems/questSystem');
const { trySpawnPrestigeDungeon } = require('../engine/prestigeDungeon');
const { initMalacharPhase, clearMalacharPhase } = require('../systems/malacharPhase');
const { tickShields } = require('../systems/activeBuffs');
const { recordMalacharKill } = require('../systems/clanQuestTracker');
const { addVoidResonance, recordPsDungeonClear } = require('../systems/ascendantSystem');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

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
            if (!dungeon) dungeon = await getActiveDungeon(true); // fallback including territory

            if (!dungeon) return msg.reply(
                `══〘 🧭 ONWARD 〙══╮\n┃◆ ❌ No active dungeon.\n╰═══════════════════════╯`
            );
            if (!dungeon.locked) return msg.reply(
                `══〘 🧭 ONWARD 〙══╮\n┃◆ ❌ Dungeon hasn't started yet.\n┃◆ Wait for auto-start or ask an admin.\n╰═══════════════════════╯`
            );

            if (!(await isPlayerInDungeon(userId, dungeon.id))) {
                return msg.reply(
                    `══〘 🧭 ONWARD 〙══╮\n┃◆ ❌ You are not inside the dungeon.\n╰═══════════════════════╯`
                );
            }

            // FIX: Always re-read the freshest dungeon state from DB
            const [freshDungeon] = await db.execute(
                "SELECT stage, max_stage, stage_cleared, dungeon_rank, boss_name, locked, is_active FROM dungeon WHERE id=?",
                [dungeon.id]
            );
            if (!freshDungeon.length || !freshDungeon[0].is_active) {
                return msg.reply(`══〘 🧭 ONWARD 〙══╮\n┃◆ ❌ Dungeon no longer active.\n╰═══════════════════════╯`);
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
                    `══〘 ⚠️ BLOCKED 〙══╮\n` +
                    `┃◆ There are still ${liveEnemies.length} enemy/enemies alive!\n` +
                    `┃◆ Defeat them first before advancing.\n` +
                    `┃◆ Use !dungeon to check status.\n` +
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
                    await client.sendMessage(RAID_GROUP, {
                        text:
                            `╔══════════════════════════════════════╗\n` +
                            `┃★                                     \n` +
                            `┃★   He is gone.                       \n` +
                            `┃★                                     \n` +
                            `┃★   The void retreats.                \n` +
                            `┃★   The fractures begin to seal.      \n` +
                            `┃★                                     \n` +
                            `┃★   MALACHAR HAS FALLEN.              \n` +
                            `┃★                                     \n` +
                            `┃★   The hunters who stood here today  \n` +
                            `┃★   will be remembered.               \n` +
                            `┃★                                     \n` +
                            `┃★   The world breathes again.         \n` +
                            `┃★                                     \n` +
                            `╚══════════════════════════════════════╝`
                    });
                }

                const rewardGold = d.dungeon_rank === 'MALACHAR' ? 500000 : Math.floor(Math.random() * 20) + 90;
                const rewardXp   = d.dungeon_rank === 'MALACHAR' ? 200000 : Math.floor(Math.random() * 15) + 82;

                const { applyGoldBonus, applyXpBonus } = require('../systems/territoryBonusSystem');
                for (const p of participants) {
                    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [rewardGold, p.player_id]);
                    await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?",           [rewardXp,   p.player_id]);
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
                    const isPrestige = d.dungeon_rank && d.dungeon_rank.startsWith('P');
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
                        await client.sendMessage(RAID_GROUP, { text: mvpResult.message }).catch(() => {});
                    } else {
                        console.log('[MVP] No result — stats may be empty for key dungeon_' + dungeon.id);
                    }
                } catch (e) { console.error('[MVP dungeon]', e.message); }

                // Void War contribution
                (async () => {
                    try {
                        const war = await getActiveWar();
                        if (!war) return;
                        for (const p of participants) {
                            const [pl] = await db.execute("SELECT nickname FROM players WHERE id=?", [p.player_id]);
                            if (!pl.length) continue;
                            const result = await addWarDamage(p.player_id, pl[0].nickname, d.dungeon_rank);
                            if (result && result.totalDamage >= result.goal) {
                                await endVoidWar(client);
                            }
                        }
                    } catch(e) { console.error('War damage error:', e.message); }
                })();

            } // end dungeon clear rewards block

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
                const RAID_G = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
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
                    clearMalacharPhase(dungeon.id);

                    // FIX: Territory dungeon timeout — clean up war record and notify group
                    if (isTerritory && territoryId) {
                        await db.execute(
                            "UPDATE territory_wars SET status='completed' WHERE territory_id=? AND status IN ('pending','active')",
                            [territoryId]
                        ).catch(() => {});
                        const { TERRITORIES } = require('../systems/voidTerritories');
                        const terr = TERRITORIES[territoryId];
                        await client.sendMessage(RAID_GROUP, {
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
            const isMalacharFinal = d.dungeon_rank === 'MALACHAR' && next === maxStage;

            if (isMalacharFinal) {
                await initMalacharPhase(dungeon.id);

                await client.sendMessage(RAID_GROUP, {
                    text:
                        `╔══════════════════════════════════════╗\n` +
                        `┃★                                     \n` +
                        `┃★   The generals are gone.            \n` +
                        `┃★   The silence is total.             \n` +
                        `┃★                                     \n` +
                        `┃★   Something watches from the dark.  \n` +
                        `┃★                                     \n` +
                        `╚══════════════════════════════════════╝`
                });

                await sleep(3000);

                await client.sendMessage(RAID_GROUP, {
                    text:
                        `╔══════════════════════════════════════╗\n` +
                        `┃★                                     \n` +
                        `┃★   The walls begin to crack.         \n` +
                        `┃★   The void bleeds through.          \n` +
                        `┃★                                     \n` +
                        `┃★   You feel him before you see him.  \n` +
                        `┃★                                     \n` +
                        `╚══════════════════════════════════════╝`
                });

                await sleep(3000);

                await client.sendMessage(RAID_GROUP, {
                    text:
                        `╔══════════════════════════════════════╗\n` +
                        `┃★                                     \n` +
                        `┃★   👁️  H E   I S   H E R E.         \n` +
                        `┃★                                     \n` +
                        `┃★        M A L A C H A R             \n` +
                        `┃★                                     \n` +
                        `┃★   ❤️  HP: 1,000,000,000             \n` +
                        `┃★   ⚔️  This is what you came for.    \n` +
                        `┃★                                     \n` +
                        `┃★   Phase 1 — The Void Awakens        \n` +
                        `┃★   He is not yet at full power.      \n` +
                        `┃★   Do not be fooled.                 \n` +
                        `┃★                                     \n` +
                        `╚══════════════════════════════════════╝`
                });

                await msg.reply(
                    `╔══〘 ★ FINAL STAGE 〙══╗\n` +
                    `┃★ Stage ${next}/${maxStage} — The End.\n` +
                    `┃★ He stands before you.\n` +
                    `┃★ Use !dungeon to see his stats.\n` +
                    `╚═══════════════════════╝`
                );
            } else {
                await msg.reply(
                    `══〘 🧭 STAGE ${next}/${maxStage} 〙══╮\n` +
                    `┃◆ The stone door grinds open, revealing a deeper darkness.\n` +
                    `┃◆ The air grows colder, and new threats stir in the shadows.\n` +
                    `╰═══════════════════════╯`
                );
            }

            const statusText = await getDungeonStatusText(dungeon.id);
            return msg.reply(statusText);

        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🧭 ONWARD 〙══╮\n┃◆ ❌ Onward failed.\n╰═══════════════════════╯`);
        }
    }
};