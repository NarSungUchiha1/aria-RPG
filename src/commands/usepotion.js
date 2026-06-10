const db = require('../database/db');
const { POTIONS } = require('../systems/potions');
const { getActiveDungeon, isPlayerInDungeon, getCurrentEnemies, isPlayerInAnyDungeon } = require('../engine/dungeon');
const {
    setEffect, getEffect, clearEffect, setTurnEffect, getTurnEffect,
    getDeaths, getHpLost
} = require('../systems/potionEffects');
const { RAID_GROUP } = require('../engine/dungeon');

// Potions that can be used outside of a dungeon
const OUT_OF_DUNGEON_OK = new Set([
    'Abyss Sight',
    'Soul Anchor',
    'Ichor of the Fallen',
    'Void Resonance',
    'The Last Drink',      // FIX: can prep before dungeon
    'Mirror Toxin',        // FIX: can prep before dungeon
    'Soul Harvest',        // FIX: can prep before dungeon
    'Phantom Draught',     // FIX: can prep before dungeon
    'Eclipse Draught',     // FIX: can prep before dungeon
    'Shattered Time',      // FIX: can prep before dungeon
    'Crimson Tide',        // FIX: can prep before dungeon
    "Malachar's Hunger",   // FIX: can prep before dungeon
]);

module.exports = {
    name: 'usepotion',
    aliases: ['usepotion'],
    async execute(msg, args, { userId, client }) {
        try {
            const potionNames = Object.keys(POTIONS);
            let potionName = null;

            const num = parseInt(args[0]);
            if (!isNaN(num) && potionNames[num - 1]) {
                potionName = potionNames[num - 1];
            } else {
                const nameArg = args.join(' ').toLowerCase();
                potionName = potionNames.find(n => n.toLowerCase().includes(nameArg));
            }

            if (!potionName) {
                // Show inventory
                const [inv] = await db.execute(
                    "SELECT potion_name, quantity FROM potion_inventory WHERE player_id=? AND quantity > 0 ORDER BY potion_name",
                    [userId]
                );
                if (!inv.length) return msg.reply(
                    `══〘 🧪 POTIONS 〙══╮\n┃◆ You have no potions.\n┃◆ !potionmarket to browse.\n╰═══════════════════════╯`
                );
                let text = `╔══〘 🧪 YOUR POTIONS 〙══╗\n┃◆\n`;
                inv.forEach((p, i) => {
                    const pot = POTIONS[p.potion_name];
                    text += `┃◆ ${i+1}. *${p.potion_name}* ×${p.quantity}\n┃◆    ${pot?.desc || ''}\n┃◆\n`;
                });
                text += `┃◆ !usepotion <number or name>\n╚═══════════════════════════╝`;
                return msg.reply(text);
            }

            const potion = POTIONS[potionName];

            // Check inventory
            const [inv] = await db.execute(
                "SELECT quantity FROM potion_inventory WHERE player_id=? AND potion_name=?",
                [userId, potionName]
            );
            if (!inv.length || inv[0].quantity < 1) return msg.reply(
                `══〘 🧪 USE POTION 〙══╮\n┃◆ ❌ You don't have *${potionName}*.\n╰═══════════════════════╯`
            );

            const [player] = await db.execute("SELECT * FROM players WHERE id=?", [userId]);
            if (!player.length) return msg.reply("❌ Not registered.");
            const p = player[0];

            // Prestige check
            if (potion.prestige && !(p.prestige_level > 0)) return msg.reply(
                `══〘 🧪 USE POTION 〙══╮\n┃◆ ❌ Prestige players only.\n╰═══════════════════════╯`
            );

            // FIX: find the dungeon the player is actually in (handles territory dungeons)
            const playerDungeonId = await isPlayerInAnyDungeon(userId);
            let dungeon = null;
            if (playerDungeonId) {
                const [dRows] = await db.execute('SELECT * FROM dungeon WHERE id=?', [playerDungeonId]);
                dungeon = dRows[0] || null;
            }
            if (!dungeon) dungeon = await getActiveDungeon(true);
            const inDungeon = dungeon ? await isPlayerInDungeon(userId, dungeon.id) : false;
            // Use 'pvp' as dungeonId key when player is in a territory war or duel
            const { isPlayerInDuel } = require('../systems/pvpsystem');
            const inDuel = isPlayerInDuel(userId);
            const dungeonId = inDungeon ? dungeon.id : (inDuel ? 'pvp' : null);

            // Dungeon requirement check
            const canUseOutside = OUT_OF_DUNGEON_OK.has(potionName);
            if (!canUseOutside && !inDungeon) return msg.reply(
                `══〘 🧪 USE POTION 〙══╮\n┃◆ ❌ *${potionName}* can only be used\n┃◆    inside an active dungeon.\n╰═══════════════════════╯`
            );

            // Special condition checks
            if (potionName === 'The Last Drink') {
                const hpPercent = p.hp / p.max_hp;
                if (hpPercent > 0.1) return msg.reply(
                    `══〘 🧪 USE POTION 〙══╮\n┃◆ ❌ Only usable below 10% HP.\n┃◆ Current: ${Math.floor(hpPercent*100)}%\n╰═══════════════════════╯`
                );
            }
            if (potionName === 'Blood Price') {
                const cost = Math.floor(p.hp * 0.4);
                if (p.hp - cost <= 0) return msg.reply(
                    `══〘 🧪 USE POTION 〙══╮\n┃◆ ❌ Not enough HP to pay the price.\n╰═══════════════════════╯`
                );
            }
            if (potionName === 'Grave Debt') {
                const hpLost = getHpLost(userId, dungeonId);
                if (!hpLost || hpLost <= 0) return msg.reply(
                    `══〘 🧪 USE POTION 〙══╮\n┃◆ ❌ You haven't lost any HP this dungeon yet.\n╰═══════════════════════╯`
                );
            }

            // FIX: Check if player already has an active effect of this type
            const existingEffect = getEffect(userId, dungeonId);
            const existingTurn  = getTurnEffect(userId);
            const wouldOverwrite = existingEffect || existingTurn;
            // Allow stacking only for specific combos — for most warn but still apply

            // Consume potion
            await db.execute(
                "UPDATE potion_inventory SET quantity = quantity - 1 WHERE player_id=? AND potion_name=?",
                [userId, potionName]
            );

            let effectMsg = '';
            let groupMsg  = ''; // sent to RAID_GROUP if needed

            // ── APPLY EFFECTS ────────────────────────────────────────────────
            switch (potion.effect) {

                // ── DEATH PROTECT (Ichor of the Fallen) ──────────────────────
                // FIX: Never implemented — set the effect, checked in death handler below
                case 'death_protect':
                    setEffect(userId, dungeonId, potionName, 'death_protect', {}, 1);
                    effectMsg = `☠️ Death protection active. If you die this run — keep ALL gold and XP.`;
                    break;

                // ── TRUE DAMAGE (Eclipse Draught) ─────────────────────────────
                case 'true_damage':
                    setTurnEffect(userId, 'true_damage', potion.turns || 5, {});
                    effectMsg = `⚫ True damage — next ${potion.turns} attacks bypass ALL defense and shields.`;
                    break;

                // ── DAMAGE LINK (Bloodpact Serum) ─────────────────────────────
                case 'damage_link': {
                    if (!inDungeon) { effectMsg = `❌ Must be in dungeon.`; break; }
                    const [allies] = await db.execute(
                        "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND player_id != ? AND is_alive=1 LIMIT 1",
                        [dungeonId, userId]
                    );
                    if (!allies.length) { effectMsg = `❌ No ally in dungeon to link with.`; break; }
                    const linkTarget = allies[0].player_id;
                    setEffect(userId, dungeonId, potionName, 'damage_link', { linkTarget });
                    setEffect(linkTarget, dungeonId, potionName, 'damage_link', { linkTarget: userId });
                    const [allyRow] = await db.execute("SELECT nickname FROM players WHERE id=?", [linkTarget]);
                    effectMsg = `🩸 Bloodpact active — damage shared 50/50 with *${allyRow[0]?.nickname || linkTarget}* for entire run.`;
                    groupMsg  = `🩸 *${p.nickname}* and *${allyRow[0]?.nickname || linkTarget}* are now blood-linked. Shared damage 50/50.`;
                    break;
                }

                // ── BERSERK (Void Madness) ─────────────────────────────────────
                // FIX: Damage multiplier is applied in skillSystem. HP display hidden in skill.js reply.
                case 'berserk':
                    setTurnEffect(userId, 'berserk', potion.turns || 5, { mult: 1 + (potion.stat_boost || 2.0) });
                    effectMsg = `🔥 VOID MADNESS — +200% damage for ${potion.turns} turns.\n┃◆ ⚠️ Your HP is now hidden — you cannot see it until it wears off.`;
                    break;

                // ── AUTO REVIVE (Soul Anchor) ─────────────────────────────────
                case 'auto_revive':
                    setEffect(userId, dungeonId, potionName, 'auto_revive', { heal: potion.heal_percent || 0.5 });
                    effectMsg = `⚓ Soul Anchor set — if you die you resurrect once at ${Math.floor((potion.heal_percent||0.5)*100)}% HP with no penalty.`;
                    break;

                // ── DOUBLE STRIKE (Phantom Draught) ───────────────────────────
                case 'double_strike':
                    setTurnEffect(userId, 'double_strike', potion.turns || 3, { chance: potion.chance || 0.4, hits: 2 });
                    effectMsg = `👻 Phantom Draught — ${potion.turns} turns. Each attack has ${Math.floor((potion.chance||0.4)*100)}% chance to hit TWICE.`;
                    break;

                // ── HP STEAL (Malachar's Hunger) ───────────────────────────────
                case 'hp_steal_first':
                    setEffect(userId, dungeonId, potionName, 'hp_steal_first', { percent: potion.steal_percent || 0.3, overflow: true });
                    effectMsg = `🍖 Malachar's Hunger — steal ${Math.floor((potion.steal_percent||0.3)*100)}% of each enemy's current HP on first hit per stage.\n┃◆ ⚠️ Overflow damage reflects back at you.`;
                    break;

                // ── CLAN BOOST (Void Resonance) ────────────────────────────────
                case 'clan_boost': {
                    const [dunMembers] = await db.execute(
                        "SELECT dp.player_id, pl.nickname FROM dungeon_players dp JOIN players pl ON pl.id=dp.player_id WHERE dp.dungeon_id=? AND dp.is_alive=1",
                        [dungeonId]
                    );
                    const targets = dunMembers.length ? dunMembers : [{ player_id: userId, nickname: p.nickname }];
                    for (const m of targets) {
                        setTurnEffect(m.player_id, 'stat_boost', 999, { mult: potion.stat_mult || 1.25 });
                    }
                    const names = targets.map(m => m.nickname).join(', ');
                    effectMsg = `🌀 Void Resonance — ALL allies in dungeon +25% damage for entire run.\n┃◆ Affected: ${names}`;
                    if (targets.length > 1) groupMsg = `🌀 *${p.nickname}* used Void Resonance — all raiders get +25% damage this run!`;
                    break;
                }

                // ── NO COOLDOWN (Shattered Time) ───────────────────────────────
                case 'no_cooldown':
                    setTurnEffect(userId, 'no_cooldown', potion.turns || 3, {});
                    effectMsg = `⏰ Shattered Time — ALL skill cooldowns ignored for ${potion.turns} turns.`;
                    break;

                // ── BLOOD PRICE (hp_to_damage) ─────────────────────────────────
                // FIX: Deducts HP immediately, stores bonus for next hit
                case 'hp_to_damage': {
                    const cost   = Math.floor(p.hp * 0.4);
                    await db.execute("UPDATE players SET hp = GREATEST(1, hp - ?) WHERE id=?", [cost, userId]);
                    setEffect(userId, dungeonId, potionName, 'hp_to_damage', { bonus: cost }, 1);
                    const hpAfter  = Math.max(1, p.hp - cost);
                    const critical = hpAfter <= Math.floor(p.max_hp * 0.1);
                    effectMsg = `🩸 Blood Price — ${cost} HP sacrificed.\n┃◆ HP: ${p.hp} → ${hpAfter}/${p.max_hp}\n┃◆ Next hit deals +${cost} bonus true damage.${critical ? '\n┃◆ ⚠️ CRITICAL HP — be careful.' : ''}`;
                    break;
                }

                // ── LAST STAND (The Last Drink) ────────────────────────────────
                case 'last_stand': {
                    await db.execute("UPDATE players SET hp = max_hp WHERE id=?", [userId]);
                    setTurnEffect(userId, 'immunity', 2, {});
                    effectMsg = `🔱 The Last Drink — HP fully restored to ${p.max_hp}/${p.max_hp}.\n┃◆ 🛡️ Invincible for 2 turns.`;
                    break;
                }

                // ── ENEMY REVEAL (Abyss Sight) ─────────────────────────────────
                case 'enemy_reveal': {
                    setEffect(userId, dungeonId, potionName, 'enemy_reveal', {});
                    if (!inDungeon || !dungeonId) {
                        effectMsg = `🔍 Abyss Sight ready — enemy intel will show on your first dungeon entry.`;
                        break;
                    }
                    const [enemies] = await db.execute(
                        "SELECT name, current_hp, max_hp, atk, def, evasion, moves FROM dungeon_enemies WHERE dungeon_id=? AND current_hp>0",
                        [dungeonId]
                    );
                    if (!enemies.length) { effectMsg = `🔍 Abyss Sight — no enemies currently in stage.`; break; }
                    let reveal = `╔══〘 🔍 ABYSS SIGHT 〙══╗\n┃◆\n`;
                    enemies.forEach(e => {
                        let moveNames = '—';
                        try {
                            const mv = typeof e.moves === 'string' ? JSON.parse(e.moves) : e.moves;
                            if (Array.isArray(mv) && mv.length) moveNames = mv.map(m => `${m.name}(×${m.damage})`).join(', ');
                        } catch(_) {}
                        reveal +=
                            `┃◆ ▸ *${e.name}*\n` +
                            `┃◆   ❤️ ${e.current_hp}/${e.max_hp}  ⚔️ ${e.atk}  🛡️ ${e.def}  💨 ${e.evasion||0}%\n` +
                            `┃◆   🗡️ ${moveNames}\n┃◆\n`;
                    });
                    reveal += `╚═══════════════════════════╝`;
                    return msg.reply(reveal);
                }

                // ── CHAOS MODE (Cursed Ichor) ──────────────────────────────────
                case 'chaos_mode':
                    setTurnEffect(userId, 'chaos_mode', potion.turns || 5, { amp: potion.damage_amp || 0.5 });
                    effectMsg = `☠️ Cursed Ichor — ALL damage +50% for ${potion.turns} turns.\n┃◆ ⚠️ This includes damage YOU take. High risk, high reward.`;
                    groupMsg  = `☠️ *${p.nickname}* drank Cursed Ichor — all damage in dungeon amplified for ${potion.turns} turns!`;
                    break;

                // ── IMMUNITY (Wraith Form) ─────────────────────────────────────
                case 'immunity':
                    setTurnEffect(userId, 'immunity', potion.turns || 2, {});
                    effectMsg = `👻 Wraith Form — completely immune to all attacks for ${potion.turns} turns.\n┃◆ Enemy retaliation passes through you.`;
                    break;

                // ── ECHO SKILL (Echo Brew) ─────────────────────────────────────
                case 'echo_skill':
                    setEffect(userId, dungeonId, potionName, 'echo_skill', { power: potion.power || 0.8 }, 1);
                    effectMsg = `🔁 Echo Brew — your next skill will automatically repeat at ${Math.floor((potion.power||0.8)*100)}% power.`;
                    break;

                // ── REDIRECT AGGRO (Void Puppeteer) ───────────────────────────
                // FIX: Was setTurnEffect but effect key in dungeon.js checks getEffect, not getTurnEffect
                case 'redirect_aggro':
                    setEffect(userId, dungeonId, potionName, 'redirect_aggro', {});
                    effectMsg = `🎭 Void Puppeteer — enemy retaliations are redirected away from you for 3 turns.\n┃◆ Allies absorb the misdirected strikes.`;
                    break;

                // ── WOUND DAMAGE (Grave Debt) ──────────────────────────────────
                // FIX: Was set correctly but never applied in skill.js — handled below in the reply
                // The effect is checked in skill.js via bpFx — need to use same key
                case 'wound_damage': {
                    const hpLost = getHpLost(userId, dungeonId);
                    const bonus  = hpLost * 5;
                    setEffect(userId, dungeonId, potionName, 'hp_to_damage', { bonus }, 1);
                    effectMsg = `⚔️ Grave Debt — ${hpLost} HP lost this dungeon × 500% = +${bonus} bonus damage on next hit.`;
                    break;
                }

                // ── DEATH REFLECT (Mirror Toxin) ───────────────────────────────
                case 'death_reflect':
                    setEffect(userId, dungeonId, potionName, 'death_reflect', {}, 1);
                    effectMsg = `🪞 Mirror Toxin — the next hit that would kill you reflects back and destroys the attacker instead.`;
                    break;

                // ── INVISIBILITY (Forgotten Name) ──────────────────────────────
                case 'invisibility':
                    setTurnEffect(userId, 'invisibility', potion.turns || 2, {});
                    effectMsg = `🫥 Forgotten Name — enemies completely ignore you for ${potion.turns} turns. No retaliation.`;
                    break;

                // ── LIFESTEAL (Crimson Tide) ────────────────────────────────────
                case 'lifesteal':
                    setTurnEffect(userId, 'lifesteal', 999, { percent: potion.percent || 0.25 });
                    effectMsg = `🩸 Crimson Tide — heal ${Math.floor((potion.percent||0.25)*100)}% of every hit as HP for this entire stage.`;
                    break;

                // ── STRIP ALL BUFFS (The Unravelling) ─────────────────────────
                // FIX: Was zeroing def in DB permanently. Now uses activeBuffs for temp DEF wipe.
                case 'strip_all': {
                    if (!inDungeon || !dungeonId) { effectMsg = `❌ Must be in dungeon.`; break; }
                    const enemies = await getCurrentEnemies(dungeonId);
                    if (!enemies.length) { effectMsg = `❌ No active enemies.`; break; }
                    const { applyBuff } = require('../systems/activeBuffs');
                    for (const e of enemies) {
                        // Apply a massive temporary DEF debuff (effectively zeroes it)
                        applyBuff('enemy', e.id, { type: 'debuff', stat: 'defense', value: -9999, duration: 99 });
                    }
                    effectMsg = `🌪️ The Unravelling — every enemy in this stage has been stripped of ALL defenses.\n┃◆ ⚠️ Effect lasts until stage ends.`;
                    groupMsg  = `🌪️ *${p.nickname}* used The Unravelling — all enemy DEF is gone!`;
                    break;
                }

                // ── TIME FREEZE (Eternity Shard Brew) ─────────────────────────
                case 'time_freeze':
                    setTurnEffect(userId, 'time_freeze', potion.turns || 2, {});
                    effectMsg = `⏳ Eternity Shard Brew — time frozen for ${potion.turns} turns.\n┃◆ You act freely. Enemies cannot retaliate.`;
                    break;

                // ── KILL HP GAIN (Soul Harvest) ────────────────────────────────
                case 'kill_hp_gain':
                    setEffect(userId, dungeonId, potionName, 'kill_hp_gain', { percent: potion.hp_percent || 0.1 });
                    effectMsg = `🌱 Soul Harvest — on each enemy kill gain ${Math.floor((potion.hp_percent||0.1)*100)}% of their max HP until the dungeon ends.`;
                    break;

                // ── DEF SHATTER (Fracture Bomb) ────────────────────────────────
                // FIX: Was applying a def_shatter effect that was never read in combat.
                // Now directly reduces enemy DEF in DB for this dungeon (permanent for the run),
                // and applies a real debuff to the player via activeBuffs.
                case 'def_shatter': {
                    if (!inDungeon || !dungeonId) { effectMsg = `❌ Must be in dungeon.`; break; }
                    const enemies2 = await getCurrentEnemies(dungeonId);
                    if (!enemies2.length) { effectMsg = `❌ No active enemies.`; break; }
                    // FIX: Apply 80% DEF reduction directly to the DB — persists through stages
                    await db.execute(
                        "UPDATE dungeon_enemies SET def = GREATEST(0, FLOOR(def * 0.2)) WHERE dungeon_id=? AND current_hp > 0",
                        [dungeonId]
                    );
                    // Also apply player defense debuff
                    const { applyBuff: ab } = require('../systems/activeBuffs');
                    ab('player', userId, { type: 'debuff', stat: 'defense', value: -20, duration: 3 });
                    effectMsg = `💥 Fracture Bomb detonated!\n┃◆ All enemy DEF reduced by 80% for this dungeon.\n┃◆ ⚠️ Your own DEF -20 for 3 turns (side effect).`;
                    groupMsg  = `💥 *${p.nickname}* used Fracture Bomb — all enemy armor shattered!`;
                    break;
                }

                // ── DEATH STACK (The Reckoning) ────────────────────────────────
                case 'death_stack': {
                    const deaths = getDeaths(userId, dungeonId);
                    const mult   = 1 + deaths;
                    setEffect(userId, dungeonId, potionName, 'death_stack', { mult, maxHpPenalty: true }, 1);
                    effectMsg = `👁️ The Reckoning — ${deaths} death(s) recorded.\n┃◆ Next hit deals ${mult * 100}% damage (×${mult}).\n┃◆ ⚠️ Each death already cost you 5% max HP permanently.`;
                    break;
                }

                default:
                    effectMsg = `✅ ${potionName} activated.`;
            }

            // ── Send group announcement for group-wide effects ─────────────────
            if (groupMsg && client && RAID_GROUP) {
                client.sendMessage(RAID_GROUP, { text: groupMsg }).catch(() => {});
            }

            return msg.reply(
                `╔══〘 🧪 POTION USED 〙══╗\n` +
                `┃◆\n` +
                `┃◆ *${potionName}*\n` +
                `┃◆\n` +
                `┃◆ 〝${potion.lore}〞\n` +
                `┃◆\n` +
                `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃◆ ${effectMsg.replace(/\n/g, '\n')}\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error('usepotion error:', err);
            msg.reply('❌ Failed to use potion.');
        }
    }
};