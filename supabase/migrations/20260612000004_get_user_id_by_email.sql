-- ════════════════════════════════════════════════════════════════════════════
-- get_user_id_by_email — résout un email → user id (pour inviter un membre)
-- ════════════════════════════════════════════════════════════════════════════
-- SECURITY DEFINER : lit auth.users (inaccessible au client anon). EXECUTE
-- réservé au service_role → appelée uniquement depuis les Server Actions, ce qui
-- évite l'énumération d'emails par un utilisateur authentifié.

create or replace function public.get_user_id_by_email(p_email text)
returns uuid
language sql
security definer
stable
set search_path = ''
as $$
  select id from auth.users where lower(email) = lower(p_email) limit 1;
$$;

revoke all on function public.get_user_id_by_email(text) from public;
grant execute on function public.get_user_id_by_email(text) to service_role;
