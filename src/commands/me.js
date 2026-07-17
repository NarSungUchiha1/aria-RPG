const db = require('../database/db');
const { hasClaimedStarter, claimStarterPack } = require('../systems/prestigeStarterPack');
const { getPlayerClan, CLAN_BLESSINGS } = require('../systems/clanSystem');
const { getPrestigeBadge } = require('../systems/prestigeSystem');
const { formatFatigueBar } = require('../systems/fatigueSystem');
const { getResonanceProfile, formatGenesisDate } = require('../systems/ascendantSystem');
const { getVip } = require('../systems/subscriberSystem');

module.exports = {
    name: 'me',
    async execute(msg, args, { userId }) {
        try {
            // ── RESONANCE CARD ───────────────────────────────────────
            const resonance = await getResonanceProfile(userId).catch(() => null);
            if (resonance && resonance.moves && resonance.moves.length) {
                const genesis = formatGenesisDate(resonance.genesis_date);
                const playerClan = await getPlayerClan(userId).catch(() => null);
                const clanDisplay = playerClan ? playerClan.name : 'None';

                const [statRows] = await db.execute(
                    `SELECT p.role, p.hp, p.max_hp, p.strength, p.agility,
                            p.intelligence, p.stamina, p.mana, p.max_mana, p.title
                     FROM players p WHERE p.id = ?`, [userId]
                );
                const p = statRows[0] || {};
                const [items] = await db.execute(
                    "SELECT strength_bonus, agility_bonus, intelligence_bonus, stamina_bonus FROM inventory WHERE player_id=? AND equipped=1", [userId]
                );
                const totalStr = (p.strength||0) + items.reduce((s,i) => s + (i.strength_bonus||0), 0);
                const totalAgi = (p.agility||0)  + items.reduce((s,i) => s + (i.agility_bonus||0), 0);
                const totalInt = (p.intelligence||0) + items.reduce((s,i) => s + (i.intelligence_bonus||0), 0);
                const totalSta = (p.stamina||0)  + items.reduce((s,i) => s + (i.stamina_bonus||0), 0);

                const roleIcons = { Tank:'🛡️', Assassin:'🗡️', Mage:'🔮', Healer:'💚', Berserker:'⚔️', Ranger:'🏹', Explorer:'🧭' };
                const icon = roleIcons[p.role] || '⚔️';

                const moveList = resonance.moves
                    .map((m, i) => `┃✧ ${['①','②','③','④','⑤'][i]} *${m.name}*\n┃✧    _${m.desc}_`)
                    .join('\n');

                // Ascendants transcend roles — clean identity card, ends at Clan.
                // !clan house style with ┃✧ resonance bullets. Wide borders force
                // the WhatsApp bubble to stretch (width = longest line).
                // VIP Ascendants get the crown merged into the header + a VIP line.
                const resVip = await getVip(userId).catch(() => null);
                const header = resVip
                    ? `╔══〘 👑 ✧ RESONANCE ✧ 👑 〙══╗\n`
                    : `╔══〘 ✧ RESONANCE ✧ 〙══╗\n`;
                const cardText =
                    header +
                    `┃✧ 👤 *Name:* ${resonance.res_name}\n` +
                    `┃✧ 📜 *Title:* ${p.title || 'Untitled'}\n` +
                    `┃✧ 🌌 *Genesis:* ${genesis}\n` +
                    `┃✧ 👑 *Authority:* ${resonance.authority}${resVip ? ' • VIP' : ''}\n` +
                    `┃✧ 🏰 *Clan:* ${clanDisplay}\n` +
                    `╚═══════════════════╝`;

                if (resonance.res_image) {
                    try {
                        const imgBuffer = Buffer.from(resonance.res_image, 'base64');
                        await msg.reply({ image: imgBuffer, caption: cardText, mimetype: 'image/jpeg' });
                        return;
                    } catch (imgErr) {
                        console.error('[Resonance Card] Image error:', imgErr.message);
                    }
                }
                return msg.reply(cardText);
            }

            // ── NORMAL / PRESTIGE CARD ───────────────────────────────
            const [rows] = await db.execute(
                `SELECT p.nickname, p.role, p.\`rank\`, p.title, p.hp, p.max_hp,
                        p.strength, p.agility, p.intelligence, p.stamina,
                        p.awakened, p.sp, p.mana, p.max_mana,
                        COALESCE(p.prestige_level, 0) as prestige_level,
                        COALESCE(p.fatigue, 0) as fatigue
                 FROM players p WHERE p.id = ?`,
                [userId]
            );
            if (!rows.length) return msg.reply('❌ Not registered.');
            const p = rows[0];

            const [items] = await db.execute(
                "SELECT strength_bonus, agility_bonus, intelligence_bonus, stamina_bonus FROM inventory WHERE player_id=? AND equipped=1",
                [userId]
            );
            const totalStr = p.strength + items.reduce((s, i) => s + (i.strength_bonus || 0), 0);
            const totalAgi = p.agility + items.reduce((s, i) => s + (i.agility_bonus || 0), 0);
            const totalInt = p.intelligence + items.reduce((s, i) => s + (i.intelligence_bonus || 0), 0);
            const totalSta = p.stamina + items.reduce((s, i) => s + (i.stamina_bonus || 0), 0);

            const [money] = await db.execute("SELECT gold FROM currency WHERE player_id=?", [userId]);
            const gold = money[0]?.gold || 0;
            const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
            const xp = xpRow[0]?.xp || 0;

            const prestigeLvl = p.prestige_level || 0;
            const fatigue = Number(p.fatigue) || 0;
            const fatigueBar = formatFatigueBar(fatigue);
            const fatigueLine = prestigeLvl > 0
                ? `\n┃★ 🔵 Fatigue: ${fatigueBar} ${fatigue}%`
                : `\n┃◆ 🔵 Fatigue: ${fatigueBar} ${fatigue}%`;

            // ── PRESTIGE STARTER PACK ────────────────────────────────────────
            if (prestigeLvl > 0) {
                const claimed = await hasClaimedStarter(userId, prestigeLvl);
                if (!claimed) {
                    const pack = await claimStarterPack(userId, p.role, prestigeLvl);
                    if (pack.ok) {
                        await msg.reply(
                            `╔══〘 ✦ WELCOME, VOID HUNTER 〙══╗\n` +
                            `┃★ \n` +
                            `┃★ The system has acknowledged you.\n` +
                            `┃★ You are no longer bound by the\n` +
                            `┃★ rules of the old world.\n` +
                            `┃★ \n` +
                            `┃★ 〝What you were is gone.\n` +
                            `┃★  What you become is your choice.〞\n` +
                            `┃★ \n` +
                            `┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n` +
                            `┃★ STARTER PACK CLAIMED\n` +
                            `┃★ \n` +
                            `┃★ ⚔️ *${pack.weapon.name}*\n` +
                            `┃★   〝${pack.weapon.desc}〞\n` +
                            `┃★ \n` +
                            `┃★ 💰 ${pack.gold.toLocaleString()} Gold\n` +
                            `┃★ ⭐ ${pack.xp.toLocaleString()} XP\n` +
                            `┃★ \n` +
                            `┃★ !prestigeshop — your armory\n` +
                            `┃★ !moveset — your void skills\n` +
                            `╚════════════════════════════╝`
                        );
                    }
                }
            }
            const stars = prestigeLvl > 0 ? '☆'.repeat(Math.min(prestigeLvl, 5)) + ' ' : '';
            const rankLine = prestigeLvl > 0 ? `${stars}${p.rank}` : p.rank;

            // Role/rank helpers inline
            const roleIcons = { Tank:'🛡️', Assassin:'🗡️', Mage:'🔮', Healer:'💚', Berserker:'⚔️', Ranger:'🏹', Explorer:'🧭' };
            const rankBadges = { F:'⚫', E:'🟤', D:'🟢', C:'🔵', B:'🟣', A:'🔴', S:'🟡' };
            const icon = roleIcons[p.role] || '⚔️';
            const badge = rankBadges[p.rank] || '⚫';

            const stylize = (s) => s.split('').join(' ');
            const styledName = stylize(p.nickname.toUpperCase());
            // Fetch clan info
            const playerClan = await getPlayerClan(userId).catch(() => null);
            const clanDisplay = playerClan ? `${playerClan.name}` : null;

            const manaLine = (p.role === 'Mage' || p.role === 'Healer' || p.role === 'Explorer')
                ? `\n┃◆ 💙 Mana: ${p.mana || 0}/${p.max_mana || 50}`
                : '';

            // VIP subscribers get their own premium interface (resonance card
            // still outranks it — that early-returned above).
            const vipRow = await getVip(userId).catch(() => null);

            let reply;

            if (vipRow) {
                const manaLineV = (p.role === 'Mage' || p.role === 'Healer' || p.role === 'Explorer')
                    ? `\n┃◈ 💙 Mana: ${p.mana || 0}/${p.max_mana || 50}`
                    : '';
                reply =
                    `◆═══〘 👑 V I P • H U N T E R 〙═══◆\n` +
                    `┃◈ 👤 ${badge} ${styledName}\n` +
                    `┃◈ 🎭 ${icon} ${p.role}\n` +
                    `┃◈ 🏅 Rank: ${rankLine}${prestigeLvl > 0 ? `  •  Prestige ${prestigeLvl}` : ''}\n` +
                    `┃◈ 📜 Title: ${p.title || 'None'}\n` +
                    (clanDisplay ? `┃◈ 🏰 Clan: ${clanDisplay}\n` : '') +
                    `┃◈━━━━━━━━━━━━━\n` +
                    `┃◈ 💪 Strength: ${totalStr}\n` +
                    `┃◈ ⚡ Agility: ${totalAgi}\n` +
                    `┃◈ 🧠 Intelligence: ${totalInt}\n` +
                    `┃◈ 🛡️ Stamina: ${totalSta}\n` +
                    `┃◈ 🔵 Fatigue: ${fatigueBar} ${fatigue}%\n` +
                    `┃◈━━━━━━━━━━━━━\n` +
                    `┃◈ ❤️ HP: ${p.hp}/${p.max_hp}` +
                    manaLineV +
                    `\n┃◈ ⚡ Awakened: ${p.awakened ? 'YES' : 'NO'}\n` +
                    `┃◈ ✨ SP: ${p.sp || 0}\n` +
                    `┃◈━━━━━━━━━━━━━\n` +
                    `┃◈ 💰 Gold: ${gold.toLocaleString()}\n` +
                    `┃◈ ⭐ XP: ${xp.toLocaleString()}\n` +
                    `◆═══════════════════◆`;
            } else if (prestigeLvl > 0) {
                // ✅ PRESTIGE — star bullets
                const manaLineP = (p.role === 'Mage' || p.role === 'Healer' || p.role === 'Explorer')
                    ? `\n┃★ 💙 Mana: ${p.mana || 0}/${p.max_mana || 50}`
                    : '';

                reply =
                    `══〘 ✦ PRESTIGE HUNTER 〙══╮\n` +
                    `┃★ 👤 ${badge} ${styledName}\n` +
                    `┃★ 🎭 ${icon} ${p.role}\n` +
                    `┃★ 🏅 Rank: ${rankLine}  •  Prestige ${prestigeLvl}\n` +
                    `┃★ 📜 Title: ${p.title || 'None'}\n` +
                    (clanDisplay ? `┃★ 🏰 Clan: ${clanDisplay}\n` : '') +
                    `┃★────────────\n` +
                    `┃★ 💪 Strength: ${totalStr}\n` +
                    `┃★ ⚡ Agility: ${totalAgi}\n` +
                    `┃★ 🧠 Intelligence: ${totalInt}\n` +
                    `┃★ 🛡️ Stamina: ${totalSta}\n` +
                    `┃★ 🔵 Fatigue: ${fatigueBar} ${fatigue}%\n` +
                    `┃★────────────\n` +
                    `┃★ ❤️ HP: ${p.hp}/${p.max_hp}` +
                    manaLineP +
                    `\n┃★ ⚡ Awakened: ${p.awakened ? 'YES' : 'NO'}\n` +
                    `┃★ ✨ SP: ${p.sp || 0}\n` +
                    `┃★────────────\n` +
                    `┃★ 💰 Gold: ${gold.toLocaleString()}\n` +
                    `┃★ ⭐ XP: ${xp.toLocaleString()}\n` +
                    `╰═══════════════════════╯`;
            } else {
                // NORMAL — diamond bullets
                reply =
                    `══〘 👤 PLAYER STATUS 〙══╮\n` +
                    `┃◆ 👤 ${badge} ${styledName}\n` +
                    `┃◆ 🎭 ${icon} ${p.role}\n` +
                    `┃◆ 🏅 Rank: ${p.rank}  •  Title: ${p.title || 'None'}\n` +
                    (clanDisplay ? `┃◆ 🏰 Clan: ${clanDisplay}\n` : '') +
                    `┃◆────────────\n` +
                    `┃◆ 💪 Strength: ${totalStr}\n` +
                    `┃◆ ⚡ Agility: ${totalAgi}\n` +
                    `┃◆ 🧠 Intelligence: ${totalInt}\n` +
                    `┃◆ 🛡️ Stamina: ${totalSta}\n` +
                    `┃◆ 🔵 Fatigue: ${fatigueBar} ${fatigue}%\n` +
                    `┃◆────────────\n` +
                    `┃◆ ❤️ HP: ${p.hp}/${p.max_hp}` +
                    manaLine +
                    `\n┃◆ ⚡ Awakened: ${p.awakened ? 'YES' : 'NO'}\n` +
                    `┃◆ ✨ SP: ${p.sp || 0}\n` +
                    `┃◆ 💰 Gold: ${gold}\n` +
                    `┃◆ ⭐ XP: ${xp}\n` +
                    `╰═══════════════════════╯`;
            }

            // Territory bonus display
            try {
                const { getPlayerTerritoryBonuses } = require('../systems/territoryBonusSystem');
                const bonuses = await getPlayerTerritoryBonuses(userId);
                if (bonuses.length) {
                    const isP = (p.prestige_level || 0) > 0;
                    const bul = vipRow ? '┃◈' : isP ? '┃★' : '┃◆';
                    reply += bul + '────────────\n';
                    reply += bul + ' 🌑 TERRITORY BONUSES ACTIVE:\n';
                    bonuses.forEach(b => { reply += bul + ' ✦ ' + b.label + ': ' + b.description + '\n'; });
                }
            } catch(e) {}

            // VIP with a custom image → send the card as the image caption
            // (same pattern as the resonance card).
            if (vipRow?.vip_image) {
                try {
                    const imgBuffer = Buffer.from(vipRow.vip_image, 'base64');
                    return await msg.reply({ image: imgBuffer, caption: reply, mimetype: 'image/jpeg' });
                } catch (imgErr) {
                    console.error('[VIP Card] Image error:', imgErr.message);
                }
            }
            return msg.reply(reply);
        } catch (err) {
            console.error(err);
            msg.reply('❌ Could not fetch profile.');
        }
    }
};