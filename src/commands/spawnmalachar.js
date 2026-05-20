const db = require('../database/db');
const { spawnStageEnemies, startLobbyTimer } = require('../engine/dungeon');
const { CHAPTER4_LORE } = require('../systems/chapter4lore');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

module.exports = {
    name: 'spawnmalachar',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');

        try {
            const [active] = await db.execute(
                "SELECT id FROM dungeon WHERE is_active=1 LIMIT 1"
            );
            if (active.length) return msg.reply(
                '❌ A dungeon is already active. Wait for it to end.'
            );

            // Ensure dungeon_rank column is wide enough
            await db.execute(
                "ALTER TABLE dungeon MODIFY COLUMN dungeon_rank VARCHAR(20)"
            ).catch(() => {});

            const [result] = await db.execute(
                `INSERT INTO dungeon (dungeon_rank, stage, max_stage, boss_name, is_active, stage_cleared, in_combat, locked)
                 VALUES ('MALACHAR', 1, 6, 'Malachar', 1, 0, 0, 0)`
            );
            const dungeonId = result.insertId;

            // Mark this dungeon as unlimited in a flag table
            await db.execute(`
                CREATE TABLE IF NOT EXISTS dungeon_flags (
                    dungeon_id INT PRIMARY KEY,
                    unlimited_entry TINYINT DEFAULT 0,
                    no_rank_check TINYINT DEFAULT 0
                )
            `).catch(() => {});

            await db.execute(
                `INSERT INTO dungeon_flags (dungeon_id, unlimited_entry, no_rank_check)
                 VALUES (?, 1, 1)
                 ON DUPLICATE KEY UPDATE unlimited_entry=1, no_rank_check=1`,
                [dungeonId]
            );

            await spawnStageEnemies(dungeonId, 'MALACHAR', 1);

            await client.sendMessage(RAID_GROUP, { text: CHAPTER4_LORE });

            const announcement =
                `╔══════════════════════════════════╗\n` +
                `┃★                                 \n` +
                `┃★  ⚠️  HE IS HERE.               \n` +
                `┃★                                 \n` +
                `┃★  MALACHAR HAS ENTERED           \n` +
                `┃★  THE KNOWN ZONE.                \n` +
                `┃★                                 \n` +
                `┃★  6 stages. His generals first.  \n` +
                `┃★  Then him.                      \n` +
                `┃★                                 \n` +
                `┃★  ALL hunters can enter.         \n` +
                `┃★  All ranks. No exceptions.      \n` +
                `┃★  No entry limit. No cap.        \n` +
                `┃★                                 \n` +
                `┃★  👁️  Boss: Malachar             \n` +
                `┃★  ❤️  HP: 1,000,000,000          \n` +
                `┃★                                 \n` +
                `┃★  DM the bot: !enter             \n` +
                `┃★  ⏳ Portal closes in 10 minutes \n` +
                `┃★                                 \n` +
                `╚══════════════════════════════════╝`;

            await client.sendMessage(RAID_GROUP, { text: announcement });

            startLobbyTimer(dungeonId, client);

            await msg.reply(`✅ Malachar dungeon spawned (id: ${dungeonId}). Lore and announcement sent.`);

        } catch (err) {
            console.error('spawnmalachar error:', err);
            msg.reply('❌ Failed to spawn Malachar dungeon.');
        }
    }
};