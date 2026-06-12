-- ════════════════════════════════════════════════════════════════════════════
-- Membres de l'organisation — partage des tournois entre comptes
-- ════════════════════════════════════════════════════════════════════════════
-- Le créateur d'un compte (owner) invite des membres qui partagent ses tournois.
--   admin  → tout, y compris CRÉER des tournois (created_by = owner)
--   editor → tout sur les tournois EXISTANTS, mais pas de création
-- L'owner garde la suppression de tournois et la gestion des membres.

-- ─── organization_members ─────────────────────────────────────────────────────
create table if not exists public.organization_members (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid references auth.users(id) on delete cascade not null,
  member_id    uuid references auth.users(id) on delete cascade not null,
  member_email text not null,
  role         text not null default 'editor' check (role in ('admin', 'editor')),
  invited_at   timestamptz default now() not null,
  accepted_at  timestamptz,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  unique (owner_id, member_email)
);

create index if not exists organization_members_owner_id_idx on public.organization_members (owner_id);
create index if not exists organization_members_member_id_idx on public.organization_members (member_id);

alter table public.organization_members enable row level security;

-- Le owner voit et gère ses membres (SELECT/INSERT/UPDATE/DELETE).
drop policy if exists "Owner gère ses membres" on public.organization_members;
create policy "Owner gère ses membres"
  on public.organization_members for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Le membre voit sa propre invitation (lecture seule ; accept/decline passent par
-- le service role dans les Server Actions pour ne pas lui ouvrir l'écriture du rôle).
drop policy if exists "Membre voit son invitation" on public.organization_members;
create policy "Membre voit son invitation"
  on public.organization_members for select
  using (auth.uid() = member_id);

-- ─── Helpers SQL (SECURITY DEFINER : contournent la RLS de organization_members,
--     auth.uid() reste celui de l'appelant) ──────────────────────────────────────
create or replace function public.is_org_member(owner_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where owner_id = owner_uuid
      and member_id = auth.uid()
      and status = 'accepted'
  );
$$;

create or replace function public.is_org_admin(owner_uuid uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.organization_members
    where owner_id = owner_uuid
      and member_id = auth.uid()
      and status = 'accepted'
      and role = 'admin'
  );
$$;

-- ─── tournaments : autoriser les membres ──────────────────────────────────────
-- UPDATE : owner OU membre accepté (admin et editor peuvent éditer/clôturer/lancer).
drop policy if exists "Modification par le créateur" on public.tournaments;
drop policy if exists "Modification par le créateur ou membre" on public.tournaments;
create policy "Modification par le créateur ou membre"
  on public.tournaments for update
  using (auth.uid() = created_by or public.is_org_member(created_by));

-- INSERT : owner (pour lui-même) OU admin (pour l'organisation → created_by = owner).
drop policy if exists "Création par utilisateur connecté" on public.tournaments;
drop policy if exists "Création par le créateur ou admin" on public.tournaments;
create policy "Création par le créateur ou admin"
  on public.tournaments for insert
  with check (auth.uid() = created_by or public.is_org_admin(created_by));

-- DELETE reste réservé au créateur ("Suppression par le créateur") — inchangé.

-- ─── Sous-tables : remplacer la policy FOR ALL par owner OU membre ────────────
-- Même motif partout : created_by récupéré via jointure sur tournaments.
do $migrate$
declare
  tbl text;
  tables text[] := array[
    'tournament_players', 'teams', 'rounds', 'matches', 'standings',
    'round_bye', 'player_tournament_stats', 'pools', 'pool_standings', 'pool_courts'
  ];
begin
  foreach tbl in array tables loop
    execute format('drop policy if exists "Gestion par le créateur du tournoi" on public.%I', tbl);
    execute format('drop policy if exists "Gestion par le créateur ou membre" on public.%I', tbl);
    execute format(
      'create policy "Gestion par le créateur ou membre" on public.%I for all '
      'using ('
      '  auth.uid() = (select created_by from public.tournaments where id = %I.tournament_id) '
      '  or public.is_org_member((select created_by from public.tournaments where id = %I.tournament_id))'
      ')',
      tbl, tbl, tbl
    );
  end loop;
end $migrate$;

-- ─── Realtime sur organization_members (bannière d'invitation live) ───────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'organization_members'
  ) then
    alter publication supabase_realtime add table public.organization_members;
  end if;
end $$;
