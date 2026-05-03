const db = require('../database/db');
const { trackContribution } = require('../systems/contributionSystem');
const { battleState, processSkillHit } = require('../systems/leviathan');
const { rollMaterialDrop } = require('../systems/materialSystem');
const { addToBag, getPlayerBag, destroyBag, getBagContents } = require('../systems/bagSystem');
const { assignDropsToContributors, clearStage, getStagePool, setStagePool, getRankedContributors } = require('../systems/contributionSystem');
const { demoteRaider, RAID_GROUP } = require('../engine/dungeon');
const getUserId = require('../utils/getUserId');
const { getAllMoves, calculateMoveDamage, calculateHeal, getMoveCooldown, setMoveCooldown } = require('../systems/skillSystem');
const { getActiveDungeon, getCurrentEnemies, playerSkill, findEnemyTarget, findPlayerTarget, isPlayerInAnyDungeon, addDamageContribution } = require('../engine/dungeon');
const { applyBuff, clearBuffs } = require('../systems/activeBuffs');
const { isPlayerInDuel } = require('../systems/pvpsystem');
const { narrate } = require('../utils/narrator');

function requiresMana(move) {
    return ['heal', 'buff', 'shield', 'cleanse', 'debuff'].includes(move.type) ||
           (move.type === 'damage' && move.stat === 'intelligence');
}

module.exports = {
    name: 'skill',
    async execute(msg, args, { userId, client }) {
        if (isPlayerInDuel(userId)) {
            return msg.reply("❌ In a duel, use !attack <move> instead.");
        }

        if (args.length < 1) return msg.reply("❌ Use: !skill <move> [target]");

        let potentialName = args.join(' ');
        let targetArg = '';

        const [playerRows] = await db.execute("SELECT * FROM players WHERE id=?", [userId]);
        if (!playerRows.length) return msg.reply("❌ Not registered.");
        const player = playerRows[0];
        const [items] = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1", [userId]);
        const moves = getAllMoves(player, items);

        let matchedMove = null;
        let remainingArgs = '';
        for (let i = args.length; i > 0; i--) {
            const testName = args.slice(0, i).join(' ');
            const move = moves.find(m => m.name.toLowerCase() === testName.toLowerCase());
            if (move) {
                matchedMove = move;
                remainingArgs = args.slice(i).join(' ');
                break;
            }
        }

        if (!matchedMove) return msg.reply("❌ You don't know that move. Use !moveset");

        const move = matchedMove;
        targetArg = remainingArgs;

        const cd = getMoveCooldown(userId, move.name);
        if (cd > 0) return msg.reply(`⏳ ${move.name} on cooldown (${Math.ceil(cd/1000)}s)`);

        if ((player.role === 'Mage' || player.role === 'Healer') && requiresMana(move)) {
            const manaCost = move.cost || 5;
            const currentMana = Number(player.mana) || 0;
            if (currentMana < manaCost) {
                return msg.reply(`❌ Not enough mana! You need ${manaCost} mana.`);
            }
            await db.execute("UPDATE players SET mana = mana - ? WHERE id=?", [manaCost, userId]);
            player.mana = currentMana - manaCost;
        }

        const dungeon = await getActiveDungeon();

        async function resolvePlayerTarget(targetArg) {
            if (!targetArg) return player;
            if (targetArg.startsWith('@')) {
                const number = targetArg.substring(1).replace(/\D/g, '');
                const [rows] = await db.execute("SELECT * FROM players WHERE id LIKE ?", [`%${number}%`]);
                return rows[0] || null;
            } else {
                if (dungeon) {
                    return await findPlayerTarget(dungeon.id, targetArg, client);
                } else {
                    const [rows] = await db.execute("SELECT * FROM players WHERE nickname=?", [targetArg]);
                    return rows[0] || null;
                }
            }
        }

        // ==================== HEAL ====================
        if (move.type === 'heal') {
            let targetPlayer = await resolvePlayerTarget(targetArg);
            if (!targetPlayer) return msg.reply(`❌ Player "${targetArg}" not found.`);

            if (targetPlayer.id !== player.id) {
                const targetDungeon = await isPlayerInAnyDungeon(targetPlayer.id);
                if (targetDungeon) {
                    const casterDungeon = await isPlayerInAnyDungeon(player.id);
                    if (casterDungeon !== targetDungeon) {
                        return msg.reply("❌ That player is inside a dungeon and cannot be affected from outside.");
                    }
                }
            }

            const heal = calculateHeal(player, move);
            await db.execute("UPDATE players SET hp = LEAST(max_hp, hp + ?) WHERE id=?", [heal, targetPlayer.id]);
            const actualCd = setMoveCooldown(userId, move.name, move.cooldown || 3, player.rank);

            const healMsg = narrate('heal', { healer: player.nickname, target: targetPlayer.nickname, heal });
            return msg.reply(`══〘 💚 HEAL 〙══╮\n┃◆ ${healMsg}\n┃◆ 💚 Restored ${heal} HP.\n┃◆ Cooldown: ${actualCd}s\n╰═══════════════════════╯`);
        }

        // ==================== DAMAGE ====================
        if (move.type === 'damage') {
            if (!dungeon) return msg.reply("❌ No active dungeon.");
            if (!dungeon.locked) return msg.reply("❌ Dungeon hasn't started.");

            const [inDungeon] = await db.execute(
                "SELECT * FROM dungeon_players WHERE player_id=? AND dungeon_id=? AND is_alive=1",
                [userId, dungeon.id]
            );
            if (!inDungeon.length) {
                return msg.reply("❌ You are not inside the dungeon.");
            }

            const enemies = await getCurrentEnemies(dungeon.id);
            if (enemies.length === 0) return msg.reply("✅ No enemies. Use !onward.");

            let targetEnemy = targetArg ? await findEnemyTarget(dungeon.id, targetArg) : enemies[0];
            if (!targetEnemy) return msg.reply(`❌ Enemy "${targetArg}" not found.`);

            const estDamage = calculateMoveDamage(player, move, targetEnemy, items);
            await addDamageContribution(dungeon.id, targetEnemy.id, userId, estDamage);
            try { trackContribution(dungeon.id, userId, player.nickname, 'damage', estDamage); } catch(e) {}

            // ✅ If Leviathan is active — damage also hits the Leviathan
            if (battleState.active && !battleState.finalPhase) {
                try {
                    await processSkillHit(userId, estDamage, client);
                } catch(e) { console.error('Leviathan hit error:', e.message); }
            }

            const result = await playerSkill(userId, dungeon.id, targetEnemy.id, move, player, items);
            const actualCd = setMoveCooldown(userId, move.name, move.cooldown || 2, player.rank);

            const [weapon] = await db.execute("SELECT * FROM inventory WHERE player_id=? AND equipped=1 LIMIT 1", [userId]);
            let weaponBroke = false;
            if (weapon.length) {
                const newDur = (weapon[0].durability || 100) - 1;
                if (newDur <= 0) {
                    await db.execute("DELETE FROM inventory WHERE id=?", [weapon[0].id]);
                    weaponBroke = true;
                } else {
                    await db.execute("UPDATE inventory SET durability=? WHERE id=?", [newDur, weapon[0].id]);
                }
            }

            let reply = `══〘 ⚔️ SKILL 〙══╮\n`;
            
            if (result.evaded) {
                const evadeMsg = narrate('evasion', { target: targetEnemy.name });
                reply += `┃◆ ${evadeMsg}\n`;
            } else {
                const skillMsg = narrate('skillDamage', { attacker: player.nickname, move: move.name, target: targetEnemy.name, damage: result.damage });
                reply += `┃◆ ${skillMsg}\n`;
            }
            reply += `┃◆ 💥 Damage: ${result.damage}\n`;
            if (targetEnemy.def > 0) {
                const defenseMsg = narrate('defenseBlock', { target: targetEnemy.name, blocked: Math.floor(targetEnemy.def / 2) });
                reply += `┃◆ 🛡️ ${defenseMsg}\n`;
            }

            if (result.defeated) {

                // ✅ Check if all stage enemies defeated — roll shared drops
                (async () => {
                    try {
                        const [dungeonCheck] = await db.execute(
                            "SELECT stage_cleared, dungeon_rank FROM dungeon WHERE id=? AND is_active=1",
                            [dungeon.id]
                        );
                        if (!dungeonCheck.length || !dungeonCheck[0].stage_cleared) return;

                        const [alivePlayers] = await db.execute(
                            "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                            [dungeon.id]
                        );

                        // Roll one drop per alive player
                        const drops = [];
                        for (const p of alivePlayers) {
                            const drop = await rollMaterialDrop(dungeonCheck[0].dungeon_rank, p.player_id, client, RAID_GROUP);
                            if (!drop) continue;
                            const emoji = drop.rarity === 'legendary' ? '🟣' : drop.rarity === 'rare' ? '🔵' : drop.rarity === 'uncommon' ? '🟢' : '⚪';
                            drops.push({ material: drop.material, rarity: drop.rarity, emoji });
                        }

                        if (!drops.length) return;

                        // Snapshot contributors BEFORE clearStage wipes the tracker
                        const qualifiedIds = getRankedContributors(dungeon.id).map(r => r.playerId);
                        clearStage(dungeon.id);
                        const dropPool = drops.map((d, i) => ({ ...d, index: i, takenBy: [] }));
                        setStagePool(dungeon.id, dropPool, qualifiedIds);

                        // Build message
                        const isPrestigeLoot = dungeonCheck[0].dungeon_rank && dungeonCheck[0].dungeon_rank.startsWith('P');
                        let text;
                        if (isPrestigeLoot) {
                            text = `╔══〘 ✦ VOID LOOT 〙══╗\n┃★ \n`;
                        } else {
                            text = `══〘 💎 STAGE LOOT 〙══╮\n┃◆ \n`;
                        }
                        if (isPrestigeLoot) {
                            dropPool.forEach((d, i) => { text += `┃★ ${i + 1}. ${d.emoji} *${d.material}* [${d.rarity.toUpperCase()}]\n`; });
                            text += `┃★ \n┃★ !pickup <number> to collect\n┃★ All Prestige Hunters can pick each item!\n╚═══════════════════════════╝`;
                        } else {
                            dropPool.forEach((d, i) => { text += `┃◆ ${i + 1}. ${d.emoji} *${d.material}* [${d.rarity.toUpperCase()}]\n`; });
                            text += `┃◆ \n┃◆ !pickup <number> to collect\n┃◆ All raiders can pick each item!\n╰═══════════════════════╯`;
                        }
                        await client.sendMessage(RAID_GROUP, { text });

                    } catch(e) { console.error('Stage drop error:', e.message); }
                })();                const defeatMsg = narrate('enemyDefeat', { enemy: targetEnemy.name });
                reply += `┃◆ ${defeatMsg}\n`;
                if (result.rewardDistribution) {
                    reply += `┃◆────────────\n┃◆ 🏆 REWARDS:\n`;
                    result.rewardDistribution.contributors.forEach(c => {
                        reply += `┃◆   ${c.nickname} absorbs lingering essence: +${c.exp} XP, +${c.gold} Gold\n`;
                    });
                }
            } else {
                reply += `┃◆ ${targetEnemy.name} HP: ${result.enemyHp}/${result.enemyMaxHp}\n`;
            }

            if (weaponBroke) reply += `┃◆ ⚠️ Your weapon cracks under the strain!\n`;

            if (result.retaliationMessage) {
                reply += `┃◆────────────\n┃◆ ${result.retaliationMessage}\n`;
                reply += `┃◆ ${player.nickname} reels from the counter: ${result.retaliation} damage (HP: ${result.playerHp}/${player.max_hp})\n`;
            }

            if (result.playerDied) {
                reply += `┃◆────────────\n┃◆ ☠️ ${player.nickname} has fallen.\n┃◆ Use !respawn to return.\n`;
                try { await demoteRaider(client, userId); } catch(e) { console.error('Demote failed:', e.message); }
            }

            reply += `┃◆ Cooldown: ${actualCd}s\n╰═══════════════════════╯`;
            return msg.reply(reply);
        }

        // ==================== BUFF / SHIELD / CLEANSE ====================
        if (['buff', 'shield', 'cleanse'].includes(move.type)) {
            let targetPlayer = await resolvePlayerTarget(targetArg);
            if (!targetPlayer) return msg.reply(`❌ Player "${targetArg}" not found.`);

            if (targetPlayer.id !== player.id) {
                const targetDungeon = await isPlayerInAnyDungeon(targetPlayer.id);
                if (targetDungeon) {
                    const casterDungeon = await isPlayerInAnyDungeon(player.id);
                    if (casterDungeon !== targetDungeon) {
                        return msg.reply("❌ That player is inside a dungeon and cannot be affected from outside.");
                    }
                }
            }

            let actualCd;
            if (move.type === 'cleanse') {
                clearBuffs('player', targetPlayer.id);
                actualCd = setMoveCooldown(userId, move.name, move.cooldown || 3, player.rank);
                const cleanseMsg = narrate('cleanse', { caster: player.nickname, target: targetPlayer.nickname });
                return msg.reply(`══〘 ✨ CLEANSE 〙══╮\n┃◆ ${cleanseMsg}\n┃◆ Cooldown: ${actualCd}s\n╰═══════════════════════╯`);
            }

            if (move.type === 'shield') {
                const shieldValue = move.value || 30;
                applyBuff('player', targetPlayer.id, {
                    type: 'shield',
                    stat: 'shield',
                    value: shieldValue,
                    duration: move.duration || 3
                });
                actualCd = setMoveCooldown(userId, move.name, move.cooldown || 4, player.rank);
                const shieldMsg = narrate('shield', { caster: player.nickname, target: targetPlayer.nickname, move: move.name, value: shieldValue, duration: move.duration || 3 });
                return msg.reply(`══〘 🛡️ SHIELD 〙══╮\n┃◆ ${shieldMsg}\n┃◆ Cooldown: ${actualCd}s\n╰═══════════════════════╯`);
            }

            if (move.type === 'buff') {
                const statName = move.effect.toLowerCase();
                applyBuff('player', targetPlayer.id, {
                    type: 'buff',
                    stat: statName,
                    value: move.value,
                    duration: move.duration || 3
                });
                actualCd = setMoveCooldown(userId, move.name, move.cooldown || 4, player.rank);
                const buffMsg = narrate('buff', { caster: player.nickname, target: targetPlayer.nickname, move: move.name, stat: move.effect, value: move.value, duration: move.duration || 3 });
                return msg.reply(`══〘 ⬆️ BUFF 〙══╮\n┃◆ ${buffMsg}\n┃◆ Cooldown: ${actualCd}s\n╰═══════════════════════╯`);
            }
        }

        // ==================== DEBUFF (on enemy) ====================
        if (move.type === 'debuff') {
            if (!dungeon) return msg.reply("❌ No active dungeon.");
            if (!dungeon.locked) return msg.reply("❌ Dungeon hasn't started.");
            const enemies = await getCurrentEnemies(dungeon.id);
            if (enemies.length === 0) return msg.reply("✅ No enemies.");
            let targetEnemy = targetArg ? await findEnemyTarget(dungeon.id, targetArg) : enemies[0];
            if (!targetEnemy) return msg.reply(`❌ Enemy "${targetArg}" not found.`);

            const statName = move.effect.toLowerCase();
            applyBuff('enemy', targetEnemy.id, {
                type: 'debuff',
                stat: statName,
                value: -move.value,
                duration: move.duration || 2
            });
            const actualCd = setMoveCooldown(userId, move.name, move.cooldown || 3, player.rank);

            const debuffMsg = narrate('debuff', { caster: player.nickname, target: targetEnemy.name, move: move.name, stat: move.effect, value: move.value, duration: move.duration || 2 });
            try { if (dungeon) trackContribution(dungeon.id, userId, player.nickname, 'debuff', 1); } catch(e) {}
            return msg.reply(`══〘 ⬇️ DEBUFF 〙══╮\n┃◆ ${debuffMsg}\n┃◆ Cooldown: ${actualCd}s\n╰═══════════════════════╯`);
        }

        // ✅ DOT moves (Poison Vial etc)
        if (move.type === 'dot') {
            if (!dungeon) return msg.reply(`══〘 ☠️ POISON 〙══╮\n┃◆ ❌ Only usable in dungeons.\n╰═══════════════════════╯`);
            const enemies = await getCurrentEnemies(dungeon.id);
            if (!enemies.length) return msg.reply(`══〘 ☠️ POISON 〙══╮\n┃◆ ❌ No enemies to target.\n╰═══════════════════════╯`);
            const target = enemies[0];

            // Apply DOT debuff — damage per turn for duration
            const dotDamage = Math.floor((player[move.stat] || player.agility) * (move.multiplier || 0.4));
            const duration = move.duration || 3;

            applyBuff('enemy', target.id, {
                type: 'dot',
                stat: 'hp',
                value: dotDamage,
                duration
            });

            const actualCd = setMoveCooldown(userId, move.name, move.cooldown || 3, player.rank);
            try { trackContribution(dungeon.id, userId, player.nickname, 'debuff', 1); } catch(e) {}

            return msg.reply(
                `══〘 ☠️ ${move.name.toUpperCase()} 〙══╮\n` +
                `┃◆ ☠️ ${player.nickname} poisons ${target.name}!\n` +
                `┃◆ 💀 ${dotDamage} damage/turn × ${duration} turns\n` +
                `┃◆ Cooldown: ${actualCd}s\n` +
                `╰═══════════════════════╯`
            );
        }

        return msg.reply("❌ Unknown move type.");
    }
};