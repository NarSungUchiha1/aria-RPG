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
        `The Gate smells like metal and something older. Like a room that has been sealed for centuries and finally opened.`,
        `Hunters who came back from this one did not talk much. That is usually a good sign. Usually.`,
        `The System logged forty seven casualties in this dungeon class last week. The week before it was thirty one. Something is changing.`,
        `First timers always say the same thing. They say it did not feel real until it did. By then it is too late to turn back.`,
        `The monsters inside are ranked. Measured. Manageable. That is what the System says. The System has been wrong before.`
    ],
    2: [
        `Three Hunters who cleared this dungeon reported the same dream that night. A dark ocean. Something beneath it. Moving.`,
        `The Void Shards found here are small. Unstable. The researchers say they are harmless. The researchers also said the Gates were temporary.`,
        `Something in the dungeon is different today. The monsters are agitated in a way that does not match their rank. Pay attention.`,
        `The seal weakens every time a dungeon opens. Every time one closes. The System does not know why. It is still calculating.`,
        `A Hunter left a message scratched into the dungeon wall at Stage 3. It said: it knows we are here. Nobody has figured out what that means yet.`
    ],
    3: [
        `The Leviathan does not need to send monsters. The monsters come because the void calls them. Because fear travels faster than commands.`,
        `Every dungeon cleared today is a message. We are still here. We are still fighting. Send more.`,
        `The sky outside the Gate looks wrong. Not dangerous wrong. Just wrong. Like someone changed something small and fundamental about the colour of things.`,
        `The Hunters who carry Void Shards into dungeons report that the monsters hesitate before attacking them. A fraction of a second. It is enough.`,
        `There is a theory that the Leviathan can feel every dungeon that opens. If that is true then every raid is a provocation. Good.`
    ],
    4: [
        `the Hollow King was seen near a Gate matching this dungeon's signature. Whatever he is looking for he has not found it yet.`,
        `The monsters inside bear a mark the System cannot identify. Not a void mark. Something older. Something that belongs to him.`,
        `He does not rush. He does not retreat. He studies. Every Hunter who survives an encounter with him says the same thing. He was watching them learn.`,
        `There is one thing Aldric Voss could never do in life. Give up. Whatever he became it kept that much. Use it against him.`,
        `The System flagged an anomaly near this Gate. A registrationId that should not exist anymore. He has been here. Recently.`
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