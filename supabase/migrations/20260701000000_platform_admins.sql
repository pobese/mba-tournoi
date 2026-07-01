-- ============================================================================
-- Admins plateforme (fondateur / staff RacketClub).
-- Table minimaliste, protégée : accessible uniquement via service_role.
-- NB (prod) : à appliquer manuellement dans le SQL Editor — ce fichier documente
-- le schéma pour le repo, il n'est pas rejoué automatiquement.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  added_at timestamptz DEFAULT now() NOT NULL,
  note     text -- ex: "Fondateur - lefrancoisleo31@gmail.com"
);

-- RLS : aucun accès client direct (lecture/écriture via service_role uniquement).
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role only" ON public.platform_admins;
CREATE POLICY "Service role only"
  ON public.platform_admins
  USING (false);

-- Compte fondateur.
INSERT INTO public.platform_admins (user_id, note)
SELECT id, 'Fondateur RacketClub'
FROM auth.users
WHERE email = 'lefrancoisleo31@gmail.com'
ON CONFLICT (user_id) DO NOTHING;
