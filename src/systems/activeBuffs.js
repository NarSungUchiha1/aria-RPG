// In-memory storage for temporary buffs/debuffs
const activeBuffs = new Map();

function getBuffKey(targetType, targetId) {
    return `${targetType}_${targetId}`;
}

function applyBuff(targetType, targetId, effect) {
    const key = getBuffKey(targetType, targetId);
    if (!activeBuffs.has(key)) {
        activeBuffs.set(key, []);
    }
    const normalizedEffect = {
        ...effect,
        stat: effect.stat ? effect.stat.toLowerCase() : undefined,
        remainingTurns: effect.duration || 3
    };
    activeBuffs.get(key).push(normalizedEffect);
}

function getBuffs(targetType, targetId) {
    const key = getBuffKey(targetType, targetId);
    return activeBuffs.get(key) || [];
}

function getBuffModifiers(targetType, targetId) {
    const buffs = getBuffs(targetType, targetId);
    const mods = { strength: 0, agility: 0, intelligence: 0, stamina: 0, attack: 0, defense: 0, shield: 0 };
    for (const buff of buffs) {
        if (buff.type === 'buff' || buff.type === 'debuff') {
            const stat = buff.stat;
            if (mods[stat] !== undefined) {
                mods[stat] += buff.value;
            }
        } else if (buff.type === 'shield') {
            mods.shield += buff.value;
        }
    }
    return mods;
}

function consumeShield(targetType, targetId, amount) {
    const key = getBuffKey(targetType, targetId);
    const buffs = activeBuffs.get(key) || [];
    for (const buff of buffs) {
        if (buff.type === 'shield') {
            buff.value = Math.max(0, buff.value - amount);
            if (buff.value <= 0) {
                // Remove this shield buff
                const index = buffs.indexOf(buff);
                if (index > -1) buffs.splice(index, 1);
            }
            break; // only consume from one shield (or all? we choose the first)
        }
    }
    if (buffs.length === 0) {
        activeBuffs.delete(key);
    } else {
        activeBuffs.set(key, buffs);
    }
}

function tickBuffs(targetType, targetId) {
    const key = getBuffKey(targetType, targetId);
    if (!activeBuffs.has(key)) return;
    const buffs = activeBuffs.get(key);
    const remaining = buffs.filter(b => {
        b.remainingTurns--;
        return b.remainingTurns > 0;
    });
    if (remaining.length === 0) {
        activeBuffs.delete(key);
    } else {
        activeBuffs.set(key, remaining);
    }
}

function clearBuffs(targetType, targetId) {
    const key = getBuffKey(targetType, targetId);
    activeBuffs.delete(key);
}

module.exports = {
    applyBuff,
    getBuffs,
    getBuffModifiers,
    consumeShield,
    tickBuffs,
    clearBuffs
};