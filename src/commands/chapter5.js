/**
 * !chapter5 — Admin only
 * Launches the full Chapter 5 sequence manually.
 * ARIA speaks → Faction reveal → Weapons distributed → Group announcement.
 * Run this after Malachar has been defeated.
 */

const db = require('../database/db');
const { ARIA_MALACHAR_REACTION, CHAPTER5_FACTION_REVEAL } = require('../systems/chapter5lore');
const { MALACHAR_WEAPONS } = require('../data/malacharWeapons');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = {
    name: 'chapter5',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');

        try {
            await msg.reply('✅ Chapter 5 sequence starting...');

            // ── ARIA speaks ───────────────────────────────────────────────────
            await sleep(3000);
            await client.sendMessage(RAID_GROUP, { text: ARIA_MALACHAR_REACTION });

            // ── Faction reveal ────────────────────────────────────────────────
            await sleep(12000);
            await client.sendMessage(RAID_GROUP, { text: CHAPTER5_FACTION_REVEAL });

            // ── Weapons distributed ───────────────────────────────────────────
            await sleep(6000);

            await db.execute('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS bound_to VARCHAR(60) DEFAULT NULL').catch(() => {});
            await db.execute('ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_unique TINYINT DEFAULT 0').catch(() => {});
            await db.execute(`
                CREATE TABLE IF NOT EXISTS weaponStats (
                    item_name    VARCHAR(100) PRIMARY KEY,
                    strength     INT DEFAULT 0,
                    agility      INT DEFAULT 0,
                    intelligence INT DEFAULT 0,
                    stamina      INT DEFAULT 0,
                    bound_to     VARCHAR(60) DEFAULT NULL
                )
            `).catch(() => {});

            const weaponMoves = require('../data/weaponMoves');
            const weaponResults = [];

            for (const [weaponName, weapon] of Object.entries(MALACHAR_WEAPONS)) {
                const ownerId = weapon.owner_id;

                const [player] = await db.execute(
                    'SELECT nickname FROM players WHERE id=?', [ownerId]
                ).catch(() => [[]]);
                if (!player.length) {
                    console.log('chapter5: player ' + ownerId + ' not found — skipped');
                    continue;
                }

                // Skip if already given
                const [existing] = await db.execute(
                    'SELECT id FROM inventory WHERE player_id=? AND item_name=?',
                    [ownerId, weaponName]
                ).catch(() => [[]]);
                if (existing.length) {
                    console.log('chapter5: ' + player[0].nickname + ' already has ' + weaponName);
                    weaponResults.push({ ownerId, ownerNick: player[0].nickname, weaponName, weapon, alreadyHad: true });
                    continue;
                }

                // Give weapon
                await db.execute(
                    'INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped, bound_to, is_unique) VALUES (?, ?, \'weapon\', 1, 0, ?, 1)',
                    [ownerId, weaponName, ownerId]
                ).catch(() => {});

                // Register stat bonuses
                const b = weapon.stat_bonus || {};
                await db.execute(
                    'INSERT INTO weaponStats (item_name, strength, agility, intelligence, stamina, bound_to) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE strength=?, agility=?, intelligence=?, stamina=?, bound_to=?',
                    [weaponName, b.strength||0, b.agility||0, b.intelligence||0, b.stamina||0, ownerId,
                     b.strength||0, b.agility||0, b.intelligence||0, b.stamina||0, ownerId]
                ).catch(() => {});

                // Register moves at runtime
                if (!weaponMoves[weaponName]) weaponMoves[weaponName] = weapon.moves;

                weaponResults.push({ ownerId, ownerNick: player[0].nickname, weaponName, weapon, alreadyHad: false });

                // DM the hunter
                await client.sendMessage(ownerId + '@s.whatsapp.net', {
                    text:
                        '╔══════════════════════════════════════╗\n' +
                        '┃★\n' +
                        '┃★   Something arrived.\n' +
                        '┃★\n' +
                        '┃★   The system doesn\'t know\n' +
                        '┃★   how to classify it.\n' +
                        '┃★   It tried. It gave up.\n' +
                        '┃★\n' +
                        '┃★   ⚔️ *' + weaponName + '*\n' +
                        '┃★\n' +
                        '┃★   〝' + weapon.lore + '〞\n' +
                        '┃★\n' +
                        '┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n' +
                        '┃★ STAT BONUSES:\n' +
                        Object.entries(b).map(([s, v]) => '┃★ +' + v + ' ' + s.toUpperCase()).join('\n') + '\n' +
                        '┃★\n' +
                        '┃★ MOVES:\n' +
                        weapon.moves.map(m => '┃★ ▸ *' + m.name + '*\n┃★   ' + m.desc).join('\n') + '\n' +
                        '┃★\n' +
                        '┃★ Bound to you. Only you.\n' +
                        '┃★ !equip ' + weaponName + '\n' +
                        '╚══════════════════════════════════════╝'
                }).catch(e => console.error('chapter5 DM failed:', e.message));
            }

            // ── Group weapon announcement ─────────────────────────────────────
            await sleep(3000);
            const newWeapons = weaponResults.filter(r => !r.alreadyHad);
            if (newWeapons.length) {
                await client.sendMessage(RAID_GROUP, {
                    text:
                        '╔══〘 ⚔️ THE THREE WEAPONS 〙══╗\n' +
                        '┃★\n' +
                        '┃★ The void left something behind\n' +
                        '┃★ when Malachar fell.\n' +
                        '┃★\n' +
                        '┃★ Three weapons. Bound to the\n' +
                        '┃★ hands that ended him.\n' +
                        '┃★\n' +
                        newWeapons.map(r => '┃★ ⚔️ *' + r.weaponName + '* → ' + r.ownerNick).join('\n') + '\n' +
                        '┃★\n' +
                        '┃★ No one else can touch them.\n' +
                        '┃★ Ever.\n' +
                        '┃★\n' +
                        '╚═══════════════════════════╝'
                }).catch(() => {});
            }

            // ── Admin summary ─────────────────────────────────────────────────
            const summary = weaponResults.map(r =>
                (r.alreadyHad ? '⚠️ already had' : '✅ given') + ' — ' + r.ownerNick + ' → *' + r.weaponName + '*'
            ).join('\n');

            return msg.reply(
                '╔══〘 ✅ CHAPTER 5 COMPLETE 〙══╗\n' +
                '┃★ ARIA reaction sent\n' +
                '┃★ Faction reveal sent\n' +
                '┃★\n' +
                '┃★ WEAPONS:\n' +
                (summary ? summary.split('\n').map(l => '┃★ ' + l).join('\n') : '┃★ none distributed') + '\n' +
                '╚═══════════════════════════╝'
            );

        } catch (err) {
            console.error('chapter5 error:', err);
            msg.reply('❌ Chapter 5 sequence failed: ' + err.message);
        }
    }
};