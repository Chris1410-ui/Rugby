-- ─────────────────────────────────────────────────────────────────────────────
-- Lot 3 · PR-4 — Série + gel de série (écran Accueil).
--
-- « Jour validé » = bilan du matin fait (daily_checkins moment='matin'). Une
-- nuit GELÉE protège la série (compte comme validée pour la continuité). Le
-- nombre de jours de série est DÉRIVÉ (jamais stocké) ; seul le ledger des gels
-- (crédits/consommations) est persisté — auditable.
--
-- Attribution : 1 gel/mois (crédit paresseux, sans cron), stock plafonné à 2,
-- usage manuel. Le +1 au palier 14 j sera crédité en PR-5.
-- Toutes les écritures passent par des RPC SECURITY DEFINER (self-check
-- my_player_id()). Les dates sont LOCALES au joueur (passées par le client,
-- comme daily_checkins.date) → aligné sur le reset minuit local (lot 1).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.streak_freezes (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  team_id    text not null,
  kind       text not null check (kind in ('grant','use')),
  reason     text,                              -- 'monthly' | 'tier14' | 'manual'
  night_date date,                              -- pour 'use' : nuit protégée (date locale)
  created_at timestamptz not null default now()
);
create index if not exists streak_freezes_player_idx on public.streak_freezes(player_id);
-- Idempotence : une seule protection par (joueur, nuit).
create unique index if not exists streak_freezes_use_night_uk
  on public.streak_freezes(player_id, night_date) where kind = 'use';

alter table public.streak_freezes enable row level security;
drop policy if exists streak_freezes_select on public.streak_freezes;
create policy streak_freezes_select on public.streak_freezes for select to authenticated
using (
  player_id = my_player_id()
  or (team_id = my_team() and is_staff())
  or is_owner()
);

-- ── Synchro série : recompte + crédite paresseusement le gel mensuel ──
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

  -- Série courante : on part d'aujourd'hui s'il est tenu, sinon d'hier (grâce
  -- « jour en cours »), puis on remonte tant que les jours s'enchaînent.
  v_cur := p_today;
  if not (v_cur = any(v_held)) then v_cur := p_today - 1; end if;
  while v_cur = any(v_held) loop
    v_streak := v_streak + 1;
    v_cur := v_cur - 1;
  end loop;

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

-- ── Utiliser un gel pour la nuit (date locale) ──
create or replace function public.streak_freeze_use(p_night date default current_date)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_me uuid := my_player_id(); v_team text := my_team(); v_avail int;
begin
  if v_me is null then raise exception 'no_player'; end if;
  -- Pas de gel rétroactif au-delà d'hier (anti-abus) ni pré-gel lointain.
  if p_night < current_date - 1 or p_night > current_date + 1 then raise exception 'bad_night'; end if;
  -- Jour déjà validé (bilan matin) → gel inutile.
  if exists (select 1 from public.daily_checkins where player_id = v_me and coalesce(moment,'matin')='matin' and date = p_night) then
    raise exception 'already_validated';
  end if;
  if exists (select 1 from public.streak_freezes where player_id = v_me and kind='use' and night_date = p_night) then
    raise exception 'already_frozen';
  end if;
  v_avail := (select count(*) filter (where kind='grant') - count(*) filter (where kind='use')
              from public.streak_freezes where player_id = v_me);
  if v_avail <= 0 then raise exception 'no_freeze'; end if;
  insert into public.streak_freezes(player_id, team_id, kind, reason, night_date) values (v_me, v_team, 'use', 'manual', p_night);
end $$;

revoke execute on function public.streak_sync(date) from public, anon;
revoke execute on function public.streak_freeze_use(date) from public, anon;
grant execute on function public.streak_sync(date) to authenticated;
grant execute on function public.streak_freeze_use(date) to authenticated;
