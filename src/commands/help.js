const db = require('../database/db');

module.exports = {
    name: 'help',
    async execute(msg, args, { userId, isAdmin }) {

        // Get player role + prestige
        let isPrestige = false;
        let role = null;
        try {
            const [row] = await db.execute(
                "SELECT role, COALESCE(prestige_level,0) as prestige_level FROM players WHERE id=?",
                [userId]
            );
            isPrestige = (row[0]?.prestige_level || 0) > 0;
            role = row[0]?.role || null;
        } catch(e) {}

        const isExplorer = role === 'Explorer';

        // ── EXPLORER HELP ────────────────────────────────────────────────────
        if (isExplorer && !isPrestige) {
            let text =
`╔══〘 🌀 ARIA — EXPLORER GUIDE 〙══╗
┃◆
┃◆  👤 PROFILE
┃◆ !me → Stats, rank & equipment
┃◆ !stats → Combat record & history
┃◆ !moveset → Your skill set
┃◆ !daily → Claim daily gold & XP bonus
┃◆
┃◆  🌀 VOID RIFT SYSTEM  [Exploration GC]
┃◆ !explore → List rifts & survival rates
┃◆ !explore <rank> → Enter a rift (e.g. !explore C)
┃◆    F/E/D — 500G  |  C/B — 1,000G
┃◆    A/S — 2,000G  |  Prestige — 5,000G
┃◆ !return → Exit the rift & collect drops
┃◆    Leave too early = no loot, no cost
┃◆ !expmaterials → View your rift materials
┃◆
┃◆  🏪 EXPLORER SHOP  [Exploration GC]
┃◆ !explorershop → Browse consumables & gear
┃◆ !explorershop buy <name> → Purchase item
┃◆
┃◆  🧪 POTIONS & BREWS  [Exploration GC]
┃◆ !brew → View all brew recipes
┃◆ !brew <recipe> → Brew a specific potion
┃◆ !potionmarket → Buy raw potions
┃◆ !buypot <name> → Quick buy a potion
┃◆ !usepotion / !use → Use a potion in your bag
┃◆
┃◆  👤 THE WANDERER  [Exploration GC]
┃◆ !wanderertrade → Trade materials to the Wanderer
┃◆    Appears randomly — watch for announcements
┃◆
┃◆  📦 BAG & MATERIALS
┃◆ !checkbag → View bag contents
┃◆ !emptybag → Bank materials to storage
┃◆ !repairbag → Repair bag durability
┃◆ !materials → All your crafting materials
┃◆ !pickup <#> → Collect a dungeon drop
┃◆
┃◆  🛒 SHOP & INVENTORY
┃◆ !shop → Your role's daily shop
┃◆ !buy <number> → Purchase an item
┃◆ !inventory → View your items
┃◆ !inspect <number> → View item bonuses
┃◆ !equip <number> → Equip an item
┃◆ !unequip <number> → Unequip an item
┃◆ !repair <number> → Repair durability
┃◆ !melt / !melt <#> → View or destroy for gold
┃◆ !upgradeweapon <#> → Upgrade weapon grade
┃◆ !use <item> → Use a consumable
┃◆
┃◆  ⚔️ PVP DUELS
┃◆ !duel @user [bet] → Challenge a player
┃◆ !duel party @user1 @user2... → Party duel
┃◆ !accept @nickname → Accept a challenge
┃◆ !decline @nickname → Decline
┃◆ !attack <move> → Use a move in your duel
┃◆ !startduel → Confirm party duel start (leaders)
┃◆ !joinparty @leader → Join a party duel side
┃◆
┃◆  💰 ECONOMY & TRADING
┃◆ !pay @user <amount> → Send gold
┃◆ !transfer @user <amount> → Send XP
┃◆ !trade @user <item #> → Give an item (Rank D+)
┃◆ !tradematerial @user <mat> <qty> → Trade materials
┃◆ !bounty → View active bounties
┃◆
┃◆  ✨ PROGRESSION
┃◆ !rankup → Rank up (costs XP)
┃◆ !convert <xp> → 250 XP = 1 SP
┃◆ !upgrade <stat> <points> → Spend SP on stats
┃◆ !prestige confirm → Prestige at S rank
┃◆ !codex → Lore fragments you have collected
┃◆
┃◆  🔄 ROLE CHANGE
┃◆ !confirmrole → Accept a role change offer
┃◆ !cancelrole → Decline a role change offer
┃◆
┃◆  📖 STORY & QUESTS
┃◆ !lore → Current chapter  |  !lore all → All chapters
┃◆ !quests → Daily, achievement & party quests
┃◆ !claim <id> → Claim a completed quest
┃◆
┃◆  🏰 CLANS
┃◆ !clan → View your clan info
┃◆ !clan join <name> → Request to join (Rank D+)
┃◆ !leaveclan → Leave  |  !clanlist → All 3 clans
┃◆
┃◆  💚 HEALER MARKET  [Healer GC]
┃◆ !healers → Browse available healers
┃◆ !hire <#> → Book a healer
┃◆
┃◆  🌍 WORLD BOSS & EVENTS
┃◆ !worldboss → Active world boss [GC]
┃◆ !attackboss → Attack world boss [GC]
┃◆ !referral → Invite link (+20 XP per referral)
┃◆`;

            if (isAdmin) {
                text +=
`
┃◆  🔐 ADMIN COMMANDS
┃◆ !spawn [rank]  |  !spawnprestige [rank]
┃◆ !spawnwanderer → Force spawn Wanderer [Exp GC]
┃◆ !begin / !clear / !closedungeon
┃◆ !spawnboss  |  !spawnleviathan  |  !spawnmalachar
┃◆ !give @user gold/xp/item <value>
┃◆ !setrole @user <role>
┃◆ !event / !event end
┃◆ !announce <msg>  |  !restock
┃◆ !erase @user  |  !lockdown  |  !getgroupid
┃◆`;
            }

            text += `\n╚══════════════════════════════════╝`;
            return msg.reply(text);
        }

        // ── PRESTIGE EXPLORER HELP ───────────────────────────────────────────
        if (isExplorer && isPrestige) {
            let text =
`╔══〘 ✦ ARIA — VOID EXPLORER GUIDE 〙══╗
┃★
┃★  👤 PROFILE
┃★ !me → Stats, rank & prestige level
┃★ !stats → Combat record & history
┃★ !moveset → Your void skill set
┃★ !daily → Claim daily bonus
┃★
┃★  🌀 VOID RIFT SYSTEM  [Exploration GC]
┃★ !explore → List rifts (prestige tiers unlocked)
┃★ !explore <rank> → Enter a rift (e.g. !explore PB)
┃★    Prestige rifts — 5,000G entry
┃★    +5% survival bonus per prestige tier
┃★ !return → Exit rift & collect void drops
┃★ !expmaterials → Your rift materials
┃★
┃★  🏪 EXPLORER SHOP  [Exploration GC]
┃★ !explorershop → Void consumables & gear
┃★ !explorershop buy <name> → Purchase
┃★
┃★  🧪 POTIONS & BREWS
┃★ !brew / !brew <recipe> → Craft potions [Exp GC]
┃★ !potionmarket → Buy raw potions
┃★ !buypot <name> → Quick buy a potion
┃★ !usepotion / !use → Use a potion
┃★
┃★  👤 THE WANDERER  [Exploration GC]
┃★ !wanderertrade → Trade materials with the Wanderer
┃★
┃★  🌀 PRESTIGE DUNGEONS
┃★ !enter → Join a prestige dungeon
┃★ !dungeon → View enemies & stage [GC]
┃★ !skill <move> [target] → Use a move [GC]
┃★ !onward → Advance to next stage [GC]
┃★ !respawn → Revive after death
┃★ !pickup <#> → Collect drop
┃★ !checkbag → View bag  |  !emptybag → Bank
┃★ !repairbag → Repair bag
┃★
┃★  ⚔️ PVP DUELS
┃★ !duel @user [bet] → Challenge
┃★ !duel party @user1 @user2... → Party duel
┃★ !accept / !decline @nickname
┃★ !attack <move> → Use a move in duel
┃★ !startduel → Confirm party duel (leaders)
┃★ !joinparty @leader → Join a party duel side
┃★
┃★  🛒 PRESTIGE SHOP & INVENTORY
┃★ !prestigeshop → Void weapons & consumables
┃★ !prestigeshop buy <name> → Purchase
┃★ !inventory → Items  |  !inspect <#> → Bonuses
┃★ !equip / !unequip / !repair <#>
┃★ !melt / !melt <#> → View or destroy for gold
┃★ !upgradeweapon <#> → Upgrade weapon grade
┃★
┃★  🔨 CRAFTING & MATERIALS
┃★ !materials → All materials
┃★ !recipes → Craftable weapons for your role
┃★ !forge <#> → Craft a weapon
┃★
┃★  🏰 CLANS
┃★ !clan → View clan & blessing
┃★ !createclan → Forge a clan (Prestige only)
┃★ !clan join <name> → Join  |  !leaveclan → Leave
┃★ !clanlist → All 3 clans
┃★
┃★  ⚔️ CLAN WARS
┃★ !clanwar → View war status
┃★ !clanwar challenge <clan> <mode> <bo3/bo5>
┃★ !clanwar accept / decline / result <s> <s>
┃★
┃★  💰 ECONOMY & TRADING
┃★ !pay @user <amount>  |  !transfer @user <amount>
┃★ !trade @user <item #>  |  !tradematerial @user <mat> <qty>
┃★ !bounty → Active bounties
┃★
┃★  📈 PROGRESSION
┃★ !rankup → Rank up through prestige ranks
┃★ !convert <xp>  |  !upgrade <stat> <points>
┃★ !prestige confirm → Prestige again at S rank
┃★ !codex → Lore fragments
┃★
┃★  📖 STORY & QUESTS
┃★ !lore → Current chapter  |  !lore all → All
┃★ !quests → Daily quests  |  !claim <id> → Claim
┃★
┃★  🌍 WORLD BOSS & EVENTS
┃★ !worldboss → Active world boss [GC]
┃★ !attackboss → Attack [GC]
┃★ !referral → Invite link (+20 XP per referral)
┃★`;

            if (isAdmin) {
                text +=
`
┃★  🔐 ADMIN
┃★ !spawn [rank]  |  !spawnprestige [rank]
┃★ !spawnwanderer → Force spawn Wanderer [Exp GC]
┃★ !begin / !clear / !closedungeon
┃★ !spawnboss  |  !spawnleviathan  |  !spawnmalachar
┃★ !startvoidwar  |  !voidstorm  |  !leviathanphase
┃★ !give @user gold/xp/item <value>  |  !payxp @user <amount>
┃★ !setrole @user <role>
┃★ !event / !event end
┃★ !announce <msg>  |  !restock
┃★ !erase @user  |  !lockdown  |  !getgroupid
┃★`;
            }

            text += `\n╚══════════════════════════════════╝`;
            return msg.reply(text);
        }

        // ── PRESTIGE (non-Explorer) HELP ─────────────────────────────────────
        if (isPrestige) {
            let text =
`╔══〘 ✦ ARIA — VOID HUNTER GUIDE 〙══╗
┃★
┃★  👤 PROFILE
┃★ !me → Stats, rank & prestige level
┃★ !stats → Combat record & PvP history
┃★ !moveset → Your void skill set
┃★ !daily → Claim daily gold & XP bonus
┃★
┃★  🌀 PRESTIGE DUNGEONS
┃★ !enter → Join an active prestige dungeon
┃★ !dungeon → View enemies & stage [GC]
┃★ !skill <move> [target] → Use a move [GC]
┃★ !onward → Advance to next stage [GC]
┃★ !respawn → Revive after death
┃★ !pickup <#> → Collect void material drop
┃★ !checkbag → View bag  |  !emptybag → Bank
┃★ !repairbag → Repair bag durability
┃★
┃★  ⚔️ PVP DUELS
┃★ !duel @user [bet] → Challenge a player
┃★ !duel party @user1 @user2... → Party duel
┃★ !accept @nickname → Accept  |  !decline → Decline
┃★ !attack <move> → Use a move in duel
┃★ !startduel → Confirm party duel start (leaders)
┃★ !joinparty @leader → Join a party duel side
┃★
┃★  🛒 PRESTIGE SHOP & INVENTORY
┃★ !prestigeshop → Void weapons & consumables
┃★ !prestigeshop buy <name> → Purchase
┃★ !inventory → Items  |  !inspect <#> → Bonuses
┃★ !equip / !unequip / !repair <#>
┃★ !melt / !melt <#> → View or destroy for gold
┃★ !upgradeweapon <#> → Upgrade weapon grade
┃★
┃★  🧪 POTIONS
┃★ !potionmarket → Browse prestige potions
┃★ !buypot <name> → Buy a potion
┃★ !usepotion / !use → Use a potion from bag
┃★
┃★  🏰 CLANS
┃★ !clan → View your clan & blessing
┃★ !createclan → Forge a clan (Prestige only)
┃★ !clan join <name> → Join  |  !leaveclan → Leave
┃★ !clan accept @user → Accept member
┃★ !clanlist → View all 3 clans
┃★
┃★  ⚔️ CLAN WARS
┃★ !clanwar → View war status
┃★ !clanwar challenge <clan> <mode> <bo3/bo5>
┃★ !clanwar accept / decline / result <score> <score>
┃★
┃★  💰 ECONOMY & TRADING
┃★ !pay @user <amount> → Send gold
┃★ !transfer @user <amount> → Send XP
┃★ !trade @user <item #> → Give an item
┃★ !tradematerial @user <mat> <qty> → Trade materials
┃★ !bounty → View active bounties
┃★
┃★  📈 PROGRESSION
┃★ !rankup → Rank up through prestige ranks
┃★ !convert <xp> → 250 XP = 1 SP
┃★ !upgrade <stat> <points> → Spend SP
┃★ !prestige confirm → Prestige again at S rank
┃★ !codex → Lore fragments you have collected
┃★
┃★  🔨 CRAFTING & MATERIALS
┃★ !recipes → Craftable weapons for your role
┃★ !forge <#> → Craft using void materials
┃★ !materials → Your collected materials
┃★
┃★  💚 HEALER MARKET  [Healer GC]
┃★ !healers → Browse available healers
┃★ !hire <#> → Book a healer
┃★ !hiredungeon <#> → Hire for dungeon (paid on clear)
┃★ !listservice <gold> <xp> <desc> → Post your service
┃★ !removelisting → Remove listing  |  !contracts → History
┃★
┃★  📖 LORE & QUESTS
┃★ !lore → Current chapter  |  !lore all → All chapters
┃★ !quests → Daily, achievement & party quests
┃★ !claim <id> → Claim a completed quest
┃★
┃★  🌍 WORLD BOSS & EVENTS
┃★ !worldboss → Active world boss [GC]
┃★ !attackboss → Attack world boss [GC]
┃★ !referral → Invite link (+20 XP per referral)
┃★`;

            if (isAdmin) {
                text +=
`
┃★  🔐 ADMIN
┃★ !spawn [rank]  |  !spawnprestige [rank]
┃★ !spawnwanderer → Force spawn Wanderer [Exp GC]
┃★ !begin → Force-start dungeon [GC]
┃★ !clear → Force-clear stage [GC]
┃★ !closedungeon → Force-close dungeon
┃★ !spawnboss  |  !spawnleviathan  |  !spawnmalachar
┃★ !leviathanphase → Force Leviathan to final phase
┃★ !startvoidwar  |  !voidstorm
┃★ !give @user gold/xp/item <value>
┃★ !gift @user <item>  |  !payxp @user <amount>
┃★ !setrole @user <role>
┃★ !event / !event end
┃★ !chapter → View/advance story chapter
┃★ !chapter4 → Trigger chapter 4 sequence
┃★ !announce <msg> → Broadcast to GC
┃★ !restock → Refill shop stock
┃★ !promote / !demote @user → Bot admin
┃★ !erase @user → Delete player data
┃★ !lockdown → Toggle maintenance mode
┃★ !update → Trigger redeploy
┃★ !getgroupid → Get current group JID
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
┃  ◆ !daily → Claim daily gold & XP bonus
┃
┃  🏰 DUNGEON SYSTEM
┃  ◆ !enter → DM the bot to join a dungeon
┃  ◆ !dungeon → View enemies & stage [GC]
┃  ◆ !skill <move> [target] → Use a move [GC]
┃  ◆ !onward → Advance to next stage [GC]
┃  ◆ !respawn → Revive after death
┃  ◆ !pickup <#> → Collect a material drop
┃  ◆ !checkbag → View bag  |  !emptybag → Bank
┃  ◆ !repairbag → Repair bag durability
┃
┃  ⚔️ COMBAT & MOVES
┃  ◆ !moveset → See all your available moves
┃  ◆ Healers can heal anywhere: !skill Heal @user
┃
┃  🛡️ PVP DUELS
┃  ◆ !duel @user [bet] → Challenge a player
┃  ◆ !duel party @user1 @user2... → Party duel
┃  ◆ !accept @nickname → Accept a challenge
┃  ◆ !decline @nickname → Decline
┃  ◆ !attack <move> → Use a move in your duel
┃  ◆ !startduel → Confirm party duel (leaders)
┃  ◆ !joinparty @leader → Join a party duel side
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
┃  ◆ !melt / !melt <#> → View or destroy for gold
┃  ◆ !use <item name> → Use a consumable
┃
┃  🧪 POTIONS
┃  ◆ !potionmarket → Browse available potions
┃  ◆ !buypot <name> → Buy a specific potion
┃  ◆ !usepotion / !use → Use a potion from bag
┃
┃  💰 ECONOMY & TRADING
┃  ◆ !pay @user <amount> → Send gold
┃  ◆ !transfer @user <amount> → Send XP
┃  ◆ !trade @user <item #> → Give an item (Rank D+)
┃  ◆ !tradematerial @user <mat> <qty> → Trade materials
┃  ◆ !bounty → View active bounties
┃
┃  ✨ PROGRESSION
┃  ◆ !rankup → Rank up (costs XP)
┃  ◆ !convert <xp> → 250 XP = 1 SP
┃  ◆ !upgrade <stat> <points> → Spend SP on stats
┃  ◆ !prestige confirm → Prestige at S rank
┃  ◆ !codex → Lore fragments you have collected
┃
┃  🔄 ROLE CHANGE
┃  ◆ !confirmrole → Accept a role change offer
┃  ◆ !cancelrole → Decline a role change offer
┃  ◆ Penalties: -2 ranks, -50% gold, gear wiped
┃
┃  📖 STORY & LORE
┃  ◆ !lore → Current chapter of ARIA's story
┃  ◆ !lore all → All chapters & status
┃
┃  📜 QUESTS & CRAFTING
┃  ◆ !quests → Daily, achievement & party quests
┃  ◆ !claim <id> → Claim a completed quest
┃  ◆ !recipes → Craftable weapons for your role
┃  ◆ !forge <number> → Craft a weapon
┃  ◆ !materials → Your crafting materials
┃
┃  🌀 EXPLORER COMMANDS  [Explorer role only]
┃  ◆ !explore → View rifts & survival rates [Exp GC]
┃  ◆ !explore <rank> → Enter a rift [Exp GC]
┃  ◆ !return → Exit rift & collect drops [Exp GC]
┃  ◆ !expmaterials → Your rift materials
┃  ◆ !explorershop → Explorer-exclusive shop [Exp GC]
┃  ◆ !brew / !brew <recipe> → Craft potions [Exp GC]
┃  ◆ !wanderertrade → Trade with the Wanderer [Exp GC]
┃
┃  🏰 CLANS
┃  ◆ !clan → View your clan info
┃  ◆ !createclan → Start a clan (Prestige only)
┃  ◆ !clan join <name> → Request to join (Rank D+)
┃  ◆ !leaveclan → Leave  |  !clanlist → All 3 clans
┃
┃  💚 HEALER MARKET  [Healer GC]
┃  ◆ !healers → Browse available healers
┃  ◆ !hire <number> → Book a healer
┃  ◆ !hiredungeon <number> → Hire for dungeon run
┃  ◆ !listservice <gold> <xp> <desc> → Post service
┃  ◆ !removelisting → Remove  |  !contracts → History
┃
┃  🌍 WORLD BOSS & EVENTS
┃  ◆ !worldboss → View active world boss [GC]
┃  ◆ !attackboss → Attack the world boss [GC]
┃  ◆ !referral → Invite link (+20 XP per referral)
┃`;

        if (isAdmin) {
            text +=
`
┃  🔐 ADMIN COMMANDS
┃  ◆ !spawn [rank] → Spawn dungeon
┃  ◆ !spawnprestige [rank] → Spawn prestige dungeon
┃  ◆ !spawnwanderer → Force spawn Wanderer [Exp GC]
┃  ◆ !begin → Force-start dungeon [GC]
┃  ◆ !clear → Force-clear current stage [GC]
┃  ◆ !closedungeon → Force-close dungeon
┃  ◆ !spawnboss → Spawn a world boss
┃  ◆ !spawnleviathan → Spawn the Void Leviathan
┃  ◆ !spawnmalachar → Spawn Malachar raid
┃  ◆ !leviathanphase → Force Leviathan to final phase
┃  ◆ !startvoidwar → Begin a Void War
┃  ◆ !voidstorm → Trigger a void storm event
┃  ◆ !give @user gold/xp/item <value> → Grant resources
┃  ◆ !gift @user <item> → Quick item gift
┃  ◆ !payxp @user <amount> → Grant XP directly
┃  ◆ !setrole @user <role> → Offer role change
┃  ◆ !event → Start a Void Fracture event
┃  ◆ !event end → End event + leaderboard
┃  ◆ !chapter → View/advance story chapter
┃  ◆ !chapter4 → Trigger chapter 4 sequence
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