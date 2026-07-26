-- 0095 — Vue JOUEUR des distributions (k-anonymat serveur).
--
-- Le joueur ne lit (RLS) que SES propres test_results → il ne peut pas calculer la
-- distribution de sa ligne/équipe côté client (contrairement au staff, cf.
-- src/lib/distribution.js). On expose donc un agrégat SECURITY DEFINER qui réutilise
-- EXACTEMENT l'extraction Top 14 déjà éprouvée (_t14_val : parsing kg, ×poids,
-- bronco→secondes) et la sélection « dernière campagne par joueur » des
-- comparison_*_stats (0050), en y ajoutant :
--   • les quartiles (percentile_cont) + min/max/moyenne de la distribution ;
--   • un GATE de k-anonymat (agrégat masqué sous 5 joueurs, comme ex_agg 0081) ;
--   • la valeur du joueur (SA donnée, jamais gatée) + son rang percentile.
-- VALEURS AGRÉGÉES UNIQUEMENT — jamais les valeurs brutes des coéquipiers.
-- Ne touche pas aux comparison_*_stats (non gatées, consommées ailleurs).

create or replace function public.test_distribution(p_metric text, p_scope text default 'team')
  returns table(n int, hidden boolean, mn numeric, q1 numeric, med numeric, q3 numeric, mx numeric, mean numeric, my_val numeric, my_pct int)
  language sql stable security definer set search_path = public, auth as $$
  with me as (select id, grp, team_id from players where id = my_player_id()),
  dir0 as (select case when p_metric = 'bronco' then 'down' else 'up' end as dir),
  vals as (
    select tr.player_id, c.date as cdate,
           public._t14_val(p_metric, tr, coalesce(tr.bodyweight, p.bodyweight)) as v
    from test_results tr
    join test_campaigns c on c.id = tr.campaign_id
    join players p on p.id = tr.player_id
    where p.team_id = (select team_id from me)
      and (p_scope <> 'line' or p.grp = (select grp from me))
  ),
  clean as (select * from vals where v is not null and v > 0),
  latest as (
    select distinct on (player_id) player_id, v
    from clean order by player_id, cdate desc
  ),
  myv as (select v from latest where player_id = (select id from me)),
  agg as (
    select count(*)::int as n,
      min(v)::numeric as mn, max(v)::numeric as mx, round(avg(v)::numeric, 4) as mean,
      percentile_cont(0.25) within group (order by v)::numeric as q1,
      percentile_cont(0.5)  within group (order by v)::numeric as med,
      percentile_cont(0.75) within group (order by v)::numeric as q3
    from latest
  )
  select
    a.n,
    (a.n < 5) as hidden,
    case when a.n >= 5 then a.mn end,
    case when a.n >= 5 then round(a.q1, 4) end,
    case when a.n >= 5 then round(a.med, 4) end,
    case when a.n >= 5 then round(a.q3, 4) end,
    case when a.n >= 5 then a.mx end,
    case when a.n >= 5 then a.mean end,
    (select v from myv) as my_val,
    case when a.n >= 5 and (select v from myv) is not null then
      round((
        (select count(*) from latest l where (case when (select dir from dir0) = 'down' then l.v > (select v from myv) else l.v < (select v from myv) end))
        + (select count(*) from latest l where l.v = (select v from myv)) / 2.0
      ) / a.n * 100)::int
    end as my_pct
  from agg a
$$;

revoke execute on function public.test_distribution(text, text) from public, anon;
grant execute on function public.test_distribution(text, text) to authenticated;
