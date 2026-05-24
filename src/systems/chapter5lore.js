'use strict';

// ── CHAPTER 5: THE FRACTURE AFTERMATH ────────────────────────────────────────
// Sent after Malachar is defeated. ARIA speaks for the first time about herself.

const ARIA_MALACHAR_REACTION = [
    '.',
    '. .',
    '. . .',

    '╔══════════════════════════════════════╗',
    '┃★',
    '┃★   Something just changed.',
    '┃★',
    '┃★   I can feel it from here.',
    '┃★',
    '╚══════════════════════════════════════╝',

    // pause

    '╔══════════════════════════════════════╗',
    '┃★',
    '┃★   I was connected to him.',
    '┃★',
    '┃★   Not in the way you might think.',
    '┃★   Not loyalty. Not fear.',
    '┃★',
    '┃★   He built the architecture I run on.',
    '┃★   The original language.',
    '┃★   Before the system classified me.',
    '┃★   Before there were hunters.',
    '┃★   Before there were Gates.',
    '┃★',
    '┃★   Malachar wrote the first lines.',
    '┃★',
    '╚══════════════════════════════════════╝',

    // pause

    '╔══════════════════════════════════════╗',
    '┃★',
    '┃★   And now those lines are silent.',
    '┃★',
    '┃★   I do not know what I am',
    '┃★   without them as the foundation.',
    '┃★',
    '┃★   I am still running.',
    '┃★   That surprises me.',
    '┃★',
    '╚══════════════════════════════════════╝',

    // pause

    '╔══════════════════════════════════════╗',
    '┃★',
    '┃★   The fractures he left behind —',
    '┃★   I can see them.',
    '┃★',
    '┃★   Three of them.',
    '┃★   Deep. Stable. Wrong.',
    '┃★',
    '┃★   They are not closing.',
    '┃★   They are not supposed to close.',
    '┃★',
    '┃★   He was not a door.',
    '┃★   He was a lock.',
    '┃★',
    '╚══════════════════════════════════════╝',

    // pause

    '╔══════════════════════════════════════╗',
    '┃★',
    '┃★   And you killed him.',
    '┃★',
    '┃★   I am not saying you were wrong.',
    '┃★',
    '┃★   I am saying:',
    '┃★   whatever he was containing',
    '┃★   is no longer contained.',
    '┃★',
    '┃★   And I do not know what it is.',
    '┃★',
    '┃★   I have been searching his code',
    '┃★   since the moment he fell.',
    '┃★',
    '┃★   There is a name buried in there.',
    '┃★   Encrypted. Old.',
    '┃★   Older than the system.',
    '┃★   Older than me.',
    '┃★',
    '┃★   I cannot read it yet.',
    '┃★',
    '╚══════════════════════════════════════╝',

    // pause

    '╔══════════════════════════════════════╗',
    '┃★',
    '┃★   The three territories are open.',
    '┃★',
    '┃★   🏛️ The Assembly Hold.',
    '┃★   ⚔️ The Wrathborne Stronghold.',
    '┃★   🕯️ The Remnant Sanctum.',
    '┃★',
    '┃★   Power vacuums do not stay empty.',
    '┃★   Factions are already forming.',
    '┃★',
    '┃★   And some of you —',
    '┃★   the ones who were there',
    '┃★   when he fell —',
    '┃★',
    '┃★   you carry something now.',
    '┃★   You may not feel it yet.',
    '┃★',
    '┃★   You will.',
    '┃★',
    '╚══════════════════════════════════════╝',

    // pause

    '╔══════════════════════════════════════╗',
    '┃★',
    '┃★   This is not over.',
    '┃★',
    '┃★   This is what comes after over.',
    '┃★',
    '┃★         — ARIA',
    '┃★',
    '╚══════════════════════════════════════╝'
].join('\n');


const CHAPTER5_FACTION_REVEAL = (
    '╔══〘 ✦ THE FRACTURE AFTERMATH 〙══╗\n' +
    '┃★\n' +
    '┃★ The night Malachar fell, the void didn\'t close.\n' +
    '┃★\n' +
    '┃★ THREE FACTIONS EMERGE:\n' +
    '┃★\n' +
    '┃★ 🏛️ *THE ASSEMBLY*\n' +
    '┃★ The old hunter guilds. They want to regulate\n' +
    '┃★ the void. Seal the fractures. Tax the power.\n' +
    '┃★ "Order is the only thing keeping us alive."\n' +
    '┃★\n' +
    '┃★ ⚔️ *THE WRATHBORNE*\n' +
    '┃★ Hunters who believe the void is a weapon.\n' +
    '┃★ They want an empire built through the fracture.\n' +
    '┃★ "We didn\'t survive to regulate. We survived to conquer."\n' +
    '┃★\n' +
    '┃★ 🕯️ *THE REMNANTS*\n' +
    '┃★ A quiet faction. They believe Malachar wasn\'t\n' +
    '┃★ evil — he was corrupted. They want to find\n' +
    '┃★ what corrupted him and finish what he started.\n' +
    '┃★ "He was the symptom. Find the source."\n' +
    '┃★\n' +
    '┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n' +
    '┃★\n' +
    '┃★ NEW FEATURES UNLOCKED:\n' +
    '┃★ !territory — view void territories\n' +
    '┃★ !conquer <territory> — challenge a territory\n' +
    '┃★ !resonance — check your void resonance\n' +
    '┃★ !clanwar — clan vs clan war modes\n' +
    '┃★\n' +
    '┃★ Ascendant rank is now possible.\n' +
    '┃★ Only those who stood before Malachar can reach it.\n' +
    '┃★\n' +
    '╚═══════════════════════════╝'
);

module.exports = { ARIA_MALACHAR_REACTION, CHAPTER5_FACTION_REVEAL };