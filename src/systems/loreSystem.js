const db = require('../database/db');

// ── Story Chapters ────────────────────────────────────────────────────────────
const CHAPTERS = [
    {
        id: 1,
        title: 'The Awakening',
        subtitle: 'Something stirs in the dark.',
        story: [
            `Before the first dungeon opened, the world was ordinary.`,
            `Then the Gates appeared.`,
            `No warning. No explanation. Just rifts in reality — bleeding`,
            `monsters into the world from somewhere else.`,
            ``,
            `Governments fell. Cities emptied. The old world ended`,
            `in a matter of weeks.`,
            ``,
            `But some people changed.`,
            ``,
            `Their bodies adapted. Their minds sharpened.`,
            `They could enter the Gates. Fight what lived inside.`,
            `Come back out alive.`,
            ``,
            `They were called Hunters.`,
            ``,
            `You are one of them.`,
            ``,
            `The system has recognised you.`,
            `Your record has been created.`,
            `Your rank: F.`,
            ``,
            `Every legend starts somewhere.`,
            `This is yours.`
        ],
        unlock_rank: null, // available from start
        teaser:
            `The Gates are open.\n` +
            `┃◆ The monsters are real.\n` +
            `┃◆ The question is whether you are too.`
    },
    {
        id: 2,
        title: 'The Fracture',
        subtitle: 'The seal is breaking.',
        story: [
            `The dungeons were supposed to be contained.`,
            ``,
            `The Gates opened — yes. Monsters poured through — yes.`,
            `But the system kept them manageable. Ranked. Measured.`,
            `It gave hunters a fighting chance.`,
            ``,
            `Something has changed.`,
            ``,
            `Void Shards have begun appearing inside dungeons —`,
            `crystallised fragments of an energy that should not exist here.`,
            `They pulse with a frequency that disrupts the system.`,
            ``,
            `The researchers have a theory.`,
            `They are not sharing it publicly.`,
            ``,
            `But the hunters who have collected enough shards`,
            `report the same dream — a dark ocean. A shape beneath.`,
            `Something enormous. Waiting.`,
            ``,
            `The seal is cracking.`,
            ``,
            `Whatever was kept out is almost through.`
        ],
        unlock_rank: 'E',
        teaser:
            `Void Shards don't belong in this world.\n` +
            `┃◆ Something sent them here.\n` +
            `┃◆ Something is coming through.`
    },
    {
        id: 3,
        title: 'The Void War',
        subtitle: 'The ancient ones have arrived.',
        story: [
            `The seal broke three days ago.`,
            ``,
            `The researchers called it a Level Zero event.`,
            `They had a protocol for it — evacuate, contain, pray.`,
            ``,
            `It didn't help.`,
            ``,
            `The Void Leviathan emerged from the largest Gate ever recorded.`,
            `It is not a monster. It is not a boss.`,
            `It is something older than the system itself —`,
            `something the Gates were built to keep locked away.`,
            ``,
            `Normal weapons do nothing.`,
            `Normal hunters die on contact.`,
            ``,
            `But the Void Shards — the ones the hunters collected —`,
            `they react to it. Burn against it.`,
            ``,
            `The only thing that can stop it`,
            `is every hunter. Together.`,
            ``,
            `This is not a dungeon run.`,
            `This is a war.`
        ],
        unlock_rank: 'C',
        teaser:
            `It is here.\n` +
            `┃◆ The Void Leviathan has breached the seal.\n` +
            `┃◆ All hunters are required.`
    },
    {
        id: 4,
        title: 'The Reckoning',
        subtitle: 'The fallen hunter must be stopped.',
        story: [
            `The Leviathan fell.`,
            ``,
            `It cost more than anyone expected.`,
            `But the hunters held. The world survived.`,
            ``,
            `Then the system flagged an anomaly.`,
            ``,
            `A registrationId that should not exist anymore.`,
            `A hunter who reached Rank S decades ago —`,
            `before the modern system existed —`,
            `and kept pushing. Past the limit.`,
            ``,
            `The void consumed him.`,
            `It gave him back — wrong.`,
            ``,
            `Malachar the Undying.`,
            ``,
            `He does not fight for the void.`,
            `He does not fight for humanity.`,
            `He fights because the system runs —`,
            `and as long as it runs, so does he.`,
            ``,
            `He cannot be reasoned with.`,
            `He cannot be bargained with.`,
            ``,
            `He can only be stopped.`,
            ``,
            `This ends here.`
        ],
        unlock_rank: 'A',
        teaser:
            `Malachar is not a boss.\n` +
            `┃◆ He is what happens when a hunter refuses to die.\n` +
            `┃◆ He must be put to rest.`
    }
];

// ── Dungeon Lore Flavour Text ─────────────────────────────────────────────────
// Shown randomly in dungeon announcements based on current chapter
const DUNGEON_LORE = {
    1: [
        `The gate pulses with an eerie light. Something waits inside.`,
        `Monsters have been sighted in the area. Proceed with caution.`,
        `The system has detected heightened activity. A dungeon has opened.`,
        `Another rift in reality. Another chance to prove yourself.`,
        `The air smells like ozone and blood. The gate is open.`
    ],
    2: [
        `The dungeon walls pulse with void energy. Something feels different.`,
        `Hunters report strange crystalline growths inside. Void Shards.`,
        `The monsters inside seem... agitated. More than usual.`,
        `A fracture in the dungeon wall leaks void energy. Be careful.`,
        `The seal weakens with every dungeon that opens. Fight anyway.`
    ],
    3: [
        `The Leviathan's presence warps reality. The dungeon feels unstable.`,
        `Void-touched monsters everywhere. The corruption spreads.`,
        `Fight hard. Every dungeon cleared weakens the Leviathan's forces.`,
        `The sky outside the gate is the wrong colour. Don't look up.`,
        `Every shard collected is a wound against the void. Keep hunting.`
    ],
    4: [
        `Malachar was spotted near this Gate. His presence corrupts everything.`,
        `The system flickers when he is near. Stay focused.`,
        `This dungeon bears his mark. The enemies inside serve him now.`,
        `He watches every battle. He is learning. So must you.`,
        `The final chapter is written by hunters. Make it worth reading.`
    ]
};

// ── DB Setup ──────────────────────────────────────────────────────────────────
async function ensureTables() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS aria_story (
            id           INT AUTO_INCREMENT PRIMARY KEY,
            current_chapter INT DEFAULT 1,
            updated_at   DATETIME DEFAULT NOW()
        )
    `).catch(() => {});

    // Seed default row
    await db.execute(`
        INSERT IGNORE INTO aria_story (id, current_chapter) VALUES (1, 1)
    `).catch(() => {});
}

async function getCurrentChapter() {
    await ensureTables();
    const [rows] = await db.execute("SELECT current_chapter FROM aria_story WHERE id=1");
    return rows[0]?.current_chapter || 1;
}

async function setChapter(chapterNum) {
    await ensureTables();
    await db.execute(
        "UPDATE aria_story SET current_chapter=?, updated_at=NOW() WHERE id=1",
        [chapterNum]
    );
}

function getChapterData(chapterNum) {
    return CHAPTERS.find(c => c.id === chapterNum) || CHAPTERS[0];
}

function getRandomDungeonLore(chapterNum) {
    const loreList = DUNGEON_LORE[chapterNum] || DUNGEON_LORE[1];
    return loreList[Math.floor(Math.random() * loreList.length)];
}

module.exports = {
    CHAPTERS,
    getCurrentChapter,
    setChapter,
    getChapterData,
    getRandomDungeonLore,
    ensureTables
};