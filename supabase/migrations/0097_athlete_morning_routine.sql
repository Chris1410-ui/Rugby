-- 0097 — Routine du matin du staff-athlète (checklist + shake) — PR-2.
--
-- Deux tables, toutes deux SELF-ONLY (comme daily_checkins) : le CONTENU de la
-- routine (items, quantités du shake) reste privé. Seul l'ÉTAT « complétée le
-- jour J » est public (points +10 + projection joueurs), exposé par un RPC dédié
-- qui ne renvoie que des dates — jamais le contenu.

-- Config éditable (1 par athlète) : items de la checklist + ingrédients du shake.
create table if not exists public.athlete_routine (
  player_id  uuid primary key references public.players(id) on delete cascade,
  team_id    text not null references public.teams(id) on delete cascade,
  items      jsonb not null default '[]'::jsonb,  -- [{id,label,time}]
  shake      jsonb not null default '[]'::jsonb,  -- [{id,label,qty,unit,proteinPer}]
  updated_at timestamptz not null default now()
);
alter table public.athlete_routine enable row level security;
drop policy if exists ar_self on public.athlete_routine;
create policy ar_self on public.athlete_routine for all
  using (player_id = my_player_id()) with check (player_id = my_player_id());

-- Journal quotidien (1 ligne/jour/athlète) : items cochés, quantités du shake,
-- total protéines, `done`. Jamais supprimé (historique/tendance) ; reset = filtre
-- par date locale côté client (comme les bilans).
create table if not exists public.athlete_routine_log (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references public.players(id) on delete cascade,
  team_id    text not null references public.teams(id) on delete cascade,
  date       date not null,
  checked    jsonb not null default '[]'::jsonb,
  shake      jsonb not null default '[]'::jsonb,
  protein_g  numeric,
  done       boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (player_id, date)
);
alter table public.athlete_routine_log enable row level security;
drop policy if exists arl_self on public.athlete_routine_log;
create policy arl_self on public.athlete_routine_log for all
  using (player_id = my_player_id()) with check (player_id = my_player_id());
create index if not exists arl_player_date_idx on public.athlete_routine_log (player_id, date);

-- Projection PUBLIQUE (club) : dates où la routine a été complétée, par joueur.
-- Alimente le +10 du classement et le « routine ✓/✗ » vu par les joueurs — ne
-- renvoie que { player_id, date }, jamais le contenu privé.
create or replace function public.team_routine_points(p_team text)
  returns table(player_id uuid, date date)
  language sql stable security definer set search_path = public, auth as $$
  select l.player_id, l.date
  from public.athlete_routine_log l
  join public.players p on p.id = l.player_id
  where p.team_id = p_team and l.done and (p_team = my_team() or is_owner());
$$;
revoke execute on function public.team_routine_points(text) from public, anon;
grant execute on function public.team_routine_points(text) to authenticated;
