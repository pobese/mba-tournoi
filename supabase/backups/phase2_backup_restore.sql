-- =============================================================================
-- SAUVEGARDE / RESTAURATION AVANT PHASE 2 (migration clubs)
-- =============================================================================
-- Snapshot intégral des données métier dans un schéma dédié `backup_phase2`.
-- À exécuter dans le SQL Editor Supabase (rôle postgres).
--
-- NOTE : ce n'est PAS une migration → ne pas placer dans supabase/migrations/.
-- Périmètre : les 9 tables interdépendantes d'un tournoi. `teams`, `round_bye`
-- et `player_tournament_stats` sont inclus car matches/standings en dépendent
-- (clés étrangères) — sans eux la restauration casserait.
--
-- Ordre d'utilisation :
--   1) SAUVEGARDE  → avant la migration
--   2) VÉRIFICATION → confirmer live == backup
--   3) RESTAURATION → seulement si la migration casse quelque chose
--   4) NETTOYAGE   → une fois la Phase 2 stable
-- =============================================================================


-- =============================================================================
-- 1) SAUVEGARDE
-- =============================================================================
create schema if not exists backup_phase2;

-- `create table as table` copie TOUTES les colonnes réelles en live
-- (robuste même si src/types/database.ts est périmé). Défauts/contraintes
-- non copiés : c'est voulu, c'est un snapshot de données.
create table backup_phase2.tournaments             as table public.tournaments;
create table backup_phase2.players                 as table public.players;
create table backup_phase2.tournament_players      as table public.tournament_players;
create table backup_phase2.teams                   as table public.teams;
create table backup_phase2.rounds                  as table public.rounds;
create table backup_phase2.matches                 as table public.matches;
create table backup_phase2.round_bye               as table public.round_bye;
create table backup_phase2.player_tournament_stats as table public.player_tournament_stats;
create table backup_phase2.standings               as table public.standings;

-- Optionnel : partage multi-comptes (inclus seulement si la table existe).
do $$
begin
  if to_regclass('public.organization_members') is not null then
    execute 'create table backup_phase2.organization_members as table public.organization_members';
  end if;
end $$;


-- =============================================================================
-- 2) VÉRIFICATION — les colonnes live et backup doivent être identiques
-- =============================================================================
select 'tournaments'              as table, (select count(*) from public.tournaments)             as live, (select count(*) from backup_phase2.tournaments)             as backup
union all select 'players',                 (select count(*) from public.players),                (select count(*) from backup_phase2.players)
union all select 'tournament_players',      (select count(*) from public.tournament_players),     (select count(*) from backup_phase2.tournament_players)
union all select 'teams',                   (select count(*) from public.teams),                  (select count(*) from backup_phase2.teams)
union all select 'rounds',                  (select count(*) from public.rounds),                 (select count(*) from backup_phase2.rounds)
union all select 'matches',                 (select count(*) from public.matches),                (select count(*) from backup_phase2.matches)
union all select 'round_bye',               (select count(*) from public.round_bye),              (select count(*) from backup_phase2.round_bye)
union all select 'player_tournament_stats', (select count(*) from public.player_tournament_stats),(select count(*) from backup_phase2.player_tournament_stats)
union all select 'standings',               (select count(*) from public.standings),              (select count(*) from backup_phase2.standings);


-- =============================================================================
-- 3) RESTAURATION — À EXÉCUTER UNIQUEMENT EN CAS DE PÉPIN
-- =============================================================================
-- `session_replication_role = replica` désactive temporairement FK + triggers :
-- l'auto-référence de `matches` (winner_advances_to / loser_goes_to) et l'ordre
-- d'insertion ne posent alors aucun problème.
-- L'insertion est dynamique (colonnes du snapshot) → reste valide si la Phase 2
-- a seulement AJOUTÉ des colonnes (elles reprennent leur défaut).
-- Si la Phase 2 a supprimé/renommé une colonne, revenir d'abord en arrière sur
-- la migration concernée avant de restaurer.
-- -----------------------------------------------------------------------------
-- begin;
-- set local session_replication_role = replica;
--
-- truncate
--   public.standings,
--   public.player_tournament_stats,
--   public.round_bye,
--   public.matches,
--   public.rounds,
--   public.teams,
--   public.tournament_players,
--   public.players,
--   public.tournaments
--   cascade;
--
-- do $$
-- declare
--   tbl  text;
--   cols text;
--   tables text[] := array[
--     'tournaments','players','tournament_players','teams','rounds',
--     'matches','round_bye','player_tournament_stats','standings'
--   ];
-- begin
--   foreach tbl in array tables loop
--     select string_agg(quote_ident(column_name), ', ' order by ordinal_position)
--       into cols
--       from information_schema.columns
--      where table_schema = 'backup_phase2' and table_name = tbl;
--
--     execute format(
--       'insert into public.%I (%s) select %s from backup_phase2.%I',
--       tbl, cols, cols, tbl
--     );
--   end loop;
-- end $$;
--
-- commit;  -- set local → session_replication_role revient à default au commit


-- =============================================================================
-- 4) NETTOYAGE — quand la Phase 2 est validée et stable
-- =============================================================================
-- drop schema if exists backup_phase2 cascade;
