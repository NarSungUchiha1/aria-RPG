const db = require('../database/db');

const RANK_ORDER = ['F', 'E', 'D', 'C', 'B', 'A', 'S'];

module.exports = {
    name: 'trade',
    async execute(msg, args, { userId }) {
        if (!args[0] || !args[1]) return msg.reply(
            `══〘 🎁 TRADE 〙══╮\n┃◆ ❌ Use: !trade @user <item number>\n╰═══════════════════════╯`
        );

        const mentioned = msg.mentionedIds;
        if (!mentioned.length) return msg.reply(
            `══〘 🎁 TRADE 〙══╮\n┃◆ ❌ Mention a player to trade with.\n╰═══════════════════════╯`
        );

        const targetId = mentioned[0].replace(/@c\.us/g, "").split("@")[0];
        const index = parseInt(args[1]) - 1;
        if (isNaN(index) || index < 0) return msg.reply(
            `══〘 🎁 TRADE 〙══╮\n┃◆ ❌ Invalid item number.\n╰═══════════════════════╯`
        );
        if (targetId === userId) return msg.reply(
            `══〘 🎁 TRADE 〙══╮\n┃◆ ❌ You cannot trade with yourself.\n╰═══════════════════════╯`
        );

        try {
            const [senderRows] = await db.execute(
                "SELECT nickname, role, `rank` FROM players WHERE id=?", [userId]
            );
            const [targetRows] = await db.execute(
                "SELECT nickname, role, `rank` FROM players WHERE id=?", [targetId]
            );

            if (!senderRows.length) return msg.reply(
                `══〘 🎁 TRADE 〙══╮\n┃◆ ❌ You are not registered.\n╰═══════════════════════╯`
            );
            if (!targetRows.length) return msg.reply(
                `══〘 🎁 TRADE 〙══╮\n┃◆ ❌ That player is not registered.\n╰═══════════════════════╯`
            );

            const sender = senderRows[0];
            const target = targetRows[0];
            const senderRankIdx = RANK_ORDER.indexOf(sender.rank);
            const targetRankIdx = RANK_ORDER.indexOf(target.rank);

            // ✅ Both players must be Rank D or higher to trade
            if (senderRankIdx < 2) return msg.reply(
                `══〘 🎁 TRADE 〙══╮\n` +
                `┃◆ ❌ Trading unlocks at Rank D.\n` +
                `┃◆ Your rank: ${sender.rank}\n` +
                `┃◆ Keep grinding!\n` +
                `╰═══════════════════════╯`
            );
            if (targetRankIdx < 2) return msg.reply(
                `══〘 🎁 TRADE 〙══╮\n` +
                `┃◆ ❌ *${target.nickname}* hasn't reached Rank D yet.\n` +
                `┃◆ Their rank: ${target.rank}\n` +
                `╰═══════════════════════╯`
            );

            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? ORDER BY id", [userId]
            );
            if (index >= items.length) return msg.reply(
                `══〘 🎁 TRADE 〙══╮\n┃◆ ❌ You don't have that item.\n╰═══════════════════════╯`
            );

            const item = items[index];
            if (item.equipped) return msg.reply(
                `══〘 🎁 TRADE 〙══╮\n┃◆ ❌ Unequip the item before trading.\n╰═══════════════════════╯`
            );

            // ✅ Cross-role item trading requires Rank A
            // Check if item belongs to a different role's pool
            const ROLE_ITEMS = {
                Tank:      ['Shield', 'Armor Plate', 'Tower Shield', 'Vanguard Helm', 'Golemheart Gauntlets', 'Iron Ward', 'Frost Barrier', 'Stormwall', 'Aegis of Eternity', 'Aegis Immortal', 'Fortress Aegis', 'Bulwark of Stone', 'Aegis of the Fallen'],
                Assassin:  ['Dagger', 'Shadow Dagger', 'Twin Fang Blades', 'Wind Katana', 'Nightshade Bow', 'Thorn Dagger', 'Shadow Fang', 'Void Edge', 'Whisperblade', 'Wraithblade', 'Eclipse Edge', "Eternity's Edge", 'Voidreaper Dagger'],
                Mage:      ['Spell Book', 'Arcane Staff', 'Frostbane Wand', 'Void Scepter', 'Celestial Orb', 'Bone Staff', 'Venom Codex', 'Blood Grimoire', 'The Last Word', 'Inferno Rod', 'Omniscient Scepter', 'Staff of the Eternal', 'Celestial Codex'],
                Healer:    ['Splint Mace', 'Ember Chalice', 'Soul Lantern', 'Cradle of Life', 'Soul Lantern'],
                Berserker: ['Battle Axe', 'Rage Blade', 'Iron Greatsword', 'Warhammer', 'Dragonbone Mace', 'Bonecrusher', 'Ember Greatsword', 'Soulreaper', 'Maw of the Abyss', 'Abyssal Greatsword', "Titan's Wrath", 'Godslayer']
            };

            const itemRole = Object.entries(ROLE_ITEMS).find(([, items]) =>
                items.includes(item.item_name)
            )?.[0];

            if (itemRole && itemRole !== target.role) {
                // Cross-role trade — requires both at Rank A
                if (senderRankIdx < 5 || targetRankIdx < 5) {
                    return msg.reply(
                        `══〘 🎁 TRADE 〙══╮\n` +
                        `┃◆ ❌ Cross-role item trading\n` +
                        `┃◆ requires both players at Rank A.\n` +
                        `┃◆ \n` +
                        `┃◆ ${sender.nickname}: ${sender.rank}\n` +
                        `┃◆ ${target.nickname}: ${target.rank}\n` +
                        `╰═══════════════════════╯`
                    );
                }
            }

            await db.execute("UPDATE inventory SET player_id=? WHERE id=?", [targetId, item.id]);

            return msg.reply(
                `══〘 🎁 TRADE COMPLETE 〙══╮\n` +
                `┃◆ \n` +
                `┃◆ ✅ ${item.item_name}\n` +
                `┃◆ given to *${target.nickname}*\n` +
                `┃◆ \n` +
                `╰═══════════════════════╯`
            );
        } catch (err) {
            console.error(err);
            msg.reply(`══〘 🎁 TRADE 〙══╮\n┃◆ ❌ Trade failed.\n╰═══════════════════════╯`);
        }
    }
};