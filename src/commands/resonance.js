const db = require('../database/db');
const { getVoidResonanceStatus, ASCENDANT_THRESHOLD, checkResonanceEligibility } = require('../systems/ascendantSystem');

module.exports = {
    name: 'resonance',
    aliases: ['voidresonance', 'ascendant'],
    async execute(msg, args, { userId }) {
        try {
            const status = await getVoidResonanceStatus(userId);
            const [player] = await db.execute('SELECT nickname, `rank` FROM players WHERE id=?', [userId]);
            if (!player.length) return msg.reply('❌ Not registered.');
            const p = player[0];

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

            // Show requirements checklist if not eligible
            if (!status.eligible) {
                const check = await checkResonanceEligibility(userId);
                let text =
                    '╔══〘 👁️ VOID RESONANCE 〙══╗\n' +
                    '┃★\n' +
                    '┃★ *' + p.nickname + '* — ' + p.rank + '\n' +
                    '┃★\n' +
                    '┃★ You cannot yet feel the resonance.\n' +
                    '┃★ These conditions must be met:\n' +
                    '┃★\n' +
                    '┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n' +
                    '┃★ REQUIREMENTS\n' +
                    '┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n' +
                    '┃★ ' + (check.prestige >= 1 ? '✅' : '❌') + ' Be a Prestige hunter\n' +
                    '┃★ ' + (['PS','ASCENDANT'].includes(check.rank) ? '✅' : '❌') + ' Rank PS required (you: ' + (check.rank || p.rank) + ')\n' +
                    '┃★ ' + ((check.psClears || 0) >= 1 ? '✅' : '❌') + ' Clear at least 1 PS dungeon\n' +
                    '┃★ ' + ((check.totalClears || 0) >= 200 ? '✅' : '❌') + ' 200 dungeon clears (' + (check.totalClears || 0) + ' done)\n' +
                    '┃★\n' +
                    '┃★ Return when all are met.\n' +
                    '╚═══════════════════════════╝';
                return msg.reply(text);
            }

            const res    = status.resonance;
            const thresh = ASCENDANT_THRESHOLD;
            const pct    = Math.min(100, Math.floor((res / thresh) * 100));
            const filled = Math.floor(pct / 10);
            const bar    = '🟣'.repeat(filled) + '⬛'.repeat(10 - filled);
            const left   = thresh - res;

            let hint = '';
            if (res < 25)      hint = '┃★ The void is quiet. Keep pushing.\n';
            else if (res < 50) hint = '┃★ Something stirs. Territory wars\n┃★ accelerate the threshold.\n';
            else if (res < 75) hint = '┃★ It is louder now. The Remnant\n┃★ Sanctum calls you.\n';
            else               hint = '┃★ Almost. One more push.\n┃★ You are on the edge of something\n┃★ that has no name yet.\n';

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
                '┃★ +5  per prestige dungeon clear\n' +
                '┃★ +3  per PS boss kill\n' +
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