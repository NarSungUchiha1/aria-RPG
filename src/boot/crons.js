/**
 * All scheduled jobs, extracted from index.js (refactor 3/3).
 *
 * registerCrons({ getSock, isReady }) — accessors return the LIVE socket /
 * ready flag from index.js at execution time, exactly like the old closures
 * over the module-level `sock` / `isReady` variables did. Call ONCE at boot
 * (crons must never be registered per-reconnect — that duplicates them).
 */
const cron = require('node-cron');
const db = require('../database/db');
const { spawnDungeon, getWeightedDungeonRank, getActiveDungeon } = require('../engine/dungeon');
const { restockAllItems } = require('../systems/shopSystem');
const { restockPrestigeShop } = require('../systems/prestigeShop');

function registerCrons({ getSock, isReady }) {

    // ==================== DATABASE HEARTBEAT ====================
    let _heartbeatRunning = false;
    cron.schedule('*/5 * * * *', async () => {
        if (_heartbeatRunning) return;
        _heartbeatRunning = true;
        try {
            await db.query('SELECT 1');
        } catch (err) {
            console.log('💔 DB Heartbeat failed:', err.message);
        } finally {
            _heartbeatRunning = false;
        }
    });

    // ==================== HOURLY DUNGEON SPAWN ====================
    cron.schedule('0 */1 * * *', async () => {
        const sock = getSock();
        if (!isReady() || !sock) { console.log('⏭️ Spawn skipped — bot not ready.'); return; }
        console.log('🕒 Scheduled dungeon spawn triggered.');
        try {
            let isEventRunning = false;
            try {
                const [eventRows] = await db.execute("SELECT id FROM events WHERE is_active=1 AND ends_at > NOW() LIMIT 1");
                isEventRunning = eventRows.length > 0;
            } catch (e) { isEventRunning = false; }
            if (isEventRunning) { console.log('⏭️ Regular spawn skipped — event active.'); return; }

            const LRJID = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
            const [terrActive] = await db.execute("SELECT id FROM dungeon WHERE is_active=1 AND dungeon_rank LIKE 'TERRITORY_%' AND (group_jid=? OR group_jid IS NULL) LIMIT 1", [LRJID]);
            if (terrActive.length) { console.log('⏭️ Spawn skipped — territory assault active.'); return; }

            const active = await getActiveDungeon();
            if (active) {
                const [pc] = await db.execute("SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=? AND is_alive=1", [active.id]);
                if (pc[0].cnt > 0 || active.locked === 1) { console.log(`⏭️ Skipping — dungeon ${active.id} has ${pc[0].cnt} players.`); return; }
                console.log(`🧹 Closing stale dungeon ${active.id}.`);
            }
            const rank = await getWeightedDungeonRank();
            console.log(`🎲 Weighted rank selected: ${rank}`);
            await spawnDungeon(rank, sock);
        } catch (err) {
            console.error('Scheduled spawn failed:', err);
        }
    });

    // ==================== EVENT DUNGEON SPAWN ====================
    cron.schedule('*/20 * * * *', async () => {
        const sock = getSock();
        if (!isReady() || !sock) return;
        try {
            let hasActiveEvent = false;
            try {
                const [eventRows] = await db.execute("SELECT id FROM events WHERE is_active=1 AND ends_at > NOW() LIMIT 1");
                hasActiveEvent = eventRows.length > 0;
            } catch (e) { hasActiveEvent = false; }
            if (!hasActiveEvent) return;

            const LRJID2 = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
            const [terrActiveE] = await db.execute("SELECT id FROM dungeon WHERE is_active=1 AND dungeon_rank LIKE 'TERRITORY_%' AND (group_jid=? OR group_jid IS NULL) LIMIT 1", [LRJID2]);
            if (terrActiveE.length) { console.log('⏭️ Event spawn skipped — territory assault active.'); return; }

            const active = await getActiveDungeon();
            if (active) {
                const [pc] = await db.execute("SELECT COUNT(*) as cnt FROM dungeon_players WHERE dungeon_id=? AND is_alive=1", [active.id]);
                if (pc[0].cnt > 0 || active.locked === 1) { console.log(`⏭️ Event spawn skipped — dungeon ${active.id} active.`); return; }
            }
            const rank = await getWeightedDungeonRank();
            console.log(`💠 Event dungeon spawn: ${rank}`);
            await spawnDungeon(rank, sock);
        } catch (err) {
            console.error('Event spawn failed:', err);
        }
    });

    // ==================== EVENT AUTO-END ====================
    cron.schedule('8-59/10 * * * *', async () => {
        try {
            const [expired] = await db.execute("SELECT * FROM events WHERE is_active=1 AND ends_at <= NOW() LIMIT 1");
            if (!expired.length) return;
            console.log(`⏰ Event "${expired[0].name}" expired — ending with leaderboard.`);
            const { endEvent } = require('../commands/event');
            await endEvent(expired[0].id, getSock());
        } catch (e) {
            console.error('Event auto-end error:', e.message);
        }
    });

    // ==================== SHOP RESTOCK ====================
    cron.schedule('0 0 * * *', async () => {
        console.log('🛒 Restocking shop...');
        try { await restockAllItems(); } catch (err) { console.error('Shop restock failed:', err); }
    });

    // ==================== PRESTIGE SHOP RESTOCK ====================
    cron.schedule('5 0 * * *', async () => {
        console.log('💎 Restocking prestige shop...');
        try { await restockPrestigeShop(); } catch (err) { console.error('Prestige shop restock failed:', err); }
    });

    // ==================== WEEKLY BOUNTY ====================
    cron.schedule('0 8 * * 1', async () => {
        const sock = getSock();
        if (!isReady() || !sock) return;
        try {
            const { selectWeeklyTarget } = require('../commands/bounty');
            const target = await selectWeeklyTarget();
            if (!target) return;
            const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
            await sock.sendMessage(RAID_GROUP, {
                text:
                    `╔══〘 🎯 MOST WANTED 〙══╗\n` +
                    `┃◆\n` +
                    `┃◆ A new bounty has been posted.\n` +
                    `┃◆\n` +
                    `┃◆ 🎯 *${target.nickname}* [${target.rank}]\n` +
                    `┃◆\n` +
                    `┃◆ This hunter has proven themselves\n` +
                    `┃◆ too dangerous to ignore.\n` +
                    `┃◆\n` +
                    `┃◆ 💰 Reward: ${target.reward_gold?.toLocaleString()}G\n` +
                    `┃◆ ⭐ Reward: ${target.reward_xp?.toLocaleString()} XP\n` +
                    `┃◆\n` +
                    `┃◆ Duel them. Beat them.\n` +
                    `┃◆ Then !bounty claim to collect.\n` +
                    `┃◆\n` +
                    `┃◆ Good luck. You'll need it.\n` +
                    `╚═══════════════════════════╝`
            });
            console.log(`🎯 Weekly bounty set: ${target.nickname}`);
        } catch(e) { console.error('Bounty cron error:', e.message); }
    });

    // ==================== MANA REGENERATION ====================
    cron.schedule('2-59/10 * * * *', async () => {
        try {
            await db.execute(`
                UPDATE players
                SET mana = LEAST(max_mana, mana + GREATEST(1, FLOOR(max_mana / 48)))
                WHERE mana < max_mana AND max_mana > 0
            `);
        } catch(e) { console.error('Mana regen error:', e.message); }
    });

    // ==================== FATIGUE RECOVERY ====================
    cron.schedule('4-59/10 * * * *', async () => {
        try {
            await db.execute(`
                UPDATE players
                SET fatigue = GREATEST(0, COALESCE(fatigue, 0) - 5)
                WHERE fatigue > 0
            `);
        } catch(e) { console.error('Fatigue recovery error:', e.message); }
    });

    // ==================== WEEKLY INACTIVE CLEANUP ====================
    cron.schedule('0 3 * * 1', async () => {
        try {
            const { clearInactivePlayers } = require('../systems/prestigeSystem');
            await clearInactivePlayers();
            console.log('🧹 Weekly inactive player cleanup done');
        } catch(e) { console.error('Cleanup error:', e.message); }
    });

    // ==================== PRESTIGE DUNGEON SPAWN ====================
    cron.schedule('30 */1 * * *', async () => {
        const sock = getSock();
        if (!isReady() || !sock) return;
        try {
            const [prestigePlayers] = await db.execute(
                "SELECT DISTINCT prestige_level FROM players WHERE prestige_level > 0 LIMIT 1"
            );
            if (!prestigePlayers.length) return;

            const LIVE_GP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
            const [anyActive] = await db.execute("SELECT id FROM dungeon WHERE is_active=1 AND (group_jid=? OR group_jid IS NULL) LIMIT 1", [LIVE_GP]);
            if (anyActive.length) { console.log('⏭️ Prestige cron skipped — dungeon active'); return; }

            const [recentP] = await db.execute(
                "SELECT id FROM dungeon WHERE dungeon_rank LIKE 'P%' AND created_at > DATE_SUB(NOW(), INTERVAL 25 MINUTE) LIMIT 1"
            );
            if (recentP.length) { console.log('⏭️ Prestige cron skipped — ran recently'); return; }

            const { spawnPrestigeDungeon, getWeightedPrestigeRank } = require('../engine/prestigeDungeon');
            const RAID_GROUP = process.env.RAID_GROUP_JID || process.env.GROUP_JID;
            if (!RAID_GROUP) { console.error('★ No RAID_GROUP_JID — cannot spawn prestige dungeon'); return; }

            const prestigeRank = await getWeightedPrestigeRank();
            console.log(`✦ Prestige cron spawn: ${prestigeRank}`);
            await spawnPrestigeDungeon(prestigeRank, sock, RAID_GROUP);
        } catch(e) { console.error('Prestige cron spawn error:', e.message); }
    });

    // ==================== VIP PASS AD (raid downtime) ====================
    // Posts the VIP PASS poster to the announcement group every 10–15 min
    // WHILE NO RAID IS RUNNING. Target group via VIP_AD_GC_JID (defaults to
    // the raid group); disable entirely with VIP_AD_OFF=1.
    let lastVipAd = 0;
    let nextVipAdGap = 10 * 60 * 1000 + Math.floor(Math.random() * 5 * 60 * 1000);
    let vipAdImage = null; // lazy-loaded once
    cron.schedule('*/5 * * * *', async () => {
        const sock = getSock();
        if (!isReady() || !sock) return;
        if (process.env.VIP_AD_OFF === '1') return;
        if (Date.now() - lastVipAd < nextVipAdGap) return;
        try {
            // Downtime only — any live dungeon means players are busy.
            const [active] = await db.execute("SELECT id FROM dungeon WHERE is_active=1 LIMIT 1");
            if (active.length) return;

            if (!vipAdImage) {
                const fs = require('fs');
                const path = require('path');
                vipAdImage = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'vip-pass.jpg'));
            }
            const AD_JID = process.env.VIP_AD_GC_JID || process.env.RAID_GROUP_JID || '120363213735662100@g.us';
            const { PRICE_GHS, PRICE_NGN, SUB_DAYS } = require('../systems/subscriberSystem');
            await sock.sendMessage(AD_JID, {
                image: vipAdImage,
                caption:
                    `◆═══〘 👑 ARIA VIP PASS 〙═══◆\n` +
                    `┃◈ 💵 GH₵${PRICE_GHS} (~₦${PRICE_NGN}) • ${SUB_DAYS} days\n` +
                    `┃◈ Type *!vip* for details.\n` +
                    `◆═══════════════════════◆`,
                mimetype: 'image/jpeg'
            });
            lastVipAd = Date.now();
            nextVipAdGap = 10 * 60 * 1000 + Math.floor(Math.random() * 5 * 60 * 1000);
            console.log('👑 VIP ad posted (no raid active).');
        } catch (e) { console.error('VIP ad cron error:', e.message); }
    });

    // ==================== FACTION WAR — WEEKLY RESULT ====================
    // Sunday 19:00 UTC: crown the week's champion faction, announce, set the
    // +10% XP champion buff for the coming week.
    cron.schedule('0 19 * * 0', async () => {
        const sock = getSock();
        if (!isReady() || !sock) return;
        try {
            const { resolveWeeklyFactionWar } = require('../systems/factionSystem');
            const AD_JID = process.env.RAID_GROUP_JID || '120363213735662100@g.us';
            await resolveWeeklyFactionWar(sock, AD_JID);
        } catch (e) { console.error('Faction weekly cron error:', e.message); }
    });

    console.log('⏰ Cron jobs registered (13)');
}

module.exports = { registerCrons };
