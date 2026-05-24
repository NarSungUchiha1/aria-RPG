const { getVoidResonanceStatus, ASCENDANT_THRESHOLD } = require('../systems/ascendantSystem');
const db = require('../database/db');

module.exports = {
    name: 'resonance',
    aliases: ['voidresonance', 'ascendant'],
    async execute(msg, args, { userId }) {
        try {
            const status = await getVoidResonanceStatus(userId);
            const [player] = await db.execute('SELECT nickname, \`rank\` FROM players WHERE id=?', [userId]);
            if (!player.length) return msg.reply('❌ Not registered.');
            const p = player[0];

            if (!status.eligible) return msg.reply(
                '══〘 👁️ VOID RESONANCE 〙══╮\n' +
                '┃★ Only those who stood before Malachar\n' +
                '┃★ when he fell can feel the resonance.\n' +
                '┃★\n' +
                '┃★ You were not there.\n' +
                '╰═══════════════════════╯'
            );

            if (status.isAscendant) return msg.reply(
                '╔══〘 👁️ ASCENDANT 〙══╗\n' +
                '┃★\n' +
                '┃★ *' + p.nickname + '*\n' +
                '┃★ You have already broken through.\n' +
                '┃★\n' +
                '┃★ There is nothing left to measure.\n' +
                '┃★\n' +
                '╚═══════════════════════════╝'
            );

            const res    = status.resonance;
            const thresh = status.threshold;
            const pct    = Math.min(100, Math.floor((res / thresh) * 100));
            const filled = Math.floor(pct / 10);
            const bar    = '🟣'.repeat(filled) + '⬛'.repeat(10 - filled);
            const left   = thresh - res;

            let hint = '';
            if (res < 25)       hint = '┃★ Clear prestige dungeons. Kill bosses.\n┃★ The void watches.\n';
            else if (res < 50)  hint = '┃★ Something stirs. Keep pushing.\n┃★ Territory wars accelerate the threshold.\n';
            else if (res < 75)  hint = '┃★ It is louder now. You can almost hear it.\n┃★ The Remnant Sanctum calls you.\n';
            else if (res < 100) hint = '┃★ Almost. One more push.\n┃★ You are on the edge of something\n┃★ that has no name yet.\n';

            return msg.reply(
                '╔══〘 👁️ VOID RESONANCE 〙══╗\n' +
                '┃★\n' +
                '┃★ *' + p.nickname + '* — ' + p.rank + '\n' +
                '┃★\n' +
                '┃★ RESONANCE:\n' +
                '┃★ ' + bar + '\n' +
                '┃★ ' + res + ' / ' + thresh + ' — ' + pct + '%\n' +
                '┃★ ' + left + ' until breakthrough.\n' +
                '┃★\n' +
                (hint ? hint + '┃★\n' : '') +
                '┃★ HOW TO BUILD RESONANCE:\n' +
                '┃★ +5 per prestige dungeon clear\n' +
                '┃★ +3 per PS boss kill\n' +
                '┃★ +15 per territory war win\n' +
                '┃★ +20 per Remnant Sanctum clear\n' +
                '┃★ +25 kill Malachar\'s Echo\n' +
                '┃★\n' +
                '╚═══════════════════════════╝'
            );

        } catch (err) {
            console.error('resonance error:', err);
            msg.reply('❌ Resonance check failed.');
        }
    }
};