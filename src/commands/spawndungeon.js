const db = require('../database/db');

async function spawnDungeon(rank) {

  await db.execute("UPDATE dungeon SET is_active=FALSE");

  const maxStage = { F:3, E:4, D:5, C:6, B:7, A:8, S:10 }[rank] || 3;

  await db.execute(
    `INSERT INTO dungeon 
     (dungeon_rank, stage, max_stage, boss_name, is_active, stage_cleared, in_combat) 
     VALUES (?,1,?,?,TRUE,FALSE,FALSE)`,
    [rank, maxStage, "Dungeon Boss"]
  );
}

module.exports = { spawnDungeon };