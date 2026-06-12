-- Migration : tables et colonnes pour le mode "rounds"
-- Créé le 2026-06-10

-- ─── round_bye : joueurs en liste d'attente par round ─────────────────────────
create table public.round_bye (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid references public.rounds(id) on delete cascade not null,
  player_id     uuid references public.players(id) on delete cascade not null,
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  unique (round_id, player_id)
);

create index on public.round_bye (tournament_id);
create index on public.round_bye (round_id);

alter table public.round_bye enable row level security;

create policy "Lecture publique"
  on public.round_bye for select using (true);

create policy "Gestion par le créateur du tournoi"
  on public.round_bye for all
  using (
    auth.uid() = (
      select created_by from public.tournaments where id = round_bye.tournament_id
    )
  );

-- ─── player_tournament_stats : stats cumulatives par joueur par tournoi ───────
-- Dénormalisé pour la perf et le Realtime (classement live).
create table public.player_tournament_stats (
  id                 uuid primary key default gen_random_uuid(),
  tournament_id      uuid references public.tournaments(id) on delete cascade not null,
  player_id          uuid references public.players(id) on delete cascade not null,
  total_wins         int2 default 0 not null,
  total_points_for   int2 default 0 not null,
  total_points_against int2 default 0 not null,
  rounds_played      int2 default 0 not null,
  consecutive_played int2 default 0 not null,
  total_waited       int2 default 0 not null,
  last_waited_round  int2,
  current_rank       int2,
  unique (tournament_id, player_id)
);

create index on public.player_tournament_stats (tournament_id);

alter table public.player_tournament_stats enable row level security;

create policy "Lecture publique"
  on public.player_tournament_stats for select using (true);

create policy "Gestion par le créateur du tournoi"
  on public.player_tournament_stats for all
  using (
    auth.uid() = (
      select created_by from public.tournaments where id = player_tournament_stats.tournament_id
    )
  );

-- ─── matches : colonnes vague et terrain ──────────────────────────────────────
-- wave : numéro de la vague dans un round (quand matchs > terrains disponibles)
-- court_number : terrain assigné (1-9)
alter table public.matches add column wave int2 default 1 not null;
alter table public.matches add column court_number int2;

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- À activer dans Supabase Dashboard → Table Editor → Enable Realtime :
--   player_tournament_stats  (classement live)
--   round_bye                (liste d'attente live)
