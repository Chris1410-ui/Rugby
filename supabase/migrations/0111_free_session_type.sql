-- 0111 — Séance libre typée (PR2) : create_free_session porte désormais le
-- MODÈLE DE SAISIE (session_type, cf. 0110) et la nature descriptive, tous deux
-- fournis par le client (le mapping type→nature/code par défaut vit dans
-- src/lib/sessionType.js — une seule vérité, pas de duplication SQL). Les blocs
-- (exercises jsonb) continuent de transiter VERBATIM : la forme d'un item cardio
-- passe sans traitement serveur.
--
-- On DROP l'ancien overload à 4 args et on recrée avec p_type/p_nature en fin de
-- signature (défauts) : un appel à 4 args nommés résout toujours cette fonction
-- (défauts appliqués) → rétro-compatible pendant le déploiement.

drop function if exists public.create_free_session(text, text, int, jsonb);

create or replace function public.create_free_session(
  p_title text, p_code text, p_duration int, p_exercises jsonb,
  p_type text default 'strength', p_nature text default null
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
  insert into public.sessions (team_id, date, code, titre, duration_min, exercises, assigned, origin, created_by, session_type, nature)
  values (
    v_team,
    current_date,
    coalesce(nullif(p_code, ''), 'RS'),
    coalesce(nullif(p_title, ''), 'Séance libre'),
    coalesce(p_duration, 60),
    coalesce(p_exercises, '[]'::jsonb),
    jsonb_build_object('mode', 'players', 'ids', jsonb_build_array(v_pid::text)),
    'libre',
    auth.uid(),
    coalesce(nullif(p_type, ''), 'strength'),
    nullif(p_nature, '')
  )
  returning id into v_id;
  return v_id;
end $$;

-- Réservé aux comptes connectés (definer) : jamais anon.
revoke all on function public.create_free_session(text, text, int, jsonb, text, text) from anon, public;
grant execute on function public.create_free_session(text, text, int, jsonb, text, text) to authenticated;
