const db = require('../database/db');

module.exports = {
    name: 'help',
    async execute(msg, args, { userId, isAdmin }) {

        // Check if prestige player
        let isPrestige = false;
        try {
            const [row] = await db.execute(
                "SELECT COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
                [userId]
            );
            isPrestige = (row[0]?.prestige_level || 0) > 0;
        } catch(e) {}

        // ── PRESTIGE HELP ────────────────────────────────────────────────────
        if (isPrestige) {
            let text =
`╔══〘 ✦ ARIA — VOID HUNTER GUIDE 〙══╗
┃★
┃★  👤 PROFILE
┃★ !me → Stats, rank & prestige level
┃★ !stats → Combat record & PvP history
┃★ !moveset → Your void skill set
┃★
┃★  🌀 PRESTIGE DUNGEONS
┃★ !enter → Join an active prestige dungeon
┃★ !dungeon → View enemies & stage [GC]
┃★ !skill <move> [target] → Use a move [GC]
┃★ !onward → Advance to next stage [GC]
┃★ !respawn → Revive after death
┃★ !pickup <#> → Collect void material drop
┃★ !checkbag → View bag contents
┃★ !emptybag → Bank materials
┃★ !repairbag → Repair bag durability
┃★
┃★  ⚔️ PVP DUELS
┃★ !duel @user [bet] → Challenge a player
┃★ !accept @nickname → Accept a challenge
┃★ !decline @nickname → Decline
┃★ !attack <move> → Use a move in duel
┃★
┃★  🛒 PRESTIGE SHOP & INVENTORY
┃★ !prestigeshop → Void weapons & consumables
┃★ !prestigeshop buy <name> → Purchase
┃★ !inventory → View your items [✦ = prestige]
┃★ !inspect <#> → View item bonuses
┃★ !equip <#> → Equip a prestige weapon
┃★ !unequip <#> → Unequip
┃★ !repair <#> → Repair durability
┃★ !melt → View items & gold return
┃★ !melt <#> → Destroy item for gold
┃★
┃★  🏰 CLANS
┃★ ✦ !clan → View your clan & blessing
┃★ ✦ !createclan → Forge a clan (Prestige only)
┃★ ✦ !clan join <name> → Join a clan
┃★ ✦ !clan accept @user → Accept member
┃★ ✦ !leaveclan → Leave your clan
┃★ ✦ !clanlist → See all 3 clans
┃★
┃★  ⚔️ CLAN WARS
┃★ ┃★ !clanwar — View war status
┃★ !clanwar challenge <clan> <mode> <bo3/bo5>
┃★ !clanwar accept / decline
┃★ !clanwar result <score> <score>
┃★
┃★
┃★  💰 ECONOMY & TRADING
┃★ !pay @user <amount> → Send gold
┃★ !transfer @user <amount> → Send XP
┃★ !trade @user <item #> → Give an item
┃★ !tradematerial @user <mat> <qty> → Trade materials
┃★
┃★  📈 PROGRESSION
┃★ !rankup → Rank up through prestige ranks
┃★ !convert <xp> → 250 XP = 1 SP
┃★ !upgrade <stat> <points> → Spend SP
┃★ !prestige confirm → Prestige again at S rank
┃★
┃★  🔨 CRAFTING & MATERIALS
┃★ !recipes → Craftable weapons for your role
┃★ !forge <#> → Craft using void materials
┃★ !materials → Your collected materials
┃★
┃★  💚 HEALER MARKET
┃★ !healers → Browse available healers
┃★ !hire <#> → Book a healer
┃★ !hiredungeon <#> → Hire for dungeon (paid on clear)
┃★ !listservice <gold> <xp> <desc> → Post your service
┃★ !removelisting → Remove your listing
┃★ !contracts → Your contract history
┃★
┃★  📖 LORE & QUESTS
┃★ !lore → Current chapter of ARIA's story
┃★ !quests → Daily, achievement & party quests
┃★ !claim <id> → Claim a completed quest
┃★
┃★  🌍 WORLD BOSS & EVENTS
┃★ !worldboss → View active world boss [GC]
┃★ !attackboss → Attack the world boss [GC]
┃★ !referral → Invite link (+20 XP per referral)
┃★`;

            if (isAdmin) {
                text +=
`
┃★  🔐 ADMIN
┃★ !spawn [rank] → Spawn dungeon
┃★ !spawnprestige [rank] → Spawn prestige dungeon
┃★ !begin → Force-start dungeon [GC]
┃★ !clear → Force-clear current stage [GC]
┃★ !closedungeon → Force-close dungeon
┃★ !spawnboss → Spawn world boss
┃★ !leviathanphase → Force Leviathan to final phase
┃★ !give @user gold/xp/item <value> → Grant resources
┃★ !gift @user <item> → Quick item gift
┃★ !setrole @user <role> → Offer role change
┃★ !event / !event end → Start/end Void event
┃★ !chapter → View/advance story chapter
┃★ !announce <msg> → Broadcast to GC
┃★ !restock → Refill shop stock
┃★ !promote / !demote @user → Bot admin
┃★ !erase @user → Delete player data
┃★ !lockdown → Toggle maintenance mode
┃★ !update → Trigger redeploy
┃★`;
            }

            text += `\n╚══════════════════════════════════╝`;
            return msg.reply(text);
        }

        // ── NORMAL HELP ──────────────────────────────────────────────────────
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
┃  ◆ !dungeon → View enemies & stage [GC]
┃  ◆ !skill <move> [target] → Use a move [GC]
┃  ◆ !onward → Advance to next stage [GC]
┃  ◆ !respawn → Revive after death
┃
┃  ⚔️ COMBAT & MOVES
┃  ◆ !moveset → See all your available moves
┃  ◆ Healers can heal anywhere: !skill Heal @user
┃
┃  🛡️ PVP DUELS
┃  ◆ !duel @user [bet] → Challenge a player
┃  ◆ !accept @nickname → Accept a challenge
┃  ◆ !decline @nickname → Decline
┃  ◆ !attack <move> → Use a move in your duel
┃  ◆ Both fight at 700 HP — 20 sec per turn
┃
┃  🛒 SHOP & INVENTORY
┃  ◆ !shop → Your role's daily shop
┃  ◆ !buy <number> → Purchase an item
┃  ◆ !inventory → View your items
┃  ◆ !inspect <number> → View item bonuses
┃  ◆ !equip <number> → Equip an item
┃  ◆ !unequip <number> → Unequip an item
┃  ◆ !repair <number> → Repair durability
┃  ◆ !upgradeweapon <number> → Upgrade grade
┃  ◆ !use <item name> → Use a consumable
┃
┃  💰 ECONOMY & TRADING
┃  ◆ !pay @user <amount> → Send gold
┃  ◆ !transfer @user <amount> → Send XP
┃  ◆ !trade @user <item #> → Give an item (Rank D+)
┃  ◆ !tradematerial @user <mat> <qty> → Trade materials
┃
┃  ✨ PROGRESSION
┃  ◆ !rankup → Rank up (costs XP)
┃  ◆ !convert <xp> → 250 XP = 1 SP
┃  ◆ !upgrade <stat> <points> → Spend SP on stats
┃  ◆ !prestige confirm → Prestige at S rank
┃
┃  🔄 ROLE CHANGE
┃  ◆ !confirmrole → Accept a role change offer
┃  ◆ !cancelrole → Decline a role change offer
┃  ◆ Penalties: -2 ranks, -50% gold, gear wiped
┃
┃  🌍 WORLD BOSS
┃  ◆ !worldboss → View active world boss [GC]
┃  ◆ !attackboss → Attack the world boss [GC]
┃  ◆ !referral → Invite link (+20 XP per referral)
┃
┃  📖 STORY & LORE
┃  ◆ !lore → Current chapter of ARIA's story
┃  ◆ !lore all → All chapters & status
┃
┃  📜 QUESTS & MATERIALS
┃  ◆ !quests → Daily, achievement & party quests
┃  ◆ !claim <id> → Claim a completed quest
┃  ◆ !pickup → Collect a material drop
┃  ◆ !checkbag → View bag contents
┃  ◆ !emptybag → Bank materials
┃  ◆ !repairbag → Repair bag durability
┃  ◆ !recipes → Craftable weapons for your role
┃  ◆ !forge <number> → Craft a weapon
┃  ◆ !materials → Your crafting materials
┃
┃  🏰 CLANS
┃  ◆ !clan → View your clan info
┃  ◆ !createclan → Start a clan (Prestige only)
┃  ◆ !clan join <name> → Request to join (Rank D+)
┃  ◆ !leaveclan → Leave your clan
┃
┃  💚 HEALER MARKET
┃  ◆ !healers → Browse available healers
┃  ◆ !hire <number> → Book a healer
┃  ◆ !hiredungeon <number> → Hire for dungeon run
┃  ◆ !listservice <gold> <xp> <desc> → Post service (Healers)
┃  ◆ !removelisting → Remove your listing
┃  ◆ !contracts → Contract history (Healers)
┃`;

        if (isAdmin) {
            text +=
`
┃  🔐 ADMIN COMMANDS
┃  ◆ !spawn [rank] → Spawn dungeon
┃  ◆ !begin → Force-start dungeon [GC]
┃  ◆ !clear → Force-clear current stage [GC]
┃  ◆ !closedungeon → Force-close dungeon
┃  ◆ !spawnboss → Spawn a world boss
┃  ◆ !leviathanphase → Force Leviathan to final phase
┃  ◆ !give @user gold/xp/item <value> → Grant resources
┃  ◆ !gift @user <item> → Quick item gift
┃  ◆ !setrole @user <role> → Offer role change
┃  ◆ !event → Start a Void Fracture event
┃  ◆ !event end → End event + leaderboard
┃  ◆ !chapter → View/advance story chapter
┃  ◆ !announce <msg> → Broadcast to GC
┃  ◆ !restock → Refill shop stock
┃  ◆ !promote / !demote @user → Bot admin
┃  ◆ !erase @user → Delete player data
┃  ◆ !lockdown → Toggle maintenance mode
┃  ◆ !update → Trigger redeploy
┃  ◆ !getgroupid → Get current group JID
┃`;
        }

        text += `\n╰══════════════════════════════╯`;
        return msg.reply(text);
    }
};