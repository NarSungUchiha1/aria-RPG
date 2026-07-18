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
            at: 30, flag: 'ch1_blue_flame',
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
                '┃★ *DUSKSPAWN* may invade F–D dungeons.\n' +
                '┃★ Kill them. Do not let them grow.\n' +
                '┃★\n' +
                '╚═══════════════════════════╝'
        },
        {
            at: 60, flag: 'ch1_whelps',
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
            at: 100, flag: 'ch1_boss_ready', bossReady: true,
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
        '╚═══════════════════════════════╝'
};

// Runs on dungeon clears (called from loreSystem.checkStoryProgress).
async function runStoryMilestones(client, raidGroup) {
    try {
        const { getCurrentChapter } = require('./loreSystem');
        const chapter = await getCurrentChapter();
        const events = CHAPTER_EVENTS[chapter];
        if (!events) return;

        const [rows] = await db.execute('SELECT COUNT(*) as cnt FROM dungeon WHERE is_active=0 AND locked=1');
        const totalClears = rows[0]?.cnt || 0;

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

// Invasion chance rises after The Whelps event.
async function duskspawnChance() {
    return (await getFlag('ch1_whelps')) === '1' ? 0.14 : 0.08;
}

module.exports = { CHAPTER_EVENTS, CHAPTER_EPILOGUE, runStoryMilestones, duskspawnActive, duskspawnChance };
