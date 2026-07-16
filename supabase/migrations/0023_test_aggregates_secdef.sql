-- ════════════════════════════════════════════════════════════════
-- 0023 — Agrégats de tests via SECURITY DEFINER (sans exposer le brut).
--
-- Remplace la lecture team-wide de test_results (0022) par des fonctions qui
-- ne renvoient QUE des dérivés non sensibles :
--   • comparison_line_stats() → par test : moyenne de MA ligne, effectif, mon
--     rang. Aucune valeur individuelle d'un coéquipier.
--   • team_top14(p_team)      → par joueur du club : les tests atteignant le
--     niveau Top 14 (clé + libellé + date de 1re validation). Statut dérivé,
--     jamais les kg/temps bruts.
-- Les valeurs brutes des coéquipiers ne quittent donc plus la base.
--
-- ⚠️ Les seuils / le parsing / le mapping de poste ci-dessous DOIVENT rester
--   synchronisés avec src/lib/top14.js (source de vérité côté app).
-- ════════════════════════════════════════════════════════════════

-- On retire la lecture large introduite en 0022 : un joueur ne lit plus que ses
-- propres résultats (tr_read) ; le staff/owner gardent leur accès.
drop policy if exists tr_team_read on test_results;

-- ---------- Helpers de parsing (miroir de lib/top14.js) ----------
-- Dernier nombre d'une chaîne « 3x170 » → 170 ; « 112.5 » → 112.5.
create or replace function public._t14_kg(s text) returns numeric
  language plpgsql immutable as $$
declare m text[];
begin
  if s is null then return null; end if;
  select array_agg(x[1]) into m from regexp_matches(replace(s, ',', '.'), '[0-9]+(\.[0-9]+)?', 'g') as x;
  if m is null or array_length(m, 1) = 0 then return null; end if;
  return m[array_length(m, 1)]::numeric;
end $$;

-- Bronco « m:ss » / « m'ss » → secondes ; « 5 » → 300 (repli).
create or replace function public._t14_bronco(s text) returns numeric
  language plpgsql immutable as $$
declare mm text[]; n numeric;
begin
  if s is null or s = '' then return null; end if;
  select regexp_match(s, '([0-9]+)\s*[:''′]\s*([0-9]+)') into mm;
  if mm is not null then return mm[1]::int * 60 + mm[2]::int; end if;
  n := nullif(regexp_replace(replace(s, ',', '.'), '[^0-9.]', '', 'g'), '')::numeric;
  if n is null then return null; end if;
  return case when n < 20 then round(n * 60) else n end;
end $$;

-- Poste app → catégorie Top 14 (accents repliés, minuscules).
create or replace function public._t14_cat(pos text) returns text
  language sql immutable as $$
  select case
    when p ~ 'pilier|talonneur' then 'premiere'
    when p ~ 'deuxieme|2e ligne|2eme ligne' then 'deuxieme'
    when p ~ 'troisieme|flanker|3e ligne|no8|n.8|(^|[^0-9])8([^0-9]|$)' then 'troisieme'
    when p ~ 'demi|melee|ouverture|charniere' then 'charniere'
    when p ~ 'centre' then 'centres'
    when p ~ 'ailier|arriere|triangle' then 'triangle'
    else null end
  from (select lower(translate(coalesce(pos, ''), 'àâäéèêëïîôöùûüç', 'aaaeeeeiioouuuc')) as p) t
$$;

-- Seuil (borne basse) par catégorie × test — EXACTEMENT TOP14_BENCH.
create or replace function public._t14_thr(cat text, metric text) returns numeric
  language sql immutable as $$
  select v from (values
    ('premiere','squat',1.70),('premiere','bench',1.30),('premiere','deadlift',1.95),('premiere','hangclean',1.00),('premiere','tractions',0.25),('premiere','mas',4.3),('premiere','bronco',330),('premiere','yoyo',1400),('premiere','cmj',32),
    ('deuxieme','squat',1.65),('deuxieme','bench',1.15),('deuxieme','deadlift',1.90),('deuxieme','hangclean',1.00),('deuxieme','tractions',0.30),('deuxieme','mas',4.4),('deuxieme','bronco',320),('deuxieme','yoyo',1500),('deuxieme','cmj',34),
    ('troisieme','squat',1.75),('troisieme','bench',1.30),('troisieme','deadlift',2.00),('troisieme','hangclean',1.10),('troisieme','tractions',0.37),('troisieme','mas',4.7),('troisieme','bronco',305),('troisieme','yoyo',1800),('troisieme','cmj',38),
    ('charniere','squat',1.75),('charniere','bench',1.30),('charniere','deadlift',2.10),('charniere','hangclean',1.15),('charniere','tractions',0.40),('charniere','mas',4.9),('charniere','bronco',285),('charniere','yoyo',2000),('charniere','cmj',40),
    ('centres','squat',1.75),('centres','bench',1.35),('centres','deadlift',2.05),('centres','hangclean',1.15),('centres','tractions',0.42),('centres','mas',4.7),('centres','bronco',290),('centres','yoyo',1900),('centres','cmj',40),
    ('triangle','squat',1.70),('triangle','bench',1.30),('triangle','deadlift',2.05),('triangle','hangclean',1.15),('triangle','tractions',0.43),('triangle','mas',5.0),('triangle','bronco',285),('triangle','yoyo',2000),('triangle','cmj',42)
  ) as t(cat, metric, v) where t.cat = _t14_thr.cat and t.metric = _t14_thr.metric
$$;

-- Valeur comparable d'un test pour une ligne de résultat (×PdC pour la force).
create or replace function public._t14_val(metric text, r public.test_results) returns numeric
  language sql immutable as $$
  select case metric
    when 'mas' then r.mas
    when 'yoyo' then r.yoyo
    when 'bronco' then public._t14_bronco(r.bronco)
    when 'cmj' then r.cmj_overall
    when 'squat'     then case when coalesce(r.bodyweight,0) > 0 then public._t14_kg(r.squat_5rm) / r.bodyweight end
    when 'bench'     then case when coalesce(r.bodyweight,0) > 0 then r.bench_5rm / r.bodyweight end
    when 'deadlift'  then case when coalesce(r.bodyweight,0) > 0 then r.deadlift / r.bodyweight end
    when 'hangclean' then case when coalesce(r.bodyweight,0) > 0 then r.hang_clean_2rm / r.bodyweight end
    when 'tractions' then case when coalesce(r.bodyweight,0) > 0 then r.tractions / r.bodyweight end
  end
$$;

-- ---------- team_top14 : statut Top 14 par joueur du club ----------
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
    select tr as trow, tr.player_id, c.date as cdate, public._t14_cat(p.pos) as cat
    from test_results tr
    join test_campaigns c on c.id = tr.campaign_id
    join players p on p.id = tr.player_id
    where tr.team_id = (select team from eff)
  ),
  valid as (
    select r.player_id, m.key, m.label, r.cdate
    from res r cross join metrics m
    where r.cat is not null
      and public._t14_val(m.key, r.trow) is not null
      and public._t14_val(m.key, r.trow) > 0
      and public._t14_thr(r.cat, m.key) is not null
      and ((m.dir = 'down' and public._t14_val(m.key, r.trow) <= public._t14_thr(r.cat, m.key))
        or (m.dir = 'up'   and public._t14_val(m.key, r.trow) >= public._t14_thr(r.cat, m.key)))
  )
  select player_id, key, label, min(cdate) as first_date
  from valid group by player_id, key, label
$$;

-- ---------- comparison_line_stats : moyenne + rang de MA ligne ----------
create or replace function public.comparison_line_stats()
  returns table(metric text, line_avg numeric, n int, my_rank int)
  language sql stable security definer set search_path = public, auth as $$
  with me as (select id, grp, team_id from players where id = my_player_id()),
  latest as (  -- dernier résultat daté par joueur de MA ligne
    select distinct on (tr.player_id) tr as trow, tr.player_id
    from test_results tr
    join test_campaigns c on c.id = tr.campaign_id
    join players p on p.id = tr.player_id
    where p.team_id = (select team_id from me) and p.grp = (select grp from me)
    order by tr.player_id, c.date desc
  ),
  metrics(metric, dir) as (values
    ('mas','up'),('yoyo','up'),('bronco','down'),('cmj','up'),
    ('squat','up'),('bench','up'),('deadlift','up'),('tractions','up')),
  vals as (
    select l.player_id, m.metric, m.dir, public._t14_val(m.metric, l.trow) as v
    from latest l cross join metrics m
  ),
  clean as (select * from vals where v is not null and v > 0),
  ranked as (
    select metric, player_id,
      rank() over (partition by metric order by (case when dir = 'down' then v else -v end) asc) as rk
    from clean
  )
  select c.metric, round(avg(c.v)::numeric, 4) as line_avg, count(*)::int as n,
    (select rk from ranked r where r.metric = c.metric and r.player_id = (select id from me))::int as my_rank
  from clean c group by c.metric
$$;

grant execute on function public.team_top14(text)            to authenticated;
grant execute on function public.comparison_line_stats()     to authenticated;
