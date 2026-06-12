-- ════════════════════════════════════════════════════════════════════════════
-- Mode CLASSIQUE — assignation dynamique terrain → poule (phase poules)
-- ════════════════════════════════════════════════════════════════════════════
-- Un terrain appartient à une seule poule à la fois (UNIQUE tournament_id +
-- court_number). Un terrain "libre" = absent de cette table pour le tournoi.
-- À la clôture d'une poule, ses lignes sont supprimées → terrains libérés.

create table if not exists public.pool_courts (
  id            uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade not null,
  pool_id       uuid references public.pools(id) on delete cascade not null,
  court_number  int2 not null,
  assigned_at   timestamptz default now() not null,
  unique (tournament_id, court_number)
);

create index if not exists pool_courts_tournament_id_idx on public.pool_courts (tournament_id);
create index if not exists pool_courts_pool_id_idx on public.pool_courts (pool_id);

alter table public.pool_courts enable row level security;

create policy "Lecture publique"
  on public.pool_courts for select using (true);

create policy "Gestion par le créateur du tournoi"
  on public.pool_courts for all
  using (
    auth.uid() = (
      select created_by from public.tournaments where id = pool_courts.tournament_id
    )
  );

-- ─── Realtime ─────────────────────────────────────────────────────────────────
-- Idempotent : n'ajoute la table que si elle n'est pas déjà publiée.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'pool_courts'
  ) then
    alter publication supabase_realtime add table public.pool_courts;
  end if;
end $$;
