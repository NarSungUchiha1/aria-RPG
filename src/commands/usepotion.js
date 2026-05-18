const db = require('../database/db');
const { POTIONS } = require('../systems/potions');
const { getActiveDungeon, isPlayerInDungeon } = require('../engine/dungeon');
const {
    setEffect, getEffect, setTurnEffect, getTurnEffect,
    getDeaths, getHpLost
} = require('../systems/potionEffects');

module.exports = {
    name: 'usepotion',
    aliases: ['use'],
    async execute(msg, args, { userId }) {
        try {
            // Find potion by number or name
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
                    `══〘 🧪 POTIONS 〙══╮\n┃◆ You have no potions.\n┃◆ !potionmarket to buy some.\n╰═══════════════════════╯`
                );
                let text = `╔══〘 🧪 YOUR POTIONS 〙══╗\n┃◆\n`;
                inv.forEach((p, i) => {
                    const pot = POTIONS[p.potion_name];
                    text += `┃◆ ${i+1}. *${p.potion_name}* ×${p.quantity}\n┃◆    ${pot?.desc || ''}\n┃◆\n`;
                });
                text += `┃◆ !usepotion <number>\n╚═══════════════════════════╝`;
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

            const [player] = await db.execute(
                "SELECT * FROM players WHERE id=?", [userId]
            );
            const p = player[0];

            // Prestige check
            if (potion.prestige && !(p.prestige_level > 0)) return msg.reply(
                `══〘 🧪 USE POTION 〙══╮\n┃◆ ❌ Prestige players only.\n╰═══════════════════════╯`
            );

            const dungeon = await getActiveDungeon();
            const inDungeon = dungeon ? await isPlayerInDungeon(userId, dungeon.id) : false;

            // Some potions require active dungeon
            const requiresDungeon = !['Abyss Sight', 'Soul Anchor', 'Ichor of the Fallen', 'Void Resonance'].includes(potionName);
            if (requiresDungeon && !inDungeon) return msg.reply(
                `══〘 🧪 USE POTION 〙══╮\n┃◆ ❌ Must be in a dungeon to use this.\n╰═══════════════════════╯`
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

            // Consume potion
            await db.execute(
                "UPDATE potion_inventory SET quantity = quantity - 1 WHERE player_id=? AND potion_name=?",
                [userId, potionName]
            );

            const dungeonId = dungeon?.id || null;
            let effectMsg = '';

            // ── APPLY EFFECTS ─────────────────────────────────────────────────
            switch (potion.effect) {

                case 'death_protect':
                    setEffect(userId, dungeonId, potionName, 'death_protect', {});
                    effectMsg = `☠️ Death protection active. Next death — keep everything.`;
                    break;

                case 'true_damage':
                    setTurnEffect(userId, 'true_damage', potion.turns || 5, {});
                    effectMsg = `⚫ True damage active for ${potion.turns} turns. All defense ignored.`;
                    break;

                case 'damage_link': {
                    // Link with a teammate in dungeon
                    const [allies] = await db.execute(
                        "SELECT player_id FROM dungeon_players WHERE dungeon_id=? AND player_id != ? AND is_alive=1 LIMIT 1",
                        [dungeonId, userId]
                    );
                    if (!allies.length) { effectMsg = `❌ No ally in dungeon to link with.`; break; }
                    const linkTarget = allies[0].player_id;
                    setEffect(userId, dungeonId, potionName, 'damage_link', { linkTarget });
                    setEffect(linkTarget, dungeonId, potionName, 'damage_link', { linkTarget: userId });
                    effectMsg = `🩸 Bloodpact active — damage shared 50/50 with your ally.`;
                    break;
                }

                case 'berserk':
                    setTurnEffect(userId, 'berserk', potion.turns || 5, { mult: 1 + (potion.stat_boost || 2.0) });
                    effectMsg = `🔥 VOID MADNESS — +200% damage. You cannot see your HP.`;
                    break;

                case 'auto_revive':
                    setEffect(userId, dungeonId, potionName, 'auto_revive', { heal: potion.heal_percent || 0.5 });
                    effectMsg = `⚓ Soul Anchor set — you will resurrect once if you die.`;
                    break;

                case 'double_strike':
                    setTurnEffect(userId, 'double_strike', potion.turns || 3, { chance: potion.chance || 0.4 });
                    effectMsg = `👻 ${potion.turns} turns — each hit has ${Math.floor((potion.chance||0.4)*100)}% chance to strike twice.`;
                    break;

                case 'hp_steal_first':
                    setEffect(userId, dungeonId, potionName, 'hp_steal_first', { percent: potion.steal_percent || 0.3, overflow: true });
                    effectMsg = `🍖 Malachar's Hunger active — steal ${Math.floor((potion.steal_percent||0.3)*100)}% HP on first hit. ⚠️ Overflow damage reflects back.`;
                    break;

                case 'clan_boost': {
                    const [clanMembers] = await db.execute(
                        "SELECT dp.player_id FROM dungeon_players dp WHERE dp.dungeon_id=? AND dp.is_alive=1",
                        [dungeonId]
                    );
                    for (const m of clanMembers) {
                        setTurnEffect(m.player_id, 'stat_boost', 999, { mult: potion.stat_mult || 1.25 });
                    }
                    effectMsg = `🌀 Void Resonance — ALL dungeon allies +25% stats for this run.`;
                    break;
                }

                case 'no_cooldown':
                    setTurnEffect(userId, 'no_cooldown', potion.turns || 3, {});
                    effectMsg = `⏰ Shattered Time — no cooldowns for ${potion.turns} turns.`;
                    break;

                case 'hp_to_damage': {
                    const cost = Math.floor(p.hp * 0.4);
                    await db.execute("UPDATE players SET hp = hp - ? WHERE id=?", [cost, userId]);
                    setEffect(userId, dungeonId, potionName, 'hp_to_damage', { bonus: cost }, 1);
                    const hpAfter = p.hp - cost;
                    const passOut = hpAfter <= Math.floor(p.max_hp * 0.1);
                    effectMsg = `🩸 Blood Price paid — ${cost} HP sacrificed. Next hit deals +${cost} bonus damage.${passOut ? ' ⚠️ You are critically low — next retaliation is doubled.' : ''}`;
                    break;
                }

                case 'last_stand': {
                    await db.execute("UPDATE players SET hp = max_hp WHERE id=?", [userId]);
                    setTurnEffect(userId, 'immunity', 2, {});
                    effectMsg = `🔱 The Last Drink — full HP restored. Invincible for 2 turns.`;
                    break;
                }

                case 'enemy_reveal': {
                    const enemies = await db.execute(
                        "SELECT name, current_hp, max_hp, atk, def FROM dungeon_enemies WHERE dungeon_id=? AND current_hp>0",
                        [dungeonId]
                    );
                    let reveal = `╔══〘 🔍 ABYSS SIGHT 〙══╗\n┃◆\n`;
                    enemies[0].forEach(e => {
                        reveal += `┃◆ ${e.name}\n┃◆   HP: ${e.current_hp}/${e.max_hp} ATK: ${e.atk} DEF: ${e.def}\n┃◆\n`;
                    });
                    reveal += `╚═══════════════════════════╝`;
                    setEffect(userId, dungeonId, potionName, 'enemy_reveal', {});
                    return msg.reply(reveal);
                }

                case 'chaos_mode':
                    setTurnEffect(userId, 'chaos_mode', potion.turns || 5, { amp: potion.damage_amp || 0.5 });
                    effectMsg = `☠️ Cursed Ichor — ALL damage taken and dealt +50% for ${potion.turns} turns.`;
                    break;

                case 'immunity':
                    setTurnEffect(userId, 'immunity', potion.turns || 2, {});
                    effectMsg = `👻 Wraith Form — completely immune for ${potion.turns} turns.`;
                    break;

                case 'echo_skill':
                    setEffect(userId, dungeonId, potionName, 'echo_skill', { power: potion.power || 0.8 }, 1);
                    effectMsg = `🔁 Echo Brew — your next skill will repeat at ${Math.floor((potion.power||0.8)*100)}% power.`;
                    break;

                case 'redirect_aggro':
                    setTurnEffect(userId, 'redirect_aggro', potion.turns || 3, {});
                    effectMsg = `🎭 Void Puppeteer active — enemies attack who you choose for ${potion.turns} turns.`;
                    break;

                case 'wound_damage': {
                    const hpLost = getHpLost(userId, dungeonId);
                    setEffect(userId, dungeonId, potionName, 'wound_damage', { bonus: hpLost * 5 }, 1);
                    effectMsg = `⚔️ Grave Debt — next hit deals +${hpLost * 5} bonus damage (500% of ${hpLost} HP lost).`;
                    break;
                }

                case 'death_reflect':
                    setEffect(userId, dungeonId, potionName, 'death_reflect', {}, 1);
                    effectMsg = `🪞 Mirror Toxin — the next hit that would kill you kills the attacker instead.`;
                    break;

                case 'invisibility':
                    setTurnEffect(userId, 'invisibility', potion.turns || 2, {});
                    effectMsg = `🫥 Forgotten Name — enemies ignore you for ${potion.turns} turns.`;
                    break;

                case 'lifesteal':
                    setTurnEffect(userId, 'lifesteal', 999, { percent: potion.percent || 0.25 });
                    effectMsg = `🩸 Crimson Tide — heal 25% of all damage dealt this stage.`;
                    break;

                case 'strip_all': {
                    await db.execute(
                        "UPDATE dungeon_enemies SET def = 0 WHERE dungeon_id=? AND current_hp>0",
                        [dungeonId]
                    );
                    effectMsg = `🌪️ The Unravelling — all enemy DEF stripped to zero.`;
                    break;
                }

                case 'time_freeze':
                    setTurnEffect(userId, 'time_freeze', potion.turns || 2, {});
                    effectMsg = `⏳ Eternity Shard Brew — time frozen. You act freely for ${potion.turns} turns.`;
                    break;

                case 'kill_hp_gain':
                    setEffect(userId, dungeonId, potionName, 'kill_hp_gain', { percent: potion.hp_percent || 0.1 });
                    effectMsg = `🌱 Soul Harvest active — gain 10% of each enemy's max HP on kill.`;
                    break;

                case 'def_shatter':
                    setEffect(userId, dungeonId, potionName, 'def_shatter', { reduction: potion.def_reduction || 0.8 }, 1);
                    try { const { applyBuff } = require('../systems/activeBuffs'); applyBuff('player', userId, { type: 'debuff', stat: 'defense_pct', value: -20, duration: 2 }); } catch(e2) {}
                    effectMsg = `💥 Fracture Bomb — enemy DEF -80%. ⚠️ Your DEF -20% for 2 turns.`;
                    break;

                case 'death_stack': {
                    const deaths = getDeaths(userId, dungeonId);
                    const mult   = 1 + deaths;
                    setEffect(userId, dungeonId, potionName, 'death_stack', { mult, maxHpPenalty: true }, 1);
                    // Side effect — each death already reduced max HP by 5% (tracked in dungeon.js)
                    effectMsg = `👁️ The Reckoning — ${deaths} deaths tracked. Next hit deals ${mult * 100}% damage. ⚠️ Each death cost you 5% max HP.`;
                    break;
                }

                default:
                    effectMsg = `✅ ${potionName} activated.`;
            }

            return msg.reply(
                `╔══〘 🧪 POTION USED 〙══╗\n` +
                `┃◆\n` +
                `┃◆ *${potionName}*\n` +
                `┃◆\n` +
                `┃◆ 〝${potion.lore}〞\n` +
                `┃◆\n` +
                `┃◆▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                `┃◆ ${effectMsg}\n` +
                `╚═══════════════════════════╝`
            );
        } catch (err) {
            console.error('usepotion error:', err);
            msg.reply('❌ Failed to use potion.');
        }
    }
};