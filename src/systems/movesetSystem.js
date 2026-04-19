const roleMoves = {
  Tank: ["Shield Bash", "Fortify", "Taunt"],
  Assassin: ["Backstab", "Shadow Step", "Poison"],
  Mage: ["Fireball", "Arcane Blast", "Mana Burst"],
  Healer: ["Heal", "Blessing", "Cleanse"],
  Berserker: ["Rage Slash", "Smash", "Bloodlust"]
};

const weaponMoves = {
  strength: ["Power Strike", "Overdrive", "Crush"],
  agility: ["Dash Cut", "Quick Slash", "Phantom Hit"],
  intelligence: ["Spell Burst", "Magic Surge", "Mind Break"],
  stamina: ["Iron Body", "Guard", "Endurance"]
};

function getMoves(player, items){

let moves = [...(roleMoves[player.role] || [])];

items.forEach(i => {
  if (weaponMoves[i.item_type]) {
    moves.push(...weaponMoves[i.item_type]);
  }
});

return moves.slice(0, 6);
}

module.exports = { getMoves };