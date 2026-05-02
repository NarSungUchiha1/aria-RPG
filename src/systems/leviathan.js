/**
 * VOID LEVIATHAN FINAL BATTLE — REBUILT
 *
 * Flow:
 * 1. Void War goal reached → Leviathan spawns, ALL registered players promoted to raid group
 * 2. Players use !skill to deal damage (same as dungeon, Leviathan is the target)
 * 3. Every 5-6 skill uses → Leviathan retaliates, kills 3/20 randomly
 * 4. Shard holders immune to death
 * 5. When only shard holders alive → !fuse phase
 * 6. Each shard holder types !fuse → unique narration
 * 7. Min 2 fused → !finalstrike opens 5sec window → anyone who types joins
 * 8. After 5sec → Leviathan falls, narration plays, Chapter 4 teased
 * 9. No rewards — just the story
 */

const db = require('../database/db');
const { RAID_GROUP } = require('../engine/dungeon');
const { sendWithRetry } = require('../utils/sendWithRetry');

const LEVIATHAN_HP     = 1000000;
const RETALIATION_FREQ = 5;
const KILL_RATIO       = 3 / 20;
const MIN_FUSED_TO_STRIKE = 2;
const FINAL_STRIKE_WINDOW = 5000; // 5 seconds

const battleState = {
    active:          false,
    hp:              LEVIATHAN_HP,
    turnCount:       0,
    nextRetaliation: 0,
    fusedPlayers:    new Set(),
    shardHolders:    new Set(),
    finalPhase:      false,
    strikeOpen:      false,
    strikeTimer:     null,
    strikers:        new Set(),
    participants:    new Map(), // playerId → { nickname, alive }
};

function resetBattle() {
    battleState.active          = false;
    battleState.hp              = LEVIATHAN_HP;
    battleState.turnCount       = 0;
    battleState.nextRetaliation = 0;
    battleState.fusedPlayers.clear();
    battleState.shardHolders.clear();
    battleState.finalPhase      = false;
    battleState.strikeOpen      = false;
    battleState.strikers.clear();
    if (battleState.strikeTimer) clearTimeout(battleState.strikeTimer);
    battleState.strikeTimer     = null;
    battleState.participants.clear();
}

async function getShardHolders() {
    const [mat] = await db.execute(
        "SELECT DISTINCT player_id FROM player_materials WHERE material IN ('Void Fragment','Void Shard') AND quantity > 0"
    );
    const [evt] = await db.execute(
        "SELECT DISTINCT player_id FROM event_progress WHERE shards > 0"
    ).catch(() => [[]]);
    return new Set([...mat.map(r => r.player_id), ...evt.map(r => r.player_id)]);
}

async function initBattle(client) {
    resetBattle();

    const [players] = await db.execute("SELECT id, nickname FROM players");
    for (const p of players) {
        battleState.participants.set(p.id, { nickname: p.nickname, alive: true });
    }

    const holders = await getShardHolders();
    holders.forEach(id => battleState.shardHolders.add(id));

    battleState.active          = true;
    battleState.hp              = LEVIATHAN_HP;
    battleState.turnCount       = 0;
    battleState.nextRetaliation = RETALIATION_FREQ + Math.floor(Math.random() * 2);

    // Promote ALL registered players to raid group
    for (const [playerId] of battleState.participants) {
        try {
            await client.groupParticipantsUpdate(
                RAID_GROUP,
                [`${playerId}@s.whatsapp.net`],
                'promote'
            );
        } catch(e) {}
    }

    console.log(`⚡ Leviathan battle started. ${battleState.participants.size} hunters, ${battleState.shardHolders.size} shard holders.`);
}

async function processSkillHit(attackerId, damage, client) {
    if (!battleState.active || battleState.finalPhase) return null;

    // Deal damage to Leviathan
    battleState.hp = Math.max(0, battleState.hp - damage);
    battleState.turnCount++;

    // Check retaliation
    let retaliated = false;
    if (battleState.turnCount >= battleState.nextRetaliation) {
        await triggerRetaliation(client);
        battleState.nextRetaliation = battleState.turnCount + RETALIATION_FREQ + Math.floor(Math.random() * 2);
        retaliated = true;
        await checkFinalPhase(client);
    }

    return { hp: battleState.hp, retaliated };
}

async function triggerRetaliation(client) {
    const mortal = [];
    for (const [id, data] of battleState.participants) {
        if (data.alive && !battleState.shardHolders.has(id)) mortal.push(id);
    }
    if (!mortal.length) return;

    const killCount = Math.max(1, Math.floor(mortal.length * KILL_RATIO));
    const toKill = mortal.sort(() => Math.random() - 0.5).slice(0, killCount);

    const killed = [];
    for (const id of toKill) {
        const data = battleState.participants.get(id);
        data.alive = false;
        killed.push(data.nickname);

        // Demote from raid group
        try {
            await client.groupParticipantsUpdate(
                RAID_GROUP,
                [`${id}@s.whatsapp.net`],
                'demote'
            );
        } catch(e) {}
    }

    const moves = [
        { name: 'Void Surge',       msg: 'Reality fractures. The void claims the weak.' },
        { name: 'Abyssal Drain',    msg: 'Life force ripped away. Some hunters simply stop existing.' },
        { name: 'Dimensional Tear', msg: 'Space collapses inward. Those without protection are gone.' },
        { name: 'Gravity Crush',    msg: 'Gravity inverts. Bodies fall upward into nothing.' },
        { name: 'Corruption Wave',  msg: 'Void energy floods the battlefield. The unprepared are consumed.' }
    ];
    const move = moves[Math.floor(Math.random() * moves.length)];
    const hpPct = ((battleState.hp / LEVIATHAN_HP) * 100).toFixed(1);
    const filled = Math.floor((battleState.hp / LEVIATHAN_HP) * 10);
    const bar = '🟥'.repeat(filled) + '⬛'.repeat(10 - filled);

    await sendWithRetry(client, RAID_GROUP, {
        text:
            `╭══〘 🌊 LEVIATHAN RETALIATES 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ *${move.name}*\n` +
            `┃◆ ${move.msg}\n` +
            `┃◆ \n` +
            `┃◆ ☠️ Fallen:\n` +
            `${killed.map(n => `┃◆   • ${n}`).join('\n')}\n` +
            `┃◆ \n` +
            `┃◆ 💚 Shard holders remain.\n` +
            `┃◆ \n` +
            `┃◆ 🌊 Leviathan HP:\n` +
            `┃◆ ${bar} ${hpPct}%\n` +
            `┃◆ \n` +
            `╰═══════════════════════════╯`
    });
}

async function checkFinalPhase(client) {
    if (battleState.finalPhase) return;

    // Check if any non-shard mortals are still alive
    for (const [id, data] of battleState.participants) {
        if (data.alive && !battleState.shardHolders.has(id)) return;
    }

    battleState.finalPhase = true;

    const alive = [];
    for (const id of battleState.shardHolders) {
        const data = battleState.participants.get(id);
        if (data?.alive) alive.push(data.nickname);
    }

    await sendWithRetry(client, RAID_GROUP, {
        text:
            `╭══〘 💠 THE SHARDS AWAKEN 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ The battlefield falls silent.\n` +
            `┃◆ \n` +
            `┃◆ The Leviathan pauses.\n` +
            `┃◆ It recognises something.\n` +
            `┃◆ \n` +
            `┃◆ The fragments of its own prison —\n` +
            `┃◆ the shards torn from the seal\n` +
            `┃◆ when the Gates first opened —\n` +
            `┃◆ are still here.\n` +
            `┃◆ In the hands of those still standing.\n` +
            `┃◆ \n` +
            `┃◆ The shards pulse.\n` +
            `┃◆ They remember what they were made to do.\n` +
            `┃◆ \n` +
            `┃◆ 💠 SHARD HOLDERS:\n` +
            `${alive.map(n => `┃◆   💠 ${n}`).join('\n')}\n` +
            `┃◆ \n` +
            `┃◆ Channel your shard into your weapon.\n` +
            `┃◆ Type *!fuse* when you are ready.\n` +
            `┃◆ \n` +
            `╰═══════════════════════════╯`
    });
}

async function processFuse(playerId, client) {
    if (!battleState.active || !battleState.finalPhase) return { ok: false, reason: 'not_in_final_phase' };
    if (!battleState.shardHolders.has(playerId)) return { ok: false, reason: 'no_shard' };
    const data = battleState.participants.get(playerId);
    if (!data?.alive) return { ok: false, reason: 'dead' };
    if (battleState.fusedPlayers.has(playerId)) return { ok: false, reason: 'already_fused' };

    battleState.fusedPlayers.add(playerId);

    const narrations = [
        `The shard cracks. Light bleeds through — not light, something older. It floods the blade. For a moment the weapon weighs nothing at all.`,
        `The shard does not merge. It surrenders. Every fracture, every chip, every crack formed when the seal broke — pours forward at once.`,
        `The weapon changes. Not in shape. Not in weight. But what was a weapon is now something else. Something the Leviathan was built to fear.`,
        `The shard shatters. The hunter feels the pieces move through them like breath. Like intention. Like anger that has waited a very long time.`,
        `For one second the hunter sees what the shard saw. The original seal. A thousand hunters who died to build it. Their purpose. Now yours.`
    ];
    const narration = narrations[Math.floor(Math.random() * narrations.length)];

    const fusedCount  = battleState.fusedPlayers.size;
    const totalHolders = battleState.shardHolders.size;
    const canStrike   = fusedCount >= MIN_FUSED_TO_STRIKE;

    await sendWithRetry(client, RAID_GROUP, {
        text:
            `╭══〘 💠 SHARD FUSED 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ *${data.nickname}* channels their shard.\n` +
            `┃◆ \n` +
            `┃◆ 〝${narration}〞\n` +
            `┃◆ \n` +
            `┃◆ Fused: ${fusedCount}/${totalHolders}\n` +
            `┃◆ \n` +
            (canStrike
                ? `┃◆ ⚔️ Enough. Type *!finalstrike* now.\n`
                : `┃◆ Waiting for more to fuse...\n`
            ) +
            `╰═══════════════════════════╯`
    });

    return { ok: true, fusedCount, canStrike };
}

async function openFinalStrike(client) {
    if (battleState.strikeOpen) return;
    battleState.strikeOpen = true;

    await sendWithRetry(client, RAID_GROUP, {
        text:
            `╭══〘 ⚔️ FINAL STRIKE OPEN 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ The window is open.\n` +
            `┃◆ \n` +
            `┃◆ All who have fused — type *!finalstrike*\n` +
            `┃◆ You have 5 seconds.\n` +
            `┃◆ \n` +
            `╰═══════════════════════════╯`
    });

    // 5 second window then auto-fire
    battleState.strikeTimer = setTimeout(async () => {
        await executeFinalStrike(client);
    }, FINAL_STRIKE_WINDOW);
}

async function addStriker(playerId, client) {
    if (!battleState.strikeOpen) return { ok: false, reason: 'window_not_open' };
    if (!battleState.fusedPlayers.has(playerId)) return { ok: false, reason: 'not_fused' };
    battleState.strikers.add(playerId);
    return { ok: true };
}

async function executeFinalStrike(client) {
    if (!battleState.active) return;

    // Clear timer if still running
    if (battleState.strikeTimer) { clearTimeout(battleState.strikeTimer); battleState.strikeTimer = null; }

    const strikerNames = [];
    for (const id of battleState.strikers) {
        const data = battleState.participants.get(id);
        if (data) strikerNames.push(data.nickname);
    }

    // Kill the Leviathan
    battleState.hp = 0;
    battleState.active = false;

    await db.execute(
        "UPDATE world_boss SET is_active=0, current_hp=0 WHERE name='The Void Leviathan' AND is_active=1"
    ).catch(() => {});

    // Narration
    await sendWithRetry(client, RAID_GROUP, {
        text:
            `╭══〘 ⚡ THE FINAL STRIKE 〙══╮\n` +
            `┃◆ \n` +
            `┃◆ They strike together.\n` +
            `┃◆ \n` +
            `┃◆ Not with strength.\n` +
            `┃◆ Not with skill.\n` +
            `┃◆ With the weight of something\n` +
            `┃◆ that has waited a very long time\n` +
            `┃◆ to go home.\n` +
            `┃◆ \n` +
            `┃◆ The shards pierce the Leviathan\n` +
            `┃◆ at every point simultaneously.\n` +
            `┃◆ The wound is not a wound.\n` +
            `┃◆ It is a door. Opening inward.\n` +
            `┃◆ \n` +
            `┃◆ The Leviathan does not scream.\n` +
            `┃◆ It exhales.\n` +
            `┃◆ One long sound — not heard,\n` +
            `┃◆ but felt in every bone\n` +
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
            `┃◆ The seal holds again.\n` +
            `┃◆ \n` +
            `┃◆ But something else is moving\n` +
            `┃◆ in the dark.\n` +
            `┃◆ Something that was watching\n` +
            `┃◆ the whole time.\n` +
            `┃◆ Waiting to see if hunters\n` +
            `┃◆ were worth what comes next.\n` +
            `┃◆ \n` +
            `┃◆         — Chapter 4 begins.\n` +
            `┃◆ \n` +
            `╰═══════════════════════════╯`
    });

    resetBattle();
}

module.exports = {
    battleState,
    initBattle,
    processSkillHit,
    processFuse,
    openFinalStrike,
    addStriker,
    executeFinalStrike,
    getShardHolders,
    LEVIATHAN_HP,
    MIN_FUSED_TO_STRIKE
};