const db = require('../database/db');
const { applyBuff, clearBuffs } = require('../systems/activeBuffs');
const { getActiveDungeon, getCurrentEnemies } = require('../engine/dungeon');

// ── Grade multipliers ─────────────────────────────────────
const GRADE_MULT = { F: 1.0, E: 1.2, D: 1.4, C: 1.6, B: 1.8, A: 2.0, S: 2.3 };

function gradeScale(base, grade) {
    return Math.floor(base * (GRADE_MULT[grade] || 1.0));
}

// ── Consumable definitions ────────────────────────────────
// type: 'heal' | 'mana' | 'buff' | 'cleanse' | 'revive' | 'dungeon_damage' | 'dungeon_debuff'
// All effects work for ALL roles unless noted
const CONSUMABLES = {
    // ── HP RESTORE ──────────────────────────────────────
    'Potion': {
        type: 'heal',
        emoji: '🧪',
        baseHp: 60,
        label: 'HP Potion'
    },
    'Herb Kit': {
        type: 'heal',
        emoji: '🌿',
        baseHp: 50,
        label: 'Herb Kit'
    },
    'Holy Water': {
        type: 'heal_cleanse',
        emoji: '💧',
        baseHp: 70,
        label: 'Holy Water'
    },

    // ── MANA RESTORE (all roles) ─────────────────────────
    'Mana Potion': {
        type: 'mana',
        emoji: '💙',
        baseMana: 30,
        label: 'Mana Potion'
    },

    // ── CLEANSE ──────────────────────────────────────────
    'Cleanse Potion': {
        type: 'cleanse',
        emoji: '✨',
        label: 'Cleanse Potion'
    },

    // ── REVIVE ───────────────────────────────────────────
    'Revive Scroll': {
        type: 'revive',
        emoji: '📜',
        label: 'Revive Scroll'
    },

    // ── STAT BUFFS (temporary, in-memory) ────────────────
    'Fortify Potion': {
        type: 'buff',
        emoji: '🛡️',
        stat: 'defense',
        baseValue: 20,
        duration: 3,
        label: 'Fortify Potion'
    },
    'Rage Potion': {
        type: 'buff',
        emoji: '🔥',
        stat: 'strength',
        baseValue: 25,
        duration: 3,
        label: 'Rage Potion'
    },
    'Eagle Eye Potion': {
        type: 'buff',
        emoji: '🦅',
        stat: 'agility',
        baseValue: 20,
        duration: 3,
        label: 'Eagle Eye Potion'
    },
    'Smoke Bomb': {
        type: 'buff',
        emoji: '💨',
        stat: 'agility',
        baseValue: 30,
        duration: 2,
        label: 'Smoke Bomb'
    },
    'Backstab Scroll': {
        type: 'buff',
        emoji: '🗡️',
        stat: 'agility',
        baseValue: 25,
        duration: 2,
        label: 'Backstab Scroll'
    },
    'Taunt Scroll': {
        type: 'buff',
        emoji: '📢',
        stat: 'stamina',
        baseValue: 20,
        duration: 2,
        label: 'Taunt Scroll'
    },
    'War Cry Scroll': {
        type: 'buff',
        emoji: '⚔️',
        stat: 'strength',
        baseValue: 20,
        duration: 3,
        label: 'War Cry Scroll'
    },
    'Blood Charm': {
        type: 'buff_heal',
        emoji: '🩸',
        stat: 'strength',
        baseValue: 15,
        duration: 3,
        baseHp: 20,
        label: 'Blood Charm'
    },
    'Blessing Charm': {
        type: 'buff',
        emoji: '💫',
        stat: 'intelligence',
        baseValue: 20,
        duration: 3,
        label: 'Blessing Charm'
    },
    'Elixir': {
        type: 'buff',
        emoji: '✨',
        stat: 'stamina',
        baseValue: 15,
        duration: 3,
        label: 'Elixir'
    },

    // ── DUNGEON COMBAT (requires active dungeon) ──────────
    'Poison Vial': {
        type: 'dungeon_debuff',
        emoji: '☠️',
        stat: 'strength',
        baseValue: -15,
        duration: 3,
        label: 'Poison Vial'
    },
    'Fire Scroll': {
        type: 'dungeon_damage',
        emoji: '🔥',
        baseDamage: 40,
        label: 'Fire Scroll'
    },
};

module.exports = {
    name: 'use',
    async execute(msg, args, { userId, client }) {
        const itemName = args.join(' ').trim();
        if (!itemName) return msg.reply("❌ Use: !use <item name>");

        try {
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? AND item_name=? LIMIT 1",
                [userId, itemName]
            );
            if (!items.length) return msg.reply(`❌ You don't have a ${itemName}.`);
            const item = items[0];

            // ✅ Use DB's item_name for lookup — preserves correct casing
            // regardless of how the user typed it (e.g. "mana potion" vs "Mana Potion")
            // ✅ Track consumable use for quests
            try {
                const { updateQuestProgress } = require('../systems/questSystem');
                await updateQuestProgress(userId, 'item_use', 1);
            } catch (e) {}

            const def = CONSUMABLES[item.item_name];
            if (!def) return msg.reply(`❌ ${itemName} cannot be used with !use.`);

            const grade = item.grade || 'F';
            const [playerRows] = await db.execute(
                "SELECT * FROM players WHERE id=?", [userId]
            );
            if (!playerRows.length) return msg.reply("❌ Not registered.");
            const player = playerRows[0];

            // ── CONSUME the item ─────────────────────────
            await db.execute("DELETE FROM inventory WHERE id=?", [item.id]);

            // ── APPLY effect ─────────────────────────────

            // HP RESTORE
            if (def.type === 'heal') {
                const restore = gradeScale(def.baseHp, grade);
                const current = Number(player.hp);
                const max     = Number(player.max_hp);
                const newHp   = Math.min(max, current + restore);
                await db.execute("UPDATE players SET hp=? WHERE id=?", [newHp, userId]);
                return msg.reply(
                    `══〘 ${def.emoji} ${def.label.toUpperCase()} 〙══╮\n` +
                    `┃◆ Grade: ${grade}\n` +
                    `┃◆ HP restored: +${restore}\n` +
                    `┃◆ HP: ${current}/${max} → ${newHp}/${max}\n` +
                    `┃◆ Consumed.\n` +
                    `╰═══════════════════════╯`
                );
            }

            // HP RESTORE + CLEANSE
            if (def.type === 'heal_cleanse') {
                const restore = gradeScale(def.baseHp, grade);
                const current = Number(player.hp);
                const max     = Number(player.max_hp);
                const newHp   = Math.min(max, current + restore);
                await db.execute("UPDATE players SET hp=? WHERE id=?", [newHp, userId]);
                clearBuffs('player', userId);
                return msg.reply(
                    `══〘 ${def.emoji} ${def.label.toUpperCase()} 〙══╮\n` +
                    `┃◆ Grade: ${grade}\n` +
                    `┃◆ HP restored: +${restore}\n` +
                    `┃◆ HP: ${current}/${max} → ${newHp}/${max}\n` +
                    `┃◆ ✨ All debuffs cleansed.\n` +
                    `┃◆ Consumed.\n` +
                    `╰═══════════════════════╯`
                );
            }

            // MANA RESTORE (all roles)
            if (def.type === 'mana') {
                const restore   = gradeScale(def.baseMana, grade);
                const currentMana = Number(player.mana) || 0;
                const maxMana     = Number(player.max_mana) || 50;
                const newMana     = Math.min(maxMana, currentMana + restore);
                await db.execute("UPDATE players SET mana=? WHERE id=?", [newMana, userId]);
                return msg.reply(
                    `══〘 ${def.emoji} ${def.label.toUpperCase()} 〙══╮\n` +
                    `┃◆ Grade: ${grade}\n` +
                    `┃◆ Mana restored: +${restore}\n` +
                    `┃◆ Mana: ${currentMana}/${maxMana} → ${newMana}/${maxMana}\n` +
                    `┃◆ Consumed.\n` +
                    `╰═══════════════════════╯`
                );
            }

            // CLEANSE ONLY
            if (def.type === 'cleanse') {
                clearBuffs('player', userId);
                return msg.reply(
                    `══〘 ${def.emoji} ${def.label.toUpperCase()} 〙══╮\n` +
                    `┃◆ All debuffs and negative effects cleared.\n` +
                    `┃◆ Consumed.\n` +
                    `╰═══════════════════════╯`
                );
            }

            // REVIVE (use when at 0 HP — no penalty like !respawn)
            if (def.type === 'revive') {
                if (player.hp > 0) {
                    // Refund — can't use on a living player
                    await db.execute(
                        "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped, grade) VALUES (?,?,?,1,0,?)",
                        [userId, itemName, item.item_type, grade]
                    );
                    return msg.reply("❌ You are not dead. Revive Scroll returned.");
                }
                const reviveHp = Math.floor(Number(player.max_hp) * 0.5);
                await db.execute("UPDATE players SET hp=? WHERE id=?", [reviveHp, userId]);
                return msg.reply(
                    `══〘 📜 REVIVE SCROLL 〙══╮\n` +
                    `┃◆ A divine light pulls you back!\n` +
                    `┃◆ Revived at ${reviveHp}/${player.max_hp} HP\n` +
                    `┃◆ No penalties. Consumed.\n` +
                    `╰═══════════════════════╯`
                );
            }

            // STAT BUFF
            if (def.type === 'buff') {
                const value = gradeScale(def.baseValue, grade);
                applyBuff('player', userId, {
                    type: 'buff',
                    stat: def.stat,
                    value,
                    duration: def.duration
                });
                const statLabel = { strength:'💪 STR', agility:'⚡ AGI', intelligence:'🧠 INT', stamina:'🛡️ STA', defense:'🛡️ DEF' }[def.stat] || def.stat.toUpperCase();
                return msg.reply(
                    `══〘 ${def.emoji} ${def.label.toUpperCase()} 〙══╮\n` +
                    `┃◆ Grade: ${grade}\n` +
                    `┃◆ ${statLabel} +${value} for ${def.duration} turns\n` +
                    `┃◆ Consumed.\n` +
                    `╰═══════════════════════╯`
                );
            }

            // BUFF + HEAL (Blood Charm)
            if (def.type === 'buff_heal') {
                const value   = gradeScale(def.baseValue, grade);
                const hpGain  = gradeScale(def.baseHp, grade);
                applyBuff('player', userId, { type: 'buff', stat: def.stat, value, duration: def.duration });
                const current = Number(player.hp);
                const max     = Number(player.max_hp);
                const newHp   = Math.min(max, current + hpGain);
                await db.execute("UPDATE players SET hp=? WHERE id=?", [newHp, userId]);
                return msg.reply(
                    `══〘 ${def.emoji} ${def.label.toUpperCase()} 〙══╮\n` +
                    `┃◆ Grade: ${grade}\n` +
                    `┃◆ 💪 STR +${value} for ${def.duration} turns\n` +
                    `┃◆ ❤️ HP +${hpGain} (${current} → ${newHp}/${max})\n` +
                    `┃◆ Consumed.\n` +
                    `╰═══════════════════════╯`
                );
            }

            // DUNGEON DEBUFF (Poison Vial — applies to enemy)
            if (def.type === 'dungeon_debuff') {
                const dungeon = await getActiveDungeon();
                if (!dungeon || !dungeon.locked) {
                    // Refund
                    await db.execute(
                        "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped, grade) VALUES (?,?,?,1,0,?)",
                        [userId, itemName, item.item_type, grade]
                    );
                    return msg.reply(`❌ ${itemName} can only be used in an active dungeon. Returned.`);
                }
                const enemies = await getCurrentEnemies(dungeon.id);
                if (!enemies.length) {
                    await db.execute(
                        "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped, grade) VALUES (?,?,?,1,0,?)",
                        [userId, itemName, item.item_type, grade]
                    );
                    return msg.reply("❌ No enemies to target. Item returned.");
                }
                const target = enemies[0];
                const value  = gradeScale(Math.abs(def.baseValue), grade);
                const { applyBuff: ab } = require('../systems/activeBuffs');
                ab('enemy', target.id, { type: 'debuff', stat: def.stat, value: -value, duration: def.duration });
                return msg.reply(
                    `══〘 ${def.emoji} ${def.label.toUpperCase()} 〙══╮\n` +
                    `┃◆ Grade: ${grade}\n` +
                    `┃◆ ${target.name} afflicted!\n` +
                    `┃◆ 💪 STR -${value} for ${def.duration} turns\n` +
                    `┃◆ Consumed.\n` +
                    `╰═══════════════════════╯`
                );
            }

            // DUNGEON DAMAGE (Fire Scroll)
            if (def.type === 'dungeon_damage') {
                const dungeon = await getActiveDungeon();
                if (!dungeon || !dungeon.locked) {
                    await db.execute(
                        "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped, grade) VALUES (?,?,?,1,0,?)",
                        [userId, itemName, item.item_type, grade]
                    );
                    return msg.reply(`❌ ${itemName} can only be used in an active dungeon. Returned.`);
                }
                const enemies = await getCurrentEnemies(dungeon.id);
                if (!enemies.length) {
                    await db.execute(
                        "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped, grade) VALUES (?,?,?,1,0,?)",
                        [userId, itemName, item.item_type, grade]
                    );
                    return msg.reply("❌ No enemies to target. Item returned.");
                }
                const damage = gradeScale(def.baseDamage, grade);
                const target = enemies[0];
                await db.execute(
                    "UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?",
                    [damage, target.id]
                );
                const [updated] = await db.execute("SELECT current_hp, max_hp FROM dungeon_enemies WHERE id=?", [target.id]);
                const newHp = updated[0].current_hp;
                if (newHp <= 0) {
                    await db.execute("UPDATE dungeon SET stage_cleared=1 WHERE id=?", [dungeon.id]);
                }
                return msg.reply(
                    `══〘 ${def.emoji} ${def.label.toUpperCase()} 〙══╮\n` +
                    `┃◆ Grade: ${grade}\n` +
                    `┃◆ 🔥 ${target.name} scorched for ${damage} damage!\n` +
                    `┃◆ HP: ${newHp}/${updated[0].max_hp}\n` +
                    `${newHp <= 0 ? '┃◆ ✅ Enemy defeated!\n' : ''}` +
                    `┃◆ Consumed.\n` +
                    `╰═══════════════════════╯`
                );
            }

            return msg.reply(`❌ ${itemName} has no usable effect defined.`);

        } catch (err) {
            console.error(err);
            msg.reply("❌ Failed to use item.");
        }
    }
};