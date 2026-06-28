const db = require('../database/db');
const { TERRITORIES, ensureTerritoryTables, getTerritoryStatus, getClanTerritories } = require('../systems/voidTerritories');
const { getPlayerClan, getClanMemberRole } = require('../systems/clanSystem');

module.exports = {
    name: 'territory',
    aliases: ['territories', 'voidterritories'],
    async execute(msg, args, { userId, client }) {
        try {
            await ensureTerritoryTables();
            const status = await getTerritoryStatus();
            const myClan = await getPlayerClan(userId);

            let text =
                '╔══〘 🌑 VOID TERRITORIES 〙══╗\n' +
                '┃★\n' +
                '┃★ The fractures Malachar left behind.\n' +
                '┃★ Three wounds in the world.\n' +
                '┃★ Clans fight to hold them.\n' +
                '┃★\n' +
                '┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n';

            for (const [tid, territory] of Object.entries(TERRITORIES)) {
                const s         = status[tid] || {};
                const holder    = s.clan_name || null;
                const claimedAt = s.claimed_at ? new Date(s.claimed_at).toLocaleDateString() : null;
                const defHp     = s.defense_hp != null ? s.defense_hp : 100;
                const defBar    = '🟥'.repeat(Math.floor(defHp / 20)) + '⬛'.repeat(5 - Math.floor(defHp / 20));
                const isMyClans = myClan && s.clan_id === myClan.id;

                text +=
                    '┃★ ' + territory.emoji + ' *' + territory.name + '*\n' +
                    '┃★ 〝' + territory.lore + '〞\n' +
                    '┃★\n' +
                    '┃★ Holder: ' + (holder ? '*' + holder + '*' + (isMyClans ? ' 👑 (yours)' : '') : '⬜ Unclaimed') + '\n' +
                    (holder ? ('┃★ Defense: ' + defBar + ' ' + defHp + '%\n') : '') +
                    (claimedAt ? ('┃★ Held since: ' + claimedAt + '\n') : '') +
                    '┃★ Bonus: ' + territory.bonus.label + '\n' +
                    '┃★  → ' + territory.bonus.description + '\n' +
                    '┃★ Guardian: ' + territory.guardian + '\n' +
                    '┃★\n' +
                    '┃★ !conquer ' + tid + ' — Challenge this territory\n' +
                    '┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n';
            }

            if (myClan) {
                const held = await getClanTerritories(myClan.id);
                if (held.length) {
                    text += '┃★ YOUR CLAN HOLDS: ' + held.map(t => TERRITORIES[t]?.emoji + ' ' + TERRITORIES[t]?.name).join(', ') + '\n';
                } else {
                    text += '┃★ Your clan holds no territories yet.\n';
                }
            }

            text += '╚═══════════════════════════╝';
            return msg.reply(text);

        } catch (err) {
            console.error('territory error:', err);
            msg.reply('❌ Territory command failed.');
        }
    }
};