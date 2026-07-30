-- ─────────────────────────────────────────────────────────────────────────────
-- Lot 2 · PR-D — Duels 1-contre-1 (onglet Équipe).
--
-- Défi entre deux joueurs du MÊME club sur une période (par défaut 7 jours),
-- métrique « séances validées ». Invitation → acceptation → résultat.
-- Un duel NE CRÉE AUCUNE MONNAIE : il met en scène un décompte de faits DÉJÀ
-- comptés (session_logs.status='done'). Barème computePoints inchangé.
--
-- Écriture uniquement via RPC SECURITY DEFINER (transitions de statut légales) ;
-- la table n'expose que le SELECT (participants + staff du club). Helpers de RLS
-- réutilisés : my_player_id(), my_team(), is_staff(), is_owner().
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.duels (
  id            uuid primary key default gen_random_uuid(),
  team_id       text not null,
  challenger_id uuid not null references public.players(id) on delete cascade,
  opponent_id   uuid not null references public.players(id) on delete cascade,
  metric        text not null default 'sessions_validated',
  period_days   int  not null default 7,
  status        text not null default 'pending',
  created_at    timestamptz not null default now(),
  responded_at  timestamptz,
  ends_at       date,
  constraint duels_distinct check (challenger_id <> opponent_id),
  constraint duels_status_valid check (status in ('pending','accepted','declined','cancelled'))
);
create index if not exists duels_team_idx on public.duels(team_id);
create index if not exists duels_challenger_idx on public.duels(challenger_id);
create index if not exists duels_opponent_idx on public.duels(opponent_id);

alter table public.duels enable row level security;

-- Lecture : participants du duel, staff du club, ou owner. Aucune policy
-- d'écriture → INSERT/UPDATE/DELETE passent obligatoirement par les RPC.
drop policy if exists duels_select on public.duels;
create policy duels_select on public.duels for select to authenticated
using (
  challenger_id = my_player_id()
  or opponent_id = my_player_id()
  or (team_id = my_team() and is_staff())
  or is_owner()
);

-- ── Créer un duel (challenger = le joueur connecté) ──
create or replace function public.duel_create(p_opponent uuid, p_days int default 7)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_me uuid := my_player_id(); v_team text := my_team(); v_id uuid;
begin
  if v_me is null then raise exception 'no_player'; end if;
  if p_opponent = v_me then raise exception 'self_duel'; end if;
  perform 1 from public.players where id = p_opponent and team_id = v_team;
  if not found then raise exception 'opponent_not_in_team'; end if;
  perform 1 from public.duels
    where team_id = v_team and status in ('pending','accepted')
      and ((challenger_id = v_me and opponent_id = p_opponent)
        or (challenger_id = p_opponent and opponent_id = v_me));
  if found then raise exception 'active_duel_exists'; end if;
  insert into public.duels(team_id, challenger_id, opponent_id, metric, period_days, status)
    values (v_team, v_me, p_opponent, 'sessions_validated', greatest(1, least(coalesce(p_days,7), 30)), 'pending')
    returning id into v_id;
  return v_id;
end $$;

-- ── Répondre (opponent uniquement) : accepter → fixe ends_at, ou refuser ──
create or replace function public.duel_respond(p_duel uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_me uuid := my_player_id(); d public.duels;
begin
  select * into d from public.duels where id = p_duel;
  if not found then raise exception 'not_found'; end if;
  if d.opponent_id <> v_me then raise exception 'not_opponent'; end if;
  if d.status <> 'pending' then raise exception 'not_pending'; end if;
  if p_accept then
    update public.duels set status = 'accepted', responded_at = now(), ends_at = (now()::date + d.period_days) where id = p_duel;
  else
    update public.duels set status = 'declined', responded_at = now() where id = p_duel;
  end if;
end $$;

-- ── Annuler (challenger uniquement, tant que pending) ──
create or replace function public.duel_cancel(p_duel uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_me uuid := my_player_id(); d public.duels;
begin
  select * into d from public.duels where id = p_duel;
  if not found then raise exception 'not_found'; end if;
  if d.challenger_id <> v_me then raise exception 'not_challenger'; end if;
  if d.status <> 'pending' then raise exception 'not_pending'; end if;
  update public.duels set status = 'cancelled' where id = p_duel;
end $$;

-- ── Score en direct (participants/staff) : décompte des séances validées dans
--    la fenêtre, mise en scène des faits déjà comptés. Aucune monnaie créée. ──
create or replace function public.duel_standing(p_duel uuid)
returns table (challenger_n int, opponent_n int, starts_at date, ends_at date, status text, is_over boolean, winner_id uuid)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare d public.duels; v_start date;
begin
  select * into d from public.duels where id = p_duel;
  if not found then return; end if;
  if not (d.challenger_id = my_player_id() or d.opponent_id = my_player_id()
          or (d.team_id = my_team() and is_staff()) or is_owner()) then
    return;
  end if;

  v_start := coalesce(d.responded_at::date, d.created_at::date);
  starts_at := v_start;
  ends_at := d.ends_at;
  status := d.status;
  is_over := d.ends_at is not null and now()::date > d.ends_at;

  if d.status = 'accepted' then
    select count(*) into challenger_n
      from public.session_logs sl join public.sessions se on se.id = sl.session_id
      where sl.player_id = d.challenger_id and sl.status = 'done' and se.team_id = d.team_id
        and sl.logged_at::date >= v_start and (d.ends_at is null or sl.logged_at::date <= d.ends_at);
    select count(*) into opponent_n
      from public.session_logs sl join public.sessions se on se.id = sl.session_id
      where sl.player_id = d.opponent_id and sl.status = 'done' and se.team_id = d.team_id
        and sl.logged_at::date >= v_start and (d.ends_at is null or sl.logged_at::date <= d.ends_at);
  else
    challenger_n := 0; opponent_n := 0;
  end if;

  if is_over then
    winner_id := case when challenger_n > opponent_n then d.challenger_id
                      when opponent_n > challenger_n then d.opponent_id
                      else null end;
  else
    winner_id := null;
  end if;
  return next;
end $$;

revoke execute on function public.duel_create(uuid, int) from public, anon;
revoke execute on function public.duel_respond(uuid, boolean) from public, anon;
revoke execute on function public.duel_cancel(uuid) from public, anon;
revoke execute on function public.duel_standing(uuid) from public, anon;
grant execute on function public.duel_create(uuid, int) to authenticated;
grant execute on function public.duel_respond(uuid, boolean) to authenticated;
grant execute on function public.duel_cancel(uuid) to authenticated;
grant execute on function public.duel_standing(uuid) to authenticated;
