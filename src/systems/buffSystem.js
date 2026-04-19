const db = require('../database/db');

async function applyEffect(targetType, targetId, effectName, effectData, duration, sourcePlayer = null) {
    await db.execute(
        `INSERT INTO active_effects (target_type, target_id, effect_name, effect_data, remaining_turns, source_player)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [targetType, targetId, effectName, JSON.stringify(effectData), duration, sourcePlayer]
    );
}

async function getActiveEffects(targetType, targetId) {
    const [rows] = await db.execute(
        "SELECT * FROM active_effects WHERE target_type=? AND target_id=? AND remaining_turns > 0",
        [targetType, targetId]
    );
    return rows;
}

async function processTurnEffects(targetType, targetId) {
    const effects = await getActiveEffects(targetType, targetId);
    const messages = [];
    for (const eff of effects) {
        const data = JSON.parse(eff.effect_data || '{}');
        if (eff.effect_name === 'Poison' || eff.effect_name === 'Bleed') {
            const damage = data.damage || 5;
            if (targetType === 'player') {
                await db.execute("UPDATE players SET hp = GREATEST(0, hp - ?) WHERE id=?", [damage, targetId]);
            } else {
                await db.execute("UPDATE dungeon_enemies SET current_hp = GREATEST(0, current_hp - ?) WHERE id=?", [damage, targetId]);
            }
            messages.push(`☠️ ${eff.effect_name} deals ${damage} damage.`);
        } else if (eff.effect_name === 'Regen' || eff.effect_name === 'Blessing') {
            const heal = data.heal || 10;
            if (targetType === 'player') {
                await db.execute("UPDATE players SET hp = LEAST(max_hp, hp + ?) WHERE id=?", [heal, targetId]);
            }
            messages.push(`💚 ${eff.effect_name} restores ${heal} HP.`);
        }
        await db.execute("UPDATE active_effects SET remaining_turns = remaining_turns - 1 WHERE id=?", [eff.id]);
    }
    await db.execute("DELETE FROM active_effects WHERE remaining_turns <= 0");
    return messages;
}

async function hasEffect(targetType, targetId, effectName) {
    const [rows] = await db.execute(
        "SELECT * FROM active_effects WHERE target_type=? AND target_id=? AND effect_name=? AND remaining_turns > 0",
        [targetType, targetId, effectName]
    );
    return rows.length > 0;
}

async function removeEffect(targetType, targetId, effectName) {
    await db.execute(
        "DELETE FROM active_effects WHERE target_type=? AND target_id=? AND effect_name=?",
        [targetType, targetId, effectName]
    );
}

module.exports = { applyEffect, getActiveEffects, processTurnEffects, hasEffect, removeEffect };