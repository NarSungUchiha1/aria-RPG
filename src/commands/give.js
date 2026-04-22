const db = require('../database/db');
const itemStats = require('../data/itemStats');

module.exports = {
    name: 'give',
    async execute(msg, args, { isAdmin }) {
        if (!isAdmin) return msg.reply("❌ Admin only.");

        if (args.length < 2) {
            return msg.reply(
                "❌ Usage:\n" +
                "  !give @user gold <amount>\n" +
                "  !give @user xp <amount>\n" +
                "  !give @user item <item name> [x<qty>]"
            );
        }

        const mentioned = msg.mentionedIds;
        const targetId = mentioned.length
            ? mentioned[0].replace(/@c\.us/g, "").split("@")[0]
            : null;
        if (!targetId) return msg.reply("❌ Mention a player.");

        const type = args[1].toLowerCase();

        try {
            const [target] = await db.execute("SELECT nickname FROM players WHERE id=?", [targetId]);
            if (!target.length) return msg.reply("❌ Player not registered.");
            const nickname = target[0].nickname;

            // ── GOLD ─────────────────────────────────────────────
            if (type === 'gold') {
                const amount = parseInt(args[2]);
                if (isNaN(amount) || amount <= 0) return msg.reply("❌ Invalid amount.");
                await db.execute("UPDATE currency SET gold = gold + ? WHERE player_id=?", [amount, targetId]);
                return msg.reply(`✅ Gave ${amount} gold to ${nickname}.`);
            }

            // ── XP ───────────────────────────────────────────────
            if (type === 'xp') {
                const amount = parseInt(args[2]);
                if (isNaN(amount) || amount <= 0) return msg.reply("❌ Invalid amount.");
                await db.execute(
                    "INSERT INTO xp (player_id, xp) VALUES (?, ?) ON DUPLICATE KEY UPDATE xp = xp + ?",
                    [targetId, amount, amount]
                );
                return msg.reply(`✅ Gave ${amount} XP to ${nickname}.`);
            }

            // ── ITEM ─────────────────────────────────────────────
            if (type === 'item') {
                // args after 'item' = item name tokens + optional x<qty>
                // e.g. !give @user item Mana Potion x3
                //      args = ['@user', 'item', 'Mana', 'Potion', 'x3']
                const remaining = args.slice(2);

                // Check if last token is a quantity specifier like x3 or X10
                let qty = 1;
                const lastToken = remaining[remaining.length - 1];
                if (/^x\d+$/i.test(lastToken)) {
                    qty = parseInt(lastToken.slice(1));
                    remaining.pop();
                }

                const itemName = remaining.join(' ').trim();
                if (!itemName) return msg.reply("❌ Provide an item name.");
                if (isNaN(qty) || qty < 1) return msg.reply("❌ Invalid quantity.");
                if (qty > 99) return msg.reply("❌ Max quantity is 99 per gift.");

                const data = itemStats[itemName];
                const itemType = data?.primaryStat || 'misc';

                for (let i = 0; i < qty; i++) {
                    const [result] = await db.execute(
                        "INSERT INTO inventory (player_id, item_name, item_type, quantity, equipped, grade) VALUES (?, ?, ?, 1, 0, 'F')",
                        [targetId, itemName, itemType]
                    );
                    if (data?.base) {
                        await db.execute(
                            `UPDATE inventory SET
                                strength_bonus     = ?,
                                agility_bonus      = ?,
                                intelligence_bonus = ?,
                                stamina_bonus      = ?,
                                attack_bonus       = ?,
                                defense_bonus      = ?,
                                durability         = 100,
                                max_durability     = 100
                             WHERE id = ?`,
                            [
                                data.base.strength     || 0,
                                data.base.agility      || 0,
                                data.base.intelligence || 0,
                                data.base.stamina      || 0,
                                data.base.attack       || 0,
                                data.base.defense      || 0,
                                result.insertId
                            ]
                        );
                    }
                }

                const qtyText = qty > 1 ? ` x${qty}` : '';
                return msg.reply(
                    `╭══〘 🎁 ITEM GIFTED 〙══╮\n` +
                    `┃◆ Item: ${itemName}${qtyText}\n` +
                    `┃◆ To:   ${nickname}\n` +
                    `┃◆ Type: ${itemType.toUpperCase()}\n` +
                    (!data ? `┃◆ ⚠️ Unknown item — no stat bonuses.\n` : '') +
                    `╰═══════════════════════╯`
                );
            }

            return msg.reply("❌ Invalid type. Use: gold, xp, item");

        } catch (err) {
            console.error(err);
            msg.reply("❌ Give failed.");
        }
    }
};