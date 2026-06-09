const db = require('../database/db');

module.exports = {
    name: 'equip',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply(
            `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Use: !equip <number>\n╰═══════════════════════╯`
        );
        const idx = parseInt(args[0]) - 1;
        if (isNaN(idx) || idx < 0) return msg.reply(
            `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Invalid number.\n╰═══════════════════════╯`
        );

        try {
            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? AND item_name NOT LIKE '%Void Shard%' ORDER BY id    
                [userId]
            );
            const item = items[idx];
            if (!item) return msg.reply(
                `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Item not found.\n┃◆ Use !inventory to check.\n╰═══════════════════════╯`
            );
            if (item.equipped) return msg.reply(
                `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ⚡ ${item.item_name} is already equipped.\n╰═══════════════════════╯`
            );
            if (item.item_type === 'consumable') return msg.reply(
                `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Consumables cannot be equipped.\n┃◆ Use !use ${item.item_name}\n╰═══════════════════════╯`
            );

            // Block non-owners from equipping bound/unique weapons
            if (item.bound_to && item.bound_to !== userId) {
                return msg.reply(
                    '══〘 ⚔️ EQUIP 〙══╮\n' +
                    '┃◆ ❌ This weapon is bound to another hunter.\n' +
                    '┃◆ It cannot be wielded by anyone else.\n' +
                    '╰═══════════════════════╯'
                );
            }

            // ── ROLE RESTRICTIONS ────────────────────────────────────────────
            // Weapons restricted to specific roles
            const WEAPON_ROLE_MAP = {
                // Healer only
                'Healing Staff':          ['Healer'],
                'Staff of the Eternal':   ['Healer'],
                'Void Sanctuary Staff':   ['Healer'],
                'Ember Chalice':          ['Healer'],
                'Soul Lantern':           ['Healer'],
                'Cradle of Life':         ['Healer'],
                'Splint Mace':            ['Healer'],
                // Mage only
                'Spell Book':             ['Mage'],
                'Arcane Staff':           ['Mage'],
                'Frostbane Wand':         ['Mage'],
                'Void Scepter':           ['Mage'],
                'Inferno Rod':            ['Mage'],
                'Celestial Orb':          ['Mage'],
                'Celestial Codex':        ['Mage'],
                'Omniscient Scepter':     ['Mage'],
                // Healer or Mage
                'Bone Staff':             ['Healer', 'Mage'],
                // Tank only
                'Shield':                 ['Tank'],
                'Tower Shield':           ['Tank'],
                'Armor Plate':            ['Tank'],
                'Bulwark of Stone':       ['Tank'],
                'Aegis of the Fallen':    ['Tank'],
                'Fortress Aegis':         ['Tank'],
                'Aegis Immortal':         ['Tank'],
                'Golemheart Gauntlets':   ['Tank'],
                // Assassin only
                'Dagger':                 ['Assassin'],
                'Shadow Dagger':          ['Assassin'],
                'Voidreaper Dagger':      ['Assassin'],
                'Whisperblade':           ['Assassin'],
                'Twin Fang Blades':       ['Assassin'],
                'Wind Katana':            ['Assassin'],
                'Nightshade Bow':         ['Assassin'],
                // Berserker only
                'Battle Axe':             ['Berserker'],
                'Rage Blade':             ['Berserker'],
                'Heavy Blade':            ['Berserker'],
                'Iron Greatsword':        ['Berserker'],
                'Abyssal Greatsword':     ['Berserker'],
                'Obsidian Cleaver':       ['Berserker'],
                'Dragonbone Mace':        ['Berserker'],
                'Warhammer':              ['Berserker'],
                'Godslayer':              ['Berserker'],
            };

            if (item.item_type === 'weapon') {
                // Bound weapons bypass all role checks
                const isBoundWeapon = item.is_unique === 1 && item.bound_to === userId;

                if (!isBoundWeapon) {
                    // Check role restriction
                    const allowedRoles = WEAPON_ROLE_MAP[item.item_name];
                    if (allowedRoles) {
                        const [roleRow] = await db.execute('SELECT role FROM players WHERE id=?', [userId]);
                        const playerRole = roleRow[0]?.role || '';
                        if (!allowedRoles.includes(playerRole)) {
                            return msg.reply(
                                '══〘 ⚔️ EQUIP 〙══╮\n' +
                                '┃◆ ❌ *' + item.item_name + '*\n' +
                                '┃◆ is restricted to: ' + allowedRoles.join(' / ') + '\n' +
                                '┃◆ Your role: ' + playerRole + '\n' +
                                '╰═══════════════════════╯'
                            );
                        }
                    }
                }
            }

            // Weapon tier restrictions
            if (item.item_type === 'weapon') {
                const isBoundWeapon = item.is_unique === 1 && item.bound_to === userId;
                if (!isBoundWeapon) {
                    const [presRow] = await db.execute(
                        "SELECT COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
                        [userId]
                    );
                    const prestigeLevel = presRow[0]?.prestige_level || 0;
                    const isPrestigeWeapon = item.grade === 'P';
                    const isForgedWeapon   = item.is_forged === 1 || item.item_source === 'forge';

                    // Prestige players cannot use normal weapons
                    if (prestigeLevel > 0 && !isPrestigeWeapon && !isForgedWeapon) return msg.reply(
                        `╔══〘 ✦ EQUIP 〙══╗\n` +
                        `┃★ ❌ Normal weapons are void-dead\n` +
                        `┃★ at your level.\n` +
                        `┃★ Use !melt to convert them to gold.\n` +
                        `┃★ Equip from !prestigeshop instead.\n` +
                        `╚═══════════════════════════╝`
                    );

                    // Normal rank players cannot use prestige or forged weapons
                    if (prestigeLevel === 0 && (isPrestigeWeapon || isForgedWeapon)) return msg.reply(
                        `══〘 ⚔️ EQUIP 〙══╮\n` +
                        `┃◆ ❌ This weapon requires Prestige.\n` +
                        `┃◆ Forged and prestige weapons are\n` +
                        `┃◆ beyond your current rank.\n` +
                        `┃◆ Reach Prestige first.\n` +
                        `╰═══════════════════════╯`
                    );
                }
            }

            // Block equipping same type twice — but bags auto-swap
            const [alreadyEquipped] = await db.execute(
                "SELECT id, item_name FROM inventory WHERE player_id=? AND item_type=? AND equipped=1",
                [userId, item.item_type]
            );
            if (alreadyEquipped.length) {
                if (item.item_type === 'bag') {
                    // Auto-unequip old bag first
                    await db.execute("UPDATE inventory SET equipped=0 WHERE id=?", [alreadyEquipped[0].id]);
                } else {
                    return msg.reply(
                        `══〘 ⚔️ EQUIP 〙══╮\n` +
                        `┃◆ ❌ Already have a ${item.item_type} equipped.\n` +
                        `┃◆ Unequip: ${alreadyEquipped[0].item_name} first.\n` +
                        `╰═══════════════════════╯`
                    );
                }
            }

            await db.execute("UPDATE inventory SET equipped=1 WHERE id=?", [item.id]);

            // ✅ Do NOT modify base stats — combat system reads item bonuses
            // directly from inventory (strength_bonus, agility_bonus etc.)
            // Adding to base stats here was causing double-counting.

            // Build bonus display from actual item data
            const bonuses = [];
            if (item.strength_bonus     > 0) bonuses.push(`💪 STR +${item.strength_bonus}`);
            if (item.agility_bonus      > 0) bonuses.push(`⚡ AGI +${item.agility_bonus}`);
            if (item.intelligence_bonus > 0) bonuses.push(`🧠 INT +${item.intelligence_bonus}`);
            if (item.stamina_bonus      > 0) bonuses.push(`🛡️ STA +${item.stamina_bonus}`);
            if (item.attack_bonus       > 0) bonuses.push(`⚔️ ATK +${item.attack_bonus}`);
            if (item.defense_bonus      > 0) bonuses.push(`🛡️ DEF +${item.defense_bonus}`);
            const bonusLine = bonuses.length ? bonuses.join('  ') : 'No stat bonuses';
            const dur = item.durability !== null ? `${item.durability}/${item.max_durability}` : '100/100';

            return msg.reply(
                `══〘 ⚔️ EQUIPPED 〙══╮\n` +
                `┃◆ ${item.item_name} [${item.grade || 'F'}]\n` +
                `┃◆ ${bonusLine}\n` +
                `┃◆ 🔧 Durability: ${dur}\n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Equip failed.\n╰═══════════════════════╯`);
        }
    }
};