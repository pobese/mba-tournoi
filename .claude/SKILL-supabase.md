# SKILL : Supabase — Schéma et conventions

Consulter ce fichier AVANT d'écrire toute migration SQL ou query Supabase.

---

## Schéma complet

### `players`
```sql
create table players (
  id          uuid primary key default gen_random_uuid(),
  created_by  uuid references auth.users(id) on delete cascade not null,
  name        text not null check (char_length(name) between 2 and 50),
  level       int2 check (level between 1 and 5) default 3,
  email       text,
  created_at  timestamptz default now() not null
);
-- Index
create index on players (created_by);
```

### `tournaments`
```sql
create table tournaments (
  id          uuid primary key default gen_random_uuid(),
  slug        uuid default gen_random_uuid() not null unique, -- pour URL publique
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
create index on tournaments (created_by);
create index on tournaments (slug);
```

### `tournament_players`
```sql
create table tournament_players (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid references tournaments(id) on delete cascade not null,
  player_id      uuid references players(id) on delete restrict not null,
  seed           int2,  -- classement initial (tournoi rounds/classique)
  is_active      boolean default true,  -- false si abandon en cours
  unique (tournament_id, player_id)
);
create index on tournament_players (tournament_id);
```

### `teams`
```sql
-- Pour tournois classique et rounds (équipes fixes)
-- Pour tournoi américain : les teams sont créées à chaque round
create table teams (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid references tournaments(id) on delete cascade not null,
  name           text,  -- optionnel, généré automatiquement si null
  player1_id     uuid references players(id) on delete restrict not null,
  player2_id     uuid references players(id) on delete restrict,  -- null si simple
  is_temporary   boolean default false  -- true pour équipes américain (round-specific)
);
create index on teams (tournament_id);
```

### `rounds`
```sql
create table rounds (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid references tournaments(id) on delete cascade not null,
  round_number   int2 not null,
  status         text not null default 'pending' 
                   check (status in ('pending', 'ongoing', 'finished')),
  created_at     timestamptz default now() not null,
  unique (tournament_id, round_number)
);
create index on rounds (tournament_id);
```

### `matches`
```sql
create table matches (
  id            uuid primary key default gen_random_uuid(),
  round_id      uuid references rounds(id) on delete cascade not null,
  tournament_id uuid references tournaments(id) on delete cascade not null,
  bracket       text check (bracket in ('main', 'consolante')) default 'main',
  position      int2,  -- position visuelle dans le bracket
  team1_id      uuid references teams(id) on delete restrict,
  team2_id      uuid references teams(id) on delete restrict,
  score_team1   int2 check (score_team1 >= 0),
  score_team2   int2 check (score_team2 >= 0),
  court         text,  -- numéro/nom du court
  status        text not null default 'pending'
                  check (status in ('pending', 'ongoing', 'done', 'bye')),
  winner_team_id uuid references teams(id),
  -- Pour le bracket classique : navigation
  winner_advances_to uuid references matches(id),
  loser_goes_to      uuid references matches(id),
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);
create index on matches (tournament_id);
create index on matches (round_id);
-- Trigger pour updated_at
create trigger set_updated_at before update on matches
  for each row execute function moddatetime(updated_at);
```

### `standings`
```sql
-- Vue matérialisée recalculée après chaque match
-- OU table mise à jour via triggers (à choisir selon complexité)
create table standings (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid references tournaments(id) on delete cascade not null,
  -- soit player_id soit team_id selon le type de tournoi
  player_id       uuid references players(id) on delete cascade,
  team_id         uuid references teams(id) on delete cascade,
  points_scored   int4 default 0 not null,
  points_conceded int4 default 0 not null,
  matches_played  int2 default 0 not null,
  wins            int2 default 0 not null,
  losses          int2 default 0 not null,
  rank            int2,
  updated_at      timestamptz default now() not null,
  check (player_id is not null or team_id is not null)
);
create unique index on standings (tournament_id, player_id) where player_id is not null;
create unique index on standings (tournament_id, team_id) where team_id is not null;
```

---

## Row Level Security (RLS)

```sql
-- Politique générale : lecture publique sur tournois, 
-- modification uniquement par le créateur

-- tournaments
alter table tournaments enable row level security;
create policy "Lecture publique" on tournaments for select using (true);
create policy "Création par user connecté" on tournaments for insert 
  with check (auth.uid() = created_by);
create policy "Modification par créateur" on tournaments for update 
  using (auth.uid() = created_by);

-- players
alter table players enable row level security;
create policy "Lecture par tous" on players for select using (true);
create policy "CRUD par créateur" on players for all 
  using (auth.uid() = created_by);

-- matches (saisie de score)
alter table matches enable row level security;
create policy "Lecture publique" on matches for select using (true);
create policy "Modification par créateur du tournoi" on matches for update using (
  auth.uid() = (
    select created_by from tournaments where id = matches.tournament_id
  )
);
```

---

## Realtime

Activer Realtime sur ces tables dans Supabase Dashboard :
- `matches` (pour les scores en live)
- `standings` (pour le classement en live)
- `rounds` (pour détecter la fin d'un round)

```typescript
// Pattern d'abonnement dans un Client Component
useEffect(() => {
  const channel = supabase
    .channel(`tournament:${tournamentId}:matches`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'matches',
      filter: `tournament_id=eq.${tournamentId}`
    }, (payload) => {
      // Mettre à jour le state local
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [tournamentId])
```

---

## Patterns de queries courants

```typescript
// ✅ Récupérer un tournoi avec ses joueurs et matchs du round actif
const { data, error } = await supabase
  .from('tournaments')
  .select(`
    *,
    tournament_players (
      player:players (id, name, level)
    ),
    rounds (
      *,
      matches (
        *,
        team1:teams!matches_team1_id_fkey (
          player1:players!teams_player1_id_fkey (id, name),
          player2:players!teams_player2_id_fkey (id, name)
        ),
        team2:teams!matches_team2_id_fkey (
          player1:players!teams_player1_id_fkey (id, name),
          player2:players!teams_player2_id_fkey (id, name)
        )
      )
    )
  `)
  .eq('id', tournamentId)
  .single()

// Toujours gérer l'erreur
if (error) throw new Error(`Failed to fetch tournament: ${error.message}`)
```

---

## Server Actions pattern

```typescript
// src/app/(app)/tournaments/[id]/actions.ts
'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { UpdateScoreSchema } from '@/lib/validations/schemas'

export async function updateMatchScore(input: unknown) {
  // 1. Valider l'input
  const parsed = UpdateScoreSchema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }
  
  // 2. Vérifier l'auth
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autorisé' }

  // 3. Vérifier les permissions métier
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('created_by')
    .eq('id', parsed.data.tournament_id)
    .single()
  
  if (tournament?.created_by !== user.id) {
    return { error: 'Permission refusée' }
  }

  // 4. Effectuer l'action
  const { error } = await supabase
    .from('matches')
    .update({ 
      score_team1: parsed.data.score_team1,
      score_team2: parsed.data.score_team2,
      status: 'done',
      winner_team_id: parsed.data.winner_team_id
    })
    .eq('id', parsed.data.match_id)

  if (error) return { error: error.message }

  // 5. Revalider le cache
  revalidatePath(`/tournaments/${parsed.data.tournament_id}`)
  return { success: true }
}
```