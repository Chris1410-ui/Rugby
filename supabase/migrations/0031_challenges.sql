-- ════════════════════════════════════════════════════════════════
-- 0031 — Défis (challenges) : Tâches++ avec points paramétrables, champs
-- logistiques (heure/lieu/matériel), visuel (bannière + badge) et mode « open »
-- (défi ouvert que les joueurs rejoignent). Validation en 2 temps comme Tâches :
--   joueur « Défi relevé » (→ validee_joueur) → prépa « Valider » (→ confirmee).
-- Les POINTS ne comptent qu'à la CONFIRMATION (team_challenge_points = confirmee).
-- Le joueur n'écrit jamais en direct (RPC SECURITY DEFINER). Isolation club :
-- FK composites (patron tasks/crews/camps) + RLS my_team().
-- ════════════════════════════════════════════════════════════════

-- ---------- TABLES ----------
create table challenges (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null references teams(id) on delete cascade,
  titre       text not null,
  description text,
  points      int not null default 10 check (points between 0 and 500),
  heure       text,
  lieu        text,
  materiel    jsonb not null default '[]',
  echeance    date,
  assigned    jsonb not null default '{"mode":"all"}',
  banner      text default 'flame',
  badge       text default '🏆',
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now(),
  unique (id, team_id)
);
create index on challenges(team_id, created_at desc);

create table challenge_completions (
  challenge_id uuid not null,
  player_id    uuid not null,
  team_id      text not null,
  statut       text not null default 'a_faire' check (statut in ('a_faire','validee_joueur','confirmee')),
  validated_at timestamptz,
  confirmed_at timestamptz,
  updated_at   timestamptz default now(),
  primary key (challenge_id, player_id),
  foreign key (challenge_id, team_id) references challenges(id, team_id) on delete cascade,
  foreign key (player_id, team_id)    references players(id, team_id)    on delete cascade
);
create index on challenge_completions(player_id);

-- ---------- RLS ----------
alter table challenges            enable row level security;
alter table challenge_completions enable row level security;

create policy ch_read  on challenges for select using (team_id = my_team());
create policy ch_staff on challenges for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy ch_owner on challenges for all using (is_owner()) with check (is_owner());

create policy cc_read  on challenge_completions for select
  using (player_id = my_player_id() or (is_staff() and team_id = my_team()));
create policy cc_staff on challenge_completions for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy cc_owner on challenge_completions for all using (is_owner()) with check (is_owner());

-- ---------- RPC (joueur) ----------
create or replace function public._challenge_assigned_to(c public.challenges, p_player uuid) returns boolean
  language sql stable security definer set search_path = public, auth as $$
  select case coalesce(c.assigned->>'mode', 'all')
    when 'all'     then true
    when 'open'    then true
    when 'group'   then (c.assigned->>'group') = (select grp::text from public.players where id = p_player)
    when 'players' then coalesce(c.assigned->'ids', '[]'::jsonb) ? p_player::text
    else true end
$$;

create or replace function public.challenge_mark_done(p_challenge uuid)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare v_pid uuid := my_player_id(); v_team text := my_team(); c public.challenges%rowtype;
begin
  if v_pid is null then raise exception 'not a player'; end if;
  select * into c from public.challenges where id = p_challenge;
  if not found or c.team_id <> v_team then raise exception 'challenge not found in your club'; end if;
  if not public._challenge_assigned_to(c, v_pid) then raise exception 'not assigned to you'; end if;
  insert into public.challenge_completions (challenge_id, player_id, team_id, statut, validated_at, updated_at)
    values (p_challenge, v_pid, v_team, 'validee_joueur', now(), now())
  on conflict (challenge_id, player_id) do update
    set statut = case when public.challenge_completions.statut = 'confirmee' then 'confirmee' else 'validee_joueur' end,
        validated_at = coalesce(public.challenge_completions.validated_at, now()),
        updated_at = now();
end $$;

create or replace function public.challenge_unmark(p_challenge uuid)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare v_pid uuid := my_player_id();
begin
  if v_pid is null then raise exception 'not a player'; end if;
  update public.challenge_completions set statut = 'a_faire', validated_at = null, updated_at = now()
    where challenge_id = p_challenge and player_id = v_pid and statut = 'validee_joueur';
end $$;

-- ---------- RPC (classement) — POINTS = confirmee uniquement ----------
create or replace function public.team_challenge_points(p_team text default null)
  returns table(player_id uuid, titre text, points int, at date)
  language sql stable security definer set search_path = public, auth as $$
  with eff as (
    select case when p_team is null then my_team() when is_owner() then p_team
      when p_team = my_team() then p_team else my_team() end as team
  )
  select cc.player_id, c.titre, c.points, coalesce(cc.confirmed_at, cc.updated_at)::date as at
  from public.challenge_completions cc
  join public.challenges c on c.id = cc.challenge_id
  where cc.team_id = (select team from eff) and cc.statut = 'confirmee'
$$;

-- Agrégat par défi (relevés / confirmés) visible par tout le club → barre de
-- progression côté joueur (qui ne lit pas les complétions des autres).
create or replace function public.team_challenge_stats(p_team text default null)
  returns table(challenge_id uuid, releves int, confirmes int)
  language sql stable security definer set search_path = public, auth as $$
  with eff as (
    select case when p_team is null then my_team() when is_owner() then p_team
      when p_team = my_team() then p_team else my_team() end as team
  )
  select cc.challenge_id,
    count(*) filter (where cc.statut in ('validee_joueur','confirmee'))::int as releves,
    count(*) filter (where cc.statut = 'confirmee')::int as confirmes
  from public.challenge_completions cc
  where cc.team_id = (select team from eff)
  group by cc.challenge_id
$$;

grant execute on function public.challenge_mark_done(uuid)   to authenticated;
grant execute on function public.challenge_unmark(uuid)      to authenticated;
grant execute on function public.team_challenge_points(text) to authenticated;
grant execute on function public.team_challenge_stats(text)  to authenticated;

-- ---------- Réactivité (top-2 : +15 aux 2 premiers à relever) ----------
create or replace function public.react_challenge() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  if new.statut = 'validee_joueur' then
    insert into public.reactivity_events(input_type, ref_id, player_id, team_id)
      values ('challenge', new.challenge_id, new.player_id, new.team_id) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger trg_react_challenge after insert or update on challenge_completions for each row execute function public.react_challenge();

-- Ajoute le libellé « défi » au bonus réactivité existant.
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
      when 'questionnaire' then 'questionnaire' when 'challenge' then 'défi' else 'camp' end || ')' as label,
    completed_at::date as at
  from ranked where rn <= 2
$$;

-- ---------- Notifications ----------
create or replace function public.notify_challenge() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
    select new.team_id, t, 'challenge', '⚡ Nouveau défi', new.titre, new.id, 'defis'
    from public.notif_targets(new.team_id,
      case when new.assigned->>'mode' = 'open' then '{"mode":"all"}'::jsonb else new.assigned end) t;
  return new;
end $$;
create trigger trg_notify_challenge after insert on challenges for each row execute function public.notify_challenge();

create or replace function public.notify_challenge_confirmed() returns trigger
  language plpgsql security definer set search_path = public, auth as $$
begin
  if new.statut = 'confirmee' and (TG_OP = 'INSERT' or old.statut is distinct from 'confirmee') then
    insert into public.notifications(team_id, player_id, type, titre, body, ref_id, route)
      select new.team_id, new.player_id, 'challenge', '✅ Défi validé', '+' || c.points || ' points · ' || c.titre, new.challenge_id, 'defis'
      from public.challenges c where c.id = new.challenge_id;
  end if;
  return new;
end $$;
create trigger trg_notify_challenge_confirmed after insert or update on challenge_completions for each row execute function public.notify_challenge_confirmed();

-- ---------- REALTIME ----------
alter publication supabase_realtime add table challenges, challenge_completions;
