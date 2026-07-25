-- 0082 — Convocations aux entraînements + présences (PR-B : fondations)
--
-- Deux tables calquées sur challenges/tasks :
--   • trainings           : l'entraînement convoqué (date, heure, lieu, nature,
--                           destinataires `assigned` combinables comme les
--                           programmes).
--   • training_attendance : une ligne par (entraînement, joueur), créée en LAZY
--                           à la 1ʳᵉ réponse du joueur ou au 1ᵉʳ pointage staff.
--                           `player_response` = l'annonce du joueur (via RPC
--                           SECURITY DEFINER, jamais d'écriture directe) ;
--                           `staff_status` = le pointage staff, LA VÉRITÉ.
--
-- Portée : équipe (team_id, RLS team_id = my_team()) — aucune fuite inter-club.
-- Gamification : alimentée plus tard (PR-D) via team_training_events, calée sur
-- le pointage staff ; réactivité existante étendue à input_type='convocation'.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.trainings (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references public.teams(id),
  date       date not null,
  heure      text,
  lieu       text,
  nature     text,                                   -- pour l'anti-surcharge
  titre      text,
  notes      text,
  assigned   jsonb not null default '{"mode":"all"}',
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (id, team_id)                               -- pour la FK composite
);
create index if not exists trainings_team_date_idx on public.trainings (team_id, date);

create table if not exists public.training_attendance (
  training_id     uuid not null,
  player_id       uuid not null,
  team_id         text not null,
  player_response text check (player_response in ('present','absent','late')), -- null = pas répondu
  absence_reason  text,
  eta             text,
  responded_at    timestamptz,
  staff_status    text check (staff_status in ('present','absent','late')),    -- null = pas pointé (vérité)
  staff_by        uuid,
  staff_at        timestamptz,
  created_at      timestamptz not null default now(),
  primary key (training_id, player_id),
  foreign key (training_id, team_id) references public.trainings(id, team_id) on delete cascade,
  foreign key (player_id, team_id)   references public.players(id, team_id)   on delete cascade
);
create index if not exists training_attendance_training_idx on public.training_attendance (training_id);
create index if not exists training_attendance_player_idx   on public.training_attendance (player_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Résolution des destinataires (miroir de _challenge_assigned_to)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._training_assigned_to(tr public.trainings, p_player uuid)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select case coalesce(tr.assigned->>'mode', 'all')
    when 'all'     then true
    when 'open'    then true
    when 'group'   then (tr.assigned->>'group') = (select grp::text from public.players where id = p_player)
    when 'players' then coalesce(tr.assigned->'ids', '[]'::jsonb) ? p_player::text
    when 'mix'     then (coalesce(tr.assigned->'groups', '[]'::jsonb) ? (select grp::text from public.players where id = p_player))
                     or (coalesce(tr.assigned->'ids', '[]'::jsonb) ? p_player::text)
    else true end
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.trainings enable row level security;
alter table public.training_attendance enable row level security;

-- trainings : staff de l'équipe (lecture+écriture) ; joueur convoqué (lecture).
drop policy if exists trainings_read on public.trainings;
create policy trainings_read on public.trainings for select using (
  (is_staff() and team_id = my_team())
  or _training_assigned_to(trainings, my_player_id())
);
drop policy if exists trainings_write on public.trainings;
create policy trainings_write on public.trainings for all
  using (is_staff() and team_id = my_team())
  with check (is_staff() and team_id = my_team());

-- training_attendance : staff de l'équipe (lecture + pointage) ; joueur (lecture
-- de sa ligne). Le joueur N'ÉCRIT PAS directement — il passe par le RPC
-- training_respond (SECURITY DEFINER). Pas de policy d'écriture joueur.
drop policy if exists ta_read on public.training_attendance;
create policy ta_read on public.training_attendance for select using (
  (is_staff() and team_id = my_team()) or player_id = my_player_id()
);
drop policy if exists ta_staff_write on public.training_attendance;
create policy ta_staff_write on public.training_attendance for all
  using (is_staff() and team_id = my_team())
  with check (is_staff() and team_id = my_team());

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC : réponse joueur (le joueur n'écrit jamais en direct)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.training_respond(
  p_training uuid, p_response text, p_reason text default null, p_eta text default null
) returns void language plpgsql security definer set search_path = public, auth as $$
declare
  v_player uuid := my_player_id();
  v_tr     public.trainings;
begin
  if v_player is null then raise exception 'no player'; end if;
  if p_response not in ('present','absent','late') then raise exception 'bad response'; end if;
  select * into v_tr from public.trainings where id = p_training;
  if not found then raise exception 'training not found'; end if;
  if not public._training_assigned_to(v_tr, v_player) then raise exception 'not convened'; end if;

  insert into public.training_attendance(training_id, player_id, team_id, player_response, absence_reason, eta, responded_at)
    values (p_training, v_player, v_tr.team_id, p_response,
            case when p_response = 'absent' then p_reason end,
            case when p_response = 'late'   then p_eta   end,
            now())
  on conflict (training_id, player_id) do update
    set player_response = excluded.player_response,
        absence_reason  = excluded.absence_reason,
        eta             = excluded.eta,
        responded_at    = now();  -- ne touche jamais au pointage staff
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC : relance des non-répondants (staff)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.training_remind(p_training uuid)
returns integer language plpgsql security definer set search_path = public, auth as $$
declare v_tr public.trainings; v_n integer;
begin
  select * into v_tr from public.trainings where id = p_training;
  if not found then raise exception 'training not found'; end if;
  if not (is_staff() and v_tr.team_id = my_team()) then raise exception 'forbidden'; end if;

  insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
    select v_tr.team_id, t, 'convocation', '⏰ Relance convocation', coalesce(v_tr.titre, ''), v_tr.id, 'convocations'
    from public.notif_targets(v_tr.team_id, v_tr.assigned) t
    where t not in (
      select player_id from public.training_attendance
      where training_id = p_training and player_response is not null
    );
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- RPC lecture : events de points datés (calés sur le POINTAGE STAFF = vérité)
--   present            → présence confirmée
--   late               → présent en retard
--   absentUnannounced  → absent non annoncé (le joueur n'a pas prévenu 'absent')
-- Absence annoncée (player_response='absent') = 0 point → aucun event.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.team_training_events(p_team text default null)
returns table (player_id uuid, kind text, at date)
language sql stable security definer set search_path = public, auth as $$
  with eff as (
    select case when p_team is null then my_team() when is_owner() then p_team
      when p_team = my_team() then p_team else my_team() end as team
  )
  select ta.player_id,
    case ta.staff_status
      when 'present' then 'present'
      when 'late'    then 'late'
      when 'absent'  then 'absentUnannounced'
    end as kind,
    tr.date as at
  from public.training_attendance ta
  join public.trainings tr on tr.id = ta.training_id
  where tr.team_id = (select team from eff)
    and ta.staff_status is not null
    -- absence annoncée à l'avance = neutre (pas d'event). coalesce indispensable :
    -- sans réponse (NULL), l'absence est NON annoncée → doit produire un event.
    and not (ta.staff_status = 'absent' and coalesce(ta.player_response, '') = 'absent')
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger : notification de convocation (→ push gratuit via notify_push_trg)
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.notify_convocation()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
    select new.team_id, t, 'convocation', '📣 Convocation', coalesce(new.titre, ''), new.id, 'convocations'
    from public.notif_targets(new.team_id, new.assigned) t;
  return new;
end $$;
drop trigger if exists notify_convocation_trg on public.trainings;
create trigger notify_convocation_trg after insert on public.trainings
  for each row execute function public.notify_convocation();

-- ─────────────────────────────────────────────────────────────────────────────
-- Trigger : réactivité (1ʳᵉ réponse du joueur) → +15 existant
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.react_convocation()
returns trigger language plpgsql security definer set search_path = public, auth as $$
begin
  if new.player_response is not null then
    insert into public.reactivity_events(input_type, ref_id, player_id, team_id)
      values ('convocation', new.training_id, new.player_id, new.team_id) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists react_convocation_trg on public.training_attendance;
create trigger react_convocation_trg after insert or update on public.training_attendance
  for each row execute function public.react_convocation();

-- Étendre le libellé de réactivité au type 'convocation' (additif — barème inchangé).
create or replace function public.team_reactivity_bonus(p_team text default null)
returns table (player_id uuid, label text, at date)
language sql stable security definer set search_path = public, auth as $$
  with eff as (
    select case when p_team is null then my_team() when is_owner() then p_team
      when p_team = my_team() then p_team else my_team() end as team
  ),
  ranked as (
    select re.player_id, re.input_type, re.completed_at,
      row_number() over (partition by re.input_type, re.ref_id order by re.completed_at asc, re.player_id) as rn
    from public.reactivity_events re where re.team_id = (select team from eff)
  )
  select player_id,
    '⚡ Top 2 réactivité (' || case input_type
      when 'task' then 'tâche' when 'session' then 'séance'
      when 'questionnaire' then 'questionnaire' when 'challenge' then 'défi'
      when 'convocation' then 'convocation' else 'camp' end || ')' as label,
    completed_at::date as at
  from ranked where rn <= 2
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Grants : les RPC ne sont pas ouvertes à anon
-- ─────────────────────────────────────────────────────────────────────────────
revoke execute on function public.training_respond(uuid, text, text, text) from public, anon;
revoke execute on function public.training_remind(uuid) from public, anon;
revoke execute on function public.team_training_events(text) from public, anon;
grant execute on function public.training_respond(uuid, text, text, text) to authenticated;
grant execute on function public.training_remind(uuid) to authenticated;
grant execute on function public.team_training_events(text) to authenticated;

-- Fonctions de trigger : jamais appelées en RPC (le trigger les exécute en tant
-- que propriétaire indépendamment de ces droits) → on retire tout EXECUTE.
revoke execute on function public.notify_convocation() from public, anon, authenticated;
revoke execute on function public.react_convocation() from public, anon, authenticated;
