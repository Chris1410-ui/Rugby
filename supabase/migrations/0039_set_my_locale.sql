-- ════════════════════════════════════════════════════════════════
-- 0039 — Langue d'interface persistée par compte (profiles.locale).
--
-- L'utilisateur écrit UNIQUEMENT sa propre langue, et rien d'autre : on passe
-- par une RPC SECURITY DEFINER (jamais de policy UPDATE ouverte sur `profiles`,
-- qui laisserait un compte modifier son propre rôle / rattachement club).
-- La colonne profiles.locale a été créée en 0038.
-- ════════════════════════════════════════════════════════════════
create or replace function public.set_my_locale(p_locale text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if p_locale is null or p_locale not in ('fr', 'en', 'nl') then
    return; -- valeur non supportée → ignorée silencieusement
  end if;
  update public.profiles set locale = p_locale where id = auth.uid();
end;
$$;
grant execute on function public.set_my_locale(text) to authenticated;
