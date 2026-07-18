/**
 * THE HOLLOW SUN — reboot era opening.
 * Posted by !hollowsun (owner). Activates Sunshard invasions + faction war.
 */

const REBOOT_DROP = [
    '╔══〘 🌑 A NEW AGE 〙══╗\n' +
    '┃★\n' +
    '┃★     *T H E   H O L L O W   S U N*\n' +
    '┃★\n' +
    '┃★ Look up.\n' +
    '┃★ Tell me what you see.\n' +
    '┃★\n' +
    '╚═══════════════════════════╝',

    '╔══════════════════════════════╗\n' +
    '┃★\n' +
    '┃★ It still hangs in the sky.\n' +
    '┃★ Same place. Same size.\n' +
    '┃★ But it gives no heat.\n' +
    '┃★ It casts no shadow.\n' +
    '┃★\n' +
    '┃★ Something reached into the sun\n' +
    '┃★ and *scooped it out* —\n' +
    '┃★ leaving the skin of it hanging\n' +
    '┃★ like a lantern with no flame.\n' +
    '┃★\n' +
    '┃★ The world lives in twilight now.\n' +
    '┃★ And in the long dark between\n' +
    '┃★ the hours... things grew teeth.\n' +
    '┃★\n' +
    '╚══════════════════════════════╝',

    '╔══〘 👁️ THE SUNSHARDS 〙══╗\n' +
    '┃★\n' +
    '┃★ Fragments of the true sun\n' +
    '┃★ still fall from the hollow shell.\n' +
    '┃★ Burning. Searching. *Alive.*\n' +
    '┃★\n' +
    '┃★ A *Sunshard* may crash into\n' +
    '┃★ ANY dungeon, at ANY stage.\n' +
    '┃★ Slay it: *+25 Void Resonance.*\n' +
    '┃★\n' +
    '┃★ The sun is not dead.\n' +
    '┃★ It is in pieces.\n' +
    '┃★ And the pieces remember you.\n' +
    '┃★\n' +
    '╚═══════════════════════════╝',

    '╔══〘 ⚔️ CHOOSE YOUR SIDE 〙══╗\n' +
    '┃★\n' +
    '┃★ Three answers to a hollow sky.\n' +
    '┃★\n' +
    '┃★ 🌅 *THE DAWNWATCH*\n' +
    '┃★ 〝The sun will rise because we\n' +
    '┃★  will drag it back.〞\n' +
    '┃★\n' +
    '┃★ 🌑 *THE UMBRAL COURT*\n' +
    '┃★ 〝Why mourn the sun? The dark\n' +
    '┃★  crowns its own.〞\n' +
    '┃★\n' +
    '┃★ 🕯️ *THE LAST LIGHT*\n' +
    '┃★ 〝The sun was taken.\n' +
    '┃★  Find the thief.〞\n' +
    '┃★\n' +
    '┃★ *!faction join <name>* — every\n' +
    '┃★ clear and duel win scores for\n' +
    '┃★ your side. Weekly champions\n' +
    '┃★ earn the crown. 👑\n' +
    '┃★\n' +
    '╚═══════════════════════════╝'
];

function sunshardInvasionText() {
    return (
        '╔══〘 ☄️ SUNSHARD IMPACT 〙══╗\n' +
        '┃★\n' +
        '┃★ The ceiling cracks open —\n' +
        '┃★ and a piece of the TRUE SUN\n' +
        '┃★ crashes into the dungeon.\n' +
        '┃★\n' +
        '┃★ It burns. It searches.\n' +
        '┃★ It has your shape in its light.\n' +
        '┃★\n' +
        '┃★ 💀 Slay the *Sunshard*:\n' +
        '┃★ *+25 Void Resonance*\n' +
        '┃★ Use !skill <move> — target it!\n' +
        '┃★\n' +
        '╚═══════════════════════════╝'
    );
}

module.exports = { REBOOT_DROP, sunshardInvasionText };
