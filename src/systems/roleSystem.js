const roles = ["Tank","Assassin","Mage","Healer","Ranger","Berserker"];

// item pools per role
const roleItems = {
    Tank: ["Shield","Armor Plate","Fortify Potion","Taunt Scroll","Iron Skin","Heavy Boots","Guard Helm"],
    Assassin: ["Dagger","Poison Vial","Smoke Bomb","Silent Boots","Backstab Scroll","Cloak"],
    Mage: ["Spell Book","Mana Potion","Fire Scroll","Ice Wand","Arcane Ring","Magic Cloak"],
    Healer: ["Healing Staff","Revive Scroll","Herb Kit","Blessing Charm","Holy Water"],
    Ranger: ["Bow","Arrow Bundle","Trap Kit","Eagle Eye Potion","Camouflage Cloak"],
    Berserker: ["Battle Axe","Rage Potion","War Cry Scroll","Blood Charm","Heavy Blade"]
};

// active shops
const shops = {};

// CONFIG
const SHOP_SIZE = 10;
const REFRESH_TIME = 10 * 60 * 60 * 1000; // 10 hours

// helper: shuffle array
function shuffle(arr) {
    return arr.sort(() => Math.random() - 0.5);
}

// generate shop for a role
function generateShop(role) {

    const pool = roleItems[role] || [];

    // fixed items (first 3 always stay)
    const fixed = pool.slice(0, 3);

    // rest shuffled
    const randomItems = shuffle(pool.slice(3)).slice(0, SHOP_SIZE - fixed.length);

    return [...fixed, ...randomItems];
}

// refresh shop
function refreshShop(role) {
    shops[role] = {
        items: generateShop(role),
        lastUpdated: Date.now()
    };
}

// auto refresh loop
function startShopCycle() {
    setInterval(() => {
        roles.forEach(role => {
            refreshShop(role);
            console.log(`🔄 ${role} shop refreshed`);
        });
    }, REFRESH_TIME);
}

// init all shops ONCE
roles.forEach(role => refreshShop(role));

// EXPORT COMMAND
module.exports = {
    name: "shop",
    async execute(msg, args, ADMIN) {

        const userRole = args[0]; // assume user passes role for now

        if (!userRole || !shops[userRole]) {
            return msg.reply("❌ Invalid role. Example: !shop Mage");
        }

        const shop = shops[userRole];

        // display shop
        let text = `🛒 ${userRole.toUpperCase()} SHOP\n\n`;

        shop.items.forEach((item, i) => {
            text += `${i + 1}. ${item}\n`;
        });

        const timeLeft = Math.floor((REFRESH_TIME - (Date.now() - shop.lastUpdated)) / 3600000);

        text += `\n⏳ Restock in: ${timeLeft}h`;

        msg.reply(text);
    }
};

// IMPORTANT: start manually from admin command
// startShopCycle();