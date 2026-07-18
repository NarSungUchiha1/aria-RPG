const db = require('../database/db');

const CHAPTERS = [
    {
        id: 1,
        title: 'The Long Dusk',
        subtitle: 'The day the sun went quiet.',
        story: [
            `Nobody agrees on the exact moment the sun hollowed.`,
            ``,
            `There was no flash. No roar. No warning shot across the sky.`,
            `People describe it the way you describe a sound stopping —`,
            `you do not notice the moment it ends. You notice the silence after.`,
            ``,
            `The light simply stopped being warm.`,
            ``,
            `It still hangs there. Same place. Same size. A perfect disc`,
            `the colour of an old coin. It casts no shadows anymore.`,
            `Shadows need conviction, and the sun has none left.`,
            `The scientists called it an optical phenomenon for nine days.`,
            `On the tenth day the instruments agreed on something impossible:`,
            `the sun was empty. A shell. A lantern with no flame inside.`,
            ``,
            `Something had reached into it and scooped it out`,
            `the way you core a fruit. From the inside.`,
            ``,
            `The world did not end. That was the strange part.`,
            `Crops still grow, slower, greyer. Rivers still run.`,
            `But in the long dusk that never lifts, the dark grew teeth.`,
            `Things that used to be rumours started leaving footprints.`,
            `Things that used to be footprints started leaving bodies.`,
            ``,
            `Then the Hunters appeared.`,
            ``,
            `Ordinary people who woke up one morning able to SEE in the gloom —`,
            `not just shapes. Intent. Heat. The seams where the dark stitches`,
            `itself together. A second sight nobody asked for.`,
            ``,
            `The System found them eventually. It always does.`,
            `It catalogued them. Ranked them. Gave them structure,`,
            `because structure is the only thing standing between`,
            `a Hunter and the thing a Hunter becomes without one.`,
            ``,
            `You are Rank F.`,
            ``,
            `That is not an insult. Every blade that ever mattered`,
            `was cold iron once.`,
            ``,
            `The dusk is long. The dark is patient.`,
            `Time to find out what you woke up as.`
        ],
        teaser:
            `The sun still rises. It just stopped meaning anything.\n` +
            `┃◆ In the dusk that never lifts, the dark grew teeth.\n` +
            `┃◆ And people like you started waking up different.`
    },
    {
        id: 2,
        title: 'Shardfall',
        subtitle: 'Pieces of the true sun are falling.',
        story: [
            `The first Sunshard fell on a fishing village with no name`,
            `worth printing. It came down slow — witnesses all say slow —`,
            `like it was looking for somewhere specific to land.`,
            ``,
            `It burned for six days. Not the village. Just itself.`,
            `A fragment of light the size of a door, standing upright`,
            `in a crater, humming at a frequency that made dogs howl`,
            `and old wounds ache.`,
            ``,
            `Hunters who touch a Shard report the same dream.`,
            `Always the same dream.`,
            ``,
            `A hand. Vast beyond geometry. Closing around a star —`,
            `not crushing it. Cradling it. The way a thief cradles`,
            `a thing he has wanted for a very long time.`,
            `And from inside the star, a voice that is not words:`,
            ``,
            `REMEMBER ME.`,
            ``,
            `The researchers concluded three things before their funding`,
            `and then their building and then two of their bodies vanished.`,
            ``,
            `One. The Shards are pieces of the TRUE sun — the flame`,
            `that was taken, not the shell that remains.`,
            ``,
            `Two. They are not falling. They are escaping.`,
            ``,
            `Three. They are looking for something down here.`,
            `Or someone.`,
            ``,
            `The Shards burn. The Shards search. The Shards remember.`,
            `Whatever hollowed the sun did not finish the job —`,
            `and the pieces it left behind have not forgiven it.`
        ],
        unlock_rank: 'E',
        teaser:
            `Pieces of the true sun are falling from the hollow shell.\n` +
            `┃◆ They burn. They search. They remember.\n` +
            `┃◆ And they are looking for someone down here.`
    },
    {
        id: 3,
        title: 'The Umbral Tide',
        subtitle: 'The dark has chosen kings.',
        story: [
            `In the third year of the Long Dusk, the dark stopped being wild.`,
            ``,
            `Hunters noticed it first in the dungeons. The beasts stopped`,
            `hunting like animals and started moving like soldiers.`,
            `Flanks. Feints. Retreats that were not retreats.`,
            `Something in the deep gloom was TEACHING them.`,
            ``,
            `Then came the night the Umbral Tide rolled over the eastern`,
            `watchtowers — a dark that moved against the wind, that put out`,
            `torches by consent rather than force. When it receded,`,
            `the towers stood empty. Not destroyed. Empty.`,
            `Beds made. Meals half-eaten. Doors locked from the inside.`,
            ``,
            `Humanity did what humanity does when the sky stops helping.`,
            `It argued.`,
            ``,
            `The DAWNWATCH swear the sun can be re-lit — that the shell`,
            `can be re-fired like a cold forge, if enough Shards are gathered,`,
            `if enough is sacrificed. They keep watch facing east. Always east.`,
            ``,
            `The UMBRAL COURT knelt to the dark and found that the dark`,
            `promotes from within. They wear the night like a crown`,
            `and call the rest of us mourners at a funeral for a fire.`,
            ``,
            `The LAST LIGHT ask the only question that matters:`,
            `WHO. Not what happened. Not what now. Who TOOK it.`,
            `Because a theft has a thief, and a thief has a name,`,
            `and a name can be hunted.`,
            ``,
            `Three answers to a hollow sky.`,
            `The dungeons deepen. The Tide rises a little every month.`,
            `Pick a side before the dark picks one for you.`
        ],
        unlock_rank: 'C',
        teaser:
            `The dark stopped being wild. It organised.\n` +
            `┃◆ Three factions rose to answer a hollow sky.\n` +
            `┃◆ Pick a side before the dark picks one for you.`
    },
    {
        id: 4,
        title: 'The Hollow Crown',
        subtitle: 'The thief has a name.',
        story: [
            `Before the Long Dusk, there was an order of hunters`,
            `whose whole purpose was the sun.`,
            ``,
            `Not worship. Maintenance. They believed the sun was not`,
            `a thing but a WOUND — the one place where the first light`,
            `broke through the original dark, and that it had to be`,
            `kept open the way a wound is kept clean.`,
            ``,
            `Their greatest was called the Dawnwright.`,
            `No statue remembers his face. That is not an accident.`,
            ``,
            `The records that survive agree on this much:`,
            `the sun was dying long before it hollowed. Guttering.`,
            `The Dawnwright saw it first, and the order voted to let it —`,
            `to let the wound close, to let the original dark come home.`,
            `They were tired. Eternity is heavy and the pay is nothing.`,
            ``,
            `He was not tired.`,
            ``,
            `He went in alone. Reached into the guttering flame`,
            `to hold it open with his hands. With his name. With everything.`,
            ``,
            `Understand this part, because it is the part that matters:`,
            `he did not fail.`,
            ``,
            `He held the sun open. He is holding it open right now.`,
            `But a man is a small container for that much fire,`,
            `and what burned away first was everything that was man.`,
            `What remains wears the shell of the sun as a crown`,
            `and cannot remember why it reached in —`,
            `only that everything it loved is on the other side of letting go.`,
            ``,
            `The Hollow King is not the thief.`,
            `The Hollow King is the theft — still happening,`,
            `every second, for three years and counting.`,
            ``,
            `The Shards are what slips through his fingers.`,
            `They are looking for someone strong enough`,
            `to make him let go.`,
            ``,
            `He cannot be saved. He can only be finished.`,
            `Bring him a sunset. He has earned one.`
        ],
        unlock_rank: 'A',
        teaser:
            `He reached into the dying sun to hold it open.\n` +
            `┃◆ He did not fail. That is the tragedy.\n` +
            `┃◆ The Hollow King must be given his sunset.`
    }
];

const DUNGEON_LORE = {
    1: [
        `The dungeon exhales cold air that has never known daylight. Whatever waits inside was born after the sun went quiet.`,
        `Hunters mark the entrance with a lit candle. If the flame turns blue, you do not go in. The flame is blue more often lately.`,
        `The System logs casualties in this dungeon class every week. The numbers climb a little each month, like the dark is practicing.`,
        `First timers always say the gloom feels solid. Like walking into water. By the third stage they stop saying anything at all.`,
        `The beasts inside are ranked. Measured. Manageable. That is what the System says. The System was built when the sun still worked.`
    ],
    2: [
        `Shardfall was heard here last night — a sound like glass singing. If a Sunshard came down inside, it will still be burning.`,
        `The walls of this one glitter faintly. Not minerals. Fragments. Something bright died in here and never stopped smoldering.`,
        `Hunters who touched the light in the deep rooms all report the same dream. A hand. A star. A voice saying REMEMBER ME.`,
        `The dark in this dungeon moves against the draft. It has learned to swim upstream. Do not follow it to where it is going.`,
        `Whatever hollowed the sun left fingerprints in places like this. The Last Light pays well for anyone who maps them.`
    ],
    3: [
        `The Umbral Tide passed through this region twice. Both times, the dungeon doors were found open afterward. From the inside.`,
        `The beasts here move like soldiers now. Flanks. Feints. Someone — something — in the deep gloom is teaching them.`,
        `Dawnwatch scouts sealed this entrance last month. The seal is gone. Not broken. Gone, like it was never there.`,
        `The Umbral Court claims territory in dungeons like this one. If you see a throne of shadow in the lower halls, bow or run.`,
        `Three factions want what is at the bottom of this place. None of them will say what it is. All of them are recruiting.`
    ],
    4: [
        `This deep, the gloom bends toward one point on the horizon — toward the crown. Everything down here leans toward the Hollow King.`,
        `The Shards fall thickest around dungeons like this. They are not falling. They are escaping through his fingers.`,
        `Hunters at this depth hear it sometimes: a heartbeat under the stone, slow as centuries. He is still holding on. He is still holding on.`,
        `The Dawnwright's order kept vaults at this depth once. The doors are melted from the inside. Whatever he became, it passed this way.`,
        `He cannot be saved. He can only be finished. Every blade sharpened in this dungeon brings his sunset one hour closer.`
    ]
};

async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS aria_story (
            id              INT AUTO_INCREMENT PRIMARY KEY,
            current_chapter INT DEFAULT 1,
            updated_at      DATETIME DEFAULT NOW()
        )
    `).catch(() => {});
    await db.execute(`INSERT IGNORE INTO aria_story (id, current_chapter) VALUES (1, 1)`).catch(() => {});
}

async function getCurrentChapter() {
    await ensureTables();
    const [rows] = await db.execute("SELECT current_chapter FROM aria_story WHERE id=1");
    return rows[0]?.current_chapter || 1;
}

async function setChapter(chapterNum) {
    await ensureTables();
    await db.execute("UPDATE aria_story SET current_chapter=?, updated_at=NOW() WHERE id=1", [chapterNum]);
}

function getChapterData(chapterNum) {
    return CHAPTERS.find(c => c.id === chapterNum) || CHAPTERS[0];
}

function getRandomDungeonLore(chapterNum) {
    const loreList = DUNGEON_LORE[chapterNum] || DUNGEON_LORE[1];
    return loreList[Math.floor(Math.random() * loreList.length)];
}

// Auto-advance story based on total dungeon clears across all players
async function checkStoryProgress(client, raidGroup) {
    try {
        const currentChapter = await getCurrentChapter();
        const thresholds = { 1: 50, 2: 150, 3: 300, 4: 500 }; // clears needed per chapter
        const threshold = thresholds[currentChapter];
        if (!threshold) return; // already at max chapter

        const db = require('../database/db');
        const [rows] = await db.execute('SELECT COUNT(*) as cnt FROM dungeon WHERE is_active=0 AND locked=1');
        const totalClears = rows[0]?.cnt || 0;

        if (totalClears >= threshold) {
            const next = currentChapter + 1;
            await setChapter(next);
            const chapter = CHAPTERS.find(c => c.id === next);
            if (chapter && client && raidGroup) {
                for (const line of chapter.story.slice(0, 3)) { // only first 3 lines to avoid spam
                    if (!line) continue;
                    await client.sendMessage(raidGroup, { text: line });
                    await new Promise(r => setTimeout(r, 3000));
                }
            }
        }
    } catch(e) {}
}

module.exports = {
    CHAPTERS,
    getCurrentChapter,
    setChapter,
    getChapterData,
    getRandomDungeonLore,
    ensureTables
};