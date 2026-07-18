-- ═══════════════════════════════════════════════════════════════════════════
-- THE HOLLOW SUN — TOTAL REBOOT SCRUB
-- Wipes ALL game/player data for the fresh start. Chosen scope: NOTHING
-- survives (players, gold, clans, VIP, referrals — all reset).
--
-- ⚠️ RUN ORDER:
--   1. STOP/SUSPEND the bot on Render first.
--   2. Run this script against the Aiven DB.
--   3. Deploy the Hollow Sun build, start the bot, run !hollowsun.
--
-- ⚠️ DELIBERATELY NOT TOUCHED:
--   wa_sessions      (the WhatsApp link — wiping it forces a re-pair!)
--   pair_state       (ban-loop protection state)
--   game_flags       (cleared selectively below instead)
--
-- Tables that don't exist on your DB will error individually — skip and
-- continue; each statement is independent.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Core player data ──────────────────────────────────────────────────────
DELETE FROM players;
DELETE FROM currency;
DELETE FROM xp;
DELETE FROM inventory;
DELETE FROM potion_inventory;
DELETE FROM player_potions;
DELETE FROM bags;

-- ── Dungeons / combat state ───────────────────────────────────────────────
DELETE FROM dungeon;
DELETE FROM dungeon_players;
DELETE FROM dungeon_enemies;
DELETE FROM dungeon_damage;
DELETE FROM dungeon_flags;
DELETE FROM dungeon_entry_log;
DELETE FROM dungeon_spawn_lock;
DELETE FROM active_effects;

-- ── Progression / endgame ─────────────────────────────────────────────────
DELETE FROM resonance_profiles;
DELETE FROM resonance_move_progress;
DELETE FROM void_resonance;
DELETE FROM ps_dungeon_clears;
DELETE FROM malachar_kills;

-- ── Clans / territories / factions ────────────────────────────────────────
DELETE FROM clans;
DELETE FROM clan_members;
DELETE FROM clan_quests;
DELETE FROM clan_blessing_state;
UPDATE void_territories SET clan_id=NULL, claimed_at=NULL, last_attacked=NULL, defense_hp=100;
DELETE FROM territory_wars;
DELETE FROM faction_members;
DELETE FROM faction_points;

-- ── Quests / events / tournaments / bounties ─────────────────────────────
DELETE FROM player_quests;
DELETE FROM quests;
DELETE FROM tournaments;
DELETE FROM tournament_players;
DELETE FROM tournament_matches;
DELETE FROM duo_gauntlet_matches;
DELETE FROM events;
DELETE FROM world_boss;
DELETE FROM world_boss_contributions;
DELETE FROM bounties;

-- ── Economy / markets ─────────────────────────────────────────────────────
DELETE FROM shop_stock;
DELETE FROM potion_market;
DELETE FROM explorer_listings;
-- (weaponStats + bound-weapon columns were old-era relic artifacts — dropped below)

-- ── Monetization / referrals (total scrub per owner decision) ────────────
DELETE FROM vip_subscribers;
DELETE FROM referral_codes;
DELETE FROM referrals;
DELETE FROM referral_pending_bonus;

-- ── AriA's memory of the old world ────────────────────────────────────────
DELETE FROM aria_conversations;
DELETE FROM aria_memory;
DELETE FROM aria_player_model;
DELETE FROM aria_group_log;
DELETE FROM aria_world_state;
UPDATE aria_story SET current_chapter=1;

-- ── Era flags: fresh world, nothing active yet ────────────────────────────
DELETE FROM game_flags;

-- ═══════════════════════════════════════════════════════════════════════════
-- Post-scrub sanity checks (run these to confirm):
--   SELECT COUNT(*) FROM players;         -- 0
--   SELECT COUNT(*) FROM wa_sessions;     -- MUST be > 0 (session preserved!)
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- IDENTIFIER MIGRATION (added with the total identifier purge)
-- The code now uses new internal names; align the DB:
--   malachar_kills  →  worldboss_kills   (clan-creation requirement counter)
-- The new table auto-creates on boot; the old one just needs to go.
-- (dungeon_rank='MALACHAR' rows and quests objective_type='malachar_clear'
--  rows are already removed by the wipes above; the code writes the new ids
--  'HOLLOWKING' / 'worldboss_clear' from now on.)
-- ═══════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS malachar_kills;

-- Safety net ONLY if you ever run this migration WITHOUT the full scrub above:
-- UPDATE dungeon SET dungeon_rank='HOLLOWKING' WHERE dungeon_rank='MALACHAR';
-- UPDATE quests  SET objective_type='worldboss_clear' WHERE objective_type='malachar_clear';

-- Relic system fully erased from the code — drop its DB artifacts too:
DROP TABLE IF EXISTS weaponStats;
ALTER TABLE inventory DROP COLUMN bound_to;   -- errors harmlessly if absent
ALTER TABLE inventory DROP COLUMN is_unique;  -- errors harmlessly if absent
