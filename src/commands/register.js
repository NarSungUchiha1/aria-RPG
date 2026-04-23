const db = require('../database/db');
const { rankBadge, roleIcon } = require('../utils/styles');
const roles = ["Tank","Assassin","Mage","Healer","Berserker"];

// In-memory — players who typed !awaken are added here by awaken.js
const awakenedSessions = new Set();

module.exports = {
    name: 'register',
    allowRegister: (userId) => awakenedSessions.add(userId),

    async execute(msg, args, { userId }) {
        if (!awakenedSessions.has(userId)) {
            return msg.reply(
                `══〘 🌌 REGISTER 〙══╮\n` +
                `┃◆ ⚠️ Use !awaken first.\n` +
                `┃◆ Type !awaken to begin.\n` +
                `╰═══════════════════════╯`
            );
        }
        const nickname = args.join(' ');
        if (!nickname) return msg.reply(
            `══〘 🌌 REGISTER 〙══╮\n┃◆ ❌ Use: !register <your name>\n╰═══════════════════════╯`
        );
        try {
            const [existing] = await db.execute("SELECT id FROM players WHERE id=?", [userId]);
            if (existing.length) return msg.reply(
                `══〘 🌌 REGISTER 〙══╮\n┃◆ ⚡ Already registered.\n┃◆ Use !me to view your stats.\n╰═══════════════════════╯`
            );
            const role  = roles[Math.floor(Math.random() * roles.length)];
            const stats = { strength:5, agility:5, intelligence:5, stamina:5, hp:100, max_hp:100 };
            switch(role) {
                case "Tank":      stats.stamina+=5; stats.hp+=50; stats.max_hp+=50; stats.strength+=3; break;
                case "Assassin":  stats.agility+=5; stats.strength+=2; stats.hp+=10; stats.max_hp+=10; break;
                case "Mage":      stats.intelligence+=5; stats.agility+=2; stats.hp+=10; stats.max_hp+=10; break;
                case "Healer":    stats.intelligence+=4; stats.stamina+=3; stats.hp+=20; stats.max_hp+=20; break;
                case "Berserker": stats.strength+=5; stats.hp+=30; stats.max_hp+=30; stats.agility+=2; break;
            }
            await db.execute(
                "INSERT INTO players (id, nickname, role, `rank`, strength, agility, intelligence, stamina, hp, max_hp, awakened) VALUES (?, ?, ?, 'F', ?, ?, ?, ?, ?, ?, 1)",
                [userId, nickname, role, stats.strength, stats.agility, stats.intelligence, stats.stamina, stats.hp, stats.max_hp]
            );
            await db.execute("INSERT IGNORE INTO currency (player_id, gold) VALUES (?, 500)", [userId]);
            await db.execute("INSERT IGNORE INTO xp (player_id, xp) VALUES (?, 0)", [userId]);
            await db.execute("INSERT IGNORE INTO combat (player_id) VALUES (?)", [userId]);
            awakenedSessions.delete(userId);
            const contact = await msg.getContact();
            return msg.reply(
                `══〘 🌌 AWAKENING COMPLETE 〙══╮\n` +
                `┃◆ ${rankBadge('F')} *${nickname.toUpperCase()}*\n` +
                `┃◆ ${roleIcon(role)} ${role}\n` +
                `┃◆━━━━━━━━━━━━\n` +
                `┃◆ 💪 STR: ${stats.strength}\n` +
                `┃◆ ⚡ AGI: ${stats.agility}\n` +
                `┃◆ 🧠 INT: ${stats.intelligence}\n` +
                `┃◆ 🛡️ STA: ${stats.stamina}\n` +
                `┃◆ ❤️ HP:  ${stats.hp}/${stats.max_hp}\n` +
                `┃◆ 💰 Gold: 500 (starter)\n` +
                `┃◆━━━━━━━━━━━━\n` +
                `┃◆ ⚡ Status: AWAKENED\n` +
                `╰═══════════════════════╯`,
                undefined, { mentions: [contact] }
            );
        } catch (err) {
            if (err.code === 'ER_DUP_ENTRY') return msg.reply(
                `══〘 🌌 REGISTER 〙══╮\n┃◆ ❌ Name already taken.\n╰═══════════════════════╯`
            );
            console.error(err);
            msg.reply(`══〘 🌌 REGISTER 〙══╮\n┃◆ ❌ Registration failed.\n╰═══════════════════════╯`);
        }
    }
};