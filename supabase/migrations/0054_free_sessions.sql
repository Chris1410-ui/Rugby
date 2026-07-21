-- ============================================================================
--  0054 — Séances libres (autonomes) créées par le JOUEUR.
--
--  Un joueur compose sa propre séance en piochant des exercices dans la
--  Bibliothèque (Lot 2), fixe séries/reps/charge, puis la loggue série par série
--  avec le MÊME moteur que les séances prescrites (session_logs, records, 1RM,
--  RPE) → elle alimente automatiquement historique / compliance / points et
--  reste visible par le staff.
--
--  Le joueur n'écrit JAMAIS sur `sessions` en direct (comme enroll_in_session,
--  0020) : une fonction SECURITY DEFINER insère la séance, auto-assignée à lui
--  seul (assigned = {mode:'players', ids:[son player_id]}), origin='libre'.
-- ============================================================================

-- Provenance de la séance : 'staff' (prescrite, défaut) | 'libre' (autonome).
alter table public.sessions add column if not exists origin text not null default 'staff';
-- Auteur (rempli pour les séances libres → contrôle de suppression par le joueur).
alter table public.sessions add column if not exists created_by uuid references auth.users(id);

-- Création d'une séance libre par le joueur connecté (datée du jour, assignée à
-- lui seul). Renvoie l'id de la séance. Refuse si l'appelant n'est pas un joueur.
create or replace function public.create_free_session(
  p_title text, p_code text, p_duration int, p_exercises jsonb
) returns uuid
  language plpgsql security definer set search_path = public, auth as $$
declare
  v_team text := public.my_team();
  v_pid  uuid := public.my_player_id();
  v_id   uuid;
begin
  if v_pid is null then
    raise exception 'FREE_SESSION_PLAYER_ONLY';  -- staff/owner : pas de player_id
  end if;
  insert into public.sessions (team_id, date, code, titre, duration_min, exercises, assigned, origin, created_by)
  values (
    v_team,
    current_date,
    coalesce(nullif(p_code, ''), 'RS'),
    coalesce(nullif(p_title, ''), 'Séance libre'),
    coalesce(p_duration, 60),
    coalesce(p_exercises, '[]'::jsonb),
    jsonb_build_object('mode', 'players', 'ids', jsonb_build_array(v_pid::text)),
    'libre',
    auth.uid()
  )
  returning id into v_id;
  return v_id;
end $$;

-- Suppression d'une séance libre par son auteur (avant/après log — cascade sur
-- session_logs). Ne touche jamais une séance prescrite ni celle d'un autre.
create or replace function public.delete_free_session(p_session uuid) returns void
  language plpgsql security definer set search_path = public, auth as $$
begin
  delete from public.sessions
   where id = p_session and origin = 'libre' and created_by = auth.uid();
end $$;

-- Réservé aux comptes connectés. On révoque aussi explicitement `anon` : les
-- privilèges par défaut de Supabase accordent l'EXECUTE à anon en direct, qu'un
-- simple REVOKE … FROM public ne retire pas. (Les fonctions se protègent déjà
-- via auth.uid()/my_player_id(), mais ce sont des mutations réservées au joueur.)
revoke all on function public.create_free_session(text, text, int, jsonb) from public, anon;
revoke all on function public.delete_free_session(uuid) from public, anon;
grant execute on function public.create_free_session(text, text, int, jsonb) to authenticated;
grant execute on function public.delete_free_session(uuid) to authenticated;
