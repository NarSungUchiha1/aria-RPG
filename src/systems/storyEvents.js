/**
 * STORY-MODE EVENT ENGINE
 * Each chapter is a SERIES of events driven by total community dungeon clears.
 * Milestones fire once (game_flags), post their announcement, and the final
 * milestone unlocks the chapter boss (storyboss_N_ready → !spawn <BOSS>).
 * Killing the boss advances the chapter (handled in onward.js).
 *
 * Content is per-chapter; only Chapter 1 is authored so far — later chapters
 * get their own event series when their day comes.
 */
const db = require('../database/db');
const { getFlag, setFlag } = require('./gameFlags');

const CHAPTER_EVENTS = {
    1: [
        {
            at: 30, flag: 'ch1_blue_flame', title: 'The Blue Flame',
            text:
                '╔══〘 🕯️ THE BLUE FLAME 〙══╗\n' +
                '┃★\n' +
                '┃★ The candles hunters leave at\n' +
                '┃★ dungeon mouths are turning BLUE.\n' +
                '┃★ Every one of them. Everywhere.\n' +
                '┃★\n' +
                '┃★ The old rule says: blue flame,\n' +
                '┃★ do not go in.\n' +
                '┃★ There are too many dungeons now\n' +
                '┃★ to follow old rules.\n' +
                '┃★\n' +
                '┃★ ⚠️ Something young and hungry has\n' +
                '┃★ begun slipping into the low halls.\n' +
                '┃★ *DUSKSPAWN* may invade F–D and\n' +
                '┃★ PF–PD dungeons — and those gates\n' +
                '┃★ are tearing open far more often.\n' +
                '┃★ Kill them. Do not let them grow.\n' +
                '┃★\n' +
                '╚═══════════════════════════╝'
        },
        {
            at: 60, flag: 'ch1_whelps', title: 'The Whelps',
            text:
                '╔══〘 🐾 THE WHELPS 〙══╗\n' +
                '┃★\n' +
                '┃★ A Dawnwatch patrol found the nest.\n' +
                '┃★ Empty. Warm.\n' +
                '┃★\n' +
                '┃★ The things invading the dungeons\n' +
                '┃★ are not strays. They are YOUNG.\n' +
                '┃★ Newborn dusk, teething on the\n' +
                '┃★ weakest halls first.\n' +
                '┃★\n' +
                '┃★ Which raises the only question\n' +
                '┃★ that matters:\n' +
                '┃★\n' +
                '┃★ 〝If these are the whelps —\n' +
                '┃★  where is the FIRSTBORN?〞\n' +
                '┃★\n' +
                '┃★ ⚠️ Invasions are intensifying.\n' +
                '┃★\n' +
                '╚═══════════════════════════╝'
        },
        {
            at: 100, flag: 'ch1_boss_ready', bossReady: true, title: 'The Firstborn Stirs',
            text:
                '╔══〘 🌑 THE FIRSTBORN STIRS 〙══╗\n' +
                '┃★\n' +
                '┃★ The invasions have stopped.\n' +
                '┃★ All of them. At once.\n' +
                '┃★\n' +
                '┃★ The whelps have gone home —\n' +
                '┃★ and something is calling them.\n' +
                '┃★ The first thing the Long Dusk\n' +
                '┃★ ever birthed. The first dark\n' +
                '┃★ that learned to be a body.\n' +
                '┃★\n' +
                '┃★ 👁️ *VESPERION, THE FIRSTBORN DUSK*\n' +
                '┃★ has risen from the nest.\n' +
                '┃★\n' +
                '┃★ The hunt can now be called.\n' +
                '┃★ Gather everyone. You will need\n' +
                '┃★ every blade.\n' +
                '┃★\n' +
                '╚═══════════════════════════╝'
        }
    ]
    // Chapters 2–4: authored later, same shape.
};

// Chapter epilogues — posted when the chapter boss falls (see onward.js).
const CHAPTER_EPILOGUE = {
    1:
        '╔══〘 📖 CHAPTER I — COMPLETE 〙══╗\n' +
        '┃★\n' +
        '┃★ The Firstborn Dusk is dead.\n' +
        '┃★\n' +
        '┃★ For one night, the candles at the\n' +
        '┃★ dungeon mouths burned ORANGE again.\n' +
        '┃★ Old hunters wept and pretended\n' +
        '┃★ it was the smoke.\n' +
        '┃★\n' +
        '┃★ But when they buried the beast,\n' +
        '┃★ they found something in its gut:\n' +
        '┃★ a fragment of light, still burning.\n' +
        '┃★ Still SEARCHING.\n' +
        '┃★\n' +
        '┃★ It had eaten a piece of the sun.\n' +
        '┃★ And it is not the only one.\n' +
        '┃★\n' +
        '┃★ 〘 CHAPTER II — SHARDFALL 〙\n' +
        '┃★ begins.\n' +
        '┃★\n' +
        '╚═══════════════════════════════╝',

    2:
        '╔══〘 📖 CHAPTER II — COMPLETE 〙══╗\n' +
        '┃★\n' +
        '┃★ The Cindermaws are dead.\n' +
        '┃★ Every one of you killed your own.\n' +
        '┃★\n' +
        '┃★ They cut the beasts open expecting\n' +
        '┃★ light. What they found was a shard\n' +
        '┃★ gone COLD — spent, like something\n' +
        '┃★ had already drunk it.\n' +
        '┃★\n' +
        '┃★ The shards were never falling.\n' +
        '┃★ They were being PULLED down.\n' +
        '┃★ Something below has been eating\n' +
        '┃★ the sun a piece at a time, and it\n' +
        '┃★ used the beasts to carry them.\n' +
        '┃★\n' +
        '┃★ That night the dark did something\n' +
        '┃★ it had never done before.\n' +
        '┃★ It moved with a purpose.\n' +
        '┃★\n' +
        '┃★ 〘 CHAPTER III — THE UMBRAL TIDE 〙\n' +
        '┃★ begins.\n' +
        '┃★\n' +
        '╚═══════════════════════════════╝'
};

/**
 * THE authoritative count of completed dungeons. Everything that reports or
 * gates on clears must call this — the milestone engine and !progress both do,
 * so they can never drift apart.
 *
 * `dungeon.clear_announced` is set once when a dungeon is actually completed
 * (onward.js). We can't key off `locked`, which was the original bug: closing a
 * dungeon sets locked=0, so the old `is_active=0 AND locked=1` matched nothing
 * and the count sat at 0 forever — no milestone could ever fire.
 */
let _clearsBackfilled = false;
async function countTotalClears(sinceHours = null) {
    // Migration guarded: this runs on every stage advance, every clear and
    // every !progress. An ALTER per call is a metadata lock plus a round-trip
    // to a remote DB — it belongs behind the once-per-process flag, not in
    // front of it.
    if (!_clearsBackfilled) {
        await db.execute('ALTER TABLE dungeon ADD COLUMN clear_announced TINYINT DEFAULT 0').catch(() => {});
        // One-time: credit dungeons completed before the flag existed. A party
        // that wiped ON the final stage is indistinguishable here and may be
        // counted; only affects pre-flag history.
        await db.execute(
            'UPDATE dungeon SET clear_announced=1 WHERE clear_announced=0 AND is_active=0 AND stage >= max_stage'
        ).catch(() => {});
        _clearsBackfilled = true;
    }
    const sql = sinceHours
        ? 'SELECT COUNT(*) as cnt FROM dungeon WHERE clear_announced=1 AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)'
        : 'SELECT COUNT(*) as cnt FROM dungeon WHERE clear_announced=1';
    const [rows] = await db.execute(sql, sinceHours ? [sinceHours] : []).catch(() => [[{ cnt: 0 }]]);
    return Number(rows[0]?.cnt || 0);
}

// Runs on dungeon clears (called from loreSystem.checkStoryProgress).
async function runStoryMilestones(client, raidGroup) {
    try {
        const { getCurrentChapter } = require('./loreSystem');
        const chapter = await getCurrentChapter();
        const events = CHAPTER_EVENTS[chapter];
        if (!events) return;

        const totalClears = await countTotalClears();

        for (const ev of events) {
            if (totalClears < ev.at) continue;
            if ((await getFlag(ev.flag)) === '1') continue;
            await setFlag(ev.flag, '1');
            if (ev.bossReady) await setFlag(`storyboss_${chapter}_ready`, '1');
            if (client && raidGroup) {
                await client.sendMessage(raidGroup, { text: ev.text }).catch(() => {});
            }
            console.log(`📖 Story event fired: ch${chapter} "${ev.flag}" (${totalClears} clears)`);
        }
    } catch (e) { console.error('Story milestone error:', e.message); }
}

// Where the whelps hunt: the low halls of BOTH ladders. They teethe on the
// weakest dungeons, normal and prestige alike.
const DUSKSPAWN_RANKS = ['F', 'E', 'D', 'PF', 'PE', 'PD'];
function duskspawnRanks() { return DUSKSPAWN_RANKS; }
function isDuskspawnRank(rank) { return DUSKSPAWN_RANKS.includes(rank); }

// Blue-Flame flavour for the spawn announcement of an affected dungeon, so the
// event is visible the moment a portal opens — not only when one invades.
function blueFlameSpawnNote() {
    const lines = [
        'The candle at this gate is burning BLUE.',
        'Blue flame at the mouth. Nobody puts it out anymore.',
        'The candle guttered blue before anyone stepped through.',
        'Blue light on the threshold. Something young is nesting deep.'
    ];
    return `┃◆ 🕯️ ${lines[Math.floor(Math.random() * lines.length)]}\n┃◆ \n`;
}

// Duskspawn invasions are live only between The Blue Flame and boss-ready.
async function duskspawnActive() {
    try {
        const { getCurrentChapter } = require('./loreSystem');
        if ((await getCurrentChapter()) !== 1) return false;
        if ((await getFlag('ch1_blue_flame')) !== '1') return false;
        if ((await getFlag('ch1_boss_ready')) === '1') return false; // they went home
        return true;
    } catch (e) { return false; }
}

// Per-stage invasion chance. Rolled on EVERY stage (including stage 1), so a
// 50% base means most runs meet at least one whelp — the event should be the
// thing players notice, not a rare curiosity. Rises after The Whelps.
async function duskspawnChance() {
    return (await getFlag('ch1_whelps')) === '1' ? 0.65 : 0.50;
}

module.exports = {
    CHAPTER_EVENTS, CHAPTER_EPILOGUE, countTotalClears, runStoryMilestones,
    duskspawnActive, duskspawnChance, duskspawnRanks, isDuskspawnRank,
    blueFlameSpawnNote
};
