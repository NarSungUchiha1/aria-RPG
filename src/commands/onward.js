const db = require('../database/db');
const {
    getActiveDungeon,
    isPlayerInDungeon,
    advanceStage,
    getMaxStageForDungeon,
    getDungeonStatusText,
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


module.exports = {
    name: 'onward',
    async execute(msg, args, { userId, client }) {
        try {
            const dungeon = await getActiveDungeon();
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

            if (!dungeon.stage_cleared) {
                return msg.reply(`══〘 ⚠️ BLOCKED 〙══╮\n┃◆ The path forward is sealed by a lingering malevolence. Defeat all enemies first!\n┃◆ Use !dungeon to check status.\n╰═══════════════════════╯`);
            }

            const maxStage = await getMaxStageForDungeon(dungeon.id);

            // ── DUNGEON CLEARED ──
            if (dungeon.stage >= maxStage) {
                const [participants] = await db.execute(
                    "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                    [dungeon.id]
                );
                const rewardGold = Math.floor(Math.random() * 20) + 90; // 90-110 gold
                const rewardXp = Math.floor(Math.random() * 15) + 82; // 82-97 XP

                for (const p of participants) {
                    await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [rewardGold, p.player_id]);
                    await db.execute("UPDATE xp SET xp = xp + ? WHERE player_id=?", [rewardXp, p.player_id]);

                    // ✅ Quest tracking — dungeon clear and survive
                    // ✅ Quest tracking — fire and forget
                    (async () => {
                        try {
                            await updateQuestProgress(p.player_id, 'dungeon_clear',   1, client);
                            await updateQuestProgress(p.player_id, 'dungeon_survive', 1, client);
                            await updateQuestProgress(p.player_id, 'dungeon_enter',   1, client);
                            if (dungeon.dungeon_rank === 'S') {
                                await updateQuestProgress(p.player_id, 'srank_clear', 1, client);
                            }
                        } catch (e) {}
                    })();
                }

                // ✅ Void War damage contribution
                (async () => {
                    try {
                        const war = await getActiveWar();
                        console.log(`⚡ War check: active=${!!war}, rank=${dungeon.dungeon_rank}`);
                        if (!war) return;
                        for (const p of participants) {
                            const [pl] = await db.execute("SELECT nickname FROM players WHERE id=?", [p.player_id]);
                            if (!pl.length) continue;
                            const result = await addWarDamage(p.player_id, pl[0].nickname, dungeon.dungeon_rank);
                            console.log(`⚡ War damage: ${pl[0].nickname} dealt ${result?.damage}, total=${result?.totalDamage}/${result?.goal}`);
                            if (result && result.totalDamage >= result.goal) {
                                console.log('⚡ Void War goal reached! Ending war...');
                                await endVoidWar(client);
                            }
                        }
                    } catch(e) { console.error('War damage error:', e.message, e.stack); }
                })();

                // ✅ Void Shard drops (event only)
                try {
                    const { handleShardDrop } = require('./event');
                    await handleShardDrop(dungeon.id, client);
                } catch (e) { console.error('Shard drop error:', e.message); }

                // ✅ Healer payment — fee split between alive party members
                (async () => {
                    try {
                        const [hire] = await db.execute(
                            "SELECT * FROM dungeon_healer WHERE dungeon_id=? AND paid=0",
                            [dungeon.id]
                        );
                        if (!hire.length) return;
                        const h = hire[0];

                        // Split fee evenly between participants
                        const partySize = participants.length;
                        if (partySize === 0) return;
                        const perPlayer = Math.ceil(h.fee_gold / partySize);

                        let totalPaid = 0;
                        for (const p of participants) {
                            const [gold] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [p.player_id]);
                            const canPay = Math.min(perPlayer, gold[0]?.gold || 0);
                            if (canPay > 0) {
                                await db.execute("UPDATE currency SET gold = gold - ? WHERE player_id=?", [canPay, p.player_id]);
                                totalPaid += canPay;
                            }
                        }

                        // Pay healer
                        await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [totalPaid, h.healer_id]);
                        await db.execute("UPDATE dungeon_healer SET paid=1 WHERE id=?", [h.id]);

                        const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
                        await client.sendMessage(RAID_GROUP, {
                            text:
                                `══〘 💚 HEALER PAID 〙══╮\n` +
                                `┃◆ *${h.healer_nick}* earned ${totalPaid} Gold\n` +
                                `┃◆ (${perPlayer}/player × ${partySize} raiders)\n` +
                                `┃◆ Thanks for the healing! 💚\n` +
                                `╰═══════════════════════╯`
                        });

                        // Notify healer
                        await client.sendMessage(`${h.healer_id}@s.whatsapp.net`, {
                            text:
                                `══〘 💚 PAYMENT RECEIVED 〙══╮\n` +
                                `┃◆ Dungeon cleared!\n` +
                                `┃◆ 💰 +${totalPaid} Gold received.\n` +
                                `╰═══════════════════════╯`
                        });
                    } catch(e) { console.error('Healer payment error:', e.message); }
                })();

                // ✅ Material drops — fire and forget
                (async () => {
                    try {
                        const RG = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
                        for (const p of participants) {
                            const drop = await rollMaterialDrop(dungeon.dungeon_rank, p.player_id, client, RG);
                            if (drop) {
                                const emoji = drop.rarity === 'legendary' ? '🟣' : drop.rarity === 'rare' ? '🔵' : drop.rarity === 'uncommon' ? '🟢' : '⚪';
                                await client.sendMessage(RG, {
                                    text:
                                        `══〘 💎 MATERIAL DROP 〙══╮\n` +
                                        `┃◆ @${p.player_id} found something!\n` +
                                        `┃◆ \n` +
                                        `┃◆ ${emoji} *${drop.material}*\n` +
                                        `┃◆ [${drop.rarity.toUpperCase()}]\n` +
                                        `┃◆ Total held: ×${drop.quantity}\n` +
                                        `┃◆ \n` +
                                        `┃◆ Visit the Blacksmith to forge.\n` +
                                        `╰═══════════════════════╯`,
                                    mentions: [`${p.player_id}@s.whatsapp.net`]
                                });
                            }
                        }
                    } catch (e) { console.error('Material drop error:', e.message); }
                })();

                // ✅ Demote all raiders before closing
                await demoteAllRaiders(client, dungeon.id);

                // Bulk-remove players and close dungeon
                await db.execute("DELETE FROM dungeon_players WHERE dungeon_id=?", [dungeon.id]);
                await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [dungeon.id]);
                clearDungeonTimers(dungeon.id);

                return msg.reply(`══〘 👑 DUNGEON CLEARED 〙══╮
┃◆ The chamber falls silent. ${dungeon.boss_name} lies vanquished, its reign of terror ended.
┃◆ Each survivor feels the dungeon's gratitude:
┃◆ 💰 +${rewardGold} Gold   ⭐ +${rewardXp} XP
┃◆ As the exit shimmers into view, you step out into the light.
╰═══════════════════════╯`);
            }

            // ── ADVANCE STAGE ──
            const next = dungeon.stage + 1;
            await advanceStage(dungeon.id, next);

            // ✅ Init fresh contribution tracker for new stage
            try {
                initStage(dungeon.id);
            } catch(e) {}

            // ✅ Track stage clear — fire and forget
            (async () => {
                try {
                    const [alive] = await db.execute(
                        "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                        [dungeon.id]
                    );
                    for (const p of alive) {
                        await updateQuestProgress(p.player_id, 'stage_clear', 1, client);
                    }
                } catch (e) {}
            })();


            // targetChat is the dungeon GC (onward is restricted there by index.js routing)
            const targetChat = await msg.getChat();

            const failCallback = async () => {
                try {
                    const [players] = await db.execute(
                        "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                        [dungeon.id]
                    );
                    for (const p of players) {
                        await db.execute("UPDATE players SET hp = 0 WHERE id=?", [p.player_id]);
                    }

                    // ✅ Demote all raiders before closing
                    await demoteAllRaiders(client, dungeon.id);

                    await db.execute("DELETE FROM dungeon_players WHERE dungeon_id=?", [dungeon.id]);
                    await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [dungeon.id]);
                    clearDungeonTimers(dungeon.id);

                    await targetChat.sendMessage(`══〘 💀 STAGE FAILED 〙══╮\n┃◆ Reinforcements have arrived!\n┃◆ The dungeon overwhelms you. You have died.\n╰═══════════════════════╯`);
                } catch (err) {
                    console.error("Onward failCallback error:", err);
                }
            };

            // Reset stage timer only — overall timer keeps running from begin/auto-start
            await resetStageTimer(dungeon.id, client, targetChat, failCallback);

            await msg.reply(`══〘 🧭 STAGE ${next}/${maxStage} 〙══╮
┃◆ The stone door grinds open, revealing a deeper darkness. The air grows colder, and new threats stir in the shadows.
╰═══════════════════════╯`);

            const statusText = await getDungeonStatusText(dungeon.id);
            return msg.reply(statusText);
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🧭 ONWARD 〙══╮\n┃◆ ❌ Onward failed.\n╰═══════════════════════╯`);
        }
    }
};