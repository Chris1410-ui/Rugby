-- 0105 — Fix Distributions en APERÇU joueur (owner/staff).
--
-- Bug : test_distribution lisait my_player_id() du CALLER authentifié. En aperçu
-- owner (owner → joueur), le caller est l'owner (pas le joueur consulté), qui n'a
-- pas de ligne `players` → `me` vide → `p.team_id = NULL` toujours faux → 0 ligne
-- → l'écran affichait « pas de mesure » alors que le groupe a des dizaines de
-- valeurs. On ajoute un paramètre `p_player` : s'il est fourni ET que le caller est
-- owner ou staff, on calcule la distribution du point de vue de CE joueur (son
-- équipe / sa ligne / sa valeur). Un joueur lambda ne peut pas viser autrui : repli
-- systématique sur my_player_id(). Agrégats k-anon (≥ 5) inchangés.
drop function if exists public.test_distribution(text, text);

create or replace function public.test_distribution(p_metric text, p_scope text default 'team', p_player uuid default null)
returns table(n integer, hidden boolean, mn numeric, q1 numeric, med numeric, q3 numeric, mx numeric, mean numeric, my_val numeric, my_pct integer)
language sql stable security definer
set search_path to 'public', 'auth'
as $function$
  with me as (
    select id, grp, team_id from players
    where id = case
      when p_player is not null and (is_owner() or is_staff()) then p_player
      else my_player_id()
    end
  ),
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
$function$;

-- Verrouillage d'accès (aligné sur 0102) : jamais anon/public, seulement connectés.
revoke execute on function public.test_distribution(text, text, uuid) from public;
revoke execute on function public.test_distribution(text, text, uuid) from anon;
grant execute on function public.test_distribution(text, text, uuid) to authenticated;
