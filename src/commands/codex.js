/**
 * THE VOID CODEX
 * Lore entries unlocked by player progression.
 * Beating bosses, reaching prestige, joining clans, finding fragments.
 */
const db = require('../database/db');

const CODEX_ENTRIES = [
    {
        id: 1, title: 'The Gates',
        unlock_condition: 'registered',
        text:
            `The Gates were not built. They were found.\n` +
            `No one knows who opened them first.\n` +
            `No one wants to know what came through.`
    },
    {
        id: 2, title: 'What is the Void',
        unlock_condition: 'dungeon_clear',
        text:
            `The void is not empty.\n` +
            `It is what exists between things that should not exist together.\n` +
            `The dungeons are windows into it. Some hunters mistake them for doors.`
    },
    {
        id: 3, title: 'The Ranking System',
        unlock_condition: 'reach_rank_D',
        text:
            `The System did not give hunters ranks to honour them.\n` +
            `It gave them ranks to know which ones were worth protecting.\n` +
            `F rank hunters die in the first dungeon.\n` +
            `S rank hunters die in the last one.`
    },
    {
        id: 4, title: 'the Hollow King — What is Known',
        unlock_condition: 'reach_rank_B',
        text:
            `He has existed longer than the dungeons.\n` +
            `He may have created them. He denies it.\n` +
            `He does not fight. He sends things that fight.\n` +
            `He has been losing for a long time.\n` +
            `He does not seem to mind.`
    },
    {
        id: 5, title: 'The First Prestige',
        unlock_condition: 'prestige',
        text:
            `The System was not designed for prestige.\n` +
            `Three hunters broke through what should have been a ceiling.\n` +
            `The void noticed.\n` +
            `It let them through.\n` +
            `It kept something in exchange.`
    },
    {
        id: 6, title: 'The Three Clans',
        unlock_condition: 'clan_join',
        text:
            `The bloodlines are not metaphor.\n` +
            `When the three crossed over, something crossed back into them.\n` +
            `The clans are not organisations.\n` +
            `They are infections. Willing ones.`
    },
    {
        id: 7, title: "the Hollow King's Herald",
        unlock_condition: 'reach_rank_PS',
        text:
            `The Herald does not speak.\n` +
            `It was seen at the edge of the known dungeon network.\n` +
            `Not attacking. Looking.\n` +
            `the Hollow King lost something when the Gates fell.\n` +
            `The Herald is here to find it.`
    },
    {
        id: 8, title: 'The Fragments',
        unlock_condition: 'hollowking_fragment',
        text:
            `The fragments are not debris.\n` +
            `They are pieces of something the Hollow King chose to leave behind.\n` +
            `He does not forget things accidentally.\n` +
            `He left them for someone specific.\n` +
            `He has been waiting to see if they would find them.`
    },
    {
        id: 9, title: 'The Void Rifts',
        unlock_condition: 'explore',
        text:
            `The rifts are where dungeons used to be.\n` +
            `Or where they will be.\n` +
            `The void does not move in one direction.\n` +
            `Explorers find things in the rifts that have not been made yet.`
    },
    {
        id: 10, title: 'What Comes Next',
        unlock_condition: 'reach_rank_PS',
        text:
            `the Hollow King is not retreating.\n` +
            `He is preparing.\n` +
            `The hunters who crossed over carry pieces of his plan.\n` +
            `They do not know this.\n` +
            `He is patient.\n` +
            `He has always been patient.`
    }
];

async function ensureCodexTable() {
    await db.execute(`
        CREATE TABLE IF NOT EXISTS player_codex (
            player_id  VARCHAR(50) NOT NULL,
            entry_id   INT NOT NULL,
            unlocked_at DATETIME DEFAULT NOW(),
            PRIMARY KEY (player_id, entry_id)
        )
    `).catch(() => {});
}

async function unlockCodexEntry(playerId, condition) {
    await ensureCodexTable();
    const toUnlock = CODEX_ENTRIES.filter(e => e.unlock_condition === condition);
    for (const entry of toUnlock) {
        await db.execute(
            "INSERT IGNORE INTO player_codex (player_id, entry_id) VALUES (?, ?)",
            [playerId, entry.id]
        );
    }
}

async function getUnlockedEntries(playerId) {
    await ensureCodexTable();
    const [rows] = await db.execute(
        "SELECT entry_id FROM player_codex WHERE player_id=?",
        [playerId]
    );
    const ids = rows.map(r => r.entry_id);
    return CODEX_ENTRIES.map(e => ({ ...e, unlocked: ids.includes(e.id) }));
}

module.exports = {
    name: 'codex',
    CODEX_ENTRIES,
    unlockCodexEntry,
    async execute(msg, args, { userId }) {
        try {
            const entries = await getUnlockedEntries(userId);
            const num     = parseInt(args[0]);

            // View specific entry
            if (!isNaN(num)) {
                const entry = entries.find(e => e.id === num);
                if (!entry) return msg.reply("❌ Entry not found.");
                if (!entry.unlocked) return msg.reply(
                    `╔══〘 📖 VOID CODEX 〙══╗\n┃◆ Entry ${num}: *${entry.title}*\n┃◆ 🔒 Not yet unlocked.\n╚═══════════════════════════╝`
                );
                return msg.reply(
                    `╔══〘 📖 ${entry.title.toUpperCase()} 〙══╗\n┃◆\n` +
                    entry.text.split('\n').map(l => `┃◆ ${l}`).join('\n') +
                    `\n┃◆\n╚═══════════════════════════╝`
                );
            }

            // List all entries
            const unlocked = entries.filter(e => e.unlocked).length;
            let text = `╔══〘 📖 VOID CODEX 〙══╗\n┃◆ ${unlocked}/${entries.length} entries unlocked\n┃◆\n`;
            entries.forEach(e => {
                text += e.unlocked
                    ? `┃◆ ${e.id}. *${e.title}*\n`
                    : `┃◆ ${e.id}. 🔒 ???\n`;
            });
            text += `┃◆\n┃◆ !codex <number> to read\n╚═══════════════════════════╝`;
            return msg.reply(text);
        } catch (err) {
            console.error('codex error:', err);
            msg.reply('❌ Codex failed.');
        }
    }
};