-- ════════════════════════════════════════════════════════════════════════════
-- Mode ROUNDS — pause à la demande d'un joueur pour le prochain round
-- ════════════════════════════════════════════════════════════════════════════
-- pause_requested : si true, le joueur est forcé en liste d'attente lors de la
-- génération du prochain round (en plus des byes de capacité/parité). Le drapeau
-- est remis à false une fois le round généré → la pause ne vaut qu'un round.
alter table public.player_tournament_stats
  add column if not exists pause_requested boolean default false not null;
