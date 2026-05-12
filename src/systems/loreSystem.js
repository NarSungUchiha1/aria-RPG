const db = require('../database/db');

const CHAPTERS = [
    {
        id: 1,
        title: 'The Awakening',
        subtitle: 'Something stirs in the dark.',
        story: [
            `Nobody remembers the exact moment the first Gate opened.`,
            ``,
            `That is the part that haunts people. Not the monsters.`,
            `Not the cities that burned. Not the governments that collapsed`,
            `in seventy two hours like they were never real to begin with.`,
            ``,
            `The part that haunts people is that no one saw it coming.`,
            ``,
            `One morning the sky above Nairobi split open like a wound`,
            `and something stepped through. By the time the cameras caught it`,
            `there were already seventeen more Gates across six continents.`,
            `By the time the military responded there were hundreds.`,
            `By the time the world understood what was happening`,
            `it was too late to do anything but survive.`,
            ``,
            `The monsters were not mindless. That was the second shock.`,
            `They moved with intent. They targeted infrastructure first.`,
            `Power grids. Water systems. Communication towers.`,
            `Whatever was sending them through understood how civilisation worked`,
            `and it wanted it gone.`,
            ``,
            `Then the Hunters appeared.`,
            ``,
            `No announcement. No explanation. Just ordinary people`,
            `who woke up one day different. Stronger. Faster. Aware`,
            `in a way they could not put into words. Like a second set`,
            `of senses had switched on overnight.`,
            ``,
            `Some of them walked into Gates and did not come back.`,
            `Some of them walked into Gates and came back with blood on their hands`,
            `and something new in their eyes.`,
            ``,
            `The System found them eventually. It always does.`,
            `It catalogued them. Ranked them. Gave them structure`,
            `because structure is the only thing standing between`,
            `a Hunter and the thing a Hunter could become`,
            `without something to answer to.`,
            ``,
            `You are Rank F.`,
            ``,
            `That is not an insult. Every Hunter who ever mattered`,
            `started exactly where you are standing.`,
            ``,
            `The Gates are open. The world needs what you are becoming.`,
            `The only question is whether you are ready to find out`,
            `what that actually is.`
        ],
        teaser:
            `The Gates appeared without warning.\n` +
            `┃◆ The world fell in seventy two hours.\n` +
            `┃◆ And then people like you started waking up different.`
    },
    {
        id: 2,
        title: 'The Fracture',
        subtitle: 'The seal is breaking.',
        story: [
            `There is a file that does not officially exist.`,
            ``,
            `The researchers call it the Cradle Report.`,
            `It was written eight months after the first Gate opened`,
            `by a team of seven scientists who were studying`,
            `the energy signature the Gates emit.`,
            ``,
            `Five of those scientists have since disappeared.`,
            `One retired and refuses to speak to anyone.`,
            `The last one gave a single interview before going silent.`,
            `She said one thing worth remembering.`,
            ``,
            `She said the Gates were not the invasion.`,
            `The Gates were the lock.`,
            ``,
            `Whatever created them was not trying to let things in.`,
            `It was trying to keep something else from getting out.`,
            ``,
            `The Void Shards started appearing six weeks ago.`,
            `Small crystalline fragments found deep inside dungeons`,
            `after high tier enemies were killed. They pulse at a frequency`,
            `that no existing instrument was built to measure.`,
            `They interfere with the System. They make Hunters uneasy`,
            `in a way none of them can fully explain.`,
            ``,
            `The ones who have held a Shard long enough report the same thing.`,
            `A dream. Always the same dream.`,
            ``,
            `A dark ocean with no shore and no sky.`,
            `And beneath the surface something moving.`,
            `Something so large that when it shifts`,
            `the water does not ripple. It heaves.`,
            ``,
            `The Cradle Report concluded that the Gates were built`,
            `by something ancient as a containment structure.`,
            `Not to protect humanity. Humanity did not exist yet`,
            `when the Gates were made.`,
            ``,
            `To contain what was already here.`,
            ``,
            `The Shards are not loot.`,
            `They are warnings.`,
            ``,
            `The seal is cracking.`,
            `And whatever is on the other side`,
            `has been waiting a very long time.`
        ],
        unlock_rank: 'E',
        teaser:
            `The Gates were not built to let things in.\n` +
            `┃◆ They were built to keep something in.\n` +
            `┃◆ The Void Shards are proof the seal is failing.`
    },
    {
        id: 3,
        title: 'The Void War',
        subtitle: 'The ancient ones have arrived.',
        story: [
            `The seal broke on a Tuesday.`,
            ``,
            `Nobody chose Tuesday. It just happened to be Tuesday.`,
            `The world does not wait for a dramatic moment.`,
            `It breaks when it breaks and you deal with it or you don't.`,
            ``,
            `The Void Leviathan emerged from coordinates that should`,
            `have been empty ocean. The Gate that opened was not`,
            `like other Gates. It was not a rift or a tear.`,
            `It was more like reality simply stepped aside`,
            `and made room for something that had`,
            `always been there waiting.`,
            ``,
            `The first military response lasted four minutes.`,
            ``,
            `The Leviathan is not a monster in the way Hunters understand monsters.`,
            `It does not attack because it is hungry or territorial.`,
            `It does not have a rank the System can assign.`,
            `When Hunters attempted to engage it the System`,
            `flagged an error that no one had ever seen before.`,
            ``,
            `ENTITY UNCLASSIFIABLE. THREAT LEVEL: UNDEFINED.`,
            ``,
            `What they know is this.`,
            `It was sealed away before human civilisation existed.`,
            `Whatever sealed it used something of itself to do it.`,
            `The Void Shards are fragments of that sacrifice.`,
            ``,
            `Which means the Hunters who collected them`,
            `are carrying pieces of the only weapon`,
            `that has ever actually worked against it.`,
            ``,
            `This is not a dungeon run.`,
            `There is no reward at the end. No rank up.`,
            `No gold waiting in a chest.`,
            ``,
            `There is only the Leviathan`,
            `and the question of whether the Hunters of this generation`,
            `are worth what the last generation paid`,
            `to give them a fighting chance.`,
            ``,
            `Every dungeon cleared weakens its forces.`,
            `Every Shard collected is a wound it cannot heal.`,
            ``,
            `This is the Void War.`,
            `Win it.`
        ],
        unlock_rank: 'C',
        teaser:
            `The Leviathan does not have a rank.\n` +
            `┃◆ The System cannot classify it.\n` +
            `┃◆ The only thing that can stop it is already in your hands.`
    },
    {
        id: 4,
        title: 'The Reckoning',
        subtitle: 'The fallen hunter must be stopped.',
        story: [
            `His name was Aldric Voss.`,
            ``,
            `The records are sparse because most of what he did`,
            `happened before the modern System existed.`,
            `But the older Hunters know the name.`,
            `They say it quietly and they do not say it twice.`,
            ``,
            `He was the first Hunter to reach Rank S.`,
            `Not in this era. Not in this generation.`,
            `In the era before this one, when the Gates first opened`,
            `and nobody understood what was happening`,
            `and the only thing keeping humanity alive`,
            `was a handful of people who refused to stop fighting.`,
            ``,
            `He refused harder than anyone.`,
            ``,
            `After Rank S there is supposed to be nothing.`,
            `The System was not designed to go further.`,
            `But Aldric did not accept that.`,
            `He kept pushing. Kept fighting. Kept forcing the System`,
            `to account for something it had not planned for.`,
            ``,
            `The void found him in that space between what the System allows`,
            `and what he was trying to become.`,
            ``,
            `It did not kill him.`,
            ``,
            `It would have been kinder if it had.`,
            ``,
            `What came back was not Aldric Voss.`,
            `It wore his body. It carried his strength.`,
            `It remembered every technique he had ever mastered`,
            `and it used them with a precision`,
            `that no living thing should be capable of.`,
            ``,
            `But the part of him that chose to fight`,
            `the part that refused to stop`,
            `the part that made him the greatest Hunter`,
            `this world has ever produced`,
            ``,
            `that part was gone.`,
            ``,
            `He calls himself Malachar now.`,
            `Nobody knows why. Maybe the void gave him the name.`,
            `Maybe he chose it in whatever is left of him`,
            `as a way of saying that Aldric Voss is dead`,
            `and what stands in his place is something else entirely.`,
            ``,
            `He does not serve the void.`,
            `He does not serve humanity.`,
            `He runs because the System runs`,
            `and the System will not let him stop.`,
            ``,
            `The cruelest part is that somewhere inside the thing he became`,
            `Aldric Voss is still there.`,
            `Still aware. Still watching.`,
            `Unable to stop what his body does.`,
            `Unable to rest.`,
            ``,
            `The only mercy left to offer him`,
            `is an end.`,
            ``,
            `He cannot be saved. He can only be stopped.`,
            ``,
            `This is the Reckoning.`,
            `Finish what he started.`,
            `Give him the rest he cannot give himself.`
        ],
        unlock_rank: 'A',
        teaser:
            `His name was Aldric Voss.\n` +
            `┃◆ He was the greatest Hunter who ever lived.\n` +
            `┃◆ The void did not kill him. It would have been kinder if it had.`
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
        `Malachar was seen near a Gate matching this dungeon's signature. Whatever he is looking for he has not found it yet.`,
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

module.exports = {
    CHAPTERS,
    getCurrentChapter,
    setChapter,
    getChapterData,
    getRandomDungeonLore,
    ensureTables
};