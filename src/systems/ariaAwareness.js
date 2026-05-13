/**
 * ARIA Awareness Engine
 *
 * She's always watching. This runs silently in the background.
 * She forms opinions. She decides when to speak.
 * She's not reactive — she's deliberate.
 */

const { remember, recallRecent, getIdentity, setWorldState, getWorldState } = require('./ariaMemory');

// ── What ARIA witnesses and files away ────────────────────────────────────────

async function witnessMessage(userId, nickname, text) {
    // Don't remember noise — only things with substance
    if (!text || text.length < 8) return;
    if (text.startsWith('!')) return; // commands aren't interesting to her

    // File it away as episodic memory
    await remember('episodic', userId,
        `${nickname} said: "${text.substring(0, 120)}"`,
        { importance: 3 }
    );
}

async function witnessDuelResult(winnerId, winnerNick, loserId, loserNick, type) {
    const content = type === 'party'
        ? `${winnerNick}'s team defeated ${loserNick}'s team in a party duel.`
        : `${winnerNick} defeated ${loserNick} in a solo duel.`;

    await remember('episodic', winnerId, content, { importance: 7, emotion: 'noted' });
    await remember('episodic', loserId,  `${loserNick} lost to ${winnerNick}.`, { importance: 6 });
    await remember('episodic', 'world',  content, { importance: 5 });
    await setWorldState('last_duel', `${winnerNick} vs ${loserNick} — ${winnerNick} won`);
}

async function witnessDungeonClear(playerIds, playerNames, dungeonRank, stages) {
    const names = playerNames.join(', ');
    const content = `${names} cleared a rank ${dungeonRank} dungeon (${stages} stages).`;
    await remember('episodic', 'world', content, { importance: 7, emotion: 'impressed' });
    for (const id of playerIds) {
        await remember('episodic', id, `Participated in clearing rank ${dungeonRank} dungeon.`, { importance: 6 });
    }
    await setWorldState('last_dungeon_clear', content);
}

async function witnessPlayerDeath(playerId, nickname, cause) {
    await remember('episodic', playerId,
        `${nickname} died in the dungeon${cause ? ` — ${cause}` : ''}.`,
        { importance: 5 }
    );
}

async function witnessRankUp(playerId, nickname, newRank) {
    await remember('semantic', playerId,
        `${nickname} reached rank ${newRank}.`,
        { importance: 8, emotion: 'proud' }
    );
    await remember('episodic', 'world',
        `${nickname} ranked up to ${newRank}.`,
        { importance: 6 }
    );
}

// ── ARIA decides whether to speak unprompted ──────────────────────────────────
// She doesn't react to everything. She chooses her moments.

const lastProactiveSpeak = new Map(); // jid → timestamp
const PROACTIVE_COOLDOWN = 25 * 60 * 1000; // 25 minutes minimum between unprompted messages

async function shouldSpeakNow(jid, trigger, context) {
    const last = lastProactiveSpeak.get(jid) || 0;
    if (Date.now() - last < PROACTIVE_COOLDOWN) return false;

    // High-value triggers always get through (after cooldown)
    const highValue = ['rank_up', 'dungeon_clear', 'first_prestige', 'pvp_streak'];
    if (highValue.includes(trigger)) {
        lastProactiveSpeak.set(jid, Date.now());
        return true;
    }

    // Low-value triggers: 6% chance
    if (Math.random() > 0.06) return false;
    lastProactiveSpeak.set(jid, Date.now());
    return true;
}

// ── Build what ARIA knows about the current world state ───────────────────────
async function getWorldContext() {
    const recent = await recallRecent(72, 8);
    const identity = await getIdentity();
    const lastDuel = await getWorldState('last_duel');
    const lastClear = await getWorldState('last_dungeon_clear');

    const lines = [];
    if (identity.observations) lines.push(`World read: ${identity.observations}`);
    if (lastDuel)   lines.push(`Last duel: ${lastDuel}`);
    if (lastClear)  lines.push(`Last dungeon clear: ${lastClear}`);
    if (recent.length) {
        lines.push('Recent events:');
        recent.forEach(m => lines.push(`  — ${m.content}`));
    }
    return lines.join('\n');
}

module.exports = {
    witnessMessage,
    witnessDuelResult,
    witnessDungeonClear,
    witnessPlayerDeath,
    witnessRankUp,
    shouldSpeakNow,
    getWorldContext
};