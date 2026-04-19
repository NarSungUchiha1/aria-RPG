module.exports = {
    // === STRENGTH WEAPONS ===
    "Iron Greatsword": {
        primaryStat: 'strength',
        base: { strength: 5, attack: 4 },
        increment: { strength: 3, attack: 2 }
    },
    "Battle Axe": {
        primaryStat: 'strength',
        base: { strength: 4, attack: 5 },
        increment: { strength: 3, attack: 3 }
    },
    "Rage Blade": {
        primaryStat: 'strength',
        base: { strength: 3, attack: 6 },
        increment: { strength: 2, attack: 4 }
    },
    "Warhammer": {
        primaryStat: 'strength',
        base: { strength: 6, stamina: 2 },
        increment: { strength: 4, stamina: 1 }
    },
    "Dragonbone Mace": {
        primaryStat: 'strength',
        base: { strength: 7, attack: 3 },
        increment: { strength: 4, attack: 2 }
    },

    // === AGILITY WEAPONS ===
    "Shadow Dagger": {
        primaryStat: 'agility',
        base: { agility: 5, attack: 4 },
        increment: { agility: 3, attack: 2 }
    },
    "Dagger": {
        primaryStat: 'agility',
        base: { agility: 4, attack: 3 },
        increment: { agility: 2, attack: 2 }
    },
    "Twin Fang Blades": {
        primaryStat: 'agility',
        base: { agility: 6, attack: 5 },
        increment: { agility: 4, attack: 3 }
    },
    "Wind Katana": {
        primaryStat: 'agility',
        base: { agility: 5, attack: 4 },
        increment: { agility: 3, attack: 3 }
    },
    "Nightshade Bow": {
        primaryStat: 'agility',
        base: { agility: 4, attack: 5 },
        increment: { agility: 3, attack: 3 }
    },

    // === INTELLIGENCE WEAPONS ===
    "Arcane Staff": {
        primaryStat: 'intelligence',
        base: { intelligence: 5, attack: 4 },
        increment: { intelligence: 3, attack: 3 }
    },
    "Spell Book": {
        primaryStat: 'intelligence',
        base: { intelligence: 4, attack: 3 },
        increment: { intelligence: 3, attack: 2 }
    },
    "Frostbane Wand": {
        primaryStat: 'intelligence',
        base: { intelligence: 6, attack: 3 },
        increment: { intelligence: 4, attack: 2 }
    },
    "Void Scepter": {
        primaryStat: 'intelligence',
        base: { intelligence: 7, attack: 5 },
        increment: { intelligence: 4, attack: 3 }
    },
    "Celestial Orb": {
        primaryStat: 'intelligence',
        base: { intelligence: 5, healing: 5 },
        increment: { intelligence: 3, healing: 3 }
    },

    // === STAMINA WEAPONS ===
    "Shield": {
        primaryStat: 'stamina',
        base: { stamina: 5, defense: 5 },
        increment: { stamina: 3, defense: 3 }
    },
    "Armor Plate": {
        primaryStat: 'stamina',
        base: { stamina: 4, defense: 4 },
        increment: { stamina: 3, defense: 3 }
    },
    "Tower Shield": {
        primaryStat: 'stamina',
        base: { stamina: 7, defense: 7 },
        increment: { stamina: 4, defense: 4 }
    },
    "Vanguard Helm": {
        primaryStat: 'stamina',
        base: { stamina: 3, defense: 4, strength: 2 },
        increment: { stamina: 2, defense: 2, strength: 1 }
    },
    "Golemheart Gauntlets": {
        primaryStat: 'stamina',
        base: { stamina: 5, defense: 3, strength: 3 },
        increment: { stamina: 3, defense: 2, strength: 2 }
    },

    // === CONSUMABLES ===
    "Mana Potion": {
        primaryStat: 'intelligence',
        base: { mana_restore: 30 },
        increment: { mana_restore: 10 }
    },

    // ======================== SPECIAL WEAPONS (Rank C and above) ========================
    
    // ---------- RANK C ----------
    "Obsidian Cleaver": {
        primaryStat: 'strength',
        base: { strength: 10, attack: 8 },
        increment: { strength: 4, attack: 3 },
        minRank: 'C'
    },
    "Whisperblade": {
        primaryStat: 'agility',
        base: { agility: 10, attack: 7 },
        increment: { agility: 4, attack: 3 },
        minRank: 'C'
    },
    "Inferno Rod": {
        primaryStat: 'intelligence',
        base: { intelligence: 10, attack: 6 },
        increment: { intelligence: 4, attack: 2 },
        minRank: 'C'
    },
    "Bulwark of Stone": {
        primaryStat: 'stamina',
        base: { stamina: 10, defense: 10 },
        increment: { stamina: 4, defense: 4 },
        minRank: 'C'
    },

    // ---------- RANK B ----------
    "Abyssal Greatsword": {
        primaryStat: 'strength',
        base: { strength: 15, attack: 12, stamina: 5 },
        increment: { strength: 5, attack: 4, stamina: 2 },
        minRank: 'B'
    },
    "Voidreaper Dagger": {
        primaryStat: 'agility',
        base: { agility: 15, attack: 11 },
        increment: { agility: 5, attack: 4 },
        minRank: 'B'
    },
    "Staff of the Eternal": {
        primaryStat: 'intelligence',
        base: { intelligence: 15, attack: 10 },
        increment: { intelligence: 5, attack: 3 },
        minRank: 'B'
    },
    "Aegis of the Fallen": {
        primaryStat: 'stamina',
        base: { stamina: 15, defense: 15 },
        increment: { stamina: 5, defense: 5 },
        minRank: 'B'
    },

    // ---------- RANK A ----------
    "Titan's Wrath": {
        primaryStat: 'strength',
        base: { strength: 22, attack: 18, stamina: 8 },
        increment: { strength: 7, attack: 6, stamina: 3 },
        minRank: 'A'
    },
    "Eclipse Edge": {
        primaryStat: 'agility',
        base: { agility: 22, attack: 16 },
        increment: { agility: 7, attack: 5 },
        minRank: 'A'
    },
    "Celestial Codex": {
        primaryStat: 'intelligence',
        base: { intelligence: 22, attack: 14, healing: 10 },
        increment: { intelligence: 7, attack: 4, healing: 5 },
        minRank: 'A'
    },
    "Fortress Aegis": {
        primaryStat: 'stamina',
        base: { stamina: 22, defense: 22 },
        increment: { stamina: 7, defense: 7 },
        minRank: 'A'
    },

    // ---------- RANK S ----------
    "Godslayer": {
        primaryStat: 'strength',
        base: { strength: 35, attack: 30, stamina: 15 },
        increment: { strength: 10, attack: 8, stamina: 5 },
        minRank: 'S'
    },
    "Eternity's Edge": {
        primaryStat: 'agility',
        base: { agility: 35, attack: 28 },
        increment: { agility: 10, attack: 7 },
        minRank: 'S'
    },
    "Omniscient Scepter": {
        primaryStat: 'intelligence',
        base: { intelligence: 35, attack: 25, healing: 20 },
        increment: { intelligence: 10, attack: 6, healing: 8 },
        minRank: 'S'
    },
    "Aegis Immortal": {
        primaryStat: 'stamina',
        base: { stamina: 35, defense: 35 },
        increment: { stamina: 10, defense: 10 },
        minRank: 'S'
    }
};