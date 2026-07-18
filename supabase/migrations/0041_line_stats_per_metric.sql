-- ════════════════════════════════════════════════════════════════
-- 0041 — comparison_line_stats : moyenne de ligne par MÉTRIQUE.
--
-- Avant : on ne prenait que le DERNIER résultat (une campagne) de chaque joueur
-- de la ligne ; si sa dernière campagne ne contenait pas tel test (ex. Bronco),
-- il était exclu → « Ligne — » alors qu'il l'avait mesuré avant.
-- Après : pour chaque (joueur, métrique) on prend sa DERNIÈRE valeur non nulle,
-- puis on moyenne sur la ligne. La moyenne apparaît dès qu'au moins un joueur de
-- la ligne a la donnée. Toujours SECURITY DEFINER, aucune valeur individuelle
-- de coéquipier n'est exposée (seulement moyenne, effectif, mon rang).
-- ════════════════════════════════════════════════════════════════
create or replace function public.comparison_line_stats()
  returns table(metric text, line_avg numeric, n int, my_rank int)
  language sql stable security definer set search_path = public, auth as $$
  with me as (select id, grp, team_id from players where id = my_player_id()),
  metrics(metric, dir) as (values
    ('mas','up'),('yoyo','up'),('bronco','down'),('cmj','up'),
    ('squat','up'),('bench','up'),('deadlift','up'),('tractions','up')),
  -- toutes les valeurs datées de MA ligne, par métrique
  vals as (
    select tr.player_id, m.metric, m.dir, c.date as cdate,
           public._t14_val(m.metric, tr) as v
    from test_results tr
    join test_campaigns c on c.id = tr.campaign_id
    join players p on p.id = tr.player_id
    cross join metrics m
    where p.team_id = (select team_id from me) and p.grp = (select grp from me)
  ),
  clean as (select * from vals where v is not null and v > 0),
  -- dernière valeur NON NULLE par (joueur, métrique)
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
