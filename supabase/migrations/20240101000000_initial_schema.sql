-- Migration initiale — schéma complet de MBA Tournoi
-- Créé le 2024-01-01

-- Extension pour updated_at automatique
create extension if not exists moddatetime schema extensions;

-- ─── players ──────────────────────────────────────────────────────────────────
create table public.players (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid references auth.users(id) on delete cascade not null,
  name        text not null check (char_length(name) between 2 and 50),
  level       int2 default 3 check (level between 1 and 5),
  email       text,
  created_at  timestamptz default now() not null
);

create index on public.players (created_by);

alter table public.players enable row level security;

create policy "Lecture publique des joueurs"
  on public.players for select using (true);

create policy "CRUD par le créateur"
  on public.players for all
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

-- ─── tournaments ───────────────────────────────────────────────────────────────
create table public.tournaments (
  id          uuid primary key default gen_random_uuid(),
  slug        uuid default gen_random_uuid() not null unique,
  created_by  uuid references auth.users(id) on delete cascade not null,
  name        text not null check (char_length(name) between 3 and 80),
  type        text not null check (type in ('american', 'classic', 'rounds')),
  status      text not null default 'draft'
                check (status in ('draft', 'ongoing', 'finished')),
  config      jsonb not null default '{}',
  created_at  timestamptz default now() not null,
  started_at  timestamptz,
  finished_at timestamptz
);

create index on public.tournaments (created_by);
create index on public.tournaments (slug);

alter table public.tournaments enable row level security;

create policy "Lecture publique des tournois"
  on public.tournaments for select using (true);

create policy "Création par utilisateur connecté"
  on public.tournaments for insert
  with check (auth.uid() = created_by);

create policy "Modification par le créateur"
  on public.tournaments for update
  using (auth.uid() = created_by);

create policy "Suppression par le créateur"
  on public.tournaments for delete
  using (auth.uid() = created_by);

-- ─── tournament_players ────────────────────────────────────────────────────────
create table public.tournament_players (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  player_id     uuid references public.players(id) on delete restrict not null,
  seed          int2,
  is_active     boolean default true not null,
  unique (tournament_id, player_id)
);

create index on public.tournament_players (tournament_id);
create index on public.tournament_players (player_id);

alter table public.tournament_players enable row level security;

create policy "Lecture publique"
  on public.tournament_players for select using (true);

create policy "Gestion par le créateur du tournoi"
  on public.tournament_players for all
  using (
    auth.uid() = (
      select created_by from public.tournaments where id = tournament_players.tournament_id
    )
  );

-- ─── teams ────────────────────────────────────────────────────────────────────
create table public.teams (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  name          text,
  player1_id    uuid references public.players(id) on delete restrict not null,
  player2_id    uuid references public.players(id) on delete restrict,
  is_temporary  boolean default false not null  -- true pour équipes américain (round-specific)
);

create index on public.teams (tournament_id);

alter table public.teams enable row level security;

create policy "Lecture publique"
  on public.teams for select using (true);

create policy "Gestion par le créateur du tournoi"
  on public.teams for all
  using (
    auth.uid() = (
      select created_by from public.tournaments where id = teams.tournament_id
    )
  );

-- ─── rounds ───────────────────────────────────────────────────────────────────
create table public.rounds (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  round_number  int2 not null,
  status        text not null default 'pending'
                  check (status in ('pending', 'ongoing', 'finished')),
  created_at    timestamptz default now() not null,
  unique (tournament_id, round_number)
);

create index on public.rounds (tournament_id);

alter table public.rounds enable row level security;

create policy "Lecture publique"
  on public.rounds for select using (true);

create policy "Gestion par le créateur du tournoi"
  on public.rounds for all
  using (
    auth.uid() = (
      select created_by from public.tournaments where id = rounds.tournament_id
    )
  );

-- ─── matches ──────────────────────────────────────────────────────────────────
create table public.matches (
  id                 uuid primary key default gen_random_uuid(),
  round_id           uuid references public.rounds(id) on delete cascade not null,
  tournament_id      uuid references public.tournaments(id) on delete cascade not null,
  bracket            text default 'main' check (bracket in ('main', 'consolante')),
  position           int2,
  team1_id           uuid references public.teams(id) on delete restrict,
  team2_id           uuid references public.teams(id) on delete restrict,
  score_team1        int2 check (score_team1 >= 0),
  score_team2        int2 check (score_team2 >= 0),
  court              text,
  status             text not null default 'pending'
                       check (status in ('pending', 'ongoing', 'done', 'bye')),
  winner_team_id     uuid references public.teams(id),
  winner_advances_to uuid references public.matches(id),
  loser_goes_to      uuid references public.matches(id),
  created_at         timestamptz default now() not null,
  updated_at         timestamptz default now() not null
);

create index on public.matches (tournament_id);
create index on public.matches (round_id);

create trigger set_matches_updated_at
  before update on public.matches
  for each row execute function extensions.moddatetime(updated_at);

alter table public.matches enable row level security;

create policy "Lecture publique"
  on public.matches for select using (true);

create policy "Gestion par le créateur du tournoi"
  on public.matches for all
  using (
    auth.uid() = (
      select created_by from public.tournaments where id = matches.tournament_id
    )
  );

-- ─── standings ────────────────────────────────────────────────────────────────
create table public.standings (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid references public.tournaments(id) on delete cascade not null,
  player_id       uuid references public.players(id) on delete cascade,
  team_id         uuid references public.teams(id) on delete cascade,
  points_scored   int4 default 0 not null,
  points_conceded int4 default 0 not null,
  matches_played  int2 default 0 not null,
  wins            int2 default 0 not null,
  losses          int2 default 0 not null,
  rank            int2,
  updated_at      timestamptz default now() not null,
  check (player_id is not null or team_id is not null)
);

create unique index on public.standings (tournament_id, player_id)
  where player_id is not null;
create unique index on public.standings (tournament_id, team_id)
  where team_id is not null;

create trigger set_standings_updated_at
  before update on public.standings
  for each row execute function extensions.moddatetime(updated_at);

alter table public.standings enable row level security;

create policy "Lecture publique"
  on public.standings for select using (true);

create policy "Gestion par le créateur du tournoi"
  on public.standings for all
  using (
    auth.uid() = (
      select created_by from public.tournaments where id = standings.tournament_id
    )
  );

-- ─── Realtime : activer sur les tables live ────────────────────────────────────
-- À activer dans Supabase Dashboard → Table Editor → Enable Realtime
-- Tables concernées : matches, standings, rounds
