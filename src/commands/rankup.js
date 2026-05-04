const db = require('../database/db');
const { getSpecialItemForRank } = require('../systems/shopSystem');
const { PRESTIGE_STAT_GAINS } = require('../systems/prestigeSystem');
const itemStats = require('../data/itemStats');

const NORMAL_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];
const PRESTIGE_ORDER = ['PF', 'PE', 'PD', 'PC', 'PB', 'PA', 'PS'];

const normalXpCost = { E: 500, D: 1200, C: 2500, B: 5000, A: 10000, S: 20000 };
const prestigeXpCost = { PE: 36000, PD: 111000, PC: 380000, PB: 1006000, PA: 3225000, PS: 7420000 };

const normalStatGain  = { E: 4, D: 6, C: 8, B: 12, A: 16, S: 22 };
const prestigeStatGain = { PE: 30, PD: 50, PC: 80, PB: 120, PA: 180, PS: 250 };

const normalHpGain   = { E: 20, D: 35, C: 50, B: 70, A: 100, S: 150 };
const prestigeHpGain  = { PE: 200, PD: 350, PC: 500, PB: 700, PA: 1000, PS: 1500 };

const normalMana  = { F: 50, E: 100, D: 160, C: 240, B: 330, A: 420, S: 500 };
const prestigeMana = { PF: 500, PE: 650, PD: 800, PC: 1000, PB: 1200, PA: 1500, PS: 2000 };

module.exports = {
    name: 'rankup',
    async execute(msg, args, { userId }) {
        try {
            const [player] = await db.execute(
                "SELECT `rank`, role, prestige_level, mana, max_mana FROM players WHERE id=?",
                [userId]
            );
            if (!player.length) return msg.reply("❌ Not registered.");

            const p = player[0];
            const isPrestige = (p.prestige_level || 0) > 0;
            const currentRank = p.rank;

            if (isPrestige) {
                // ── PRESTIGE RANKUP ──────────────────────────────────────────
                const currentIdx = PRESTIGE_ORDER.indexOf(currentRank);
                if (currentIdx === -1) {
                    // They might still be on a normal rank — push them to PF
                    await db.execute("UPDATE players SET `rank`='PF' WHERE id=?", [userId]);
                    return msg.reply(
                        `╔══〘 ✦ RANK UP 〙══╗\n` +
                        `┃★ You have been placed at PF.\n` +
                        `┃★ Your prestige journey begins.\n` +
                        `╚═══════════════════════════╝`
                    );
                }
                if (currentIdx === PRESTIGE_ORDER.length - 1) return msg.reply(
                    `╔══〘 ✦ RANK UP 〙══╗\n┃★ ❌ Already max prestige rank (PS).\n╚═══════════════════════════╝`
                );

                const nextRank = PRESTIGE_ORDER[currentIdx + 1];
                const xpCost   = prestigeXpCost[nextRank];
                const gains    = PRESTIGE_STAT_GAINS[nextRank] || { stats: 40, hp: 300, mana: 80 };
                const statGain = gains.stats;
                const hpGain   = gains.hp;

                const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
                const currentXp = Number(xpRow[0]?.xp) || 0;

                if (currentXp < xpCost) return msg.reply(
                    `╔══〘 ✦ RANK UP 〙══╗\n` +
                    `┃★ ❌ Need ${xpCost.toLocaleString()} XP\n` +
                    `┃★ You have ${currentXp.toLocaleString()} XP\n` +
                    `╚═══════════════════════════╝`
                );

                await db.execute("UPDATE xp SET xp = xp - ? WHERE player_id=?", [xpCost, userId]);

                const isCaster = (p.role === 'Mage' || p.role === 'Healer');
                const newMana  = isCaster ? ((p.max_mana || 400) + gains.mana) : null;

                let q = `UPDATE players SET \`rank\`=?, strength=strength+?, agility=agility+?, intelligence=intelligence+?, stamina=stamina+?, hp=hp+?, max_hp=max_hp+?`;
                const params = [nextRank, statGain, statGain, statGain, statGain, hpGain, hpGain];
                if (isCaster) { q += `, mana=?, max_mana=?`; params.push(newMana, newMana); }
                q += ` WHERE id=?`; params.push(userId);
                await db.execute(q, params);

                let reply =
                    `╔══〘 ✦ PRESTIGE RANK UP 〙══╗\n` +
                    `┃★ ${currentRank} → ${nextRank}\n` +
                    `┃★────────────\n` +
                    `┃★ 💪 All stats +${statGain}\n` +
                    `┃★ ❤️ Max HP +${hpGain}\n`;
                if (isCaster) reply += `┃★ 💙 Max Mana → ${newMana}\n`;
                reply += `┃★ XP spent: ${xpCost.toLocaleString()}\n╚═══════════════════════════╝`;
                return msg.reply(reply);

            } else {
                // ── NORMAL RANKUP ────────────────────────────────────────────
                const currentIdx = NORMAL_ORDER.indexOf(currentRank);
                if (currentIdx === -1) return msg.reply("❌ Invalid rank data.");
                if (currentIdx === NORMAL_ORDER.length - 1) return msg.reply(
                    `══〘 🏅 RANK UP 〙══╮\n┃◆ ❌ Already max rank (S).\n┃◆ Type !prestige confirm to prestige.\n╰═══════════════════════╯`
                );

                const nextRank = NORMAL_ORDER[currentIdx + 1];
                const xpCost   = normalXpCost[nextRank];
                const statGain = normalStatGain[nextRank];
                const hpGain   = normalHpGain[nextRank];

                const [xpRow] = await db.execute("SELECT xp FROM xp WHERE player_id=?", [userId]);
                const currentXp = Number(xpRow[0]?.xp) || 0;

                if (currentXp < xpCost) return msg.reply(
                    `══〘 🏅 RANK UP 〙══╮\n` +
                    `┃◆ ❌ Need ${xpCost} XP to reach ${nextRank}.\n` +
                    `┃◆ You have ${currentXp} XP.\n` +
                    `╰═══════════════════════╯`
                );

                await db.execute("UPDATE xp SET xp = xp - ? WHERE player_id=?", [xpCost, userId]);

                const isCaster = (p.role === 'Mage' || p.role === 'Healer');
                const newMana  = isCaster ? normalMana[nextRank] : null;

                let q = `UPDATE players SET \`rank\`=?, strength=strength+?, agility=agility+?, intelligence=intelligence+?, stamina=stamina+?, hp=hp+?, max_hp=max_hp+?`;
                const params = [nextRank, statGain, statGain, statGain, statGain, hpGain, hpGain];
                if (isCaster) { q += `, mana=?, max_mana=?`; params.push(newMana, newMana); }
                q += ` WHERE id=?`; params.push(userId);
                await db.execute(q, params);

                let reply =
                    `══〘 🏅 RANK UP 〙══╮\n` +
                    `┃◆ Rank: ${currentRank} → ${nextRank}\n` +
                    `┃◆ XP Cost: ${xpCost}\n` +
                    `┃◆────────────\n` +
                    `┃◆ 💪 STR/AGI/INT/STA +${statGain}\n` +
                    `┃◆ ❤️ Max HP +${hpGain}\n`;
                if (isCaster) reply += `┃◆ 💙 Max Mana → ${newMana}\n`;

                // Special weapon for rank C+
                if (NORMAL_ORDER.indexOf(nextRank) >= NORMAL_ORDER.indexOf('C')) {
                    const specialName = getSpecialItemForRank(nextRank);
                    if (specialName) {
                        const itemData = itemStats[specialName];
                        await db.execute(
                            "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped, grade) VALUES (?, ?, 'weapon', 1, 0, 'F')",
                            [userId, specialName]
                        );
                        const [res] = await db.execute("SELECT LAST_INSERT_ID() as id");
                        await db.execute(
                            `UPDATE inventory SET strength_bonus=?, agility_bonus=?, intelligence_bonus=?, stamina_bonus=?, attack_bonus=?, defense_bonus=?, durability=100, max_durability=100 WHERE id=?`,
                            [itemData?.base?.strength||0, itemData?.base?.agility||0, itemData?.base?.intelligence||0, itemData?.base?.stamina||0, itemData?.base?.attack||0, itemData?.base?.defense||0, res[0].id]
                        );
                        reply += `┃◆ 🎁 Weapon unlocked: ${specialName}\n`;
                    }
                }

                reply += `╰═══════════════════════╯`;
                return msg.reply(reply);
            }
        } catch (err) {
            console.error('rankup error:', err);
            msg.reply("❌ Rank up failed.");
        }
    }
};