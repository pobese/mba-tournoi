-- ════════════════════════════════════════════════════════════════════════════
-- Archivage d'un tournoi terminé sous forme statique ("forme brute")
-- ════════════════════════════════════════════════════════════════════════════
-- results_snapshot : copie figée des résultats finaux (classement + vainqueurs),
-- avec les noms dénormalisés en texte. Une fois rempli, les données relationnelles
-- vives du tournoi (matchs, équipes, poules, inscriptions…) peuvent être purgées
-- sans casser l'affichage — ce qui permet de supprimer un joueur de l'historique.
-- NULL = tournoi vivant (rendu normal) ; non-NULL = tournoi archivé (rendu statique).
alter table public.tournaments add column if not exists results_snapshot jsonb;
