-- =============================================================================
-- PHASE 2 — Clubs (clubs / club_members / club_invitations + RLS + backfill)
-- =============================================================================
-- ✅ DÉJÀ APPLIQUÉ EN PROD (SQL Editor). Ce fichier est la transcription EXACTE
--    du SQL exécuté — il sert de référence versionnée et de migration pour un
--    environnement neuf. NE PAS le ré-exécuter sur la prod (les CREATE sans
--    IF NOT EXISTS échoueraient — c'est voulu : une migration ne tourne qu'une fois).
--
--    Fonction find_similar_club : voir 20260615000001_club_similarity.sql.
-- =============================================================================

CREATE TABLE public.clubs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL CHECK (char_length(name) BETWEEN 2 AND 80),
  full_name    text,
  city         text,
  postal_code  text,
  sport        text NOT NULL DEFAULT 'badminton'
                 CHECK (sport IN ('badminton', 'padel', 'tennis', 'squash', 'autre')),
  owner_id     uuid REFERENCES auth.users(id) ON DELETE RESTRICT NOT NULL,
  slug         text UNIQUE,
  invite_token uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  invite_code  text UNIQUE,
  is_active    boolean DEFAULT true,
  created_at   timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX ON public.clubs (owner_id);

CREATE TABLE public.club_members (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id   uuid REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
  user_id   uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role      text NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'admin', 'editor', 'member')),
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (club_id, user_id)
);
CREATE INDEX ON public.club_members (club_id);
CREATE INDEX ON public.club_members (user_id);

CREATE TABLE public.club_invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id     uuid REFERENCES public.clubs(id) ON DELETE CASCADE NOT NULL,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'member'
                CHECK (role IN ('admin', 'editor', 'member')),
  token       uuid DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  invited_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at  timestamptz DEFAULT now() NOT NULL,
  expires_at  timestamptz DEFAULT (now() + interval '30 days') NOT NULL,
  accepted_at timestamptz,
  status      text NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'accepted', 'expired', 'cancelled')),
  UNIQUE (club_id, email)
);
CREATE INDEX ON public.club_invitations (club_id);

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS club_id uuid
  REFERENCES public.clubs(id) ON DELETE SET NULL;

-- ─── Fonctions SECURITY DEFINER (helpers RLS) ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_club_member(p_club_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_members
    WHERE club_id = p_club_id AND user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = p_club_id AND owner_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.get_user_club_role(p_club_id uuid)
RETURNS text LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.clubs WHERE id = p_club_id AND owner_id = auth.uid())
    THEN 'owner'
    ELSE (SELECT role FROM public.club_members WHERE club_id = p_club_id AND user_id = auth.uid() LIMIT 1)
  END;
$$;

-- ─── RLS ─────────────────────────────────────────────────────────────────────────
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Lecture publique clubs"
  ON public.clubs FOR SELECT USING (true);
CREATE POLICY "Owner gère son club"
  ON public.clubs FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Membres voient leur club"
  ON public.club_members FOR SELECT
  USING (public.is_club_member(club_id));
CREATE POLICY "Owner/Admin gèrent les membres"
  ON public.club_members FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.clubs WHERE id = club_members.club_id AND owner_id = auth.uid())
    OR public.get_user_club_role(club_members.club_id) = 'admin'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.clubs WHERE id = club_members.club_id AND owner_id = auth.uid())
    OR public.get_user_club_role(club_members.club_id) = 'admin'
  );

CREATE POLICY "Lecture invitation par token"
  ON public.club_invitations FOR SELECT USING (true);
CREATE POLICY "Owner/Admin gèrent les invitations"
  ON public.club_invitations FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.clubs WHERE id = club_invitations.club_id AND owner_id = auth.uid())
    OR public.get_user_club_role(club_invitations.club_id) = 'admin'
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.clubs WHERE id = club_invitations.club_id AND owner_id = auth.uid())
    OR public.get_user_club_role(club_invitations.club_id) = 'admin'
  );

-- ─── Backfill (one-shot, données existantes) ────────────────────────────────────
-- Un club auto-créé par utilisateur ayant déjà des tournois (invite_code = 6 hex
-- de md5(user_id), ex. "9F0727" ; ville NULL).
INSERT INTO public.clubs (name, owner_id, invite_code, city)
SELECT
  COALESCE(NULLIF(split_part(u.email, '@', 1), ''), 'Mon') || ' Club',
  u.id,
  upper(substring(md5(u.id::text), 1, 6)),
  NULL
FROM auth.users u
WHERE EXISTS (SELECT 1 FROM public.tournaments t WHERE t.created_by = u.id)
  AND NOT EXISTS (SELECT 1 FROM public.clubs c WHERE c.owner_id = u.id);

-- Rattachement des tournois existants au club de leur créateur.
UPDATE public.tournaments t
SET club_id = c.id
FROM public.clubs c
WHERE c.owner_id = t.created_by
  AND t.club_id IS NULL;

-- Les membres acceptés d'une organisation deviennent membres du club du owner.
-- NB : l'owner lui-même n'est PAS inséré ici (il est identifié via clubs.owner_id).
INSERT INTO public.club_members (club_id, user_id, role, joined_at)
SELECT c.id, om.member_id,
  CASE om.role WHEN 'admin' THEN 'admin' WHEN 'editor' THEN 'editor' ELSE 'member' END,
  COALESCE(om.accepted_at, om.invited_at)
FROM public.organization_members om
JOIN public.clubs c ON c.owner_id = om.owner_id
WHERE om.status = 'accepted' AND om.member_id IS NOT NULL
ON CONFLICT (club_id, user_id) DO NOTHING;

-- Realtime sur club_members.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'club_members'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.club_members;
  END IF;
END $$;
