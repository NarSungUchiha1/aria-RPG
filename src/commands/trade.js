const db = require('../database/db');
const { getInventoryItem } = require('../utils/inventoryHelper');

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

        // Trades between two players in the SAME active dungeon are allowed (raider to raider).
        // Trading with someone outside the dungeon, or in a different dungeon, is blocked.
        const [sTradeD] = await db.execute("SELECT dp.dungeon_id FROM dungeon_players dp JOIN dungeon d ON d.id=dp.dungeon_id WHERE dp.player_id=? AND dp.is_alive=1 AND d.is_active=1", [userId]);
        const [tTradeD] = await db.execute("SELECT dp.dungeon_id FROM dungeon_players dp JOIN dungeon d ON d.id=dp.dungeon_id WHERE dp.player_id=? AND dp.is_alive=1 AND d.is_active=1", [targetId]);
        const senderInDungeon = sTradeD.length > 0;
        const targetInDungeon = tTradeD.length > 0;
        const sameDungeon = senderInDungeon && targetInDungeon && sTradeD[0].dungeon_id === tTradeD[0].dungeon_id;

        if ((senderInDungeon || targetInDungeon) && !sameDungeon) {
            if (senderInDungeon && !targetInDungeon) return msg.reply(
                `══〘 🎁 TRADE 〙══╮\n┃◆ ❌ You cannot trade with someone\n┃◆ outside the dungeon.\n╰═══════════════════════╯`
            );
            if (targetInDungeon && !senderInDungeon) return msg.reply(
                `══〘 🎁 TRADE 〙══╮\n┃◆ ❌ Cannot trade with a player\n┃◆ currently inside a dungeon.\n╰═══════════════════════╯`
            );
            // Both in dungeons but different ones
            return msg.reply(
                `══〘 🎁 TRADE 〙══╮\n┃◆ ❌ You are both in dungeons,\n┃◆ but not the same one.\n╰═══════════════════════╯`
            );
        }

        try {
            const [senderRows] = await db.execute(
                "SELECT nickname, role, `rank`, prestige_level FROM players WHERE id=?", [userId]
            );
            const [targetRows] = await db.execute(
                "SELECT nickname, role, `rank`, prestige_level FROM players WHERE id=?", [targetId]
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
            const senderPrestige = (sender.prestige_level || 0) > 0;
            const targetPrestige = (target.prestige_level || 0) > 0;

            // Prestige players bypass ALL rank restrictions
            if (!senderPrestige && senderRankIdx < 2) return msg.reply(
                `══〘 🎁 TRADE 〙══╮\n` +
                `┃◆ ❌ Trading unlocks at Rank D.\n` +
                `┃◆ Your rank: ${sender.rank}\n` +
                `┃◆ Keep grinding!\n` +
                `╰═══════════════════════╯`
            );
            if (!targetPrestige && targetRankIdx < 2) return msg.reply(
                `══〘 🎁 TRADE 〙══╮\n` +
                `┃◆ ❌ *${target.nickname}* hasn't reached Rank D yet.\n` +
                `┃◆ Their rank: ${target.rank}\n` +
                `╰═══════════════════════╯`
            );

            const [items] = await db.execute(
                "SELECT * FROM inventory WHERE player_id=? AND item_name NOT LIKE '%Void Shard%' ORDER BY equipped DESC, id", [userId]
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
                Tank:      ['Duskward Shield', 'Vigil Plating', 'Duskwatch Tower', 'Vigil Helm', 'Duskstone Gauntlets', 'Duskiron Ward', 'Gloamfrost Barrier', 'Nightwall', 'Aegis of Everdark', 'Aegis Everdark', 'Duskwall Aegis', 'Bulwark of Dusk', 'Aegis of the Hollow'],
                Assassin:  ['Duskfang Dagger', 'Umbral Fang', 'Twin Gloamfangs', 'Duskwind Katana', 'Nightgloam Bow', 'Duskthorn Dagger', 'Umbra Fang', 'Gloam Edge', 'Gloamwhisper', 'Wraithblade', 'Eclipse Edge', "Last Hour's Edge", 'Gloamreaper Dagger'],
                Mage:      ['Gloam Primer', 'Gloamlight Staff', 'Gloamfrost Wand', 'Umbral Scepter', 'Eclipse Orb', 'Gravebone Staff', 'Venom Codex', 'Duskblood Grimoire', 'The Last Word', 'Cinderrod', 'Umbral Oracle Scepter', 'Staff of the Long Dusk', 'Twilight Codex'],
                Healer:    ['Gloam Mace', 'Cinder Chalice', 'Wraith Lantern', 'Cradle of Dawn', 'Wraith Lantern'],
                Berserker: ['Gloam Axe', 'Duskrend Blade', 'Duskiron Greatsword', 'Gloamhammer', 'Duskbone Mace', 'Gravebone Crusher', 'Cinder Greatsword', 'Wraithreaper', 'Maw of Umbra', 'Umbral Greatsword', "Umbra Titan's Wrath", 'Sunslayer']
            };

            const itemRole = Object.entries(ROLE_ITEMS).find(([, items]) =>
                items.includes(item.item_name)
            )?.[0];

            if (itemRole && itemRole !== target.role) {
                // Cross-role trade — requires both at Rank A OR both prestige
                if (!senderPrestige && !targetPrestige && (senderRankIdx < 5 || targetRankIdx < 5)) {
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