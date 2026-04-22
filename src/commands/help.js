module.exports = {
    name: 'help',
    async execute(msg, args, { isAdmin }) {
        let text =
`══〘 📘 ARIA SYSTEM GUIDE 〙══╮
┃
┃  🌌 AWAKENING & PROFILE
┃  ◆ !awaken → Register prompt
┃  ◆ !register <name> → Create character
┃  ◆ !me → View full stats (base + equipment)
┃  ◆ !stats → Combat record & PvP wins/losses
┃
┃  🏰 DUNGEON SYSTEM
┃  ◆ !enter → DM the bot to join active dungeon
┃  ◆ !dungeon → View enemies & stage status [GC]
┃  ◆ !skill <move> [target] → Use a move [GC]
┃  ◆ !onward → Advance to next stage [GC]
┃  ◆ !respawn → Revive after death (penalties apply)
┃  ◆ [GC] = Dungeon Group Chat only
┃
┃  ⚔️ COMBAT & MOVES
┃  ◆ !moveset → Show all your available moves
┃  ◆ Healers can heal anywhere: !skill Heal @user
┃  ◆ Every role has a free Strike move
┃
┃  🛡️ PVP DUELS
┃  ◆ !duel @user [bet] → Challenge a player
┃  ◆ !accept @user → Accept a challenge
┃  ◆ !decline @user → Decline a challenge
┃  ◆ !attack <move> → Use a move in a duel
┃  ◆ Bet gold goes to the winner
┃
┃  🛒 SHOP & INVENTORY
┃  ◆ !shop → View your role's shop (restocks daily)
┃  ◆ !buy <number> → Purchase item
┃  ◆ !inventory → List your items (grouped)
┃  ◆ !inspect <number> → View item details & bonuses
┃  ◆ !equip <number> → Equip item
┃  ◆ !unequip <number> → Unequip item
┃  ◆ !repair <number> → Repair item durability
┃  ◆ !upgradeweapon <number> → Upgrade item grade (F→S)
┃  ◆ !use <item name> → Use a consumable
┃
┃  💰 ECONOMY & TRADING
┃  ◆ !pay @user <amount> → Send gold
┃  ◆ !transfer @user <amount> → Send XP
┃  ◆ !trade @user <item #> → Give an item
┃
┃  ✨ PROGRESSION
┃  ◆ !rankup → Increase rank (costs XP)
┃  ◆ !convert <xp> → Convert XP to SP (20 XP = 1 SP)
┃  ◆ !upgrade <stat> <points> → Spend SP on stats
┃
┃  🔄 ROLE CHANGE
┃  ◆ !confirmrole → Accept a role change offer
┃  ◆ !cancelrole → Decline a role change offer
┃  ◆ Offers expire after 2 minutes
┃  ◆ Penalties: -2 ranks, -50% gold, gear wiped
┃
┃  🌍 WORLD BOSS
┃  ◆ !worldboss → View active world boss [GC]
┃  ◆ !attackboss → Attack the world boss [GC]
┃
┃  📜 QUESTS
┃  ◆ !quests → View your active quests
┃  ◆ !claim <quest_id> → Claim completed rewards
┃
`;

        if (isAdmin) {
            text +=
`┃  🔐 ADMIN COMMANDS
┃  ◆ !spawn <rank> → Spawn a dungeon (F–S) [GC]
┃  ◆ !begin → Force-start the dungeon [GC]
┃  ◆ !clear → Force-clear the current stage [GC]
┃  ◆ !closedungeon → Force-close active dungeon [GC]
┃  ◆ !give @user gold <amt> → Grant gold
┃  ◆ !give @user xp <amt> → Grant XP
┃  ◆ !give @user item <name> [x<qty>] → Grant item(s)
┃  ◆ !gift @user <item name> → Quick single item gift
┃  ◆ !setrole @user <role> → Offer a role change
┃  ◆ !restock → Refill shop stock
┃  ◆ !promote @user → Grant bot admin
┃  ◆ !demote @user → Remove bot admin
┃  ◆ !erase @user → Delete player data
┃  ◆ !update → Trigger a Render redeploy
┃  ◆ !getgroupid → Get current group's JID
┃
`;
        }

        text += `╰══════════════════════════════╯`;

        return msg.reply(text);
    }
};