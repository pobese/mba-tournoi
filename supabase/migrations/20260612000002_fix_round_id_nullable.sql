-- ════════════════════════════════════════════════════════════════════════════
-- FIX — matches.round_id doit être NULLABLE (rattrapage cloud)
-- ════════════════════════════════════════════════════════════════════════════
-- La migration 20260612000000_classic_mode.sql contient déjà ce DROP NOT NULL,
-- mais la version appliquée dans le SQL Editor cloud était antérieure à son
-- ajout : les INSERT des matchs de poule (sans round_id) étaient rejetés en
-- silence → poules créées avec classements mais 0 match.
-- Idempotent : DROP NOT NULL sur une colonne déjà nullable est un no-op.

alter table public.matches alter column round_id drop not null;
