module.exports = {
    F: {
        miniBosses: [
            { name: "Goblin Scout",    hp: 80,   atk: 12,  def: 3,  exp: 80,  gold: 45,  moves: [{ name: "Slash",       damage: 1.0 }] },
            { name: "Wolf Pup",        hp: 90,   atk: 14,  def: 4,  exp: 100, gold: 60,  moves: [{ name: "Bite",        damage: 1.2 }] },
            { name: "Mud Crawler",     hp: 70,   atk: 10,  def: 2,  exp: 72,  gold: 36,  moves: [{ name: "Scratch",     damage: 0.9 }] }
        ],
        boss: { name: "Goblin King", hp: 250, atk: 18, def: 6, exp: 400, gold: 450, moves: [{ name: "Club Smash", damage: 1.4 }] }
    },
    E: {
        miniBosses: [
            { name: "Cave Spider",     hp: 160,  atk: 22,  def: 7,  exp: 160, gold: 105,  moves: [{ name: "Web Shot",    stun: true }] },
            { name: "Orc Grunt",       hp: 200,  atk: 26,  def: 9,  exp: 200, gold: 135,  moves: [{ name: "Axe Swing",  damage: 1.4 }] },
            { name: "Stone Lizard",    hp: 180,  atk: 20,  def: 10, exp: 180, gold: 120,  moves: [{ name: "Tail Whip",  damage: 1.2 }] }
        ],
        boss: { name: "Cave Troll", hp: 600, atk: 40, def: 12, exp: 1000, gold: 900, moves: [{ name: "Ground Slam", damage: 1.8 }] }
    },
    D: {
        miniBosses: [
            { name: "Shadow Hound",    hp: 320,  atk: 38,  def: 12, exp: 280, gold: 180,  moves: [{ name: "Shadow Bite",  damage: 1.6 }] },
            { name: "Skeleton Warrior",hp: 380,  atk: 44,  def: 16, exp: 360, gold: 225,  moves: [{ name: "Bone Slash",   damage: 1.7 }] },
            { name: "Dark Imp",        hp: 290,  atk: 35,  def: 10, exp: 260, gold: 165,  moves: [{ name: "Dark Bolt",    damage: 1.5 }] }
        ],
        boss: { name: "Shadow Beast", hp: 1000, atk: 58, def: 20, exp: 1600, gold: 1500, moves: [{ name: "Dark Pulse", damage: 2.0 }] }
    },
    C: {
        miniBosses: [
            { name: "Flame Imp",       hp: 500,  atk: 58,  def: 18, exp: 330, gold: 270,  moves: [{ name: "Fireball",     damage: 1.9 }] },
            { name: "Lava Golem",      hp: 620,  atk: 65,  def: 26, exp: 390, gold: 330, moves: [{ name: "Magma Punch",  damage: 2.1 }] },
            { name: "Ash Wraith",      hp: 460,  atk: 55,  def: 16, exp: 300, gold: 255,  moves: [{ name: "Cinder Slash", damage: 1.8 }] }
        ],
        boss: { name: "Flame Warden", hp: 2000, atk: 82, def: 32, exp: 1800, gold: 2100, moves: [{ name: "Inferno", damage: 2.5 }] }
    },
    B: {
        miniBosses: [
            { name: "Ice Wraith",      hp: 800,  atk: 80,  def: 28, exp: 480, gold: 325, moves: [{ name: "Frost Breath", damage: 2.2 }] },
            { name: "Iron Golem",      hp: 950,  atk: 75,  def: 42, exp: 570, gold: 400, moves: [{ name: "Heavy Slam",   damage: 2.4 }] },
            { name: "Storm Hawk",      hp: 720,  atk: 85,  def: 22, exp: 465, gold: 313, moves: [{ name: "Thunder Dive", damage: 2.3 }] }
        ],
        boss: { name: "Ancient Hydra", hp: 3500, atk: 108, def: 40, exp: 3000, gold: 3000, moves: [{ name: "Poison Breath", damage: 2.8 }] }
    },
    A: {
        miniBosses: [
            { name: "Void Reaper",     hp: 1200, atk: 110, def: 36, exp: 690, gold: 475, moves: [{ name: "Soul Rend",    damage: 2.8 }] },
            { name: "Celestial Guard", hp: 1400, atk: 100, def: 52, exp: 780, gold: 550, moves: [{ name: "Holy Smite",   damage: 2.6 }] },
            { name: "Abyssal Knight",  hp: 1100, atk: 115, def: 32, exp: 720, gold: 500, moves: [{ name: "Abyss Slash",  damage: 2.9 }] }
        ],
        boss: { name: "Dark Dragon", hp: 6000, atk: 145, def: 55, exp: 5400, gold: 6250, moves: [{ name: "Dragon Breath", damage: 3.5 }] }
    },
    S: {
        miniBosses: [
            { name: "Abyssal Horror",  hp: 2000, atk: 150, def: 48, exp: 1050, gold: 700, moves: [{ name: "Mind Flay",     damage: 3.2 }] },
            { name: "Elder Lich",      hp: 2400, atk: 140, def: 62, exp: 1200, gold: 800, moves: [{ name: "Finger of Death", damage: 3.8 }] },
            { name: "Void Titan",      hp: 2200, atk: 160, def: 55, exp: 1140, gold: 750, moves: [{ name: "Titan Crush",   damage: 3.5 }] }
        ],
        boss: { name: "Abyss Lord", hp: 10000, atk: 200, def: 80, exp: 10500, gold: 12500, moves: [{ name: "Annihilation", damage: 4.5 }] }
    }
};