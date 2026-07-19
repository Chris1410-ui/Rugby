-- ════════════════════════════════════════════════════════════════
-- 0050 — Comparaison joueur = même tableau que le staff (agrégats serveur).
--
-- Le joueur ne peut lire (RLS) que SES propres test_results → il ne peut pas
-- calculer les moyennes équipe/ligne côté client comme le staff. On expose donc
-- deux agrégats SECURITY DEFINER, VALEURS AGRÉGÉES UNIQUEMENT (jamais les valeurs
-- brutes des coéquipiers) :
--   • comparison_line_stats() — ma ligne (grp), enrichie de `avg_pct`
--   • comparison_team_stats() — toute mon équipe
-- `avg_pct` = moyenne, par joueur, de (valeur ÷ seuil Top 14 de SON poste) ×100
-- (sens inversé pour le Bronco) → miroir exact d'averageProfile() du staff, pour
-- que « Toi » et les moyennes partagent la même échelle de barres/radar.
-- Ajout de hangclean pour couvrir les 9 tests du tableau partagé.
-- ════════════════════════════════════════════════════════════════

-- La signature change (nouvelle colonne avg_pct) → drop puis recreate.
drop function if exists public.comparison_line_stats();

create or replace function public.comparison_line_stats()
  returns table(metric text, line_avg numeric, avg_pct numeric, n int, my_rank int)
  language sql stable security definer set search_path = public, auth as $$
  with me as (select id, grp, team_id from players where id = my_player_id()),
  metrics(metric, dir) as (values
    ('mas','up'),('yoyo','up'),('bronco','down'),('cmj','up'),
    ('squat','up'),('bench','up'),('deadlift','up'),('hangclean','up'),('tractions','up')),
  vals as (
    select tr.player_id, m.metric, m.dir, c.date as cdate,
           public._t14_cat(p.pos) as cat,
           public._t14_val(m.metric, tr, coalesce(tr.bodyweight, p.bodyweight)) as v
    from test_results tr
    join test_campaigns c on c.id = tr.campaign_id
    join players p on p.id = tr.player_id
    cross join metrics m
    where p.team_id = (select team_id from me) and p.grp = (select grp from me)
  ),
  clean as (select * from vals where v is not null and v > 0),
  latest as (
    select distinct on (player_id, metric) player_id, metric, dir, cat, v
    from clean order by player_id, metric, cdate desc
  ),
  scored as (
    select l.*,
      (case when public._t14_thr(l.cat, l.metric) is not null and public._t14_thr(l.cat, l.metric) > 0
        then case when l.dir = 'down'
                  then public._t14_thr(l.cat, l.metric) / l.v * 100
                  else l.v / public._t14_thr(l.cat, l.metric) * 100 end
      end) as pct
    from latest l
  ),
  ranked as (
    select metric, player_id,
      rank() over (partition by metric order by (case when dir = 'down' then v else -v end) asc) as rk
    from latest
  )
  select s.metric, round(avg(s.v)::numeric, 4) as line_avg,
    round(avg(s.pct)::numeric, 2) as avg_pct, count(*)::int as n,
    (select rk from ranked r where r.metric = s.metric and r.player_id = (select id from me))::int as my_rank
  from scored s group by s.metric
$$;

-- Toute l'équipe (pas de filtre grp). Même logique, même confidentialité.
create or replace function public.comparison_team_stats()
  returns table(metric text, team_avg numeric, avg_pct numeric, n int, my_rank int)
  language sql stable security definer set search_path = public, auth as $$
  with me as (select id, team_id from players where id = my_player_id()),
  metrics(metric, dir) as (values
    ('mas','up'),('yoyo','up'),('bronco','down'),('cmj','up'),
    ('squat','up'),('bench','up'),('deadlift','up'),('hangclean','up'),('tractions','up')),
  vals as (
    select tr.player_id, m.metric, m.dir, c.date as cdate,
           public._t14_cat(p.pos) as cat,
           public._t14_val(m.metric, tr, coalesce(tr.bodyweight, p.bodyweight)) as v
    from test_results tr
    join test_campaigns c on c.id = tr.campaign_id
    join players p on p.id = tr.player_id
    cross join metrics m
    where p.team_id = (select team_id from me)
  ),
  clean as (select * from vals where v is not null and v > 0),
  latest as (
    select distinct on (player_id, metric) player_id, metric, dir, cat, v
    from clean order by player_id, metric, cdate desc
  ),
  scored as (
    select l.*,
      (case when public._t14_thr(l.cat, l.metric) is not null and public._t14_thr(l.cat, l.metric) > 0
        then case when l.dir = 'down'
                  then public._t14_thr(l.cat, l.metric) / l.v * 100
                  else l.v / public._t14_thr(l.cat, l.metric) * 100 end
      end) as pct
    from latest l
  ),
  ranked as (
    select metric, player_id,
      rank() over (partition by metric order by (case when dir = 'down' then v else -v end) asc) as rk
    from latest
  )
  select s.metric, round(avg(s.v)::numeric, 4) as team_avg,
    round(avg(s.pct)::numeric, 2) as avg_pct, count(*)::int as n,
    (select rk from ranked r where r.metric = s.metric and r.player_id = (select id from me))::int as my_rank
  from scored s group by s.metric
$$;
