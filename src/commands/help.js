module.exports = {
    name: 'help',
    async execute(msg, args, { isAdmin }) {
        let text = `══〘 📘 ARIA SYSTEM GUIDE 〙══╮
┃
┃  🌌 AWAKENING & PROFILE
┃  ◆ !awaken → Register prompt
┃  ◆ !register <name> → Create character
┃  ◆ !me → View full stats (base + equipment)
┃  ◆ !stats → Combat record & PvP wins/losses
┃
┃  🏰 DUNGEON SYSTEM
┃  ◆ !enter → Join active dungeon
┃  ◆ !begin → Lock dungeon & start combat
┃  ◆ !dungeon → View enemies & status
┃  ◆ !skill <move> [target] → Use a move (includes basic Strike)
┃  ◆ !onward → Advance to next stage
┃  ◆ !respawn → Revive after death (penalties apply)
┃
┃  ⚔️ COMBAT & MOVES
┃  ◆ !moveset → Show all available moves
┃  ◆ Healers can heal anywhere: !skill Heal @user
┃  ◆ Every role has a free "Strike" move for basic attacks
┃
┃  🛡️ PVP DUELS
┃  ◆ !duel @user [bet] → Challenge a player
┃  ◆ !accept @user → Accept a pending challenge
┃  ◆ !decline @user → Decline a challenge
┃  ◆ !attack <move> → Use a move in a duel
┃  ◆ Bet gold goes to the winner; wins/losses tracked
┃
┃  🛒 SHOP & INVENTORY
┃  ◆ !shop → View items (restocks daily)
┃  ◆ !buy <number> → Purchase item
┃  ◆ !inventory → List your items
┃  ◆ !inspect <number> → View item details
┃  ◆ !equip <number> → Equip item
┃  ◆ !unequip <number> → Unequip item
┃  ◆ !repair <number> → Repair durability
┃  ◆ !upgradeweapon <number> → Upgrade item grade
┃  ◆ !use <item name> → Use equipped item (e.g., !use Mana Potion)
┃
┃  💰 ECONOMY & TRADING
┃  ◆ !pay @user <amount> → Send gold
┃  ◆ !transfer @user <amount> → Send XP
┃  ◆ !trade @user <item #> → Give an item
┃
┃  ✨ PROGRESSION
┃  ◆ !rankup → Increase rank (costs XP)
┃  ◆ !convert <xp> → 20 XP = 1 SP
┃  ◆ !upgrade <stat> <points> → Spend SP on stats
┃
┃  🌍 WORLD BOSS
┃  ◆ !worldboss → View active world boss
┃  ◆ !attackboss → Attack world boss
┃
┃  📜 QUESTS
┃  ◆ !quests → View active quests
┃  ◆ !claim <quest_id> → Claim completed rewards
┃
`;

        if (isAdmin) {
            text += `┃  🔐 ADMIN COMMANDS
┃  ◆ !spawn <rank> → Create dungeon (F-S)
┃  ◆ !clear → Force-clear current stage
┃  ◆ !give @user <type> <amount> → Grant gold/xp/item
┃  ◆ !restock <item> [amount] → Refill shop stock
┃  ◆ !promote @user → Make admin
┃  ◆ !demote @user → Remove admin
┃  ◆ !erase @user → Delete player data
`;
        }

        text += `┃
╰══════════════════════════════╯`;

        return msg.reply(text);
    }
};