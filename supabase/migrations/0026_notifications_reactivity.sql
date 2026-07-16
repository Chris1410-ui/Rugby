-- ════════════════════════════════════════════════════════════════
-- 0026 — Notifications in-app + bonus « top 2 réactivité ».
--
-- 1) notifications : une ligne par joueur à chaque input du staff (tâche,
--    séance, camp, message, questionnaire, résultats de tests). Générées par
--    TRIGGERS (fire quel que soit le chemin : client / RPC / démo) → rien oublié.
-- 2) reactivity_events : journal IMMUABLE (insert-once) de la 1re complétion de
--    chaque input par joueur → les 2 premiers gagnent +15 (calculé par
--    team_reactivity_bonus, ajouté comme event daté dans computePoints).
-- RLS club stricte ; données jamais modifiées par le joueur en direct (sauf
-- marquer ses notifications lues). Aucun barème existant modifié.
-- ════════════════════════════════════════════════════════════════

-- ---------- NOTIFICATIONS ----------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  type       text not null,           -- task|session|camp|message|questionnaire|test
  titre      text not null,
  body       text,
  ref_id     uuid,
  route      text,                     -- onglet joueur : taches|seances|questionnaires|messages|fiche
  read       boolean not null default false,
  created_at timestamptz default now()
);
create index on notifications(player_id, read);
create index on notifications(player_id, created_at desc);

alter table notifications enable row level security;
create policy notif_read on notifications for select
  using (player_id = my_player_id() or (is_staff() and team_id = my_team()));
-- Le joueur ne peut que marquer SES notifications lues.
create policy notif_player_update on notifications for update
  using (player_id = my_player_id()) with check (player_id = my_player_id());
create policy notif_staff on notifications for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy notif_owner on notifications for all using (is_owner()) with check (is_owner());

-- Destinataires d'un `assigned` (all/group/players) → player_ids réels du club
-- (exclut les démos, jamais connectés).
create or replace function public.notif_targets(p_team text, p_assigned jsonb) returns setof uuid
  language sql stable security definer set search_path = public, auth as $$
  select p.id from public.players p
  where p.team_id = p_team and coalesce(p.is_demo, false) = false
    and case coalesce(p_assigned->>'mode', 'all')
      when 'all'     then true
      when 'group'   then p.grp::text = (p_assigned->>'group')
      when 'players' then coalesce(p_assigned->'ids', '[]'::jsonb) ? p.id::text
      else true end
$$;

-- ---------- TRIGGERS notifications ----------
create or replace function public.notify_task() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
    select new.team_id, t, 'task', 'Nouvelle tâche', new.titre, new.id, 'taches'
    from public.notif_targets(new.team_id, new.assigned) t;
  return new;
end $$;
create trigger trg_notify_task after insert on tasks for each row execute function public.notify_task();

create or replace function public.notify_session() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  if coalesce(new.is_demo, false) then return new; end if;
  -- séance ouverte → toute l'équipe (chacun peut s'inscrire) ; sinon destinataires.
  insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
    select new.team_id, t, 'session', 'Nouvelle séance', coalesce(new.titre, 'Séance'), new.id, 'seances'
    from public.notif_targets(new.team_id,
      case when new.assigned->>'mode' = 'open' then '{"mode":"all"}'::jsonb else new.assigned end) t;
  return new;
end $$;
create trigger trg_notify_session after insert on sessions for each row execute function public.notify_session();

create or replace function public.notify_questionnaire() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
    values (new.team_id, new.player_id, 'questionnaire', 'Nouveau questionnaire',
      (select nom from public.questionnaires where id = new.questionnaire_id), new.questionnaire_id, 'questionnaires');
  return new;
end $$;
create trigger trg_notify_questionnaire after insert on questionnaire_assignments for each row execute function public.notify_questionnaire();

create or replace function public.notify_message() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  if new.dir <> 'staff' then return new; end if;
  insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
    select p.team_id, new.player_id, 'message', 'Nouveau message', left(coalesce(new.text, ''), 120), new.player_id, 'messages'
    from public.players p where p.id = new.player_id;
  return new;
end $$;
create trigger trg_notify_message after insert on messages for each row execute function public.notify_message();

create or replace function public.notify_camp() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
    select new.team_id, p.id, 'camp', 'Nouveau camp', new.nom, new.id, 'seances'
    from public.players p where p.team_id = new.team_id and coalesce(p.is_demo, false) = false;
  return new;
end $$;
create trigger trg_notify_camp after insert on camps for each row execute function public.notify_camp();

create or replace function public.notify_test_result() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  -- ignore les upserts sans changement de valeur (mise à jour d'updated_at seule).
  if TG_OP = 'UPDATE' and
     row(new.mas, new.bronco, new.yoyo, new.squat_5rm, new.bench_5rm, new.deadlift, new.hang_clean_2rm, new.tractions, new.cmj_overall, new.bodyweight)
     is not distinct from
     row(old.mas, old.bronco, old.yoyo, old.squat_5rm, old.bench_5rm, old.deadlift, old.hang_clean_2rm, old.tractions, old.cmj_overall, old.bodyweight)
  then return new; end if;
  -- ignore les lignes entièrement vides.
  if coalesce(new.mas::text, new.bronco, new.squat_5rm, new.yoyo::text, new.bench_5rm::text, new.deadlift::text,
              new.hang_clean_2rm::text, new.tractions::text, new.cmj_overall::text, new.bodyweight::text) is null
  then return new; end if;
  insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
    values (new.team_id, new.player_id, 'test', 'Nouveaux résultats de tests', null, new.campaign_id, 'fiche');
  return new;
end $$;
create trigger trg_notify_test_result after insert or update on test_results for each row execute function public.notify_test_result();

-- ---------- REACTIVITY LEDGER ----------
create table reactivity_events (
  input_type   text not null,          -- task|session|questionnaire|camp
  ref_id       uuid not null,
  player_id    uuid not null,
  team_id      text not null,
  completed_at timestamptz not null default now(),
  primary key (input_type, ref_id, player_id)
);
create index on reactivity_events(team_id);
alter table reactivity_events enable row level security; -- aucun accès direct : lecture via RPC (definer)

create or replace function public.react_task() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  if new.statut = 'validee_joueur' then
    insert into public.reactivity_events(input_type, ref_id, player_id, team_id)
      values ('task', new.task_id, new.player_id, new.team_id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger trg_react_task after insert or update on task_completions for each row execute function public.react_task();

create or replace function public.react_session() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  if new.status = 'done' then
    insert into public.reactivity_events(input_type, ref_id, player_id, team_id)
      select 'session', new.session_id, new.player_id, p.team_id from public.players p where p.id = new.player_id
      on conflict do nothing;
  end if;
  return new;
end $$;
create trigger trg_react_session after insert or update on session_logs for each row execute function public.react_session();

create or replace function public.react_questionnaire() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  if new.statut = 'rempli' then
    insert into public.reactivity_events(input_type, ref_id, player_id, team_id)
      values ('questionnaire', new.questionnaire_id, new.player_id, new.team_id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger trg_react_questionnaire after insert or update on questionnaire_assignments for each row execute function public.react_questionnaire();

create or replace function public.react_camp() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.reactivity_events(input_type, ref_id, player_id, team_id)
    values ('camp', new.camp_id, new.player_id, new.team_id) on conflict do nothing;
  return new;
end $$;
create trigger trg_react_camp after insert on camp_participants for each row execute function public.react_camp();

-- Top 2 par input (rang sur la 1re complétion) → events +15 pour computePoints.
create or replace function public.team_reactivity_bonus(p_team text default null)
  returns table(player_id uuid, label text, at date)
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
      when 'questionnaire' then 'questionnaire' else 'camp' end || ')' as label,
    completed_at::date as at
  from ranked where rn <= 2
$$;
grant execute on function public.team_reactivity_bonus(text) to authenticated;

-- ---------- REALTIME ----------
alter publication supabase_realtime add table notifications;
