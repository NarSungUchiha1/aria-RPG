/**
 * !givemalacharweapon — Admin only
 * Gives each of the three Malachar hunters their bound weapon.
 * Can only be run once per player — weapon is unique and bound.
 */

const db = require('../database/db');
const { MALACHAR_WEAPONS } = require('../data/malacharWeapons');

const RAID_GROUP = process.env.RAID_GROUP_JID || '120363213735662100@g.us';

module.exports = {
    name: 'givemalacharweapon',
    async execute(msg, args, { isAdmin, client }) {
        if (!isAdmin) return msg.reply('❌ Admin only.');

        try {
            // Ensure bound_to column exists on inventory
            await db.execute(
                'ALTER TABLE inventory ADD COLUMN IF NOT EXISTS bound_to VARCHAR(60) DEFAULT NULL'
            ).catch(() => {});
            await db.execute(
                'ALTER TABLE inventory ADD COLUMN IF NOT EXISTS is_unique TINYINT DEFAULT 0'
            ).catch(() => {});
            await db.execute(
                'ALTER TABLE weaponStats ADD COLUMN IF NOT EXISTS bound_to VARCHAR(60) DEFAULT NULL'
            ).catch(() => {});

            // Also add to weaponStats table so equip system can read stat bonuses
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

            const results = [];

            for (const [weaponName, weapon] of Object.entries(MALACHAR_WEAPONS)) {
                const ownerId = weapon.owner_id;

                // Check player exists
                const [player] = await db.execute(
                    'SELECT nickname FROM players WHERE id=?', [ownerId]
                );
                if (!player.length) {
                    results.push('⚠️ Player ' + ownerId + ' not found — skipped.');
                    continue;
                }

                // Check already has weapon
                const [existing] = await db.execute(
                    'SELECT id FROM inventory WHERE player_id=? AND item_name=?',
                    [ownerId, weaponName]
                );
                if (existing.length) {
                    results.push('⚠️ ' + player[0].nickname + ' already has *' + weaponName + '*.');
                    continue;
                }

                // Give weapon to player — bound, unique, quantity 1
                await db.execute(
                    'INSERT INTO inventory (player_id, item_name, item_type, quantity, grade, equipped, durability, max_durability, bound_to, is_unique) VALUES (?, ?, \'weapon\', 1, \'P\', 0, 999, 999, ?, 1)',
                    [ownerId, weaponName, ownerId]
                );

                // Register stat bonuses in weaponStats
                const b = weapon.stat_bonus || {};
                await db.execute(
                    'INSERT INTO weaponStats (item_name, strength, agility, intelligence, stamina, bound_to) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE strength=?, agility=?, intelligence=?, stamina=?, bound_to=?',
                    [weaponName,
                     b.strength || 0, b.agility || 0, b.intelligence || 0, b.stamina || 0, ownerId,
                     b.strength || 0, b.agility || 0, b.intelligence || 0, b.stamina || 0, ownerId]
                );

                // Register moves in weaponMoves data (runtime patch)
                const { MALACHAR_WEAPONS: mw } = require('../data/malacharWeapons');
                const weaponMoves = require('../data/weaponMoves');
                if (!weaponMoves[weaponName]) {
                    weaponMoves[weaponName] = weapon.moves;
                }

                results.push('✅ ' + player[0].nickname + ' → *' + weaponName + '*');

                // DM the player
                try {
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
                            Object.entries(weapon.stat_bonus || {}).map(([s, v]) => '┃★ +' + v + ' ' + s.toUpperCase()).join('\n') + '\n' +
                            '┃★\n' +
                            '┃★ MOVES:\n' +
                            weapon.moves.map(m => '┃★ ▸ *' + m.name + '*\n┃★   ' + m.desc).join('\n') + '\n' +
                            '┃★\n' +
                            '┃★ This weapon is bound to you.\n' +
                            '┃★ It cannot be traded, dropped,\n' +
                            '┃★ or wielded by anyone else.\n' +
                            '┃★ Ever.\n' +
                            '┃★\n' +
                            '┃★ !equip ' + weaponName + '\n' +
                            '╚══════════════════════════════════════╝'
                    });
                } catch(e) {}
            }

            // Group announcement
            await client.sendMessage(RAID_GROUP, {
                text:
                    '╔══〘 ⚔️ THE THREE WEAPONS 〙══╗\n' +
                    '┃★\n' +
                    '┃★ The void left something in the\n' +
                    '┃★ dungeon when Malachar fell.\n' +
                    '┃★\n' +
                    '┃★ Three weapons. Forged from the\n' +
                    '┃★ moment of his death.\n' +
                    '┃★\n' +
                    '┃★ Bound to the hands that ended him.\n' +
                    '┃★ No one else can touch them.\n' +
                    '┃★\n' +
                    '┃★▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬\n' +
                    '┃★ ⚔️ *Ruin* → Hajun\n' +
                    '┃★ ⚔️ *Stillpoint* → VØƦTEX\n' +
                    '┃★ ⚔️ *No More Words* → Sekiro\n' +
                    '┃★\n' +
                    '┃★ They earned it.\n' +
                    '┃★\n' +
                    '╚═══════════════════════════╝'
            });

            return msg.reply(
                '╔══〘 ⚔️ WEAPONS DISTRIBUTED 〙══╗\n' +
                results.map(r => '┃★ ' + r).join('\n') + '\n' +
                '╚═══════════════════════════╝'
            );

        } catch (err) {
            console.error('givemalacharweapon error:', err);
            msg.reply('❌ Failed: ' + err.message);
        }
    }
};