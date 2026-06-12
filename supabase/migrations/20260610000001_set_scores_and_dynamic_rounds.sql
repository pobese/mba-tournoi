-- set_scores : stocke les scores par set pour le mode best-of-3
-- [[t1_s1, t2_s1], [t1_s2, t2_s2], [t1_s3, t2_s3]]
-- score_team1 / score_team2 restent les TOTAUX de points (pour le goal average)
ALTER TABLE matches ADD COLUMN IF NOT EXISTS set_scores jsonb;

-- Index pour les requêtes de reset (optionnel, améliore perf sur gros tournois)
CREATE INDEX IF NOT EXISTS idx_matches_tournament_status ON matches (tournament_id, status);
