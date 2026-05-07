module.exports = {
    F: {
        miniBosses: [
            { name: "Goblin Scout",    hp: 140,  atk: 18,  def: 5,  exp: 20,  gold: 15,  moves: [{ name: "Slash",       damage: 1.0 }] },
            { name: "Wolf Pup",        hp: 160,  atk: 20,  def: 6,  exp: 25,  gold: 20,  moves: [{ name: "Bite",        damage: 1.2 }] },
            { name: "Mud Crawler",     hp: 120,  atk: 15,  def: 4,  exp: 18,  gold: 12,  moves: [{ name: "Scratch",     damage: 0.9 }] }
        ],
        boss: { name: "Goblin King", hp: 500, atk: 28, def: 10, exp: 100, gold: 150, moves: [{ name: "Club Smash", damage: 1.5 }] }
    },
    E: {
        miniBosses: [
            { name: "Cave Spider",     hp: 280,  atk: 32,  def: 11, exp: 40,  gold: 35,  moves: [{ name: "Web Shot",    stun: true }] },
            { name: "Orc Grunt",       hp: 340,  atk: 38,  def: 14, exp: 50,  gold: 45,  moves: [{ name: "Axe Swing",  damage: 1.5 }] },
            { name: "Stone Lizard",    hp: 310,  atk: 30,  def: 16, exp: 45,  gold: 40,  moves: [{ name: "Tail Whip",  damage: 1.3 }] }
        ],
        boss: { name: "Cave Troll", hp: 1100, atk: 58, def: 20, exp: 250, gold: 300, moves: [{ name: "Ground Slam", damage: 2.0 }] }
    },
    D: {
        miniBosses: [
            { name: "Shadow Hound",    hp: 560,  atk: 55,  def: 18, exp: 70,  gold: 60,  moves: [{ name: "Shadow Bite",  damage: 1.7 }] },
            { name: "Skeleton Warrior",hp: 660,  atk: 65,  def: 24, exp: 90,  gold: 75,  moves: [{ name: "Bone Slash",   damage: 1.8 }] },
            { name: "Dark Imp",        hp: 500,  atk: 50,  def: 16, exp: 65,  gold: 55,  moves: [{ name: "Dark Bolt",    damage: 1.6 }] }
        ],
        boss: { name: "Shadow Beast", hp: 1800, atk: 85, def: 30, exp: 400, gold: 500, moves: [{ name: "Dark Pulse", damage: 2.2 }] }
    },
    C: {
        miniBosses: [
            { name: "Flame Imp",       hp: 900,  atk: 85,  def: 28, exp: 110, gold: 90,  moves: [{ name: "Fireball",     damage: 2.1 }] },
            { name: "Lava Golem",      hp: 1100, atk: 95,  def: 40, exp: 130, gold: 110, moves: [{ name: "Magma Punch",  damage: 2.3 }] },
            { name: "Ash Wraith",      hp: 820,  atk: 80,  def: 25, exp: 100, gold: 85,  moves: [{ name: "Cinder Slash", damage: 2.0 }] }
        ],
        boss: { name: "Flame Warden", hp: 3800, atk: 120, def: 50, exp: 600, gold: 700, moves: [{ name: "Inferno", damage: 2.8 }] }
    },
    B: {
        miniBosses: [
            { name: "Ice Wraith",      hp: 1450, atk: 115, def: 42, exp: 160, gold: 130, moves: [{ name: "Frost Breath", damage: 2.5 }] },
            { name: "Iron Golem",      hp: 1700, atk: 108, def: 65, exp: 190, gold: 160, moves: [{ name: "Heavy Slam",   damage: 2.7 }] },
            { name: "Storm Hawk",      hp: 1300, atk: 122, def: 34, exp: 155, gold: 125, moves: [{ name: "Thunder Dive", damage: 2.6 }] }
        ],
        boss: { name: "Ancient Hydra", hp: 6500, atk: 158, def: 62, exp: 1000, gold: 1200, moves: [{ name: "Poison Breath", damage: 3.2 }] }
    },
    A: {
        miniBosses: [
            { name: "Void Reaper",     hp: 2200, atk: 160, def: 55, exp: 230, gold: 190, moves: [{ name: "Soul Rend",    damage: 3.1 }] },
            { name: "Celestial Guard", hp: 2600, atk: 148, def: 80, exp: 260, gold: 220, moves: [{ name: "Holy Smite",   damage: 2.9 }] },
            { name: "Abyssal Knight",  hp: 2000, atk: 168, def: 50, exp: 240, gold: 200, moves: [{ name: "Abyss Slash",  damage: 3.2 }] }
        ],
        boss: { name: "Dark Dragon", hp: 11000, atk: 210, def: 85, exp: 1800, gold: 2500, moves: [{ name: "Dragon Breath", damage: 4.0 }] }
    },
    S: {
        miniBosses: [
            { name: "Abyssal Horror",  hp: 3600, atk: 218, def: 74, exp: 350, gold: 280, moves: [{ name: "Mind Flay",       damage: 3.6 }] },
            { name: "Elder Lich",      hp: 4200, atk: 205, def: 96, exp: 400, gold: 320, moves: [{ name: "Finger of Death", damage: 4.2 }] },
            { name: "Void Titan",      hp: 3900, atk: 232, def: 85, exp: 380, gold: 300, moves: [{ name: "Titan Crush",     damage: 3.9 }] }
        ],
        boss: { name: "Abyss Lord", hp: 18000, atk: 290, def: 125, exp: 3500, gold: 5000, moves: [{ name: "Annihilation", damage: 5.0 }] }
    }
};