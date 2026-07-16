-- ════════════════════════════════════════════════════════════════
-- 0024 — Tâches assignées aux joueurs + validation en 2 temps.
--
-- Le staff crée une tâche (titre, description, lieu, échéance, destinataires
-- all/group/players comme les séances). Le joueur clique « Fait »
-- (→ validee_joueur, +2 pts), le coach confirme (→ confirmee) ou refuse
-- (→ a_faire, points retirés).
--
-- Le joueur n'écrit JAMAIS en direct sur task_completions : il passe par les
-- fonctions SECURITY DEFINER task_mark_done / task_unmark (comme
-- l'auto-inscription 0020). Le +2 est visible par tous au classement via
-- team_task_points (dérivé, jamais d'autre donnée que « a validé la tâche X »).
-- Isolation club : FK composites (patron crews/camps) + RLS my_team().
-- ════════════════════════════════════════════════════════════════

-- ---------- TABLES ----------
create table tasks (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null references teams(id) on delete cascade,
  titre       text not null,
  description text,
  lieu        text,
  echeance    date,
  assigned    jsonb not null default '{"mode":"all"}',
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now(),
  unique (id, team_id)
);
create index on tasks(team_id, echeance);

create table task_completions (
  task_id      uuid not null,
  player_id    uuid not null,
  team_id      text not null,
  statut       text not null default 'a_faire' check (statut in ('a_faire','validee_joueur','confirmee')),
  validated_at timestamptz,
  confirmed_at timestamptz,
  updated_at   timestamptz default now(),
  primary key (task_id, player_id),
  foreign key (task_id, team_id)   references tasks(id, team_id)     on delete cascade,
  foreign key (player_id, team_id) references players(id, team_id)   on delete cascade
);
create index on task_completions(player_id);

-- ---------- RLS ----------
alter table tasks             enable row level security;
alter table task_completions  enable row level security;

-- tasks : lues par tout le club (le joueur filtre ses tâches assignées), écrites par le staff.
create policy tasks_read  on tasks for select using (team_id = my_team());
create policy tasks_staff on tasks for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy tasks_owner on tasks for all using (is_owner()) with check (is_owner());

-- task_completions : le joueur voit les siennes ; le staff toutes celles du club.
-- Écriture directe réservée au staff/owner (confirmer / refuser). Le joueur passe
-- par les RPC ci-dessous.
create policy tc_read  on task_completions for select
  using (player_id = my_player_id() or (is_staff() and team_id = my_team()));
create policy tc_staff on task_completions for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy tc_owner on task_completions for all using (is_owner()) with check (is_owner());

-- ---------- RPC (joueur) ----------
-- Le joueur est-il destinataire de la tâche ? (assigned all/group/players)
create or replace function public._task_assigned_to(t public.tasks, p_player uuid) returns boolean
  language sql stable security definer set search_path = public, auth as $$
  select case coalesce(t.assigned->>'mode', 'all')
    when 'all'    then true
    when 'group'  then (t.assigned->>'group') = (select grp::text from public.players where id = p_player)
    when 'players' then coalesce(t.assigned->'ids', '[]'::jsonb) ? p_player::text
    else true end
$$;

-- « Fait » : a_faire → validee_joueur (+ validated_at). Ne re-déclasse pas une
-- tâche déjà confirmée. Vérifie destinataire + club.
create or replace function public.task_mark_done(p_task uuid)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare v_pid uuid := my_player_id(); v_team text := my_team(); t public.tasks%rowtype;
begin
  if v_pid is null then raise exception 'not a player'; end if;
  select * into t from public.tasks where id = p_task;
  if not found or t.team_id <> v_team then raise exception 'task not found in your club'; end if;
  if not public._task_assigned_to(t, v_pid) then raise exception 'not assigned to you'; end if;
  insert into public.task_completions (task_id, player_id, team_id, statut, validated_at, updated_at)
    values (p_task, v_pid, v_team, 'validee_joueur', now(), now())
  on conflict (task_id, player_id) do update
    set statut = case when public.task_completions.statut = 'confirmee' then 'confirmee' else 'validee_joueur' end,
        validated_at = coalesce(public.task_completions.validated_at, now()),
        updated_at = now();
end $$;

-- « Annuler » : validee_joueur → a_faire (tant que non confirmée).
create or replace function public.task_unmark(p_task uuid)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare v_pid uuid := my_player_id();
begin
  if v_pid is null then raise exception 'not a player'; end if;
  update public.task_completions
    set statut = 'a_faire', validated_at = null, updated_at = now()
    where task_id = p_task and player_id = v_pid and statut = 'validee_joueur';
end $$;

-- ---------- RPC (classement) ----------
-- Tâches validées par joueur du club → (player_id, titre, date) pour le +2.
-- Dérivé non sensible, visible par tous (émulation), owner ciblé via p_team.
create or replace function public.team_task_points(p_team text default null)
  returns table(player_id uuid, titre text, at date)
  language sql stable security definer set search_path = public, auth as $$
  with eff as (
    select case
      when p_team is null then my_team()
      when is_owner() then p_team
      when p_team = my_team() then p_team
      else my_team() end as team
  )
  select tc.player_id, t.titre, coalesce(tc.validated_at, tc.updated_at)::date as at
  from public.task_completions tc
  join public.tasks t on t.id = tc.task_id
  where tc.team_id = (select team from eff) and tc.statut in ('validee_joueur', 'confirmee')
$$;

grant execute on function public.task_mark_done(uuid)      to authenticated;
grant execute on function public.task_unmark(uuid)         to authenticated;
grant execute on function public.team_task_points(text)    to authenticated;

-- ---------- REALTIME ----------
alter publication supabase_realtime add table tasks, task_completions;
