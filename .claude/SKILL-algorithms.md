# SKILL : Algorithmes de scheduling de tournois

Ce fichier documente les 3 algorithmes de génération de matchs.
Consulter ce fichier AVANT d'écrire ou modifier du code dans `/lib/algorithms/`.

---

## 1. Tournoi Américain (`american-scheduler.ts`)

### Principe
Chaque round, les joueurs sont redistribués en équipes de 2.
**Contrainte principale** : un joueur ne doit pas rejouer avec ou contre
le même partenaire s'il existe une combinaison qui l'évite.

### Structure de données interne

```typescript
// Graphe des paires déjà jouées ensemble
type PairingHistory = Map<string, Set<string>>
// key: player_id, value: Set des player_ids déjà partenaires

// Graphe des adversaires déjà rencontrés
type OpponentHistory = Map<string, Set<string>>
```

### Algorithme (round par round)

```
1. Récupérer la liste des joueurs disponibles pour ce round
2. Si nombre impair → identifier le joueur "exempt" par rotation
   (le dernier exempt ou le moins exempt jusqu'ici)
3. Générer toutes les combinaisons de paires possibles
4. Scorer chaque combinaison : pénalité si paire déjà jouée ensemble
5. Trouver l'assignment optimal par matching hongrois simplifié
   (ou greedy si nb joueurs < 12 pour simplifier)
6. Générer les matchs : paire A vs paire B
   → les paires avec scores les plus proches s'affrontent
```

### Scoring final (classement individuel)

```typescript
// Points marqués = points cumulés sur tous les matchs de tous les rounds
// PAS basé sur victoires/défaites des matchs
// Ex: match 15-11 → joueurs de l'équipe 1 : +15 pts, équipe 2 : +11 pts
interface PlayerStanding {
  player_id: string
  total_points_scored: number    // Points marqués (offensif)
  total_points_conceded: number  // Points encaissés
  point_difference: number       // Calculé : scored - conceded
  matches_played: number
  wins: number
  rank: number
}
```

### Edge cases à gérer
- Nombre impair de joueurs → rotation bye
- 4 joueurs seulement → impossible d'éviter toutes les répétitions après round 2
- Joueur qui abandonne en cours de tournoi → marquer absent pour les rounds suivants

---

## 2. Tournoi Classique — Bracket (`classic-bracket.ts`)

### Principe
Élimination directe avec tableau principal + consolante pour les premiers éliminés.

### Génération du bracket

```
1. Récupérer le nombre d'équipes N
2. Calculer la prochaine puissance de 2 ≥ N → taille du bracket
3. Générer les "byes" (exemptions) pour compléter
   → Les meilleures seeds reçoivent les byes
4. Positionner les équipes dans le bracket en alternant seeds
   (1 vs N, 2 vs N-1, etc. dans les 8ièmes de finale)
5. Créer les matchs du round 1 (certains sont des byes automatiques)
```

### Structure bracket

```typescript
interface BracketMatch {
  id: string
  round: number              // 1 = finale, 2 = demis, 3 = quarts...
  position: number           // Position dans le bracket visuel
  bracket: 'main' | 'consolante'
  team1_id: string | null    // null si pas encore qualifié
  team2_id: string | null
  winner_advances_to: string | null   // match_id de destination du gagnant
  loser_goes_to: string | null        // match_id consolante du perdant
}
```

### Règle consolante
- Les équipes éliminées au **round 1 principal** entrent en consolante round 1
- Les équipes éliminées au **round 2 principal** entrent en consolante à partir du round 2
- Match pour la 3ème place : gagnant consolante vs perdant finale principale

### Avancement automatique
Quand un score est saisi et validé :
```
1. Identifier le gagnant et le perdant
2. Placer le gagnant dans le match suivant (winner_advances_to)
3. Si loser_goes_to existe → placer le perdant en consolante
4. Si les deux équipes du match suivant sont connues → changer status en 'ready'
```

---

## 3. Tournoi par Rounds — Système Serpent (`rounds-scheduler.ts`)

### Principe
Tournoi en N rounds. Après chaque round, les joueurs/équipes sont reclassés
selon leur score cumulatif. Au round suivant, le système "serpent" associe
le meilleur avec le moins bon pour équilibrer les matchs.

### Classement inter-rounds

```typescript
// Après chaque round, calculer le score cumulatif
interface RoundStanding {
  entity_id: string          // player_id ou team_id selon config
  cumulative_score: number   // Points marqués en tout
  rounds_played: number
  rank: number               // 1 = meilleur
}
```

### Algorithme serpent (génération du round suivant)

```
Exemple avec 8 équipes classées [1,2,3,4,5,6,7,8] :

Sens "aller"  : 1 joue avec 8, 2 joue avec 7
Sens "retour" : 3 joue avec 6, 4 joue avec 5

→ Équipes formées : (1+8), (2+7), (3+6), (4+5)
→ Ces 4 équipes se confrontent : (1+8) vs (2+7), (3+6) vs (4+5)

Pour le round d'après, si le classement a changé → recalculer
```

### Configuration

```typescript
interface RoundsConfig {
  num_rounds: number              // Nombre total de rounds (ex: 4)
  matches_per_round: number       // Matchs simultanés par round (ex: 3)
  points_per_win: number          // Points bonus victoire (ex: 0 ou 1)
  snake_direction: 'score' | 'seed'  // Basé sur score ou seed initial
  courts_available: number        // Pour validation logistique
}
```

### Edge cases
- Si `2 × matches_per_round > nb équipes` → réduire automatiquement
- Égalité parfaite au classement → départager par points marqués, puis confrontation directe
- Round non terminé → bloquer la génération du round suivant (tous matchs doivent avoir un score)

---

## Tests attendus pour chaque algorithme

```typescript
// american-scheduler.test.ts
describe('american scheduler', () => {
  it('génère le bon nombre de matchs par round')
  it('évite les répétitions de paires quand possible')
  it('gère un nombre impair de joueurs')
  it('calcule le classement final correctement')
})

// classic-bracket.test.ts
describe('classic bracket', () => {
  it('génère un bracket valide pour 8 équipes')
  it('génère un bracket valide pour 6 équipes (avec byes)')
  it('place les perdants en consolante correctement')
  it('identifie le match pour la 3ème place')
})

// rounds-scheduler.test.ts
describe('rounds scheduler', () => {
  it('applique le système serpent correctement')
  it('reclasse après chaque round')
  it('gère les égalités de classement')
})
```