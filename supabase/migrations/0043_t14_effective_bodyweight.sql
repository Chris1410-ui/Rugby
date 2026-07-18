-- ════════════════════════════════════════════════════════════════
-- 0043 — Force ×PdC serveur : diviser par le POIDS COURANT (questionnaire).
--
-- Problème : `_t14_val(metric, tr)` divise la force par `test_results.bodyweight`
-- (le poids saisi dans la ligne de test), quasi toujours NULL. Le poids courant
-- alimenté par le questionnaire (#78) vit dans `players.bodyweight` et était
-- IGNORÉ côté serveur. Résultat : la moyenne de ligne de force
-- (comparison_line_stats) et les points Top 14 de force (team_top14) étaient
-- vides, alors que la valeur « Toi » (client) utilise bien le poids courant.
--
-- Correctif : surcharge `_t14_val(metric, r, eff_bw)` qui divise la force par un
-- poids effectif fourni. Les deux RPC passent `coalesce(tr.bodyweight,
-- p.bodyweight)` → miroir de currentBodyweight() côté client (le poids du profil
-- prend le relais quand la ligne de test n'a pas de poids). Aucune valeur
-- individuelle exposée, toujours SECURITY DEFINER. La surcharge 2-args d'origine
-- est conservée (compat).
-- ════════════════════════════════════════════════════════════════

-- Surcharge : valeur comparable d'un test avec poids de corps effectif explicite.
create or replace function public._t14_val(metric text, r public.test_results, eff_bw numeric)
  returns numeric language sql immutable as $$
  select case metric
    when 'mas' then r.mas
    when 'yoyo' then r.yoyo
    when 'bronco' then public._t14_bronco(r.bronco)
    when 'cmj' then r.cmj_overall
    when 'squat'     then case when coalesce(eff_bw,0) > 0 then public._t14_kg(r.squat_5rm) / eff_bw end
    when 'bench'     then case when coalesce(eff_bw,0) > 0 then r.bench_5rm / eff_bw end
    when 'deadlift'  then case when coalesce(eff_bw,0) > 0 then r.deadlift / eff_bw end
    when 'hangclean' then case when coalesce(eff_bw,0) > 0 then r.hang_clean_2rm / eff_bw end
    when 'tractions' then case when coalesce(eff_bw,0) > 0 then r.tractions / eff_bw end
  end
$$;

-- ---------- comparison_line_stats : force ÷ poids courant ----------
create or replace function public.comparison_line_stats()
  returns table(metric text, line_avg numeric, n int, my_rank int)
  language sql stable security definer set search_path = public, auth as $$
  with me as (select id, grp, team_id from players where id = my_player_id()),
  metrics(metric, dir) as (values
    ('mas','up'),('yoyo','up'),('bronco','down'),('cmj','up'),
    ('squat','up'),('bench','up'),('deadlift','up'),('tractions','up')),
  vals as (
    select tr.player_id, m.metric, m.dir, c.date as cdate,
           public._t14_val(m.metric, tr, coalesce(tr.bodyweight, p.bodyweight)) as v
    from test_results tr
    join test_campaigns c on c.id = tr.campaign_id
    join players p on p.id = tr.player_id
    cross join metrics m
    where p.team_id = (select team_id from me) and p.grp = (select grp from me)
  ),
  clean as (select * from vals where v is not null and v > 0),
  latest as (
    select distinct on (player_id, metric) player_id, metric, dir, v
    from clean
    order by player_id, metric, cdate desc
  ),
  ranked as (
    select metric, player_id,
      rank() over (partition by metric order by (case when dir = 'down' then v else -v end) asc) as rk
    from latest
  )
  select l.metric, round(avg(l.v)::numeric, 4) as line_avg, count(*)::int as n,
    (select rk from ranked r where r.metric = l.metric and r.player_id = (select id from me))::int as my_rank
  from latest l group by l.metric
$$;

-- ---------- team_top14 : statut Top 14 de force ÷ poids courant ----------
create or replace function public.team_top14(p_team text default null)
  returns table(player_id uuid, key text, label text, first_date date)
  language sql stable security definer set search_path = public, auth as $$
  with eff as (
    select case
      when p_team is null then my_team()
      when is_owner() then p_team
      when p_team = my_team() then p_team
      else my_team() end as team
  ),
  metrics(key, label, dir) as (values
    ('squat','Squat 5RM','up'),('bench','Bench 5RM','up'),('deadlift','Deadlift','up'),
    ('hangclean','Hang Clean 2RM','up'),('tractions','Tractions','up'),('mas','MAS','up'),
    ('bronco','Bronco','down'),('yoyo','Yo-Yo IR1','up'),('cmj','CMJ','up')),
  res as (
    select tr as trow, tr.player_id, c.date as cdate, public._t14_cat(p.pos) as cat,
           coalesce(tr.bodyweight, p.bodyweight) as eff_bw
    from test_results tr
    join test_campaigns c on c.id = tr.campaign_id
    join players p on p.id = tr.player_id
    where tr.team_id = (select team from eff)
  ),
  valid as (
    select r.player_id, m.key, m.label, r.cdate
    from res r cross join metrics m
    where r.cat is not null
      and public._t14_val(m.key, r.trow, r.eff_bw) is not null
      and public._t14_val(m.key, r.trow, r.eff_bw) > 0
      and public._t14_thr(r.cat, m.key) is not null
      and ((m.dir = 'down' and public._t14_val(m.key, r.trow, r.eff_bw) <= public._t14_thr(r.cat, m.key))
        or (m.dir = 'up'   and public._t14_val(m.key, r.trow, r.eff_bw) >= public._t14_thr(r.cat, m.key)))
  )
  select player_id, key, label, min(cdate) as first_date
  from valid group by player_id, key, label
$$;
