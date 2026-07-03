// One-time owner migration: give players who resonated BEFORE the rebirth
// update their unique weapon, and apply the rebirth wipe (inventory + gold).
// Idempotent — only touches profiles that don't yet have a forged weapon.
const db = require('../database/db');
const { isOwner } = require('../systems/aiSystems');
const { forgeAscendantWeapon } = require('../systems/ascendantSystem');
const { setSignatureMoves, setAscendantWeapon } = require('../systems/skillSystem');

module.exports = {
    name: 'backfillascendants',
    aliases: ['forgeascendants'],
    async execute(msg, args, { userId }) {
        if (!isOwner(userId)) return msg.reply('❌ Owner only.');

        const [rows] = await db.execute(
            "SELECT player_id, moves FROM resonance_profiles WHERE weapon_moves IS NULL OR weapon_moves = ''"
        );
        if (!rows.length) return msg.reply('✅ No Ascendants need backfilling — all have a unique weapon.');

        await msg.reply(`⚙️ Backfilling ${rows.length} Ascendant(s): forging weapons + wiping items/gold…`);

        let done = 0, failed = 0;
        for (const r of rows) {
            try {
                let sig = [];
                try { sig = JSON.parse(r.moves || '[]'); } catch { sig = []; }

                const weapon = await forgeAscendantWeapon(sig);
                await db.execute(
                    'UPDATE resonance_profiles SET weapon_name=?, weapon_moves=? WHERE player_id=?',
                    [weapon.name, JSON.stringify(weapon.moves), r.player_id]
                );
                // Rebirth wipe — same as a fresh resonance.
                await db.execute('DELETE FROM inventory WHERE player_id=?', [r.player_id]).catch(() => {});
                await db.execute('UPDATE currency SET gold=0 WHERE player_id=?', [r.player_id]).catch(() => {});

                // Refresh combat caches so the new kit applies immediately.
                setSignatureMoves(r.player_id, sig);
                setAscendantWeapon(r.player_id, weapon.name, weapon.moves);

                done++;
                await new Promise(res => setTimeout(res, 500)); // gentle on the AI
            } catch (e) {
                failed++;
                console.error('[backfill] failed for', r.player_id, e.message);
            }
        }

        return msg.reply(`✅ Backfill complete. Forged + wiped: *${done}*${failed ? `, failed: *${failed}*` : ''}.`);
    }
};
