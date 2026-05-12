const db = require('../database/db');
const { WORLD_BOSSES, getActiveWorldBoss } = require('../systems/worldBossSystem');
const { getActiveWar } = require('../systems/voidwar');
const { RAID_GROUP } = require('../engine/dungeon');
const { sendWithRetry } = require('../utils/sendWithRetry');

module.exports = {
    name: 'spawnleviathan',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply(
            `══〘 🌊 LEVIATHAN 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );

        try {
            const existing = await getActiveWorldBoss();
            if (existing) return msg.reply(
                `══〘 🌊 LEVIATHAN 〙══╮\n` +
                `┃◆ ⚠️ A world boss is already active.\n` +
                `┃◆ 👹 ${existing.name}\n` +
                `┃◆ ❤️ ${Number(existing.current_hp).toLocaleString()}/${Number(existing.max_hp).toLocaleString()} HP\n` +
                `╰═══════════════════════╯`
            );

            const leviathan = WORLD_BOSSES.find(b => b.name === 'The Void Leviathan');
            if (!leviathan) return msg.reply(`══〘 🌊 LEVIATHAN 〙══╮\n┃◆ ❌ Leviathan not found in boss list.\n╰═══════════════════════╯`);

            // Spawn in DB
            const [result] = await db.execute(
                `INSERT INTO world_boss (name, \`rank\`, max_hp, current_hp, atk, def, exp_reward, gold_reward, is_active, spawn_time)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, NOW())`,
                [leviathan.name, leviathan.rank, leviathan.hp, leviathan.hp,
                 leviathan.atk, leviathan.def, leviathan.exp, leviathan.gold]
            );

            // Check if void war is running
            const war = await getActiveWar();
            const warLine = war
                ? `┃◆ ⚡ VOID WAR ACTIVE — attacks deal war damage!\n`
                : `┃◆ ⚠️ Start !startvoidwar to begin the collective goal.\n`;

            let mentions = [];
            try {
                const { tagAll } = require('../utils/tagAll');
                const t = await tagAll(client);
                mentions = t.mentions || [];
            } catch(e) {}

            await sendWithRetry(client, RAID_GROUP, {
                text:
                    `╭══〘 🌊 THE VOID LEVIATHAN 〙══╮\n` +
                    `┃◆ \n` +
                    `┃◆   CHAPTER 3 — THE VOID WAR\n` +
                    `┃◆ \n` +
                    `┃◆ ${leviathan.spawnMsg}\n` +
                    `┃◆ \n` +
                    `┃◆ ━━━━━━━━━━━━━━━━━━━━\n` +
                    `┃◆ \n` +
                    `┃◆ ❤️ HP: ${leviathan.hp.toLocaleString()}\n` +
                    `┃◆ ⚔️ ATK: ${leviathan.atk}  🛡️ DEF: ${leviathan.def}\n` +
                    `┃◆ Rank: ${leviathan.rank}\n` +
                    `┃◆ \n` +
                    `${warLine}` +
                    `┃◆ \n` +
                    `┃◆ Use !attackboss to fight it.\n` +
                    `┃◆ Use !worldboss to see its status.\n` +
                    `┃◆ \n` +
                    `┃◆ 〝The system cannot classify it.\n` +
                    `┃◆   The system is afraid.〞\n` +
                    `┃◆ \n` +
                    `╰═══════════════════════════╯`,
                mentions
            });

            return msg.reply(
                `══〘 🌊 LEVIATHAN 〙══╮\n` +
                `┃◆ ✅ The Void Leviathan has been spawned!\n` +
                `┃◆ ❤️ ${leviathan.hp.toLocaleString()} HP\n` +
                `┃◆ Announcement sent.\n` +
                `╰═══════════════════════╯`
            );

        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🌊 LEVIATHAN 〙══╮\n┃◆ ❌ Failed.\n┃◆ ${err.message}\n╰═══════════════════════╯`);
        }
    }
};