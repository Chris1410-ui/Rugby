-- 0098 — Projection PUBLIQUE d'un staff-athlète (ce que les joueurs voient) — PR-3.
--
-- Un joueur voit d'un staff-athlète : ses points/badges (déjà via le classement),
-- ses SÉANCES RÉALISÉES (nombre + nature) et sa ROUTINE du matin complétée ou non
-- (juste l'état ✓/✗). JAMAIS : charges détaillées, tests, poids, bilans, contenu
-- de la routine. On expose donc un agrégat SECURITY DEFINER strictement limité à
-- ces champs — les tables privées restent self-only (0096/0097).

create or replace function public.team_athlete_public(p_team text)
  returns table(player_id uuid, sessions_done int, natures jsonb, routine_today boolean)
  language sql stable security definer set search_path = public, auth as $$
  select
    a.id as player_id,
    coalesce(d.n, 0) as sessions_done,
    coalesce(d.natures, '{}'::jsonb) as natures,
    exists (select 1 from public.athlete_routine_log l
             where l.player_id = a.id and l.date = current_date and l.done) as routine_today
  from public.players a
  left join lateral (
    select sum(c)::int as n, jsonb_object_agg(k, c) as natures
    from (
      select coalesce(s.nature, s.code, 'autre') as k, count(*)::int as c
      from public.session_logs sl
      join public.sessions s on s.id = sl.session_id
      where sl.player_id = a.id and sl.status = 'done'
      group by 1
    ) g
  ) d on true
  where a.team_id = p_team and a.is_staff_athlete and (p_team = my_team() or is_owner());
$$;
revoke execute on function public.team_athlete_public(text) from public, anon;
grant execute on function public.team_athlete_public(text) to authenticated;
