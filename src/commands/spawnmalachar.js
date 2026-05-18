const db = require('../database/db');
const { spawnDungeon } = require('../engine/dungeon');
const { CHAPTER4_LORE } = require('../systems/chapter4lore');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

module.exports = {
    name: 'spawnmalachar',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');

        try {
            // Check no active dungeon
            const [active] = await db.execute(
                "SELECT id FROM dungeon WHERE is_active=1 LIMIT 1"
            );
            if (active.length) return msg.reply(
                '❌ A dungeon is already active. Wait for it to end.'
            );

            // Spawn MALACHAR dungeon with 6 stages
            const [result] = await db.execute(
                `INSERT INTO dungeon (dungeon_rank, stage, max_stage, boss_name, is_active, stage_cleared, in_combat, locked)
                 VALUES ('MALACHAR', 1, 6, 'Malachar', 1, 0, 0, 0)`
            );
            const dungeonId = result.insertId;

            // Spawn first stage enemies
            const { spawnStageEnemies } = require('../engine/dungeon');
            await spawnStageEnemies(dungeonId, 'MALACHAR', 1);

            // Announce lore first
            await client.sendMessage(RAID_GROUP, { text: CHAPTER4_LORE });

            // Then dungeon announcement
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
                `┃★                                 \n` +
                `┃★  👁️  Boss: Malachar             \n` +
                `┃★  ❤️  HP: 1,000,000,000          \n` +
                `┃★                                 \n` +
                `┃★  DM the bot: !enter             \n` +
                `┃★  ⏳ Portal closes in 10 minutes \n` +
                `┃★                                 \n` +
                `╚══════════════════════════════════╝`;

            await client.sendMessage(RAID_GROUP, { text: announcement });

            // Start lobby timer
            const { startLobbyTimer } = require('../engine/dungeon');
            // Use dungeon lobby timer via lockDungeon after players enter
            await msg.reply(`✅ Malachar dungeon spawned (id: ${dungeonId}). Lore and announcement sent.`);

        } catch (err) {
            console.error('spawnmalachar error:', err);
            msg.reply('❌ Failed to spawn Malachar dungeon.');
        }
    }
};