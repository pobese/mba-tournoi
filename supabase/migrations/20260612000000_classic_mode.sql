-- ════════════════════════════════════════════════════════════════════════════
-- Mode CLASSIQUE (tournoi de club) — Phase poules + tableau éliminatoire
-- ════════════════════════════════════════════════════════════════════════════

-- ─── pools : poules de la phase 1 ─────────────────────────────────────────────
create table public.pools (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  name          text not null,        -- "Poule A", "Poule B"...
  position      int2 not null,        -- ordre d'affichage (1, 2, 3...)
  status        text not null default 'ongoing'
                  check (status in ('ongoing', 'finished')),
  created_at    timestamptz default now() not null
);

create index on public.pools (tournament_id);
alter table public.pools enable row level security;

create policy "Lecture publique"
  on public.pools for select using (true);

create policy "Gestion par le créateur du tournoi"
  on public.pools for all
  using (
    auth.uid() = (
      select created_by from public.tournaments where id = pools.tournament_id
    )
  );

-- ─── teams : rattachement à une poule ─────────────────────────────────────────
alter table public.teams add column if not exists pool_id
  uuid references public.pools(id) on delete set null;

-- ─── matches : colonnes spécifiques au classique ──────────────────────────────
-- phase : distingue poule / barrage / tableau principal / consolante.
alter table public.matches add column if not exists phase text default 'pool'
  check (phase in ('pool', 'barrage', 'bracket_main', 'bracket_consolante'));
alter table public.matches add column if not exists pool_id
  uuid references public.pools(id) on delete set null;
-- court_number : déjà ajouté par la migration rounds → no-op si présent.
alter table public.matches add column if not exists court_number int2;
-- Scores détaillés par set (classique : colonnes discrètes plutôt que jsonb).
alter table public.matches add column if not exists set1_team1 int2;
alter table public.matches add column if not exists set1_team2 int2;
alter table public.matches add column if not exists set2_team1 int2;
alter table public.matches add column if not exists set2_team2 int2;
alter table public.matches add column if not exists set3_team1 int2;
alter table public.matches add column if not exists set3_team2 int2;
-- bracket_position : position dans le tableau (numérotée depuis la finale).
alter table public.matches add column if not exists bracket_position int2;

-- round_id : rendu NULLABLE — les matchs de poule et de tableau du mode
-- classique n'appartiennent à aucun round (les rounds sont propres aux modes
-- américain / rounds). Sans cela, les INSERT du classique échoueraient.
alter table public.matches alter column round_id drop not null;

-- ─── tournaments : phase courante du classique ────────────────────────────────
alter table public.tournaments add column if not exists current_phase text
  default 'pool' check (current_phase in ('pool', 'bracket'));

-- ─── pool_standings : classement par poule (dénormalisé, live) ────────────────
create table public.pool_standings (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid references public.tournaments(id) on delete cascade not null,
  pool_id         uuid references public.pools(id) on delete cascade not null,
  team_id         uuid references public.teams(id) on delete cascade not null,
  wins            int2 default 0 not null,
  losses          int2 default 0 not null,
  sets_won        int2 default 0 not null,
  sets_lost       int2 default 0 not null,
  points_for      int4 default 0 not null,
  points_against  int4 default 0 not null,
  matches_played  int2 default 0 not null,
  rank_in_pool    int2,
  global_rank     int2,
  unique (pool_id, team_id)
);

create index on public.pool_standings (tournament_id);
create index on public.pool_standings (pool_id);
alter table public.pool_standings enable row level security;

create policy "Lecture publique"
  on public.pool_standings for select using (true);

create policy "Gestion par le créateur du tournoi"
  on public.pool_standings for all
  using (
    auth.uid() = (
      select created_by from public.tournaments where id = pool_standings.tournament_id
    )
  );

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Classement de poule live + statut des poules + scores des matchs (tableau).
-- Idempotent : n'ajoute la table que si elle n'est pas déjà publiée.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pool_standings'
  ) then
    alter publication supabase_realtime add table public.pool_standings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pools'
  ) then
    alter publication supabase_realtime add table public.pools;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'matches'
  ) then
    alter publication supabase_realtime add table public.matches;
  end if;
end $$;
