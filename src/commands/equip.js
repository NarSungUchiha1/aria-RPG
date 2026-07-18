const db = require('../database/db');
const { getInventoryItem } = require('../utils/inventoryHelper');

const WEAPON_ROLES = {
    // Berserker
    'Void Crusher':'Berserker', 'Fracture Cleaver':'Berserker', 'Abyss Annihilator':'Berserker',
    "Malachar's Fist":'Berserker', 'Bonecrusher':'Berserker', 'Ember Greatsword':'Berserker',
    'Soulreaper':'Berserker', 'Abyssal Reckoning':'Berserker', 'Gloamrend Ravager':'Berserker',
    'Eclipse Titan Blade':'Berserker', 'Hollow Kings Replica':'Berserker',
    'Battle Axe':'Berserker', 'Duskrend Blade':'Berserker', 'Iron Greatsword':'Berserker',
    'Warhammer':'Berserker', 'Dragonbone Mace':'Berserker', 'Obsidian Cleaver':'Berserker',
    "Titan's Wrath":'Berserker', 'Godslayer':'Berserker',
    // Assassin
    'Void Fang':'Assassin', 'Fracture Edge':'Assassin', 'Abyss Phantom':'Assassin',
    "Malachar's Shadow":'Assassin', 'Thorn Dagger':'Assassin', 'Shadow Fang':'Assassin',
    'Void Edge':'Assassin', 'Wraithblade':'Assassin', 'Gloam Phantom Blade':'Assassin',
    'Penumbra Reaper':'Assassin', 'Hollow Kings Shadow Replica':'Assassin',
    'Dagger':'Assassin', 'Umbral Fang':'Assassin', 'Twin Fang Blades':'Assassin',
    'Wind Katana':'Assassin', 'Nightshade Bow':'Assassin', 'Whisperblade':'Assassin',
    'Voidreaper Dagger':'Assassin', 'Eclipse Edge':'Assassin', "Eternity's Edge":'Assassin',
    // Mage
    'Void Codex':'Mage', 'Fracture Scepter':'Mage', 'Abyss Tome':'Mage',
    "Malachar's Gospel":'Mage', 'Bone Staff':'Mage', 'Venom Codex':'Mage',
    'Blood Grimoire':'Mage', 'The Last Word':'Mage', 'Umbral Grimoire':'Mage',
    'Eclipse Codex Supreme':'Mage', 'Hollow Kings Gospel Replica':'Mage',
    'Spell Book':'Mage', 'Gloamlight Staff':'Mage', 'Frostbane Wand':'Mage',
    'Void Scepter':'Mage', 'Ice Wand':'Mage', 'Arcane Ring':'Mage',
    'Inferno Rod':'Mage', 'Staff of the Eternal':'Mage',
    'Celestial Codex':'Mage', 'Omniscient Scepter':'Mage',
    // Tank
    'Void Bulwark':'Tank', 'Fracture Rampart':'Tank', 'Abyss Fortress':'Tank',
    "Malachar's Seal":'Tank', 'Iron Ward':'Tank', 'Frost Barrier':'Tank',
    'Stormwall':'Tank', 'Aegis of Eternity':'Tank', 'Void Earthbreaker':'Tank',
    'Fracture Colossus':'Tank', 'Umbral Aegis':'Tank', 'Eclipse Fortress Shield':'Tank',
    'Umbral Colossus Gauntlet':'Tank',
    'Shield':'Tank', 'Armor Plate':'Tank', 'Tower Shield':'Tank',
    'Vanguard Helm':'Tank', 'Golemheart Gauntlets':'Tank',
    'Bulwark of Stone':'Tank', 'Aegis of the Fallen':'Tank',
    'Fortress Aegis':'Tank', 'Aegis Immortal':'Tank',
    // Healer
    'Void Mend':'Healer', 'Fracture Chalice':'Healer', 'Abyss Lantern':'Healer',
    "Malachar's Grace":'Healer', 'Splint Mace':'Healer', 'Ember Chalice':'Healer',
    'Soul Lantern':'Healer', 'Cradle of Life':'Healer', 'Gloamlight Sanctuary Staff':'Healer',
    'Eclipse Life Chalice':'Healer', 'Hollow Kings Grace Replica':'Healer',
    'Healing Staff':'Healer', 'Sacred Staff':'Healer', 'Divine Staff':'Healer',
};

module.exports = {
    WEAPON_ROLES,
    name: 'equip',
    async execute(msg, args, { userId }) {
        if (!args[0]) return msg.reply(
            `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Use: !equip <number>\n╰═══════════════════════╯`
        );
        const num = parseInt(args[0]);
        if (isNaN(num) || num < 1) return msg.reply(
            `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Invalid number.\n╰═══════════════════════╯`
        );

        try {
            const item = await getInventoryItem(userId, num);
            if (!item) return msg.reply(
                `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Item not found.\n┃◆ Use !inventory to check.\n╰═══════════════════════╯`
            );
            if (item.equipped) return msg.reply(
                `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ⚡ ${item.item_name} is already equipped.\n╰═══════════════════════╯`
            );
            if (item.item_type === 'consumable') return msg.reply(
                `══〘 ⚔️ EQUIP 〙══╮\n┃◆ ❌ Consumables cannot be equipped.\n┃◆ Use !use ${item.item_name}\n╰═══════════════════════╯`
            );

            // Block prestige players from equipping normal (non-prestige) weapons
            if (item.item_type === 'weapon') {
                const [presRow] = await db.execute(
                    "SELECT COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
                    [userId]
                );
                const isPrestige = (presRow[0]?.prestige_level || 0) > 0;
                const isPrestigeWeapon = item.grade === 'P';
                if (isPrestige && !isPrestigeWeapon) return msg.reply(
                    `╔══〘 ✦ EQUIP 〙══╗\n` +
                    `┃★ ❌ Normal weapons are void-dead\n` +
                    `┃★ at your level.\n` +
                    `┃★ Use !melt to convert them to gold.\n` +
                    `┃★ Equip from !prestigeshop instead.\n` +
                    `╚═══════════════════════════╝`
                );
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