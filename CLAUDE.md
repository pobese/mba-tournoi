# CLAUDE.md — mba.stellix.fr (Badminton Tournament App)

> Lis ce fichier ENTIÈREMENT avant toute action.
> Ne fais JAMAIS d'hypothèses sur la stack, les conventions ou l'architecture.
> Tout est documenté ici et dans `.claude/SKILL-*.md`.

---

## 🎯 Contexte du projet

Application web de gestion de tournois de badminton, déployée sur `mba.stellix.fr`.
Side-project personnel, développé en solo par un ingénieur francophone.

**Objectif** : code ultra-clean, maintenable, lisible 6 mois plus tard, déployable en 5 min.

---

## 📚 Skills disponibles — CONSULTER AVANT D'AGIR

| Avant de faire…                         | Lire ce fichier                        |
|----------------------------------------|----------------------------------------|
| Algo de scheduling ou calcul de matchs | `.claude/SKILL-algorithms.md`          |
| Query Supabase, migration SQL, RLS      | `.claude/SKILL-supabase.md`            |
| Créer un composant UI                   | `.claude/SKILL-ui-components.md`       |
| Server Action, data fetching, hooks     | `.claude/SKILL-data-patterns.md`       |
| Déploiement, DNS, CI/CD, env vars       | `.claude/SKILL-deployment.md`          |

---

## 🏗️ Stack technique (NON NÉGOCIABLE)

| Couche        | Techno                        | Notes                                      |
|---------------|-------------------------------|--------------------------------------------|
| Framework     | Next.js 14 — App Router       | Jamais Pages Router                        |
| Langage       | TypeScript strict             | `noImplicitAny`, `strictNullChecks` ON     |
| Style         | Tailwind CSS 3.x              | Classes custom dans `tailwind.config.ts`   |
| Composants    | shadcn/ui                     | Vérifier dispo avant de créer custom       |
| Base de données | Supabase (PostgreSQL)       | Via `@supabase/ssr`                        |
| Auth          | Supabase Auth                 | Middleware Next.js                         |
| Icons         | Lucide React                  | Pas d'autres libs d'icons                  |
| Animations    | Framer Motion                 | Uniquement si nécessaire, pas de surcharge |
| Formulaires   | React Hook Form + Zod         | Pour toute saisie utilisateur              |
| State global  | Zustand                       | Tournoi en cours, user session             |
| Tests         | Vitest + Testing Library      | Algorithmes de scheduling uniquement       |
| Toasts        | Sonner                        | Compatible shadcn/ui                       |

**Jamais** : Redux, class components, `any` TypeScript, CSS modules (sauf exception justifiée), jQuery, Axios (fetch natif suffit).

---

## 📁 Structure des fichiers (RESPECTER STRICTEMENT)

```
src/
├── app/
│   ├── (auth)/                     # Route group — pages non protégées
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (app)/                      # Route group — pages protégées (middleware)
│   │   ├── layout.tsx              # Layout avec sidebar/nav
│   │   ├── dashboard/page.tsx
│   │   ├── players/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts          # Server Actions CRUD joueurs
│   │   └── tournaments/
│   │       ├── page.tsx
│   │       ├── new/page.tsx        # Wizard création
│   │       └── [id]/
│   │           ├── page.tsx        # Dashboard tournoi live
│   │           ├── bracket/page.tsx
│   │           ├── scores/page.tsx # Saisie mobile-optimisée
│   │           ├── standings/page.tsx
│   │           └── actions.ts      # Server Actions tournoi
│   ├── t/[slug]/page.tsx           # Page publique read-only
│   ├── layout.tsx                  # Root layout (fonts, providers)
│   ├── page.tsx                    # Landing
│   └── globals.css
├── components/
│   ├── ui/                         # shadcn/ui — NE JAMAIS MODIFIER
│   ├── tournament/                 # Composants métier tournoi
│   │   ├── TournamentCard.tsx
│   │   ├── MatchCard.tsx
│   │   ├── BracketView.tsx
│   │   ├── StandingsTable.tsx
│   │   └── RoundProgress.tsx
│   ├── players/
│   │   ├── PlayerAvatar.tsx
│   │   └── PlayerList.tsx
│   └── shared/
│       ├── PageHeader.tsx
│       ├── EmptyState.tsx
│       └── LoadingSpinner.tsx
├── lib/
│   ├── supabase/
│   │   ├── client.ts               # createBrowserClient
│   │   ├── server.ts               # createServerClient
│   │   └── middleware.ts           # updateSession
│   ├── algorithms/
│   │   ├── american-scheduler.ts
│   │   ├── american-scheduler.test.ts
│   │   ├── classic-bracket.ts
│   │   ├── classic-bracket.test.ts
│   │   ├── rounds-scheduler.ts
│   │   └── rounds-scheduler.test.ts
│   ├── validations/
│   │   └── schemas.ts              # TOUS les schemas Zod centralisés ici
│   ├── constants.ts                # Magic strings → constantes nommées
│   └── utils.ts                    # cn(), formatDate(), etc.
├── hooks/
│   ├── useRealtime.ts              # Subscription Supabase Realtime
│   └── useTournament.ts            # State tournoi (Zustand)
├── stores/
│   └── tournament-store.ts         # Zustand store
├── types/
│   ├── database.ts                 # Généré par `supabase gen types` — NE PAS ÉDITER
│   └── app.ts                      # Types métier (Player, Tournament, Match, etc.)
└── supabase/
    └── migrations/                 # SQL versionnés — JAMAIS de modif via Studio
```

---

## 🧠 Conventions TypeScript (OBLIGATOIRES)

```typescript
// ✅ Toujours typer les retours de fonction
async function getPlayers(): Promise<Player[]> { ... }

// ✅ Types Supabase générés pour les queries
import type { Database } from '@/types/database'
type Player = Database['public']['Tables']['players']['Row']
type PlayerInsert = Database['public']['Tables']['players']['Insert']

// ✅ Zod + infer pour les formulaires
const CreatePlayerSchema = z.object({
  name: z.string().min(2).max(50),
  level: z.number().int().min(1).max(5),
})
type CreatePlayerInput = z.infer<typeof CreatePlayerSchema>

// ✅ Types union pour les états métier (dans types/app.ts)
type TournamentType = 'american' | 'classic' | 'rounds'
type TournamentStatus = 'draft' | 'ongoing' | 'finished'
type MatchStatus = 'pending' | 'ongoing' | 'done'

// ❌ Jamais de `any`
// ❌ Jamais de `as` cast sauf justification en commentaire
// ❌ Jamais de `!` non-null assertion sans commentaire // safe because...
// ❌ Jamais de types inline complexes dans les props — utiliser interface nommée
```

---

## 🎨 Design System (MODE SOMBRE UNIQUEMENT)

### Palette
```
bg-app          → #0f1117   Fond principal
bg-surface      → #1a1d2e   Cards, panels
bg-surface-alt  → #252840   Inputs, hover states
border-subtle   → #2e3150   Bordures
primary         → #4ade80   Vert badminton (accent principal)
primary-dim     → #166534   Vert foncé (bg accent)
accent          → #facc15   Jaune volant (scores, highlights)
text            → #f1f5f9   Texte principal
text-muted      → #94a3b8   Texte secondaire
danger          → #f87171   Erreurs
```

### Typographie
- **Display** : `Barlow Condensed` (Bold / ExtraBold) — titres, scores
- **Body** : `Inter` — tout le reste
- **Mono / Scores** : `JetBrains Mono` — tabular-nums obligatoire pour les chiffres

### Règles visuelles
- Radius : `rounded-xl` cards · `rounded-lg` boutons · `rounded-md` inputs
- Espacement : multiples de 4px (Tailwind standard)
- Shadow : `shadow-lg` teinté surface (pas de shadow noir pur)
- Boutons primaires : toujours un état `loading` avec spinner inline
- Erreurs : via `toast.error()` de sonner — jamais `alert()`

---

## 📐 Règles d'architecture

### Responsabilités strictes

```
Server Component (async)    → fetch data, passe props au client
Server Action (actions.ts)  → mutation DB, validation Zod, revalidatePath
Client Component ('use client') → interactivité, formulaires, realtime
Hook custom (hooks/)        → logique réutilisable, subscriptions
Algorithme (lib/algorithms) → pur, sans side effects, testé
Store Zustand (stores/)     → état global cross-composants
```

### Règle des 200 lignes
Un fichier > 200 lignes = signal fort à découper.
Exception : les fichiers de migration SQL et les schemas Zod complexes.

### Commentaires
Commenter UNIQUEMENT :
- Les algorithmes non-triviaux (avec référence à l'approche choisie)
- Les workarounds avec un lien vers l'issue ou la raison
- Les `as` cast et `!` assertions avec justification

Ne jamais commenter ce qui est évident depuis le code.

### Constantes métier
Tout string/number répété → dans `src/lib/constants.ts`
```typescript
export const TOURNAMENT_TYPES = {
  AMERICAN: 'american',
  CLASSIC: 'classic',
  ROUNDS: 'rounds',
} as const

export const MAX_BADMINTON_SCORE = 30
export const STANDARD_WIN_SCORE = 21
```

---

## 🚀 Commandes du projet

```bash
# Développement
npm run dev                                           # Next.js + Turbopack
npx supabase start                                    # Supabase local (Docker requis)

# Base de données
npx supabase db diff --schema public -f <nom>         # Nouvelle migration depuis les changements
npx supabase migration new <nom>                      # Migration vide à remplir manuellement
npx supabase db push                                  # Push vers Supabase cloud
npx supabase gen types typescript --local > src/types/database.ts

# Composants UI
npx shadcn@latest add <composant>                     # Ajouter un composant shadcn

# Tests
npm run test                                          # Vitest
npm run test:ui                                       # Vitest avec interface

# Qualité
npm run lint                                          # ESLint
npm run format                                        # Prettier
npm run type-check                                    # tsc --noEmit
```

---

## 🔒 Sécurité (NON NÉGOCIABLE)

1. **Toute Server Action** valide l'input avec Zod AVANT d'appeler Supabase
2. **Toute Server Action** vérifie l'utilisateur avec `getUser()` (jamais `getSession()` seul côté serveur)
3. **RLS activé** sur toutes les tables — la `service_role_key` n'est utilisée QUE dans les Server Actions pour contourner le RLS intentionnellement
4. **`SUPABASE_SERVICE_ROLE_KEY`** jamais dans une variable `NEXT_PUBLIC_`
5. **Slugs publics** de tournoi = UUID v4 — pas d'IDs séquentiels dans les URLs
6. **Pas de `dangerouslySetInnerHTML`** sauf contenu entièrement contrôlé et sanitisé

---

## 🐛 Debugging rapide

| Problème                            | Solution                                                    |
|-------------------------------------|-------------------------------------------------------------|
| Erreur Supabase vague               | Logger `error.code` + `error.message` + `error.details`    |
| Types DB incorrects                 | `supabase gen types typescript --local > src/types/database.ts` |
| Auth cassée / cookies               | Vérifier `src/middleware.ts` et `updateSession()`           |
| Realtime ne se connecte pas         | Vérifier que la table a Realtime activé dans Supabase Dashboard → Table Editor → Enable Realtime |
| Build Vercel qui échoue             | `npm run type-check` en local d'abord                       |
| RLS qui bloque                      | Tester la policy dans Supabase Studio → SQL Editor avec `set role authenticated; set local request.jwt.claim.sub = '...';` |

---

## 📦 Variables d'environnement

```env
# .env.local — JAMAIS commité
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # Server only — jamais NEXT_PUBLIC_
NEXT_PUBLIC_APP_URL=https://mba.stellix.fr
```

`.env.example` toujours à jour avec les clés (sans valeurs) — commité dans le repo.