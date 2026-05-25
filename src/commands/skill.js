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
const { getPlayerClan, CLAN_BLESSINGS, getPlayerBlessingState, updateBlessingState } = require('../systems/clanSystem');
const { getEffect, getTurnEffect, clearEffect, consumeCharge, getHpLost } = require('../systems/potionEffects');
const { checkPhaseTransition } = require('../systems/malacharPhase');

// In-memory taunt state: dungeonId -> { tankId, expires }
const tauntState = new Map();

// Spam tracker: userId -> { lastAttack, count, window }
const spamTracker = new Map();
const SPAM_WINDOW_MS  = 3000;
const SPAM_THRESHOLD  = 2;
const SPAM_FATIGUE    = 50;
const { narrate } = require('../utils/narrator');
const { recordDamage, recordHeal, recordKill, calculateMvp } = require('../systems/mvpSystem');

function requiresMana(move, player) {
    // FIX: Any move with a cost > 0 consumes mana
    // Previously only INT damage and weapon heals triggered this —
    // everything else with cost defined was silently free
    if (move.cost && move.cost > 0) return true;

    // Role heals are always free (no cost defined, but explicit check)
    if (move.type === 'heal' && move.source === 'role') return false;

    return false;
}

// ── CLAN BLESSING TRIGGER ────────────────────────────────────────────────────
async function triggerBlessingIfReady(trigger, playerId, dungeonId, player, dungeon, msg, extraData = {}) {
    try {
        const clan = await getPlayerClan(playerId);
        if (!clan) return null;
        const blessing = CLAN_BLESSINGS[clan.blessing_id];
        if (!blessing || blessing.trigger !== trigger) return null;
        if (blessing.prestige_only && !(player.prestige_level > 0)) return null;

        const state = await getPlayerBlessingState(playerId, dungeonId);

        const oneUseTriggers = ['hp_below_30','on_death','final_stage','all_allies_below_50','stage_first_move'];
        if (oneUseTriggers.includes(trigger) && state.blessing_used) return null;

        const repeatTriggers = ['on_kill','every_5_skills','three_consecutive_hits','on_healed','enemy_below_25'];
        if (repeatTriggers.includes(trigger) && state.last_triggered) {
            const secsSince = (Date.now() - new Date(state.last_triggered).getTime()) / 1000;
            if (secsSince < 30) return null;
        }

        let blessingMsg = '';

        if (trigger === 'hp_below_30' || trigger === 'on_kill' || trigger === 'final_stage') {
            const enemies = await db.execute('SELECT id, current_hp, def FROM dungeon_enemies WHERE dungeon_id=? AND current_hp>0', [dungeonId]);
            const roleStatMap = { Berserker: 'strength', Assassin: 'agility', Mage: 'intelligence', Healer: 'intelligence', Tank: 'stamina', Explorer: 'agility' };
            const primaryStatKey = roleStatMap[player.role] || 'strength';
            const primaryStat = Number(player[primaryStatKey]) || 100;
            const dmg = Math.max(1, Math.floor(primaryStat * (blessing.multiplier || 3.0)));
            for (const e of enemies[0]) {
                await db.execute('UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?', [dmg, e.id]);
            }
            const totalDmgDealt = enemies[0].length * dmg;
            if (trigger === 'hp_below_30') {
                blessingMsg = `╔══〘 🐉 DRAGON'S BREATH 〙══╗
┃◆ The bloodline awakens.
┃◆ ${player.nickname} reaches the edge —
┃◆ and the dragon inside ignites.
┃◆ 🔥 Void fire erupts on ALL enemies.
┃◆ DEF means nothing. It burns through.
╚═══════════════════════════╝`;
            } else if (trigger === 'on_kill') {
                blessingMsg = `╔══〘 🌑 VOID COLLAPSE 〙══╗
┃◆ The kill tears a hole in space.
┃◆ The void rushes in — and takes
┃◆ everything with it.
┃◆ 💥 ALL remaining enemies hit.
┃◆ DEF shattered by 50% this stage.
╚═══════════════════════════╝`;
            } else {
                blessingMsg = `╔══〘 ✨ ${blessing.name} 〙══╗
┃◆ ${blessing.emoji} The bloodline stirs.
┃◆ ${blessing.effect}
╚═══════════════════════════╝`;
            }
            if (['hp_below_30','final_stage','all_allies_below_50'].includes(trigger)) {
                await updateBlessingState(playerId, dungeonId, { blessing_used: 1 });
            }
        }

        if (trigger === 'every_5_skills') {
            const newCount = (state.skill_count || 0) + 1;
            if (newCount % 5 === 0) {
                const enemies = await db.execute('SELECT id, current_hp FROM dungeon_enemies WHERE dungeon_id=? AND current_hp>0', [dungeonId]);
                const stat = player.intelligence || 100;
                for (const e of enemies[0]) {
                    const dmg = Math.floor(stat * blessing.multiplier);
                    await db.execute('UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?', [dmg, e.id]);
                }
                blessingMsg = `\n☄️ *Heaven's Fall* strikes all enemies for ${Math.floor((player.intelligence||100)*blessing.multiplier)} damage!`;
            }
            await updateBlessingState(playerId, dungeonId, { skill_count: newCount });
        }

        if (trigger === 'three_consecutive_hits') {
            const newHits = (state.hit_count || 0) + 1;
            if (newHits >= 3) {
                await updateBlessingState(playerId, dungeonId, { hit_count: 0, invincible: 2 });
                blessingMsg = `╔══〘 ⚡ TITAN'S ROAR 〙══╗
┃◆ Three hits. Enough.
┃◆ ${player.nickname} lets out a roar
┃◆ that shakes the dungeon walls.
┃◆ 
┃◆ Invincible. 2 turns.
┃◆ Next strike: 400% damage.
╚═══════════════════════════╝`;
            } else {
                await updateBlessingState(playerId, dungeonId, { hit_count: newHits });
            }
        }

        if (trigger === 'on_healed') {
            const healAmt = extraData.healAmount || 100;
            const dmg     = Math.floor(healAmt * (blessing.heal_multiplier || 2.0));
            const [rndEnemy] = await db.execute(
                'SELECT id FROM dungeon_enemies WHERE dungeon_id=? AND current_hp>0 ORDER BY RAND() LIMIT 1', [dungeonId]
            );
            if (rndEnemy.length) {
                await db.execute('UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?', [dmg, rndEnemy[0].id]);
                blessingMsg = `\n🕳️ *Abyssal Hunger* absorbs ${healAmt} healing → ${dmg} void damage on enemy!`;
            }
        }

        if (trigger === 'enemy_below_25' && extraData.enemy) {
            const e = extraData.enemy;
            const isBoss = e.current_hp > 50000;
            if (isBoss) {
                const bossDmg = Math.floor(e.current_hp * (blessing.boss_multiplier || 0.8));
                await db.execute('UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?', [bossDmg, e.id]);
                blessingMsg = `\n💀 *Reaper's Mark* — ${bossDmg} void damage on boss!`;
            } else {
                await db.execute('UPDATE dungeon_enemies SET current_hp = 0 WHERE id=?', [e.id]);
                blessingMsg = `╔══〘 💀 REAPER'S MARK 〙══╗
┃◆ The mark was set the moment
┃◆ ${e.name} started bleeding.
┃◆ 
┃◆ Execution carried out.
╚═══════════════════════════╝`;
            }
            await updateBlessingState(playerId, dungeonId, { blessing_used: 1 });
        }

        if (trigger === 'on_death') {
            const healAmt = Math.floor(player.max_hp * (blessing.heal_percent || 0.6));
            await db.execute('UPDATE players SET hp = ? WHERE id=?', [Math.max(1, healAmt), playerId]);
            await updateBlessingState(playerId, dungeonId, { blessing_used: 1 });
            blessingMsg = `╔══〘 👻 PHANTOM SHIFT 〙══╗
┃◆ Death reached for ${player.nickname}.
┃◆ The bloodline refused.
┃◆ 
┃◆ You survived with ${healAmt} HP.
┃◆ The attacker feels the recoil.
╚═══════════════════════════╝`;
        }

        if (trigger === 'stage_first_move') {
            await db.execute(
                'UPDATE dungeon_enemies SET def = GREATEST(0, def - FLOOR(def * ?)) WHERE dungeon_id=? AND current_hp>0',
                [blessing.damage_amp || 0.5, dungeonId]
            );
            blessingMsg = `╔══〘 💠 SOUL SHATTER 〙══╗
┃◆ ASHEN blood burns cold.
┃◆ The first strike cracks
┃◆ something deeper than armour.
┃◆ 
┃◆ All enemies: DEF -50% this stage.
╚═══════════════════════════╝`;
            await updateBlessingState(playerId, dungeonId, { blessing_used: 1 });
        }

        if (trigger === 'final_stage') {
            const [allEnemies] = await db.execute('SELECT id, current_hp FROM dungeon_enemies WHERE dungeon_id=? AND current_hp>0', [dungeonId]);
            for (const e of allEnemies) {
                const drain = Math.floor(e.current_hp * (blessing.hp_drain || 0.4));
                await db.execute('UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?', [drain, e.id]);
            }
            await updateBlessingState(playerId, dungeonId, { damage_boost: blessing.damage_boost || 0.3, blessing_used: 1 });
            blessingMsg = `╔══〘 🌒 ECLIPSE 〙══╗
┃◆ The final stage darkens.
┃◆ Something ancient in the bloodline
┃◆ recognises the end — and rises.
┃◆ 
┃◆ All enemies: -40% current HP.
┃◆ +30% damage — permanent this run.
╚═══════════════════════════╝`;
        }

        if (trigger === 'all_allies_below_50') {
            await updateBlessingState(playerId, dungeonId, { invincible: blessing.charges || 3, blessing_used: 1 });
            blessingMsg = `╔══〘 👁️ MALACHAR'S WILL 〙══╗
┃★ The bloodline does not ask.
┃★ It takes.
┃★ 
┃★ Malachar channels through you.
┃★ Next 3 attacks — 1000% damage.
┃★ Nothing evades. Nothing blocks.
╚═══════════════════════════╝`;
        }

        if (blessingMsg) {
            await msg.reply(blessingMsg).catch(() => {});
            await db.execute(
                'UPDATE clan_blessing_state SET last_triggered=NOW() WHERE player_id=? AND dungeon_id=?',
                [playerId, dungeonId]
            ).catch(() => {});
        }
        return blessingMsg;
    } catch(e) {
        console.error('Blessing trigger error:', e.message);
        return null;
    }
}

module.exports = {
    name: 'skill',
    async execute(msg, args, { userId, client }) {
      try {
        if (isPlayerInDuel(userId)) {
            return msg.reply("❌ In a duel, use !attack <move> instead.");
        }

        if (args.length < 1) return msg.reply("❌ Use: !skill <move> [target]");

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
        const targetArg = remainingArgs;

        const cd = getMoveCooldown(userId, move.name);
        const noCdFx = getTurnEffect ? getTurnEffect(userId) : null;
        if (cd > 0 && noCdFx?.effect !== 'no_cooldown') return msg.reply(`⏳ ${move.name} on cooldown (${Math.ceil(cd/1000)}s)`);

        // ── SPAM DETECTION ──────────────────────────────────────────────────
        if (move.type === 'damage') {
            const now  = Date.now();
            const spam = spamTracker.get(userId) || { lastAttack: 0, count: 0 };
            const gap  = now - spam.lastAttack;
            if (gap < SPAM_WINDOW_MS) {
                spam.count++;
            } else {
                spam.count = Math.max(0, spam.count - 1);
            }
            spam.lastAttack = now;
            spamTracker.set(userId, spam);

            if (spam.count >= SPAM_THRESHOLD) {
                const spamHitNumber = spam.count - SPAM_THRESHOLD;
                // FIX: ADD fatigue penalty instead of jumping to a fixed target with GREATEST.
                // Old code: GREATEST(fatigue, 35) meant once you were above 35 it did nothing.
                // New code: each spam hit adds a fixed penalty on top of current fatigue.
                const spamPenalty = spamHitNumber === 0 ? 10 : Math.min(30, 10 * (spamHitNumber + 1));
                try {
                    await db.execute(
                        'UPDATE players SET fatigue = LEAST(100, COALESCE(fatigue, 0) + ?) WHERE id=?',
                        [spamPenalty, userId]
                    );
                } catch(e) {}
                if (spamHitNumber === 0) {
                    await msg.reply(
                        `╔══〘 ⚠️ FATIGUE SPIKE 〙══╗\n` +
                        `┃◆ You are moving too fast.\n` +
                        `┃◆ Your body cannot keep up.\n` +
                        `┃◆ 🔵 Fatigue +${spamPenalty}% penalty.\n` +
                        `┃◆ Slow down or your damage suffers.\n` +
                        `╚═══════════════════════════╝`
                    ).catch(() => {});
                }
            }
        }

        if (requiresMana(move)) {
            const manaCost = move.cost || 5;
            const currentMana = Number(player.mana) || 0;
            const isCaster = ['Mage', 'Healer', 'Explorer'].includes(player.role);
            if (currentMana < manaCost) {
                const tip = isCaster
                    ? `❌ Not enough mana! Need ${manaCost}, have ${currentMana}.`
                    : `❌ Not enough mana (${currentMana}/${player.max_mana || 20}).\n┃◆ Healing weapons need mana — only Mages, Healers & Explorers can sustain them.`;
                return msg.reply(tip);
            }
            await db.execute("UPDATE players SET mana = mana - ? WHERE id=?", [manaCost, userId]);
            player.mana = currentMana - manaCost;
        }

        // FIX: use the dungeon the player is actually IN, not the globally active one
        // This prevents territory/normal dungeon crossover bugs
        const playerDungeonId = await isPlayerInAnyDungeon(userId);
        const dungeon = playerDungeonId
            ? await (async () => { const [r] = await db.execute('SELECT * FROM dungeon WHERE id=?', [playerDungeonId]); return r[0] || null; })()
            : await getActiveDungeon(true);

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
            if (dungeon) triggerBlessingIfReady('every_5_skills', userId, dungeon.id, player, dungeon, msg).catch(() => {});
            if (dungeon && targetPlayer.id !== userId) {
                triggerBlessingIfReady('on_healed', targetPlayer.id, dungeon.id, targetPlayer, dungeon, msg, { healAmount: heal }).catch(() => {});
            }

            const healMsg = narrate('heal', { healer: player.nickname, target: targetPlayer.nickname, heal });

            // FIX: Reward healer for healing in dungeon
            if (dungeon) {
                const healReward = Math.floor(heal * 0.1);
                if (healReward > 0) {
                    await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [healReward, userId]).catch(() => {});
                    await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [healReward, userId]).catch(() => {});
                    await db.execute(
                        'UPDATE dungeon_players SET session_gold = session_gold + ?, session_xp = session_xp + ? WHERE player_id=? AND dungeon_id=?',
                        [healReward, healReward, userId, dungeon.id]
                    ).catch(() => {});
                    try { recordHeal(`dungeon_${dungeon.id}`, userId, heal); } catch(e) {}
                    try { trackContribution(dungeon.id, userId, player.nickname, 'heal', heal); } catch(e) {}
                }
            }

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
            if (!inDungeon.length) return msg.reply("❌ You are not inside the dungeon.");

            const enemies = await getCurrentEnemies(dungeon.id);
            if (enemies.length === 0) return msg.reply("✅ No enemies. Use !onward.");

            let targetEnemy = targetArg ? await findEnemyTarget(dungeon.id, targetArg) : enemies[0];
            if (!targetEnemy) return msg.reply(`❌ Enemy "${targetArg}" not found.`);

            const estDamage = calculateMoveDamage(player, move, targetEnemy, items, { noTick: true });
            await addDamageContribution(dungeon.id, targetEnemy.id, userId, estDamage);
            try { trackContribution(dungeon.id, userId, player.nickname, 'damage', estDamage); } catch(e) {}

            // Leviathan parallel damage
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

            // Blood Price bonus
            try {
                const bpFx = getEffect(userId, dungeon?.id);
                if (bpFx?.effect === 'hp_to_damage') {
                    const bonus = bpFx.data.bonus || 0;
                    await db.execute('UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?', [bonus, targetEnemy?.id]);
                    consumeCharge(userId);
                    reply += `┃◆ 🩸 Blood Price: +${bonus} bonus damage!\n`;
                }
            } catch(e) {}
            reply += `┃◆ 💥 Damage: ${result.damage}\n`;

            // Malachar's Hunger — steal HP on first hit per stage
            try {
                const hungerFx2 = getEffect ? getEffect(userId, dungeon?.id) : null;
                if (hungerFx2?.effect === 'hp_steal_first' && targetEnemy?.id && result.enemyHp > 0) {
                    const stealAmt = Math.floor(result.enemyHp * (hungerFx2.data.percent || 0.3));
                    if (stealAmt > 0) {
                        await db.execute('UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?', [stealAmt, targetEnemy.id]);
                        await db.execute('UPDATE players SET hp = LEAST(max_hp, hp + ?) WHERE id=?', [stealAmt, userId]);
                        reply += `┃◆ 🍖 Hunger: stole ${stealAmt} HP from ${targetEnemy.name}!\n`;
                        if (hungerFx2?.data?.overflow && stealAmt > (result.enemyHp || 0)) {
                            const overflow = stealAmt - (result.enemyHp || 0);
                            await db.execute('UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?', [overflow, userId]);
                            reply += `┃◆ 🍖 Hunger overflow — ${overflow} reflected back!\n`;
                        }
                        consumeCharge(userId);
                    }
                }
            } catch(e3) {}

            // Turn effects
            try {
                const activeTurnEffect = getTurnEffect ? getTurnEffect(userId) : null;

                if (activeTurnEffect?.effect === 'double_strike') {
                    const hit = Math.random() < (activeTurnEffect.data.chance || 0.4);
                    if (hit && targetEnemy?.id) {
                        await db.execute('UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?', [result.damage, targetEnemy.id]);
                        reply += `┃◆ 👻 DOUBLE STRIKE — hit twice! +${result.damage} bonus damage!\n`;
                    } else if (!hit) {
                        const recoil = Math.floor(result.damage * 0.10);
                        await db.execute('UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?', [recoil, userId]);
                        reply += `┃◆ 👻 Double strike MISSED — recoil ${recoil} damage to you!\n`;
                    }
                }

                if (activeTurnEffect?.effect === 'lifesteal' && result.damage > 0) {
                    const healAmt = Math.floor(result.damage * (activeTurnEffect.data.percent || 0.25));
                    await db.execute('UPDATE players SET hp = LEAST(max_hp, hp + ?) WHERE id=?', [healAmt, userId]);
                    await db.execute('UPDATE players SET fatigue = LEAST(100, COALESCE(fatigue, 0) + 5) WHERE id=?', [userId]);
                    reply += `┃◆ 🩸 Crimson Tide: +${healAmt} HP (fatigue +5%)\n`;
                }

                if (activeTurnEffect?.effect === 'chaos_mode' && Math.random() < 0.20) {
                    const selfDmg = Math.floor(result.damage * 0.30);
                    await db.execute('UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?', [selfDmg, userId]);
                    reply += `┃◆ ☠️ Chaos backfires — ${selfDmg} damage to yourself!\n`;
                }

                if (activeTurnEffect?.effect === 'berserk') {
                    reply = reply.replace(/HP: \d+\/\d+/, 'HP: ???/???');
                }
            } catch(e) {}

            // Echo brew
            try {
                const echoFx = getEffect(userId, dungeon?.id);
                if (echoFx?.effect === 'echo_skill') {
                    consumeCharge(userId);
                    const echoDmg = Math.floor(result.damage * (echoFx.data.power || 0.8));
                    await db.execute('UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?', [echoDmg, targetEnemy?.id]);
                    reply += `┃◆ 🔁 Echo: ${move.name} repeats — ${echoDmg} damage!\n`;
                }
            } catch(e) {}

            // Clan blessings
            if (dungeon) {
                const newPlayerHp = result.playerHp || player.hp;
                if (newPlayerHp > 0 && newPlayerHp < player.max_hp * 0.3) {
                    await triggerBlessingIfReady('hp_below_30', userId, dungeon.id, player, dungeon, msg);
                }
                if (result.enemyHp > 0 && result.enemyMaxHp > 0) {
                    const pct = result.enemyHp / result.enemyMaxHp;
                    if (pct <= 0.25) {
                        await triggerBlessingIfReady('enemy_below_25', userId, dungeon.id, player, dungeon, msg, { enemy: { id: result.enemyId || targetEnemy?.id, current_hp: result.enemyHp, max_hp: result.enemyMaxHp, name: result.enemyName } });
                    }
                }
                if (result.defeated || result.enemyDefeated) {
                    await triggerBlessingIfReady('on_kill', userId, dungeon.id, player, dungeon, msg);
                }
                const blessingState = await getPlayerBlessingState(userId, dungeon.id).catch(() => null);
                if (blessingState && blessingState.skill_count === 0) {
                    await triggerBlessingIfReady('stage_first_move', userId, dungeon.id, player, dungeon, msg);
                }
                if (dungeon.stage === dungeon.max_stage) {
                    await triggerBlessingIfReady('final_stage', userId, dungeon.id, player, dungeon, msg);
                }
                try {
                    const [aliveRows] = await db.execute(
                        'SELECT p.hp, p.max_hp FROM dungeon_players dp JOIN players p ON p.id=dp.player_id WHERE dp.dungeon_id=? AND dp.is_alive=1',
                        [dungeon.id]
                    );
                    if (aliveRows.length > 1 && aliveRows.every(r => r.hp < r.max_hp * 0.5)) {
                        await triggerBlessingIfReady('all_allies_below_50', userId, dungeon.id, player, dungeon, msg);
                    }
                } catch(e) {}
            }

            if (targetEnemy.def > 0) {
                const defenseMsg = narrate('defenseBlock', { target: targetEnemy.name, blocked: Math.floor(targetEnemy.def / 2) });
                reply += `┃◆ 🛡️ ${defenseMsg}\n`;
            }

            // ── MALACHAR PHASE TRANSITIONS ──────────────────────────────────
            // Uses malacharPhase system — ATK always scaled from base, never compounds
            if (dungeon.dungeon_rank === 'MALACHAR' && targetEnemy?.name === 'Malachar' && result.enemyHp > 0) {
                try {
                    await checkPhaseTransition(dungeon.id, result.enemyHp, client, RAID_GROUP);
                } catch(phaseErr) { console.error('[MalacharPhase]', phaseErr.message); }
            }

            if (result.defeated) {
                (async () => {
                    try {
                        const [dungeonCheck] = await db.execute(
                            "SELECT stage_cleared, dungeon_rank, stage, max_stage FROM dungeon WHERE id=? AND is_active=1",
                            [dungeon.id]
                        );
                        const isFinalStage = dungeonCheck[0]?.stage >= dungeonCheck[0]?.max_stage;
                        if (dungeonCheck[0]?.stage_cleared && isFinalStage) {
                            try {
                                const [raiders] = await db.execute(
                                    "SELECT player_id FROM dungeon_players WHERE dungeon_id=?",
                                    [dungeon.id]
                                );
                                const raiderIds = raiders.map(r => r.player_id);
                                const mvpResult = await calculateMvp(`dungeon_${dungeon.id}`, raiderIds, 'dungeon');
                                if (mvpResult?.message) {
                                    await client.sendMessage(RAID_GROUP, { text: mvpResult.message }).catch(() => {});
                                }
                            } catch(mvpErr) { console.error('[MVP] error:', mvpErr.message); }
                        }
                        if (!dungeonCheck.length || !dungeonCheck[0].stage_cleared) return;

                        const [alivePlayers] = await db.execute(
                            "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND is_alive=1",
                            [dungeon.id]
                        );

                        const drops = [];
                        for (const p of alivePlayers) {
                            const drop = await rollMaterialDrop(dungeonCheck[0].dungeon_rank, p.player_id, client, RAID_GROUP);
                            if (!drop) continue;
                            const emoji = drop.rarity === 'legendary' ? '🟣' : drop.rarity === 'rare' ? '🔵' : drop.rarity === 'uncommon' ? '🟢' : '⚪';
                            drops.push({ material: drop.material, rarity: drop.rarity, emoji });
                        }
                        if (!drops.length) return;

                        const qualifiedIds = getRankedContributors(dungeon.id).map(r => r.playerId);
                        clearStage(dungeon.id);
                        const dropPool = drops.map((d, i) => ({ ...d, index: i, takenBy: [] }));
                        setStagePool(dungeon.id, dropPool, qualifiedIds);

                        const isPrestigeLoot = dungeonCheck[0].dungeon_rank?.startsWith('P');
                        let text = isPrestigeLoot
                            ? `╔══〘 ✦ VOID LOOT 〙══╗\n┃★ \n`
                            : `══〘 💎 STAGE LOOT 〙══╮\n┃◆ \n`;
                        if (isPrestigeLoot) {
                            dropPool.forEach((d, i) => { text += `┃★ ${i + 1}. ${d.emoji} *${d.material}* [${d.rarity.toUpperCase()}]\n`; });
                            text += `┃★ \n┃★ !pickup <number> to collect\n┃★ All Prestige Hunters can pick each item!\n╚═══════════════════════════╝`;
                        } else {
                            dropPool.forEach((d, i) => { text += `┃◆ ${i + 1}. ${d.emoji} *${d.material}* [${d.rarity.toUpperCase()}]\n`; });
                            text += `┃◆ \n┃◆ !pickup <number> to collect\n┃◆ All raiders can pick each item!\n╰═══════════════════════╯`;
                        }
                        await client.sendMessage(RAID_GROUP, { text });
                    } catch(e) { console.error('Stage drop error:', e.message); }
                })();

                const defeatMsg = narrate('enemyDefeat', { enemy: targetEnemy.name });
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
                try {
                    const immuneFx2 = getTurnEffect ? getTurnEffect(userId) : null;
                    if (['immunity','invisibility','time_freeze'].includes(immuneFx2?.effect)) {
                        reply += `┃◆────────────\n┃◆ 🛡️ Protected — no retaliation this turn.\n`;
                    } else {
                        reply += `┃◆────────────\n┃◆ ${result.retaliationMessage}\n`;
                        reply += `┃◆ ${player.nickname} reels from the counter: ${result.retaliation} damage (HP: ${result.playerHp}/${player.max_hp})\n`;
                    }
                } catch(e2) {
                    reply += `┃◆────────────\n┃◆ ${result.retaliationMessage}\n`;
                    reply += `┃◆ ${player.nickname} reels from the counter: ${result.retaliation} damage (HP: ${result.playerHp}/${player.max_hp})\n`;
                }
            }

            if (result.playerDied) {
                try {
                    const mirrorFx2 = getEffect ? getEffect(userId, dungeon?.id) : null;
                    if (mirrorFx2?.effect === 'death_reflect' && targetEnemy?.id) {
                        await db.execute('UPDATE dungeon_enemies SET current_hp = 0 WHERE id=?', [targetEnemy.id]);
                        consumeCharge(userId);
                        reply += `┃◆ 🪞 Mirror Toxin — the killing blow rebounds! ${targetEnemy.name} is destroyed!\n`;
                    }
                } catch(e2) {}

                let lostMsg = '';
                try {
                    const [sess] = await db.execute('SELECT session_gold, session_xp FROM dungeon_players WHERE player_id=? AND dungeon_id=?', [userId, dungeon.id]);
                    const lg = sess[0]?.session_gold || 0;
                    const lx = sess[0]?.session_xp   || 0;
                    if (lg > 0 || lx > 0) lostMsg = `┃◆ 💸 Lost: ${lg.toLocaleString()}G  ⭐${lx.toLocaleString()}XP\n`;
                } catch(e) {}

                const bul = dungeon.dungeon_rank?.startsWith('P') ? '┃★' : '┃◆';
                reply += `${bul}────────────\n${bul} ☠️ ${player.nickname} has fallen.\n${lostMsg}${bul} Use !respawn to return.\n`;

                try {
                    // FIX: check phantom shift BEFORE demoting, so we can skip demotion on revival
                    const phantomResult = await triggerBlessingIfReady('on_death', userId, dungeon.id, player, dungeon, msg);
                    if (phantomResult) {
                        // Revived — restore HP and alive status, do NOT demote
                        await db.execute('UPDATE players SET hp = GREATEST(1, FLOOR(max_hp * 0.6)) WHERE id=?', [userId]);
                        await db.execute('UPDATE dungeon_players SET is_alive=1 WHERE player_id=? AND dungeon_id=?', [userId, dungeon.id]);
                        // Skip the demote below — player is alive again
                    } else {
                        // Truly dead — demote now
                        try { await demoteRaider(client, userId); } catch(e2) { console.error('Demote failed:', e2.message); }
                    }
                } catch(e) { console.error('Phantom shift error:', e.message); }

                const [aliveCheck] = await db.execute(
                    'SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=? AND is_alive=1',
                    [dungeon.id]
                );
                if (aliveCheck[0].cnt === 0) {
                    await db.execute('UPDATE dungeon SET is_active=0, locked=0 WHERE id=?', [dungeon.id]);
                    const { clearDungeonTimers } = require('../engine/dungeonTimer');
                    clearDungeonTimers(dungeon.id);
                    const { clearMalacharPhase } = require('../systems/malacharPhase');
                    clearMalacharPhase(dungeon.id);
                    const { trySpawnPrestigeDungeon: spawnPrestige } = require('../engine/prestigeDungeon');
                    if (!dungeon.dungeon_rank?.startsWith('P')) {
                        spawnPrestige(client, RAID_GROUP).catch(e => console.error('★ Prestige spawn error (skill):', e.message));
                    }
                    reply += `┃◆────────────\n┃◆ 💀 All hunters have fallen.\n┃◆ The dungeon collapses.\n`;
                }
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
                    type: 'shield', stat: 'shield', value: shieldValue, duration: move.duration || 3
                });
                actualCd = setMoveCooldown(userId, move.name, move.cooldown || 4, player.rank);
                const shieldMsg = narrate('shield', { caster: player.nickname, target: targetPlayer.nickname, move: move.name, value: shieldValue, duration: move.duration || 3 });

                // FIX: Reward caster for shielding in dungeon
                if (dungeon) {
                    const shieldReward = Math.floor(shieldValue * 0.05);
                    await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [shieldReward, userId]).catch(() => {});
                    await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [shieldReward, userId]).catch(() => {});
                    await db.execute(
                        'UPDATE dungeon_players SET session_gold = session_gold + ?, session_xp = session_xp + ? WHERE player_id=? AND dungeon_id=?',
                        [shieldReward, shieldReward, userId, dungeon.id]
                    ).catch(() => {});
                    try { mvpRecordHeal(dungeon.id, userId, shieldValue); } catch(e) {}
                    try { trackContribution(dungeon.id, userId, player.nickname, 'shield', shieldValue); } catch(e) {}
                }

                return msg.reply(`══〘 🛡️ SHIELD 〙══╮\n┃◆ ${shieldMsg}\n┃◆ Cooldown: ${actualCd}s\n╰═══════════════════════╯`);
            }

            if (move.type === 'buff') {
                const statName = move.effect.toLowerCase().replace(/_up$/, '');
                applyBuff('player', targetPlayer.id, {
                    type: 'buff', stat: statName, value: move.value, duration: move.duration || 3
                });
                actualCd = setMoveCooldown(userId, move.name, move.cooldown || 4, player.rank);
                const buffMsg = narrate('buff', { caster: player.nickname, target: targetPlayer.nickname, move: move.name, stat: move.effect, value: move.value, duration: move.duration || 3 });

                if (dungeon) {
                    const buffReward = Math.floor((move.value || 20) * 2);
                    await db.execute('UPDATE currency SET gold = gold + ? WHERE player_id=?', [buffReward, userId]).catch(() => {});
                    await db.execute('UPDATE xp SET xp = xp + ? WHERE player_id=?', [buffReward, userId]).catch(() => {});
                    await db.execute(
                        'UPDATE dungeon_players SET session_gold = session_gold + ?, session_xp = session_xp + ? WHERE player_id=? AND dungeon_id=?',
                        [buffReward, buffReward, userId, dungeon.id]
                    ).catch(() => {});
                    try { trackContribution(dungeon.id, userId, player.nickname, 'buff', 1); } catch(e) {}
                }
                return msg.reply(`══〘 ⬆️ BUFF 〙══╮\n┃◆ ${buffMsg}\n┃◆ Cooldown: ${actualCd}s\n╰═══════════════════════╯`);
            }
        }

        // ==================== DEBUFF ====================
        if (move.type === 'debuff') {
            if (!dungeon) return msg.reply("❌ No active dungeon.");
            if (!dungeon.locked) return msg.reply("❌ Dungeon hasn't started.");
            const enemies = await getCurrentEnemies(dungeon.id);
            if (enemies.length === 0) return msg.reply("✅ No enemies.");
            let targetEnemy = targetArg ? await findEnemyTarget(dungeon.id, targetArg) : enemies[0];
            if (!targetEnemy) return msg.reply(`❌ Enemy "${targetArg}" not found.`);

            const statName = move.effect.toLowerCase();
            applyBuff('enemy', targetEnemy.id, {
                type: 'debuff', stat: statName, value: -move.value, duration: move.duration || 2
            });
            const actualCd = setMoveCooldown(userId, move.name, move.cooldown || 3, player.rank);
            const debuffMsg = narrate('debuff', { caster: player.nickname, target: targetEnemy.name, move: move.name, stat: move.effect, value: move.value, duration: move.duration || 2 });
            try { if (dungeon) trackContribution(dungeon.id, userId, player.nickname, 'debuff', 1); } catch(e) {}

            if (move.name && move.name.toLowerCase().includes('taunt')) {
                try { if (dungeon) trackContribution(dungeon.id, userId, player.nickname, 'taunt', 1); } catch(e) {}
                const tauntDuration = 3 * 30000;
                tauntState.set(dungeon.id, { tankId: userId, expires: Date.now() + tauntDuration });
            }
            return msg.reply(`══〘 ⬇️ DEBUFF 〙══╮\n┃◆ ${debuffMsg}\n┃◆ Cooldown: ${actualCd}s\n╰═══════════════════════╯`);
        }

        // ==================== DOT ====================
        if (move.type === 'dot') {
            if (!dungeon) return msg.reply(`══〘 ☠️ POISON 〙══╮\n┃◆ ❌ Only usable in dungeons.\n╰═══════════════════════╯`);
            const enemies = await getCurrentEnemies(dungeon.id);
            if (!enemies.length) return msg.reply(`══〘 ☠️ POISON 〙══╮\n┃◆ ❌ No enemies to target.\n╰═══════════════════════╯`);
            const target = enemies[0];

            const dotDamage = Math.floor((player[move.stat] || player.agility) * (move.multiplier || 0.4));
            const duration = move.duration || 3;

            applyBuff('enemy', target.id, { type: 'dot', stat: 'hp', value: dotDamage, duration });

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
      } catch(err) {
        console.error("skill.js error:", err.message, err.stack);
        return msg.reply("❌ Something went wrong using that skill. Check bot logs.");
      }
    }
};