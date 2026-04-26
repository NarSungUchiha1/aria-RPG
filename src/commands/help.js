module.exports = {
    name: 'help',
    async execute(msg, args, { isAdmin }) {
        let text =
`══〘 📘 ARIA SYSTEM GUIDE 〙══╮
┃
┃  🌌 AWAKENING & PROFILE
┃  ◆ !awaken → Registration prompt
┃  ◆ !register <name> → Create your character
┃  ◆ !me → View stats, rank & equipment
┃  ◆ !stats → Combat record & PvP history
┃
┃  🏰 DUNGEON SYSTEM
┃  ◆ !enter → DM the bot to join a dungeon
┃  ◆      (3/day, unlimited during events)
┃  ◆ !dungeon → View enemies & stage [GC]
┃  ◆ !skill <move> [target] → Use a move [GC]
┃  ◆ !onward → Advance to next stage [GC]
┃  ◆ !respawn → Revive after death (penalties apply)
┃
┃  ⚔️ COMBAT & MOVES
┃  ◆ !moveset → See all your available moves
┃  ◆ Healers can heal anywhere: !skill Heal @user
┃
┃  🛡️ PVP DUELS
┃  ◆ !duel @user [bet] → Challenge a player
┃  ◆ !accept @nickname → Accept a challenge
┃  ◆ !decline @nickname → Decline a challenge
┃  ◆ !attack <move> → Use a move in your duel
┃  ◆ Both fight at 700 HP — 20 sec per turn
┃  ◆ Miss your turn = forfeit
┃
┃  🛒 SHOP & INVENTORY
┃  ◆ !shop → Your role's daily shop
┃  ◆ !buy <number> → Purchase an item
┃  ◆ !inventory → View your items
┃  ◆ !inspect <number> → View item bonuses
┃  ◆ !equip <number> → Equip an item
┃  ◆ !unequip <number> → Unequip an item
┃  ◆ !repair <number> → Repair durability
┃  ◆ !upgradeweapon <number> → Upgrade grade (capped at your rank)
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
┃  ◆ !worldboss → View active world boss [GC]
┃  ◆ !attackboss → Attack the world boss [GC]
┃  ◆ !referral → Get your invite link (+20 XP per referral)
┃
┃  📖 STORY & LORE
┃  ◆ !lore → Read the current chapter of ARIA's story
┃  ◆ !lore all → See all chapters & their status
┃
┃  📜 QUESTS
┃  ◆ !quests → Daily, achievement & party quests
┃  ◆ !claim <id> → Claim a completed quest
┃  ◆ Dailies are role-specific, reset at midnight
┃  ◆ Achievements grant titles & SP
┃
┃  ⚒️ BLACKSMITH (Blacksmith GC only)
┃  ◆ !recipes → View craftable weapons for your role
┃  ◆ !forge <number> → Craft a weapon using materials
┃  ◆ !materials → View your collected crafting materials
┃
┃  ◆ !healers → Browse available healers & prices
┃  ◆ !hire <number> → Book a healer (gold + XP)
┃  ◆ !listservice <gold> <xp> <desc> → Post your service (Healers only)
┃  ◆ !removelisting → Remove your listing (Healers only)
┃  ◆ !contracts → View your contract history (Healers only)
┃
┃  ◆ Events announced in the group
┃  ◆ During events: no daily dungeon limit
┃  ◆ Void Shards: 5% drop per cleared dungeon
┃  ◆ Whole party gets the shard if one drops
┃  ◆ Collect 5 to complete the event
┃
┃  💚 HEALER MARKET [Healer GC only]
┃  ◆ !listservice <gold> <xp> <desc> → Post your service
┃  ◆ !healers → Browse available healers
┃  ◆ !hire <number> → Book a healer (pays them instantly)
┃  ◆ !contracts → Your contract history (healers only)
┃  ◆ !removelisting → Take down your listing
┃
`;

        if (isAdmin) {
            text +=
`┃  🔐 ADMIN COMMANDS
┃  ◆ !spawn [rank] → Spawn dungeon (auto if no rank)
┃  ◆ !begin → Force-start dungeon [GC]
┃  ◆ !clear → Force-clear current stage [GC]
┃  ◆ !closedungeon → Force-close dungeon [GC]
┃  ◆ !spawnboss → Spawn a world boss
┃  ◆ !give @user gold/xp/item <value> → Grant resources
┃  ◆ !gift @user <item name> → Quick item gift
┃  ◆ !setrole @user <role> → Offer role change
┃  ◆ !event → Start a Void Fracture event
┃  ◆ !event end → End event early + leaderboard
┃  ◆ !spawnboss → Spawn a world boss
┃  ◆ !chapter → View/advance story chapter (admin)
┃  ◆ !announce <message> → Broadcast to GC (tags everyone) (24h)
┃  ◆ !event end → Close event + leaderboard
┃  ◆ !announce <message> → Broadcast to GC (@all)
┃  ◆ !restock → Refill shop stock
┃  ◆ !promote @user → Grant bot admin
┃  ◆ !demote @user → Remove bot admin
┃  ◆ !erase @user → Delete player data
┃  ◆ !lockdown → Toggle maintenance mode (admin only)
┃  ◆ !update → Trigger Render redeploy
┃  ◆ !getgroupid → Get current group JID
┃
`;
        }

        text += `╰══════════════════════════════╯`;
        return msg.reply(text);
    }
};