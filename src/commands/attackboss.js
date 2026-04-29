const db = require('../database/db');
const { attackWorldBoss, getActiveWorldBoss, distributeWorldBossRewards } = require('../systems/worldBossSystem');
const { RAID_GROUP } = require('../engine/dungeon');

module.exports = {
    name: 'attackboss',
    async execute(msg, args, { userId, client }) {
        try {
            const [player] = await db.execute(
                "SELECT nickname, strength, agility, `rank` FROM players WHERE id=?", [userId]
            );
            if (!player.length) return msg.reply(
                `══〘 🌍 BOSS ATTACK 〙══╮\n┃◆ ❌ Not registered.\n╰═══════════════════════╯`
            );

            const boss = await getActiveWorldBoss();
            if (!boss) return msg.reply(
                `══〘 🌍 BOSS ATTACK 〙══╮\n┃◆ ❌ No world boss is currently active.\n╰═══════════════════════╯`
            );

            const p = player[0];
            const baseDmg  = (Number(p.strength) * 5) + (Number(p.agility) * 2);
            const variance = Math.floor(Math.random() * baseDmg * 0.2);
            const damage   = baseDmg + variance;

            const result = await attackWorldBoss(userId, damage);
            if (result.error) return msg.reply(
                `══〘 🌍 BOSS ATTACK 〙══╮\n┃◆ ❌ ${result.error}\n╰═══════════════════════╯`
            );

            // ✅ If attacking the Leviathan — use Leviathan battle system
            if (boss.name === 'The Void Leviathan') {
                const { battleState, processTurn } = require('../systems/leviathan');

                // Init battle if not active yet
                if (!battleState.active) {
                    const { initBattle } = require('../systems/leviathan');
                    await initBattle(client);
                }

                if (battleState.finalPhase) return msg.reply(
                    `══〘 🌊 LEVIATHAN 〙══╮\n` +
                    `┃◆ The Leviathan is in its final phase.\n` +
                    `┃◆ Shard holders must !fuse then !finalstrike.\n` +
                    `╰═══════════════════════╯`
                );

                await processTurn(userId, damage, client);

                // War damage contribution
                try {
                    const { addWarDamage, getActiveWar, endVoidWar } = require('../systems/voidwar');
                    const war = await getActiveWar();
                    if (war) {
                        const warResult = await addWarDamage(userId, p.nickname, 'S');
                        if (warResult && warResult.totalDamage >= warResult.goal) {
                            await endVoidWar(client);
                        }
                    }
                } catch(e) {}
            }

            const filledBars = Math.max(0, Math.floor((result.newHp / boss.max_hp) * 10));
            const bar        = '█'.repeat(filledBars) + '░'.repeat(10 - filledBars);
            const hpPct      = ((result.newHp / Number(boss.max_hp)) * 100).toFixed(1);

            if (result.defeated) {
                await msg.reply(
                    `══〘 🌍 BOSS ATTACK 〙══╮\n` +
                    `┃◆ ⚔️ ${p.nickname} deals ${damage} damage!\n` +
                    `┃◆ 💀 ${boss.name} has been slain!\n` +
                    `╰═══════════════════════╯`
                );

                // Build and send leaderboard to GC
                const announcement = await distributeWorldBossRewards(boss.id);
                if (announcement && client) {
                    await client.sendMessage(RAID_GROUP, { text: announcement });
                }
            } else {
                return msg.reply(
                    `══〘 🌍 BOSS ATTACK 〙══╮\n` +
                    `┃◆ ⚔️ ${p.nickname} deals ${damage} damage!\n` +
                    `┃◆────────────\n` +
                    `┃◆ 👹 ${boss.name} [${boss.rank}]\n` +
                    `┃◆ ❤️ [${bar}] ${hpPct}%\n` +
                    `┃◆ HP: ${result.newHp.toLocaleString()}/${Number(boss.max_hp).toLocaleString()}\n` +
                    `╰═══════════════════════╯`
                );
            }
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🌍 BOSS ATTACK 〙══╮\n┃◆ ❌ Attack failed.\n╰═══════════════════════╯`);
        }
    }
};