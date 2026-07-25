-- 0081 — Agrégats par exercice pour la vue joueur (PR3)
--
-- Deux RPC au-dessus de exercise_perf (matérialisé en 0080) :
--   • player_exercise_series : la série personnelle du joueur (ses données à lui,
--     RLS suffit — SECURITY INVOKER).
--   • ex_agg : comparaison anonymisée « moi / ma ligne / mon équipe » avec
--     k-anonymat serveur (seuil ≥ 5 joueurs distincts). SECURITY DEFINER car un
--     joueur ne peut pas lire les lignes de ses coéquipiers via la RLS ; la
--     fonction ne renvoie donc JAMAIS de valeur individuelle, seulement des
--     moyennes calculées sur ≥ 5 joueurs, et uniquement pour sa propre équipe
--     (borné par my_team()). Aucune donnée ne traverse les clubs.

-- ─────────────────────────────────────────────────────────────────────────────
-- Série personnelle (données du joueur lui-même — pas de k-anonymat requis)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.player_exercise_series(p_exercise_key text)
returns table (d date, top_kg numeric, est_1rm integer, volume_kg numeric)
language sql
stable
security invoker
set search_path = public
as $$
  select ep.date, ep.top_kg, ep.est_1rm, ep.volume_kg
  from public.exercise_perf ep
  where ep.player_id = my_player_id()
    and ep.exercise_key = p_exercise_key
  order by ep.date, ep.created_at
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Comparaison anonymisée moi / ma ligne / mon équipe (k-anonymat ≥ 5)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.ex_agg(p_exercise_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  k_anon    constant int := 5;   -- seuil de k-anonymat
  v_team    text := my_team();
  v_player  uuid := my_player_id();
  v_line    text;
  v_me      jsonb;
  v_line_a  jsonb;
  v_team_a  jsonb;
begin
  if v_team is null then
    return jsonb_build_object('line', null, 'me', null, 'line_agg', null, 'team_agg', null);
  end if;

  select p.grp::text into v_line from public.players p where p.id = v_player;

  -- Moi : agrégat de mes propres lignes (aucune anonymisation nécessaire).
  select case when count(*) = 0 then null else jsonb_build_object(
           'top',      max(top_kg),
           'orm',      max(est_1rm),
           'vol',      round(avg(volume_kg)),
           'sessions', count(*)
         ) end
    into v_me
    from public.exercise_perf
   where player_id = v_player and exercise_key = p_exercise_key;

  -- Équipe : on réduit d'abord à UNE valeur par joueur (meilleur top/1RM,
  -- volume moyen), puis on moyenne sur les joueurs. Rendu uniquement si ≥ 5
  -- joueurs distincts ont travaillé cet exercice.
  with pp as (
    select player_id, max(top_kg) top, max(est_1rm) orm, avg(volume_kg) vol
      from public.exercise_perf
     where team_id = v_team and exercise_key = p_exercise_key
     group by player_id
  )
  select case when count(*) >= k_anon then jsonb_build_object(
           'n',   count(*),
           'top', round(avg(top)::numeric, 1),
           'orm', round(avg(orm)::numeric, 1),
           'vol', round(avg(vol)::numeric)
         ) else null end
    into v_team_a
    from pp;

  -- Ma ligne (avants / arrières) au sein de mon équipe, même seuil k-anon.
  with pp as (
    select player_id, max(top_kg) top, max(est_1rm) orm, avg(volume_kg) vol
      from public.exercise_perf
     where team_id = v_team and line = v_line and exercise_key = p_exercise_key
     group by player_id
  )
  select case when count(*) >= k_anon then jsonb_build_object(
           'n',   count(*),
           'top', round(avg(top)::numeric, 1),
           'orm', round(avg(orm)::numeric, 1),
           'vol', round(avg(vol)::numeric)
         ) else null end
    into v_line_a
    from pp;

  return jsonb_build_object('line', v_line, 'me', v_me, 'line_agg', v_line_a, 'team_agg', v_team_a);
end;
$$;

-- Retirer le grant EXECUTE par défaut à PUBLIC (dont hérite anon) : ces RPC ne
-- sont destinées qu'aux utilisateurs authentifiés. ex_agg reste appelable par
-- `authenticated` (les joueurs) — le k-anonymat et le cloisonnement my_team()
-- sont appliqués DANS la fonction.
revoke execute on function public.player_exercise_series(text) from public, anon;
revoke execute on function public.ex_agg(text) from public, anon;
grant execute on function public.player_exercise_series(text) to authenticated;
grant execute on function public.ex_agg(text) to authenticated;
