/**
 * VOID LEVIATHAN FINAL BATTLE SYSTEM
 * 
 * Flow:
 * 1. Void War goal reached → Leviathan spawns, everyone promoted to raid group
 * 2. Players !attackboss to deal damage
 * 3. Every 5-6 collective turns → Leviathan retaliates, kills 3/20 players randomly
 * 4. Shard holders are immune to death
 * 5. When only shard holders remain → !fuse phase begins
 * 6. Each shard holder types !fuse → narration plays
 * 7. When all have fused → !finalstrike available → 1 damage per fused player → Leviathan dies
 */

const db = require('../database/db');
const { RAID_GROUP } = require('../engine/dungeon');
const { sendWithRetry } = require('../utils/sendWithRetry');

const LEVIATHAN_HP     = 1000000;
const RETALIATION_FREQ = 5;   // every 5-6 turns
const KILL_RATIO       = 3/20; // kills 3/20 of participants per retaliation

// In-memory battle state
const battleState = {
    active:         false,
    turnCount:      0,
    nextRetaliation: 0,
    fusedPlayers:   new Set(),  // player IDs who have fused their shards
    shardHolders:   new Set(),  // player IDs with void shards
    finalPhase:     false,      // true when only shard holders remain
    participants:   new Map(),  // playerId → { nickname, alive }
};

function resetBattle() {
    battleState.active         = false;
    battleState.turnCount      = 0;
    battleState.nextRetaliation = 0;
    battleState.fusedPlayers.clear();
    battleState.shardHolders.clear();
    battleState.finalPhase     = false;
    battleState.participants.clear();
}

async function getShardHolders() {
    // Check both player_materials and event_progress
    const [matHolders] = await db.execute(
        "SELECT DISTINCT player_id FROM player_materials WHERE material IN ('Void Fragment', 'Void Shard') AND quantity > 0"
    );
    const [eventHolders] = await db.execute(
        "SELECT DISTINCT player_id FROM event_progress WHERE shards > 0"
    ).catch(() => [[]]);

    const holders = new Set([
        ...matHolders.map(r => r.player_id),
        ...eventHolders.map(r => r.player_id)
    ]);
    return holders;
}

async function initBattle(client) {
    resetBattle();

    // Get all registered players
    const [players] = await db.execute("SELECT id, nickname FROM players");
    for (const p of players) {
        battleState.participants.set(p.id, { nickname: p.nickname, alive: true });
    }

    // Get shard holders
    const holders = await getShardHolders();
    holders.forEach(id => battleState.shardHolders.add(id));

    battleState.active = true;
    battleState.turnCount = 0;
    battleState.nextRetaliation = 5 + Math.floor(Math.random() * 2); // 5 or 6

    // Promote everyone to raid group
    try {
        for (const [playerId] of battleState.participants) {
            try {
                await client.groupParticipantsUpdate(
                    RAID_GROUP,
                    [`${playerId}@s.whatsapp.net`],
                    'promote'
                );
            } catch(e) {}
        }
    } catch(e) {}

    console.log(`⚡ Leviathan battle initiated. ${battleState.participants.size} participants, ${battleState.shardHolders.size} shard holders.`);
}

async function processTurn(attackerId, damage, client) {
    if (!battleState.active) return null;

    battleState.turnCount++;

    // Get attacker name
    const attacker = battleState.participants.get(attackerId);
    const attackerNick = attacker?.nickname || attackerId;

    let retaliationResult = null;

    // Check if retaliation triggers
    if (battleState.turnCount >= battleState.nextRetaliation) {
        retaliationResult = await triggerRetaliation(client);
        battleState.nextRetaliation = battleState.turnCount + 5 + Math.floor(Math.random() * 2);

        // Check if only shard holders remain
        await checkFinalPhase(client);
    }

    return { retaliationResult, turnCount: battleState.turnCount };
}

async function triggerRetaliation(client) {
    // Get all alive non-immune players
    const mortal = [];
    for (const [id, data] of battleState.participants) {
        if (data.alive && !battleState.shardHolders.has(id)) {
            mortal.push(id);
        }
    }

    if (!mortal.length) return { killed: [], msg: 'No mortals remain.' };

    // Kill 3/20 of alive participants (minimum 1)
    const killCount = Math.max(1, Math.floor(mortal.length * KILL_RATIO));
    const shuffled  = mortal.sort(() => Math.random() - 0.5);
    const toKill    = shuffled.slice(0, killCount);

    const killed = [];
    for (const id of toKill) {
        const data = battleState.participants.get(id);
        data.alive = false;
        killed.push(data.nickname);
    }

    const killList = killed.map(n => `┃◆   ☠️ ${n}`).join('\n');

    const retaliationMoves = [
        { name: 'Void Surge',       msg: 'Reality fractures. The void claims the weak.' },
        { name: 'Abyssal Drain',    msg: 'Life force ripped away. Some hunters simply stop existing.' },
        { name: 'Dimensional Tear', msg: 'Space collapses inward. Those without protection are gone.' },
        { name: 'Gravity Crush',    msg: 'Gravity inverts. Bodies fall upward into the void.' },
        { name: 'Corruption Wave',  msg: 'Void energy floods the battlefield. The unprepared are consumed.' }
    ];

    const move = retaliationMoves[Math.floor(Math.random() * retaliationMoves.length)];

    await sendWithRetry(client, RAID_GROUP, {
        text:
            `╭══〘 ⚡ LEVIATHAN RETALIATES 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ *${move.name}*\n` +
            `┃◆ ${move.msg}\n` +
            `┃◆ \n` +
            `┃◆ The following hunters have fallen:\n` +
            `${killList}\n` +
            `┃◆ \n` +
            `┃◆ ✨ Shard holders remain protected.\n` +
            `┃◆ \n` +
            `╰═══════════════════════════╯`
    });

    return { killed, move: move.name };
}

async function checkFinalPhase(client) {
    if (battleState.finalPhase) return;

    // Check if any non-shard holders are still alive
    const livingMortals = [];
    for (const [id, data] of battleState.participants) {
        if (data.alive && !battleState.shardHolders.has(id)) {
            livingMortals.push(id);
        }
    }

    if (livingMortals.length > 0) return; // mortals still alive

    // Only shard holders remain — trigger final phase
    battleState.finalPhase = true;

    const holders = [];
    for (const id of battleState.shardHolders) {
        const data = battleState.participants.get(id);
        if (data?.alive) holders.push(data.nickname);
    }

    await sendWithRetry(client, RAID_GROUP, {
        text:
            `╭══〘 💠 THE SHARDS AWAKEN 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ The battlefield falls silent.\n` +
            `┃◆ \n` +
            `┃◆ The Leviathan pauses.\n` +
            `┃◆ \n` +
            `┃◆ It recognises something.\n` +
            `┃◆ The fragments of its own prison —\n` +
            `┃◆ the shards that were torn from the seal\n` +
            `┃◆ when the Gates were first built —\n` +
            `┃◆ are still here.\n` +
            `┃◆ \n` +
            `┃◆ In the hands of the ones still standing.\n` +
            `┃◆ \n` +
            `┃◆ The shards pulse. They remember.\n` +
            `┃◆ They know what they were made to do.\n` +
            `┃◆ \n` +
            `┃◆ ✨ SHARD HOLDERS:\n` +
            `${holders.map(n => `┃◆   💠 ${n}`).join('\n')}\n` +
            `┃◆ \n` +
            `┃◆ The void cannot touch what it created.\n` +
            `┃◆ \n` +
            `┃◆ Each of you must channel your shard\n` +
            `┃◆ into your weapon. One by one.\n` +
            `┃◆ \n` +
            `┃◆ Type *!fuse* when you are ready.\n` +
            `┃◆ \n` +
            `┃◆ Wait for everyone. Then strike together.\n` +
            `┃◆ \n` +
            `╰═══════════════════════════╯`
    });
}

async function processFFuse(playerId, client) {
    if (!battleState.active || !battleState.finalPhase) return {
        ok: false, reason: 'not_in_final_phase'
    };

    if (!battleState.shardHolders.has(playerId)) return {
        ok: false, reason: 'no_shard'
    };

    const data = battleState.participants.get(playerId);
    if (!data?.alive) return { ok: false, reason: 'dead' };

    if (battleState.fusedPlayers.has(playerId)) return {
        ok: false, reason: 'already_fused'
    };

    battleState.fusedPlayers.add(playerId);

    // Narration for each fuse
    const fuseNarrations = [
        `The shard cracks. Light bleeds through the fracture. Not light — something older than light. It floods into the blade, and for a moment the weapon weighs nothing at all.`,
        `The shard does not merge. It surrenders. Every fracture, every chip, every hairline crack that formed when the seal broke — all of it pours forward at once.`,
        `The weapon changes. Not in shape. Not in weight. But the thing that was a weapon is now something else. Something the Leviathan was built to fear.`,
        `The shard shatters completely. The hunter feels the pieces moving through them like breath. Like intention. Like the specific kind of anger that comes from a very long wait.`,
        `For one second the hunter sees what the shard saw. The original seal. The thousand hunters who died to build it. Their purpose. Now yours.`
    ];

    const narration = fuseNarrations[Math.floor(Math.random() * fuseNarrations.length)];

    const totalHolders  = battleState.shardHolders.size;
    const fusedCount    = battleState.fusedPlayers.size;
    const remaining     = totalHolders - fusedCount;

    await sendWithRetry(client, RAID_GROUP, {
        text:
            `╭══〘 💠 SHARD FUSED 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ *${data.nickname}* channels their shard.\n` +
            `┃◆ \n` +
            `┃◆ 〝${narration}〞\n` +
            `┃◆ \n` +
            `┃◆ ━━━━━━━━━━━━━━━━━━━━\n` +
            `┃◆ Fused: ${fusedCount}/${totalHolders}\n` +
            `${remaining > 0
                ? `┃◆ Waiting for ${remaining} more...\n`
                : `┃◆ ✅ ALL SHARDS FUSED.\n┃◆ \n┃◆ Type *!finalstrike* NOW.\n`
            }` +
            `┃◆ \n` +
            `╰═══════════════════════════╯`
    });

    // Check if all have fused
    if (remaining === 0) {
        await sendWithRetry(client, RAID_GROUP, {
            text:
                `╭══〘 ⚡ THE MOMENT 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ The Leviathan sees it now.\n` +
                `┃◆ \n` +
                `┃◆ It built the seal.\n` +
                `┃◆ It knows what happens when every piece\n` +
                `┃◆ of a prison comes back together.\n` +
                `┃◆ \n` +
                `┃◆ It has been afraid of exactly this\n` +
                `┃◆ for longer than this world has existed.\n` +
                `┃◆ \n` +
                `┃◆ ⚔️ ALL SHARD HOLDERS — type *!finalstrike*\n` +
                `┃◆ \n` +
                `╰═══════════════════════════╯`
        });
    }

    return { ok: true, fusedCount, totalHolders, allFused: remaining === 0 };
}

async function processFinalStrike(playerId, client) {
    if (!battleState.active || !battleState.finalPhase) return {
        ok: false, reason: 'not_in_final_phase'
    };

    if (!battleState.fusedPlayers.has(playerId)) return {
        ok: false, reason: 'not_fused',
        msg: 'You must !fuse your shard first.'
    };

    const totalFused = battleState.fusedPlayers.size;
    const totalHolders = battleState.shardHolders.size;

    if (battleState.fusedPlayers.size < battleState.shardHolders.size) return {
        ok: false, reason: 'waiting',
        msg: `Waiting for ${totalHolders - totalFused} more hunters to !fuse.`
    };

    // Deal massive damage — 1 damage per fused player to the Leviathan
    // Each hit = leviathan loses massive HP (enough to kill it)
    const massiveDamage = LEVIATHAN_HP; // guaranteed kill

    // Update boss HP to 0
    await db.execute(
        "UPDATE world_boss SET current_hp = 0 WHERE is_active=1 AND name='The Void Leviathan'"
    );

    battleState.active = false;

    // Build final narration
    const data = battleState.participants.get(playerId);

    await sendWithRetry(client, RAID_GROUP, {
        text:
            `╭══〘 ⚡ THE FINAL STRIKE 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ They strike together.\n` +
            `┃◆ \n` +
            `┃◆ Not with strength. Not with skill.\n` +
            `┃◆ With the specific weight of something\n` +
            `┃◆ that has been waiting a very long time\n` +
            `┃◆ to go home.\n` +
            `┃◆ \n` +
            `┃◆ The shards pierce the Leviathan\n` +
            `┃◆ at every point simultaneously.\n` +
            `┃◆ The wound is not a wound.\n` +
            `┃◆ It is a door, opening inward.\n` +
            `┃◆ \n` +
            `┃◆ The Leviathan does not scream.\n` +
            `┃◆ It exhales.\n` +
            `┃◆ One long sound that is not sound\n` +
            `┃◆ but is felt in every bone\n` +
            `┃◆ of every hunter still standing.\n` +
            `┃◆ \n` +
            `┃◆ Then silence.\n` +
            `┃◆ \n` +
            `┃◆ The kind of silence that means\n` +
            `┃◆ something very old\n` +
            `┃◆ has finally been allowed to rest.\n` +
            `┃◆ \n` +
            `┃◆ ━━━━━━━━━━━━━━━━━━━━\n` +
            `┃◆ \n` +
            `┃◆ 💀 THE VOID LEVIATHAN\n` +
            `┃◆       HAS FALLEN.\n` +
            `┃◆ \n` +
            `┃◆ ━━━━━━━━━━━━━━━━━━━━\n` +
            `┃◆ \n` +
            `┃◆ The war is over.\n` +
            `┃◆ The seal holds again.\n` +
            `┃◆ \n` +
            `┃◆ But something else is moving\n` +
            `┃◆ in the dark.\n` +
            `┃◆ \n` +
            `┃◆ Something that was watching\n` +
            `┃◆ the whole time.\n` +
            `┃◆ Waiting to see\n` +
            `┃◆ if the hunters were worth\n` +
            `┃◆ what comes next.\n` +
            `┃◆ \n` +
            `┃◆        — Chapter 4 begins.\n` +
            `┃◆ \n` +
            `╰═══════════════════════════╯`
    });

    // Reward all survivors
    const survivors = [];
    for (const [id, data] of battleState.participants) {
        if (data.alive) {
            survivors.push({ id, nickname: data.nickname });
            await db.execute("UPDATE currency SET gold = gold + 5000 WHERE player_id=?", [id]);
            await db.execute("UPDATE xp SET xp = xp + 2000 WHERE player_id=?", [id]);
        }
    }

    // Extra reward for shard holders
    for (const id of battleState.fusedPlayers) {
        await db.execute("UPDATE currency SET gold = gold + 3000 WHERE player_id=?", [id]);
        await db.execute("UPDATE xp SET xp = xp + 1000 WHERE player_id=?", [id]);
    }

    // Mark boss defeated
    await db.execute(
        "UPDATE world_boss SET is_active=0 WHERE name='The Void Leviathan' AND is_active=1"
    );

    resetBattle();
    return { ok: true, survivors: survivors.length };
}

module.exports = {
    battleState,
    initBattle,
    processTurn,
    processFFuse,
    processFinalStrike,
    getShardHolders,
    LEVIATHAN_HP
};