const db = require('../database/db');
const {
    demoteAllRaiders,
    getActiveDungeon,
    clearLobbyTimer,
    dungeonLocks,
    autoStartTimers
} = require('../engine/dungeon');
const { clearDungeonTimers } = require('../engine/dungeonTimer');
const { trySpawnPrestigeDungeon } = require('../engine/prestigeDungeon');

module.exports = {
    name: 'closedungeon',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply(
            `══〘 🔒 CLOSE DUNGEON 〙══╮\n┃◆ ❌ Admin only.\n╰═══════════════════════╯`
        );
        try {
            // Check DB first
            const dungeon = await getActiveDungeon();

            // Also check if any dungeon is active in DB regardless of memory state
            const [anyActive] = await db.execute(
                "SELECT id FROM dungeon WHERE is_active=1 ORDER BY id DESC LIMIT 1"
            );

            const dungeonId = dungeon?.id || anyActive[0]?.id;

            if (!dungeonId) return msg.reply(
                `══〘 🔒 CLOSE DUNGEON 〙══╮\n┃◆ ❌ No active dungeon found.\n╰═══════════════════════╯`
            );

            // ✅ Clear ALL in-memory state
            clearDungeonTimers(dungeonId);
            clearLobbyTimer(dungeonId);

            try {
                const { clearStage } = require('../systems/contributionSystem');
                clearStage(dungeonId);
            } catch(e) {}

            if (autoStartTimers.has(dungeonId)) {
                clearTimeout(autoStartTimers.get(dungeonId));
                autoStartTimers.delete(dungeonId);
            }

            dungeonLocks.delete(dungeonId);

            // Demote raiders from GC
            try { await demoteAllRaiders(client, dungeonId); } catch (e) {}

            // ✅ Close in DB + clean up players/enemies
            await db.execute("UPDATE dungeon SET is_active=0, locked=0 WHERE id=?", [dungeonId]);
            await db.execute("DELETE FROM dungeon_players WHERE dungeon_id=?", [dungeonId]);
            await db.execute("DELETE FROM dungeon_enemies WHERE dungeon_id=?", [dungeonId]);

            // Auto-spawn prestige dungeon after admin close
            const PRESTIGE_RG = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
            trySpawnPrestigeDungeon(client, PRESTIGE_RG).catch(e => console.error('★ Prestige spawn error (closeDungeon):', e.message));

            return msg.reply(
                `══〘 🔒 CLOSE DUNGEON 〙══╮\n` +
                `┃◆ ✅ Dungeon ${dungeonId} closed.\n` +
                `┃◆ Timers cleared. Raiders demoted.\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🔒 CLOSE DUNGEON 〙══╮\n┃◆ ❌ Failed to close dungeon.\n╰═══════════════════════╯`);
        }
    }
};