-- ─────────────────────────────────────────────────────────────────────────────
-- Lot 3 · PR-5 — Paliers de série 7 / 14 / 30 jours (écran Accueil).
--
-- Points ADDITIFS (barème existant inchangé) : +25 / +50 / +100 par palier
-- atteint, une seule fois par RUN de série (run_start = 1er jour du run courant).
-- Les events sont créés PARESSEUSEMENT par streak_sync (comme le crédit mensuel
-- de gel), idempotents par (player_id, run_start, tier). Au palier 14, un gel
-- bonus est crédité (plafond 2). Le palier 30 alimente le mur du club.
--
-- Modèle « faits de points » du club (0036/0114) : la table reste en RLS stricte
-- (self/staff/owner) et une RPC SECURITY DEFINER expose le sous-ensemble minimal
-- (player_id, tier, reached_on) au calcul du classement — jamais la longueur
-- courante ni aucune donnée de santé.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.streak_tier_events (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  team_id    text not null,
  tier       int  not null check (tier in (7, 14, 30)),
  reached_on date not null,                 -- jour réel d'atteinte (run_start + tier - 1)
  run_start  date not null,                 -- 1er jour du run → 1 crédit par run et par palier
  created_at timestamptz not null default now()
);
create index if not exists streak_tier_events_player_idx on public.streak_tier_events(player_id);
create unique index if not exists streak_tier_events_run_uk
  on public.streak_tier_events(player_id, run_start, tier);

alter table public.streak_tier_events enable row level security;
drop policy if exists streak_tier_events_select on public.streak_tier_events;
create policy streak_tier_events_select on public.streak_tier_events for select to authenticated
using (
  player_id = my_player_id()
  or (team_id = my_team() and is_staff())
  or is_owner()
);

-- ── streak_sync : + crédit paresseux des paliers + gel bonus au palier 14 ──
create or replace function public.streak_sync(p_today date default current_date)
returns table (streak int, best int, freezes_available int, frozen_tonight boolean)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me   uuid := my_player_id();
  v_team text := my_team();
  v_avail int;
  v_held date[];
  v_cur date;
  v_run int := 0;
  v_best int := 0;
  v_streak int := 0;
  v_prev date;
  v_start date;
  v_tier int;
  v_reached date;
  v_ins int;
begin
  if v_me is null then return; end if;

  -- Crédit mensuel paresseux : 1/mois, seulement si stock < 2 (plafond).
  v_avail := (select count(*) filter (where kind='grant') - count(*) filter (where kind='use')
              from public.streak_freezes where player_id = v_me);
  if v_avail < 2
     and not exists (
       select 1 from public.streak_freezes
       where player_id = v_me and kind='grant' and reason='monthly'
         and date_trunc('month', created_at) = date_trunc('month', now()))
  then
    insert into public.streak_freezes(player_id, team_id, kind, reason) values (v_me, v_team, 'grant', 'monthly');
  end if;

  -- Jours « tenus » : bilan matin OU nuit gelée (90 j glissants), triés croissant.
  select coalesce(array_agg(d order by d), '{}'::date[]) into v_held
  from (
    select distinct c.date as d from public.daily_checkins c
      where c.player_id = v_me and coalesce(c.moment,'matin')='matin' and c.date >= p_today - 90
    union
    select f.night_date from public.streak_freezes f
      where f.player_id = v_me and f.kind='use' and f.night_date is not null and f.night_date >= p_today - 90
  ) s;

  -- Série courante : on part d'aujourd'hui s'il est tenu, sinon d'hier.
  v_cur := p_today;
  if not (v_cur = any(v_held)) then v_cur := p_today - 1; end if;
  while v_cur = any(v_held) loop
    v_streak := v_streak + 1;
    v_cur := v_cur - 1;
  end loop;

  -- Paliers atteints par le run courant : crédit idempotent (1/run/palier).
  if v_streak > 0 then
    v_start := v_cur + 1;                    -- 1er jour tenu du run
    foreach v_tier in array array[7, 14, 30] loop
      if v_streak >= v_tier then
        v_reached := v_start + (v_tier - 1);
        insert into public.streak_tier_events(player_id, team_id, tier, reached_on, run_start)
          values (v_me, v_team, v_tier, v_reached, v_start)
          on conflict (player_id, run_start, tier) do nothing;
        get diagnostics v_ins = row_count;
        -- Palier 14 : gel bonus (respecte le plafond de 2), une seule fois par run.
        if v_tier = 14 and v_ins = 1
           and (select count(*) filter (where kind='grant') - count(*) filter (where kind='use')
                from public.streak_freezes where player_id = v_me) < 2 then
          insert into public.streak_freezes(player_id, team_id, kind, reason) values (v_me, v_team, 'grant', 'tier14');
        end if;
      end if;
    end loop;
  end if;

  -- Record : plus longue suite dans la fenêtre.
  foreach v_cur in array v_held loop
    if v_prev is not null and v_cur = v_prev + 1 then v_run := v_run + 1;
    else v_run := 1; end if;
    if v_run > v_best then v_best := v_run; end if;
    v_prev := v_cur;
  end loop;

  streak := v_streak;
  best := greatest(v_best, v_streak);
  freezes_available := (select count(*) filter (where kind='grant') - count(*) filter (where kind='use')
                        from public.streak_freezes where player_id = v_me);
  frozen_tonight := exists (select 1 from public.streak_freezes where player_id = v_me and kind='use' and night_date = p_today);
  return next;
end $$;

-- ── Faits de points « palier de série » à l'échelle du club (classement) ──
create or replace function public.team_streak_tier_events(p_team text default null)
returns table (player_id uuid, tier int, reached_on date)
language sql stable security definer set search_path = public, auth as $$
  with eff as (
    select case when p_team is null then my_team() when is_owner() then p_team
      when p_team = my_team() then p_team else my_team() end as team
  )
  select e.player_id, e.tier, e.reached_on
  from public.streak_tier_events e
  where e.team_id = (select team from eff)
$$;

-- ── Mur du club : le palier 30 apparaît dans le fil d'activité (pseudonymisé) ──
create or replace function public.team_activity_feed(p_team text default null, p_limit int default 40)
returns table (player_id uuid, kind text, occurred_at timestamptz, subject text)
language sql
stable
security definer
set search_path = public, auth
as $$
  with eff as (
    select case
      when p_team is null then my_team()
      when is_owner() then p_team
      when p_team = my_team() then p_team
      else my_team()
    end as team
  ),
  feed as (
    select sl.player_id, 'session'::text as kind, sl.logged_at as occurred_at, se.titre as subject
    from public.session_logs sl
    join public.sessions se on se.id = sl.session_id
    join public.players p on p.id = sl.player_id
    where sl.status = 'done'
      and se.team_id = (select team from eff)
      and p.team_id = (select team from eff)
      and sl.logged_at >= now() - interval '30 days'

    union all
    select c.player_id, 'checkin'::text, c.created_at, coalesce(c.moment, 'matin')
    from public.daily_checkins c
    join public.players p on p.id = c.player_id
    where coalesce(c.moment, 'matin') in ('matin', 'soir')
      and p.team_id = (select team from eff)
      and c.created_at >= now() - interval '30 days'

    union all
    select cc.player_id, 'challenge'::text, coalesce(cc.confirmed_at, cc.validated_at), ch.titre
    from public.challenge_completions cc
    join public.challenges ch on ch.id = cc.challenge_id
    where cc.team_id = (select team from eff)
      and cc.statut in ('validee_joueur', 'confirmee')
      and coalesce(cc.confirmed_at, cc.validated_at) >= now() - interval '30 days'

    union all
    select ta.player_id, 'convocation'::text, coalesce(ta.staff_at, ta.responded_at), tr.titre
    from public.training_attendance ta
    join public.trainings tr on tr.id = ta.training_id
    where ta.team_id = (select team from eff)
      and ta.staff_status = 'present'
      and coalesce(ta.staff_at, ta.responded_at) >= now() - interval '30 days'

    union all
    select g.player_id, 'gps'::text, g.created_at, null::text
    from public.gps_sessions g
    where g.team_id = (select team from eff)
      and g.created_at >= now() - interval '30 days'

    union all
    -- Palier 30 jours (grande série) → célébré sur le mur, subject = le palier.
    select e.player_id, 'streak'::text, e.created_at, e.tier::text
    from public.streak_tier_events e
    where e.team_id = (select team from eff)
      and e.tier = 30
      and e.created_at >= now() - interval '30 days'
  )
  select player_id, kind, occurred_at, subject
  from feed
  where occurred_at is not null
  order by occurred_at desc
  limit greatest(1, least(coalesce(p_limit, 40), 100));
$$;

revoke execute on function public.team_streak_tier_events(text) from public, anon;
grant execute on function public.team_streak_tier_events(text) to authenticated;
revoke execute on function public.team_activity_feed(text, int) from public, anon;
grant execute on function public.team_activity_feed(text, int) to authenticated;