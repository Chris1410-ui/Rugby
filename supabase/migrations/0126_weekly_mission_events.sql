-- ─────────────────────────────────────────────────────────────────────────────
-- Classement v2 · PR-5 — Mission hebdo (objectif « 3 jours » + points additifs).
--
-- Reprend l'objectif EXISTANT « 3 jours avec ≥ 1 séance validée » (WEEKLY_GOAL_
-- DAYS) et le récompense via une EXTENSION ADDITIVE de computePoints (param
-- weeklyMissionEvents). UNE seule monnaie : +15 dans le barème, 1×/semaine ISO,
-- daté, idempotent (motif identique aux paliers de série). Aucune formule
-- existante modifiée. Crédit paresseux côté base (self-check), lecture club par
-- RPC SECURITY DEFINER (jamais de donnée de santé).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.weekly_mission_events (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  team_id    text not null,
  iso_week   text not null,                        -- 'IYYY-IW' (semaine ISO)
  reached_on date not null,
  created_at timestamptz not null default now()
);
create unique index if not exists weekly_mission_events_uk on public.weekly_mission_events(player_id, iso_week);
create index if not exists weekly_mission_events_player_idx on public.weekly_mission_events(player_id);

alter table public.weekly_mission_events enable row level security;
drop policy if exists weekly_mission_select on public.weekly_mission_events;
create policy weekly_mission_select on public.weekly_mission_events for select to authenticated
using (player_id = my_player_id() or (team_id = my_team() and is_staff()) or is_owner());

-- Crédit paresseux : appelé au chargement du joueur. Objectif = 3 JOURS
-- DISTINCTS de la semaine ISO courante avec au moins une séance validée.
create or replace function public.weekly_mission_sync(p_today date default current_date)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_me   uuid := my_player_id();
  v_team text := my_team();
  v_mon  date := date_trunc('week', p_today)::date;  -- lundi de la semaine ISO
  v_week text := to_char(p_today, 'IYYY-IW');
  v_days int;
begin
  if v_me is null then return; end if;
  if exists (select 1 from public.weekly_mission_events where player_id = v_me and iso_week = v_week) then
    return; -- déjà crédité cette semaine
  end if;
  select count(distinct se.date) into v_days
  from public.session_logs sl
  join public.sessions se on se.id = sl.session_id
  where sl.player_id = v_me and sl.status = 'done'
    and se.date >= v_mon and se.date < v_mon + 7;
  if coalesce(v_days, 0) >= 3 then   -- WEEKLY_GOAL_DAYS
    insert into public.weekly_mission_events (player_id, team_id, iso_week, reached_on)
      values (v_me, v_team, v_week, p_today)
      on conflict (player_id, iso_week) do nothing;
  end if;
end $$;

-- Faits « mission hebdo » à l'échelle du club (classement) — (player_id, reached_on).
create or replace function public.team_weekly_mission_events(p_team text default null)
returns table (player_id uuid, reached_on date)
language sql stable security definer set search_path = public, auth as $$
  with eff as (
    select case when p_team is null then my_team() when is_owner() then p_team
      when p_team = my_team() then p_team else my_team() end as team
  )
  select e.player_id, e.reached_on
  from public.weekly_mission_events e
  where e.team_id = (select team from eff)
$$;

revoke execute on function public.weekly_mission_sync(date) from public, anon;
grant execute on function public.weekly_mission_sync(date) to authenticated;
revoke execute on function public.team_weekly_mission_events(text) from public, anon;
grant execute on function public.team_weekly_mission_events(text) to authenticated;