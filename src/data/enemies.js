module.exports = {
    F: {
        miniBosses: [
            { name: "Goblin Scout", hp: 50, atk: 8, def: 2, exp: 20, gold: 15, moves: [{ name: "Slash", damage: 1.0 }] },
            { name: "Wolf Pup", hp: 60, atk: 10, def: 3, exp: 25, gold: 20, moves: [{ name: "Bite", damage: 1.2 }] }
        ],
        boss: { name: "Goblin King", hp: 150, atk: 15, def: 5, exp: 100, gold: 150, moves: [{ name: "Club Smash", damage: 1.5 }] }
    },
    E: {
        miniBosses: [
            { name: "Cave Spider", hp: 100, atk: 15, def: 6, exp: 40, gold: 35, moves: [{ name: "Web Shot", stun: true }] },
            { name: "Orc Grunt", hp: 130, atk: 18, def: 8, exp: 50, gold: 45, moves: [{ name: "Axe Swing", damage: 1.4 }] }
        ],
        boss: { name: "Cave Troll", hp: 300, atk: 28, def: 10, exp: 250, gold: 300, moves: [{ name: "Ground Slam", damage: 1.8 }] }
    },
    D: {
        miniBosses: [
            { name: "Shadow Hound", hp: 180, atk: 25, def: 10, exp: 70, gold: 60, moves: [{ name: "Shadow Bite", damage: 1.6 }] },
            { name: "Skeleton Warrior", hp: 220, atk: 30, def: 14, exp: 90, gold: 75, moves: [{ name: "Bone Slash", damage: 1.7 }] }
        ],
        boss: { name: "Shadow Beast", hp: 500, atk: 40, def: 16, exp: 400, gold: 500, moves: [{ name: "Dark Pulse", damage: 2.0 }] }
    },
    C: {
        miniBosses: [
            { name: "Flame Imp", hp: 260, atk: 38, def: 14, exp: 110, gold: 90, moves: [{ name: "Fireball", damage: 1.9 }] },
            { name: "Lava Golem", hp: 320, atk: 42, def: 20, exp: 130, gold: 110, moves: [{ name: "Magma Punch", damage: 2.1 }] }
        ],
        boss: { name: "Flame Warden", hp: 800, atk: 55, def: 24, exp: 600, gold: 700, moves: [{ name: "Inferno", damage: 2.5 }] }
    },
    B: {
        miniBosses: [
            { name: "Ice Wraith", hp: 380, atk: 52, def: 20, exp: 160, gold: 130, moves: [{ name: "Frost Breath", damage: 2.2 }] },
            { name: "Iron Golem", hp: 450, atk: 48, def: 32, exp: 190, gold: 160, moves: [{ name: "Heavy Slam", damage: 2.4 }] }
        ],
        boss: { name: "Ancient Hydra", hp: 1200, atk: 72, def: 28, exp: 1000, gold: 1200, moves: [{ name: "Poison Breath", damage: 2.8 }] }
    },
    A: {
        miniBosses: [
            { name: "Void Reaper", hp: 520, atk: 68, def: 26, exp: 230, gold: 190, moves: [{ name: "Soul Rend", damage: 2.8 }] },
            { name: "Celestial Guardian", hp: 600, atk: 62, def: 38, exp: 260, gold: 220, moves: [{ name: "Holy Smite", damage: 2.6 }] }
        ],
        boss: { name: "Dark Dragon", hp: 1800, atk: 95, def: 36, exp: 1800, gold: 2500, moves: [{ name: "Dragon Breath", damage: 3.5 }] }
    },
    S: {
        miniBosses: [
            { name: "Abyssal Horror", hp: 750, atk: 90, def: 34, exp: 350, gold: 280, moves: [{ name: "Mind Flay", damage: 3.2 }] },
            { name: "Elder Lich", hp: 850, atk: 85, def: 44, exp: 400, gold: 320, moves: [{ name: "Finger of Death", damage: 3.8 }] }
        ],
        boss: { name: "Abyss Lord", hp: 3000, atk: 130, def: 50, exp: 3500, gold: 5000, moves: [{ name: "Annihilation", damage: 4.5 }] }
    }
};