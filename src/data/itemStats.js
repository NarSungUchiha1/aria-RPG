module.exports = {
    // ── REGULAR WEAPONS (F-rank, modest bonuses) ──────────────────────────────
    // These complement stats — player rank and SP upgrades are the real power.
    // Max at S-grade: stat ~5, attack ~5

    // STR
    "Iron Greatsword":  { primaryStat: 'strength',     base: { strength: 1, attack: 1 }, increment: { strength: 1, attack: 1 } },
    "Battle Axe":       { primaryStat: 'strength',     base: { strength: 1, attack: 2 }, increment: { strength: 1, attack: 1 } },
    "Rage Blade":       { primaryStat: 'strength',     base: { strength: 1, attack: 2 }, increment: { strength: 1, attack: 1 } },
    "Warhammer":        { primaryStat: 'strength',     base: { strength: 2, stamina: 1 }, increment: { strength: 1, stamina: 0 } },
    "Dragonbone Mace":  { primaryStat: 'strength',     base: { strength: 2, attack: 1 }, increment: { strength: 1, attack: 1 } },

    // AGI
    "Shadow Dagger":    { primaryStat: 'agility',      base: { agility: 1, attack: 1 }, increment: { agility: 1, attack: 1 } },
    "Dagger":           { primaryStat: 'agility',      base: { agility: 1, attack: 1 }, increment: { agility: 1, attack: 1 } },
    "Twin Fang Blades": { primaryStat: 'agility',      base: { agility: 2, attack: 1 }, increment: { agility: 1, attack: 1 } },
    "Wind Katana":      { primaryStat: 'agility',      base: { agility: 1, attack: 1 }, increment: { agility: 1, attack: 1 } },
    "Nightshade Bow":   { primaryStat: 'agility',      base: { agility: 1, attack: 2 }, increment: { agility: 1, attack: 1 } },

    // INT
    "Arcane Staff":     { primaryStat: 'intelligence', base: { intelligence: 1, attack: 1 }, increment: { intelligence: 1, attack: 1 } },
    "Spell Book":       { primaryStat: 'intelligence', base: { intelligence: 1, attack: 1 }, increment: { intelligence: 1, attack: 1 } },
    "Frostbane Wand":   { primaryStat: 'intelligence', base: { intelligence: 2, attack: 1 }, increment: { intelligence: 1, attack: 1 } },
    "Void Scepter":     { primaryStat: 'intelligence', base: { intelligence: 2, attack: 1 }, increment: { intelligence: 1, attack: 1 } },
    "Celestial Orb":    { primaryStat: 'intelligence', base: { intelligence: 1, healing: 1 }, increment: { intelligence: 1, healing: 1 } },

    // STA
    "Shield":               { primaryStat: 'stamina', base: { stamina: 1, defense: 2 }, increment: { stamina: 1, defense: 1 } },
    "Armor Plate":          { primaryStat: 'stamina', base: { stamina: 1, defense: 1 }, increment: { stamina: 1, defense: 1 } },
    "Tower Shield":         { primaryStat: 'stamina', base: { stamina: 2, defense: 2 }, increment: { stamina: 1, defense: 1 } },
    "Vanguard Helm":        { primaryStat: 'stamina', base: { stamina: 1, defense: 1, strength: 1 }, increment: { stamina: 1, defense: 1, strength: 0 } },
    "Golemheart Gauntlets": { primaryStat: 'stamina', base: { stamina: 1, defense: 1, strength: 1 }, increment: { stamina: 1, defense: 1, strength: 0 } },

    // CONSUMABLE
    "Mana Potion": { primaryStat: 'intelligence', base: { mana_restore: 30 }, increment: { mana_restore: 10 } },

    // ── SPECIAL WEAPONS — C RANK ──────────────────────────────────────────────
    // Meaningful power jump — reward for reaching rank C
    "Obsidian Cleaver": { primaryStat: 'strength',     base: { strength: 8,  attack: 8  }, increment: { strength: 3, attack: 3 }, minRank: 'C' },
    "Whisperblade":     { primaryStat: 'agility',      base: { agility: 8,   attack: 7  }, increment: { agility: 3,  attack: 3 }, minRank: 'C' },
    "Inferno Rod":      { primaryStat: 'intelligence', base: { intelligence: 8, attack: 6 }, increment: { intelligence: 3, attack: 3 }, minRank: 'C' },
    "Bulwark of Stone": { primaryStat: 'stamina',      base: { stamina: 8,   defense: 8 }, increment: { stamina: 3,  defense: 3 }, minRank: 'C' },

    // ── SPECIAL WEAPONS — B RANK ──────────────────────────────────────────────
    "Abyssal Greatsword":   { primaryStat: 'strength',     base: { strength: 14, attack: 12, stamina: 4 }, increment: { strength: 4, attack: 4, stamina: 1 }, minRank: 'B' },
    "Voidreaper Dagger":    { primaryStat: 'agility',      base: { agility: 14,  attack: 11 },             increment: { agility: 4,  attack: 4 },             minRank: 'B' },
    "Staff of the Eternal": { primaryStat: 'intelligence', base: { intelligence: 14, attack: 10 },         increment: { intelligence: 4, attack: 4 },         minRank: 'B' },
    "Aegis of the Fallen":  { primaryStat: 'stamina',      base: { stamina: 14,  defense: 14 },            increment: { stamina: 4,  defense: 4 },            minRank: 'B' },

    // ── SPECIAL WEAPONS — A RANK ──────────────────────────────────────────────
    "Titan's Wrath":    { primaryStat: 'strength',     base: { strength: 22, attack: 18, stamina: 6 }, increment: { strength: 5, attack: 5, stamina: 2 }, minRank: 'A' },
    "Eclipse Edge":     { primaryStat: 'agility',      base: { agility: 22,  attack: 16 },             increment: { agility: 5,  attack: 5 },             minRank: 'A' },
    "Celestial Codex":  { primaryStat: 'intelligence', base: { intelligence: 22, attack: 14, healing: 8 }, increment: { intelligence: 5, attack: 4, healing: 2 }, minRank: 'A' },
    "Fortress Aegis":   { primaryStat: 'stamina',      base: { stamina: 22,  defense: 22 },            increment: { stamina: 5,  defense: 5 },            minRank: 'A' },

    // ── SPECIAL WEAPONS — S RANK (overwhelming) ───────────────────────────────
    "Godslayer":           { primaryStat: 'strength',     base: { strength: 35, attack: 28, stamina: 10 }, increment: { strength: 8, attack: 6, stamina: 3 }, minRank: 'S' },
    "Eternity's Edge":     { primaryStat: 'agility',      base: { agility: 35,  attack: 26 },              increment: { agility: 8,  attack: 6 },             minRank: 'S' },
    "Omniscient Scepter":  { primaryStat: 'intelligence', base: { intelligence: 35, attack: 22, healing: 15 }, increment: { intelligence: 8, attack: 5, healing: 4 }, minRank: 'S' },
    "Aegis Immortal":      { primaryStat: 'stamina',      base: { stamina: 35,  defense: 35 },             increment: { stamina: 8,  defense: 8 },            minRank: 'S' },
};