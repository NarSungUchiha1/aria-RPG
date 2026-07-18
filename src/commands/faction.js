// !faction — view the faction war standings and your allegiance.
// !faction join <assembly|wrathborne|remnants> — pick your side.
const { FACTIONS, SWITCH_COST, getFaction, joinFaction, getStandings } = require('../systems/factionSystem');

module.exports = {
    name: 'faction',
    aliases: ['factions'],
    async execute(msg, args, { userId }) {
        try {
            const sub = (args[0] || '').toLowerCase();

            if (sub === 'join') {
                const r = await joinFaction(userId, args[1]);
                if (!r.ok) {
                    if (r.reason === 'unknown_faction')
                        return msg.reply('❌ Pick a side: *!faction join assembly*, *wrathborne* or *remnants*');
                    if (r.reason === 'already_in')
                        return msg.reply('❌ You are already sworn to that faction.');
                    if (r.reason === 'cant_afford')
                        return msg.reply(`❌ Switching sides costs *${r.cost.toLocaleString()}L*. Betrayal isn't cheap.`);
                    return msg.reply('❌ Could not join.');
                }
                const f = r.faction;
                return msg.reply(
                    `╔══〘 ${f.emoji} ALLEGIANCE SWORN 〙══╗\n` +
                    `┃★\n` +
                    `┃★ You now fight for *${f.name}*.\n` +
                    `┃★ 〝${f.motto}〞\n` +
                    `┃★\n` +
                    `┃★ Dungeon clears: +10 pts\n` +
                    `┃★ Duel wins: +5 pts\n` +
                    `┃★ Weekly champions get +10% XP.\n` +
                    (r.switched ? `┃★ (−${SWITCH_COST.toLocaleString()}L paid for switching)\n` : '') +
                    `╚═══════════════════════════╝`
                );
            }

            // Standings view
            const [standings, mine] = await Promise.all([getStandings(), getFaction(userId)]);
            const lines = standings.map((s, i) =>
                `┃★ ${i === 0 && s.points > 0 ? '👑' : `${i + 1}.`} ${s.emoji} ${s.name} — ${s.points.toLocaleString()} pts`).join('\n');
            const mineF = mine ? FACTIONS[mine] : null;
            return msg.reply(
                `╔══〘 ⚔️ FACTION WAR 〙══╗\n` +
                `┃★ This week:\n` +
                lines + '\n' +
                `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                (mineF
                    ? `┃★ Your side: ${mineF.emoji} *${mineF.name}*\n`
                    : `┃★ You are UNSWORN.\n┃★ *!faction join <name>* to fight.\n`) +
                `┃★ Resets every Sunday. 👑 = +10% XP\n` +
                `╚═══════════════════════╝`
            );
        } catch (err) {
            console.error('faction error:', err);
            msg.reply('❌ Faction command failed.');
        }
    }
};
