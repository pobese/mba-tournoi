-- Active le Realtime (publication supabase_realtime) sur les tables du mode rounds.
-- Classement live (player_tournament_stats) + liste d'attente live (round_bye).
-- Idempotent : n'ajoute la table que si elle n'est pas déjà publiée.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_tournament_stats'
  ) then
    alter publication supabase_realtime add table public.player_tournament_stats;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'round_bye'
  ) then
    alter publication supabase_realtime add table public.round_bye;
  end if;
end $$;
