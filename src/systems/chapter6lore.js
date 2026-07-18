/**
 * CHAPTER 6 — "The Source"
 * Malachar was the symptom. The Remnants were right.
 * When the first hunter completed the Resonance, the thing on the other side
 * of the fracture noticed. Now fragments of Malachar walk the dungeons again —
 * not to kill. To search.
 */

const CHAPTER6_DROP = [
    '╔══〘 📖 CHAPTER VI 〙══╗\n' +
    '┃★\n' +
    '┃★        *T H E   S O U R C E*\n' +
    '┃★\n' +
    '┃★ The fractures never sealed.\n' +
    '┃★ We just stopped watching them.\n' +
    '┃★\n' +
    '╚═══════════════════════════╝',

    '╔══════════════════════════════╗\n' +
    '┃★\n' +
    '┃★ The night the first hunter\n' +
    '┃★ completed the Resonance and\n' +
    '┃★ was reborn — something on the\n' +
    '┃★ other side of the fracture\n' +
    '┃★ *opened its eyes.*\n' +
    '┃★\n' +
    '┃★ The Remnants were right.\n' +
    '┃★ Malachar was never the disease.\n' +
    '┃★ He was the fever.\n' +
    '┃★\n' +
    '┃★ And the thing that burned him\n' +
    '┃★ from the inside...\n' +
    '┃★ is still hungry.\n' +
    '┃★\n' +
    '╚══════════════════════════════╝',

    '╔══〘 ⚠️ THE ECHOES 〙══╗\n' +
    '┃★\n' +
    '┃★ Fragments of Malachar now walk\n' +
    '┃★ the dungeons again.\n' +
    '┃★\n' +
    '┃★ They do not roar. They *search.*\n' +
    '┃★ The Source wants to understand\n' +
    '┃★ what broke through toward it.\n' +
    '┃★\n' +
    '┃★ 👁️ *Malachar\'s Echo* may invade\n' +
    '┃★ ANY dungeon, at ANY stage.\n' +
    '┃★ Kill it: +25 Void Resonance.\n' +
    '┃★\n' +
    '┃★ The void kept receipts.\n' +
    '┃★ Time to collect.\n' +
    '┃★\n' +
    '╚═══════════════════════════╝',

    '╔══〘 ⚔️ CHOOSE YOUR SIDE 〙══╗\n' +
    '┃★\n' +
    '┃★ The three factions are no longer\n' +
    '┃★ waiting. War for the void begins.\n' +
    '┃★\n' +
    '┃★ 🏛️ *THE ASSEMBLY* — order\n' +
    '┃★ ⚔️ *THE WRATHBORNE* — conquest\n' +
    '┃★ 🕯️ *THE REMNANTS* — the truth\n' +
    '┃★\n' +
    '┃★ Type *!faction join <name>*\n' +
    '┃★ Every dungeon you clear and duel\n' +
    '┃★ you win scores for your faction.\n' +
    '┃★ Weekly champions earn the\n' +
    '┃★ blessing of the void. 👑\n' +
    '┃★\n' +
    '╚═══════════════════════════╝'
];

function echoInvasionText(rank) {
    return (
        '╔══〘 👁️ THE VOID TEARS OPEN 〙══╗\n' +
        '┃★\n' +
        '┃★ Something steps through.\n' +
        '┃★\n' +
        '┃★ *MALACHAR\'S ECHO* has invaded\n' +
        '┃★ the dungeon. It is not here\n' +
        '┃★ for the enemies.\n' +
        '┃★ It is here for *you.*\n' +
        '┃★\n' +
        '┃★ 💀 Kill it: *+25 Void Resonance*\n' +
        '┃★ Use !skill <move> — target it!\n' +
        '┃★\n' +
        '╚═══════════════════════════╝'
    );
}

module.exports = { CHAPTER6_DROP, echoInvasionText };
