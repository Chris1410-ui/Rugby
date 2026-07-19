-- ════════════════════════════════════════════════════════════════
-- 0049 — Onboarding (tour guidé au 1er lancement) : état « vu » par profil.
--
-- `profiles.onboarding_seen_at` : NULL = jamais vu → le tour s'affiche au 1er
-- lancement (par rôle, puisqu'un compte a un rôle). L'utilisateur écrit
-- UNIQUEMENT ce champ via une RPC SECURITY DEFINER (jamais de policy UPDATE
-- ouverte sur profiles, qui laisserait un compte changer son rôle/rattachement) —
-- même patron que set_my_locale (0039) / set_my_initials (0038).
-- ════════════════════════════════════════════════════════════════

alter table public.profiles add column if not exists onboarding_seen_at timestamptz;

create or replace function public.set_my_onboarding_seen()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  update public.profiles set onboarding_seen_at = now() where id = auth.uid();
end;
$$;

grant execute on function public.set_my_onboarding_seen() to authenticated;
