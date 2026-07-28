-- 0112 — Garde exercise_perf (PR3b) : l'agrégation de charge (top_kg / volume /
-- 1RM estimé) n'a de sens que pour les blocs de MUSCULATION. Les blocs cardio
-- (kind cardio_*) n'ont pas de séries w×reps → sans garde ils créeraient des
-- lignes parasites à zéro. On les EXCLUT de l'agrégation. Séries muscu / poids
-- de corps inchangées. Corps identique à 0080, seul le filtre `ex` change.

create or replace function public._rebuild_exercise_perf(p_session uuid, p_player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status  text;
  v_per     jsonb;
  v_team    text;
  v_date    date;
  v_exos    jsonb;
  v_club    uuid;
  v_line    text;
begin
  delete from public.exercise_perf where session_id = p_session and player_id = p_player;

  select sl.status::text, sl.per_exercise
    into v_status, v_per
    from public.session_logs sl
   where sl.session_id = p_session and sl.player_id = p_player
   limit 1;

  if v_status is distinct from 'done' or v_per is null then
    return;
  end if;

  select s.team_id, s.date, coalesce(s.exercises, '[]'::jsonb)
    into v_team, v_date, v_exos
    from public.sessions s
   where s.id = p_session;

  if v_team is null then
    return;
  end if;

  select t.club_id into v_club from public.teams t where t.id = v_team;
  select p.grp::text into v_line from public.players p where p.id = p_player;

  insert into public.exercise_perf (
    player_id, team_id, club_id, line, session_id, date,
    exercise_key, exercise_name, top_kg, volume_kg, est_1rm,
    presc_sets, done_sets, presc_pct, adhered
  )
  select
    p_player,
    v_team,
    v_club,
    v_line,
    p_session,
    v_date,
    public._ex_key(ex.name),
    ex.name,
    agg.top_kg,
    agg.volume_kg,
    agg.est_1rm,
    ex.presc_sets,
    agg.done_sets,
    ex.presc_pct,
    (ex.presc_sets is null or agg.done_sets >= ex.presc_sets)
  from jsonb_each(v_per) pe(exo_id, exo_val)
  cross join lateral (
    select
      coalesce(o->>'name', '') as name,
      public._num_lead(o->>'sets') as presc_sets,
      public._num_lead(
        substring(coalesce(o->>'reps', '') || ' ' || coalesce(o->>'charge', '')
                  from '([0-9]+)\s*%')
      ) as presc_pct
    from jsonb_array_elements(v_exos) o
    where o->>'id' = pe.exo_id
      -- GARDE PR3b : on ignore les blocs cardio (pas de charge w×reps).
      and coalesce(o->>'kind', 'strength') not in
          ('cardio_continuous', 'cardio_interval', 'cardio_circuit', 'cardio_test')
    limit 1
  ) ex
  cross join lateral (
    select
      max(w)                                   as top_kg,
      sum(case when w is not null and r is not null then w * r end) as volume_kg,
      max(public._e1rm(w, r))                  as est_1rm,
      count(*) filter (where w is not null or r is not null) as done_sets
    from (
      select public._num_lead(st->>'w') as w, public._num_lead(st->>'reps') as r
      from jsonb_array_elements(coalesce(exo_val->'sets', '[]'::jsonb)) st
      where coalesce(st->>'type', 'normal') <> 'warmup'
    ) sets
  ) agg
  where agg.done_sets > 0;
end;
$$;
