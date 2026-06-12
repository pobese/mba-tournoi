# SKILL : UI Components & Design

Consulter ce fichier AVANT de créer tout composant visuel.

---

## Règle d'or : shadcn/ui d'abord

Avant de créer un composant custom, vérifier si shadcn/ui le propose :
```bash
npx shadcn@latest add button card dialog sheet table tabs badge
npx shadcn@latest add form input select textarea toast
npx shadcn@latest add dropdown-menu avatar separator skeleton
```

Ne créer un composant custom QUE si shadcn/ui ne couvre pas le besoin.

---

## Composants custom prioritaires pour ce projet

### `TournamentCard`
```typescript
// Affiche un tournoi dans une liste (dashboard)
interface TournamentCardProps {
  tournament: Pick<Tournament, 'id' | 'name' | 'type' | 'status' | 'created_at'>
  playerCount: number
  href: string
}
```
Visuels : badge coloré par type, badge status, chevron de navigation.

### `MatchCard`
```typescript
// Affiche un match avec scores saisables
interface MatchCardProps {
  match: MatchWithTeams
  editable: boolean         // false sur page publique
  onScoreUpdate?: (matchId: string, s1: number, s2: number) => void
  court?: string
}
```
Visuels : noms des joueurs des deux équipes, inputs scores (mode edit), 
badge court, highlight du gagnant en vert.

### `BracketView`
```typescript
// Arbre de tournoi visuel — SVG ou HTML flex
interface BracketViewProps {
  matches: BracketMatch[]
  onMatchClick?: (matchId: string) => void
}
```
Contrainte : responsive. Sur mobile → scroll horizontal. Sur desktop → centré.

### `StandingsTable`
```typescript
interface StandingsTableProps {
  standings: PlayerStanding[] | TeamStanding[]
  type: 'player' | 'team'    // pour adapter les colonnes
  animated?: boolean          // animations de re-rank
}
```
Colonnes : Rang | Nom | Pts marqués | Pts encaissés | +/- | Matchs | V/D

### `RoundProgress`
```typescript
// Indicateur visuel d'avancement du round en cours
interface RoundProgressProps {
  totalMatches: number
  completedMatches: number
  roundNumber: number
}
```

### `PlayerAvatar`
```typescript
// Avatar avec initiales + niveau (1-5 étoiles)
interface PlayerAvatarProps {
  name: string
  level: number
  size?: 'sm' | 'md' | 'lg'
}
```

---

## Conventions de layout

### Page authentifiée type
```
┌─────────────────────────────┐
│  Sidebar (desktop) /        │
│  Bottom nav (mobile)        │
├─────────────────────────────┤
│  Header avec titre + actions│
├─────────────────────────────┤
│                             │
│  Contenu principal          │
│  max-w-7xl mx-auto px-4     │
│                             │
└─────────────────────────────┘
```

### Dashboard tournoi (page principale)
```
┌─────────────┬───────────────┐
│  Rounds /   │  Classement   │
│  Matchs     │  live         │
│  (2/3)      │  (1/3)        │
│             │               │
└─────────────┴───────────────┘
Sur mobile : tabs (Matchs | Classement)
```

---

## Tailwind classes de référence (thème du projet)

```typescript
// Ne pas hardcoder les couleurs — utiliser ces classes Tailwind custom
// (à configurer dans tailwind.config.ts)

// Backgrounds
'bg-app'          // #0f1117
'bg-surface'      // #1a1d2e
'bg-surface-alt'  // #252840

// Borders
'border-subtle'   // #2e3150

// Text
'text-primary-green'   // #4ade80
'text-accent-yellow'   // #facc15
'text-muted'           // #94a3b8

// Exemples d'utilisation
<div className="bg-surface border border-subtle rounded-xl p-6">
  <h2 className="font-display text-2xl font-bold text-white">Titre</h2>
  <p className="text-muted text-sm">Sous-titre</p>
  <span className="text-primary-green font-mono tabular-nums">21</span>
</div>
```

---

## Animations & micro-interactions

```typescript
// Score update (Framer Motion)
// Animation légère quand un score change en realtime
const scoreVariants = {
  initial: { scale: 1 },
  updated: { scale: 1.2, color: '#facc15' },
  final: { scale: 1, color: '#f1f5f9' }
}

// Re-rank dans le classement
// Les lignes remontent/descendent avec une transition smooth
// Utiliser la lib 'react-flip-toolkit' ou Framer Motion layout animations

// Règle : pas d'animation si prefers-reduced-motion
// Toujours wrapper : 
const prefersReduced = useReducedMotion()  // framer-motion hook
```

---

## États de chargement

```typescript
// Pattern standard pour les data-fetching components
// 1. Skeleton (Suspense boundary)
// 2. Error boundary avec message clair
// 3. Empty state avec CTA

// Skeleton type pour une MatchCard
function MatchCardSkeleton() {
  return (
    <div className="bg-surface rounded-xl p-4 animate-pulse">
      <div className="h-4 bg-surface-alt rounded w-3/4 mb-3" />
      <div className="h-8 bg-surface-alt rounded w-full mb-2" />
      <div className="h-4 bg-surface-alt rounded w-1/2" />
    </div>
  )
}
```

---

## Toasts (feedback utilisateur)

```typescript
// Utiliser sonner (compatible shadcn/ui)
import { toast } from 'sonner'

// ✅ Score sauvegardé
toast.success('Score enregistré')

// ✅ Erreur
toast.error('Erreur lors de la sauvegarde', {
  description: error.message
})

// ✅ Action avec undo (utile pour correction de score)
toast.success('Score modifié', {
  action: {
    label: 'Annuler',
    onClick: () => handleUndo()
  }
})
```

---

## Accessibilité (minimum requis)

- Tous les boutons icon-only ont un `aria-label`
- Les inputs ont un `label` associé (via htmlFor ou aria-label)
- Le focus visible n'est jamais supprimé (outline-offset dans le thème Tailwind)
- Les couleurs ont un ratio de contraste ≥ 4.5:1 (vert `#4ade80` sur fond `#1a1d2e` = OK)
- Les scores sont des `<input type="number">` avec `min="0"` et `max="30"` (badminton)

---

## Mobile-first obligatoire

- Breakpoints utilisés : `sm` (640px), `md` (768px), `lg` (1024px)
- Navigation mobile : bottom nav bar (pas de sidebar)
- Saisie de scores : inputs larges (h-14 minimum), tap targets ≥ 44px
- Bracket visuel : scroll horizontal sur mobile (`overflow-x-auto`)
- Tableau standings : colonnes masquées sur mobile, garder rang / nom / points