-- 0100 — Ordre de passage (file d'attente par totems) — fondations.
--
-- Le staff crée une file pour une session (tests, prise en charge, atelier),
-- ajoute des joueurs, indique ce sur quoi il travaille (current_focus) et fait
-- avancer chaque ticket (0 / 50 / 100 %). Le joueur voit son rang et l'ordre par
-- TOTEMS (jamais de nom réel), et peut s'auto-inscrire sur une file ouverte via
-- une RPC SECURITY DEFINER (jamais d'écriture cliente directe). Temps réel sur
-- queue_tickets. RLS club stricte. Notifications « prépare-toi » (2e) / « ton
-- tour » (1er) via trigger → push gratuit (0034). Historique conservé.

-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.queues (
  id            uuid primary key default gen_random_uuid(),
  team_id       text not null references public.teams(id) on delete cascade,
  title         text not null,
  lieu          text,
  scheduled_at  timestamptz,
  status        text not null default 'open',   -- 'open' | 'closed'
  current_focus text,                            -- ce sur quoi le staff travaille
  created_by    uuid,
  created_at    timestamptz not null default now(),
  closed_at     timestamptz,
  constraint queues_status_chk check (status in ('open', 'closed'))
);
create index if not exists queues_team_idx on public.queues (team_id, status);

create table if not exists public.queue_tickets (
  id             uuid primary key default gen_random_uuid(),
  queue_id       uuid not null references public.queues(id) on delete cascade,
  team_id        text not null,
  player_id      uuid not null references public.players(id) on delete cascade,
  position       int not null default 0,
  progress       smallint not null default 0,   -- 0 | 50 | 100
  absent         boolean not null default false,
  notified_stage smallint not null default 0,   -- 0 rien · 1 « prépare-toi » · 2 « ton tour »
  joined_at      timestamptz not null default now(),
  started_at     timestamptz,
  done_at        timestamptz,
  constraint queue_tickets_progress_chk check (progress in (0, 50, 100)),
  constraint queue_tickets_uni unique (queue_id, player_id)
);
create index if not exists queue_tickets_queue_idx on public.queue_tickets (queue_id, position);

alter table public.queues enable row level security;
alter table public.queue_tickets enable row level security;

-- RLS queues : staff écrit sur son club ; owner bypass ; joueur lit une file
-- OUVERTE de son club (pour s'inscrire) ou une file où il a un ticket.
drop policy if exists queues_staff on public.queues;
create policy queues_staff on public.queues for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
drop policy if exists queues_owner on public.queues;
create policy queues_owner on public.queues for all using (is_owner()) with check (is_owner());
drop policy if exists queues_player_read on public.queues;
create policy queues_player_read on public.queues for select using (
  team_id = my_team() and (
    status = 'open'
    or exists (select 1 from public.queue_tickets qt where qt.queue_id = queues.id and qt.player_id = my_player_id())
  )
);

-- RLS tickets : staff/owner gèrent ; joueur lit TOUS les tickets d'une file qu'il
-- peut voir (ordre complet par totems). Aucun write joueur direct (RPC only).
drop policy if exists qt_staff on public.queue_tickets;
create policy qt_staff on public.queue_tickets for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
drop policy if exists qt_owner on public.queue_tickets;
create policy qt_owner on public.queue_tickets for all using (is_owner()) with check (is_owner());
drop policy if exists qt_player_read on public.queue_tickets;
create policy qt_player_read on public.queue_tickets for select using (
  team_id = my_team() and exists (
    select 1 from public.queues q
    where q.id = queue_tickets.queue_id and (
      q.status = 'open'
      or exists (select 1 from public.queue_tickets m where m.queue_id = q.id and m.player_id = my_player_id())
    )
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-inscription du joueur (fin de file), idempotente. Jamais d'insert client.
create or replace function public.queue_join(p_queue uuid)
  returns uuid language plpgsql security definer set search_path = public, auth as $$
declare
  v_player uuid := my_player_id();
  v_team   text;
  v_status text;
  v_id     uuid;
  v_pos    int;
begin
  if v_player is null then raise exception 'no player'; end if;
  select team_id, status into v_team, v_status from public.queues where id = p_queue;
  if v_team is null then raise exception 'no queue'; end if;
  if v_team <> my_team() then raise exception 'forbidden'; end if;
  if v_status <> 'open' then raise exception 'closed'; end if;

  select id into v_id from public.queue_tickets where queue_id = p_queue and player_id = v_player;
  if v_id is not null then return v_id;  -- déjà inscrit
  end if;

  select coalesce(max(position), 0) + 1 into v_pos from public.queue_tickets where queue_id = p_queue;
  insert into public.queue_tickets (queue_id, team_id, player_id, position)
    values (p_queue, v_team, v_player, v_pos)
    returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.queue_join(uuid) from public, anon;
grant execute on function public.queue_join(uuid) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Notifications de file : recalcule les 2 prochains à passer (progress < 100,
-- non absents, par position) et notifie une seule fois chaque palier
-- (notified_stage ne fait qu'augmenter → pas de doublon au réordonnancement).
create or replace function public._queue_recompute_notifications(p_queue uuid)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_team  text;
  v_title text;
  v_rank  int := 0;
  r       record;
begin
  select team_id, title into v_team, v_title from public.queues where id = p_queue;
  if v_team is null then return; end if;
  for r in
    select id, player_id, notified_stage from public.queue_tickets
    where queue_id = p_queue and not absent and progress < 100
    order by position asc, joined_at asc
  loop
    v_rank := v_rank + 1;
    if v_rank = 1 and r.notified_stage < 2 then
      insert into public.notifications (team_id, player_id, type, titre, body, ref_id, route)
        values (v_team, r.player_id, 'queue', '⏱️ C''est ton tour', coalesce(v_title, ''), p_queue, 'passage');
      update public.queue_tickets set notified_stage = 2 where id = r.id;
    elsif v_rank = 2 and r.notified_stage < 1 then
      insert into public.notifications (team_id, player_id, type, titre, body, ref_id, route)
        values (v_team, r.player_id, 'queue', '⏳ Prépare-toi', coalesce(v_title, ''), p_queue, 'passage');
      update public.queue_tickets set notified_stage = 1 where id = r.id;
    elsif v_rank > 2 then
      exit;
    end if;
  end loop;
end;
$$;

-- Ne se déclenche que si position / progress / absent changent (pas notified_stage)
-- → la mise à jour de notified_stage par la fonction ne provoque pas de récursion.
create or replace function public._queue_ticket_changed()
  returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  perform public._queue_recompute_notifications(coalesce(new.queue_id, old.queue_id));
  return null;
end;
$$;
drop trigger if exists tr_queue_ticket_changed on public.queue_tickets;
create trigger tr_queue_ticket_changed
  after insert or delete or update of position, progress, absent on public.queue_tickets
  for each row execute function public._queue_ticket_changed();

alter table public.queues replica identity full;
alter table public.queue_tickets replica identity full;
alter publication supabase_realtime add table queues, queue_tickets;
