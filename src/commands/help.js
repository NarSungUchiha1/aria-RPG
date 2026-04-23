module.exports = {
    name: 'help',
    async execute(msg, args, { isAdmin }) {
        let text =
`══〘 📘 ARIA SYSTEM GUIDE 〙══╮
┃
┃  🌌 AWAKENING & PROFILE
┃  ◆ !awaken → Register prompt
┃  ◆ !register <name> → Create your character
┃  ◆ !me → View stats, rank & equipment
┃  ◆ !stats → Combat record & PvP history
┃
┃  🏰 DUNGEON SYSTEM
┃  ◆ !enter → DM the bot to join a dungeon
┃  ◆      (3 entries per day, unlimited during events)
┃  ◆ !dungeon → View enemies & stage [GC only]
┃  ◆ !skill <move> [target] → Use a move [GC only]
┃  ◆ !onward → Advance to next stage [GC only]
┃  ◆ !respawn → Revive after death (penalties apply)
┃
┃  ⚔️ COMBAT & MOVES
┃  ◆ !moveset → See all your available moves
┃  ◆ Healers can heal anywhere: !skill Heal @user
┃  ◆ All roles have a free Strike move
┃
┃  🛡️ PVP DUELS
┃  ◆ !duel @user [bet] → Challenge a player
┃  ◆ !accept @nickname → Accept a challenge
┃  ◆ !decline @nickname → Decline a challenge
┃  ◆ !attack <move> → Use a move in your duel
┃  ◆ Both players fight at 700 HP (main HP unaffected)
┃  ◆ Winner takes the full pot
┃
┃  🛒 SHOP & INVENTORY
┃  ◆ !shop → Your role's shop (restocks daily)
┃  ◆ !buy <number> → Purchase an item
┃  ◆ !inventory → View your items
┃  ◆ !inspect <number> → View item stats & bonuses
┃  ◆ !equip <number> → Equip an item
┃  ◆ !unequip <number> → Unequip an item
┃  ◆ !repair <number> → Repair item durability
┃  ◆ !upgradeweapon <number> → Upgrade grade (F→S)
┃  ◆ !use <item name> → Use a consumable
┃
┃  💰 ECONOMY & TRADING
┃  ◆ !pay @user <amount> → Send gold
┃  ◆ !transfer @user <amount> → Send XP
┃  ◆ !trade @user <item #> → Give an item
┃
┃  ✨ PROGRESSION
┃  ◆ !rankup → Rank up (costs XP)
┃  ◆ !convert <xp> → 250 XP = 1 SP
┃  ◆ !upgrade <stat> <points> → Spend SP on stats
┃
┃  🔄 ROLE CHANGE
┃  ◆ !confirmrole → Accept a role change offer
┃  ◆ !cancelrole → Decline a role change offer
┃  ◆ Penalties: -2 ranks, -50% gold, gear wiped
┃
┃  🌍 WORLD BOSS
┃  ◆ !worldboss → View active world boss [GC only]
┃  ◆ !attackboss → Attack the world boss [GC only]
┃
┃  📜 QUESTS
┃  ◆ !quests → View daily, achievement & party quests
┃  ◆ !claim <id> → Claim a completed quest reward
┃  ◆ Daily quests are role-specific, reset at midnight
┃  ◆ Achievements grant titles & SP rewards
┃
┃  💠 EVENTS
┃  ◆ Events are announced in the group
┃  ◆ During events: no daily entry limit
┃  ◆ Void Shards drop from cleared dungeons (5% chance)
┃  ◆ Collect 5 Void Shards to complete the event
┃
`;

        if (isAdmin) {
            text +=
`┃  🔐 ADMIN COMMANDS
┃  ◆ !spawn [rank] → Spawn dungeon (F–S or auto)
┃  ◆ !begin → Force-start dungeon [GC only]
┃  ◆ !clear → Force-clear current stage [GC only]
┃  ◆ !closedungeon → Force-close dungeon [GC only]
┃  ◆ !give @user gold <amt> → Grant gold
┃  ◆ !give @user xp <amt> → Grant XP
┃  ◆ !give @user item <name> [x<qty>] → Grant items
┃  ◆ !gift @user <item name> → Quick item gift
┃  ◆ !setrole @user <role> → Offer role change
┃  ◆ !event → Start a Void Fracture event
┃  ◆ !restock → Refill shop stock
┃  ◆ !promote @user → Grant bot admin
┃  ◆ !demote @user → Remove bot admin
┃  ◆ !erase @user → Delete player data
┃  ◆ !update → Trigger Render redeploy
┃  ◆ !getgroupid → Get current group JID
┃
`;
        }

        text += `╰══════════════════════════════╯`;
        return msg.reply(text);
    }
};