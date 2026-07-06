-- ============================================================================
--  0001 — Schéma Rugby Player Performance Platform (Postgres + RLS)
--  Source de vérité : SUPABASE_SCHEMA.sql (handoff). search_path figé sur les
--  helpers SECURITY DEFINER pour satisfaire le linter Supabase.
-- ============================================================================

-- ---------- ENUMS ----------
create type app_role as enum ('joueur','preparateur','medical','coach');
create type player_group as enum ('avants','arrieres');
create type session_status as enum ('pending','done','missed');
create type set_type as enum ('normal','warmup','drop','fail');
create type msg_dir as enum ('staff','joueur');

-- ---------- TEAMS ----------
create table teams (
  id           text primary key,
  sport        text not null default 'rugby',
  label        text not null,
  competition  text,
  created_at   timestamptz default now()
);

-- ---------- PROFILES ----------
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       app_role not null,
  full_name  text,
  team_id    text references teams(id),
  player_id  uuid,
  created_at timestamptz default now()
);

-- ---------- PLAYERS ----------
create table players (
  id           uuid primary key default gen_random_uuid(),
  team_id      text not null references teams(id) on delete cascade,
  owner_uid    uuid references auth.users(id),
  num          int,
  name         text not null,
  pos          text,
  grp          player_group,
  club         text,
  age          int,
  acwr_seed    numeric default 1.0,
  wellness     int default 35,
  sleep_h      numeric default 7.5,
  risque       int default 30,
  charge7j     int default 1800,
  dispo        int default 90,
  mas          numeric, back_squat numeric,
  cmj_g        numeric, cmj_d numeric,
  ischios_g    numeric, ischios_d numeric,
  asym         numeric,
  is_custom    boolean default false,
  created_at   timestamptz default now()
);
create index on players(team_id);

-- ---------- EXERCISES ----------
create table exercises (
  id         uuid primary key default gen_random_uuid(),
  team_id    text references teams(id) on delete cascade,
  name       text not null,
  category   text,
  quality    text,
  cues       text,
  is_custom  boolean default false,
  created_at timestamptz default now()
);

-- ---------- PROGRAMS ----------
create table programs (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams(id) on delete cascade,
  title      text not null,
  note       text,
  start_date date,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ---------- SESSIONS ----------
create table sessions (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid references programs(id) on delete cascade,
  team_id      text not null references teams(id) on delete cascade,
  date         date not null,
  code         text,
  titre        text,
  duration_min int default 60,
  exercises    jsonb not null default '[]',
  assigned     jsonb not null default '{}',
  created_at   timestamptz default now()
);
create index on sessions(team_id, date);

-- ---------- SESSION LOGS ----------
create table session_logs (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references sessions(id) on delete cascade,
  player_id     uuid not null references players(id) on delete cascade,
  status        session_status not null default 'pending',
  rpe           int,
  feedback      text,
  per_exercise  jsonb default '{}',
  logged_at     timestamptz default now(),
  unique(session_id, player_id)
);
create index on session_logs(player_id);

-- ---------- DAILY CHECK-INS ----------
create table daily_checkins (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  date       date not null,
  wb         jsonb not null,
  sleep_h    numeric,
  hydra      numeric,
  fc         int, hrv int, poids numeric,
  created_at timestamptz default now(),
  unique(player_id, date)
);
create index on daily_checkins(player_id, date);

-- ---------- MESSAGES ----------
create table messages (
  id         uuid primary key default gen_random_uuid(),
  player_id  uuid not null references players(id) on delete cascade,
  dir        msg_dir not null,
  author     text,
  text       text not null,
  read       boolean default false,
  created_at timestamptz default now()
);
create index on messages(player_id, created_at);

-- ---------- ROUTINES ----------
create table routines (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams(id) on delete cascade,
  name       text not null,
  templates  jsonb not null default '[]',
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- ============================================================================
--  ROW LEVEL SECURITY
-- ============================================================================
alter table teams           enable row level security;
alter table profiles        enable row level security;
alter table players         enable row level security;
alter table exercises       enable row level security;
alter table programs        enable row level security;
alter table sessions        enable row level security;
alter table session_logs    enable row level security;
alter table daily_checkins  enable row level security;
alter table messages        enable row level security;
alter table routines        enable row level security;

create or replace function my_team() returns text
  language sql stable security definer set search_path = public, auth as
  $$ select team_id from profiles where id = auth.uid() $$;

create or replace function is_staff() returns boolean
  language sql stable security definer set search_path = public, auth as
  $$ select role in ('preparateur','medical','coach') from profiles where id = auth.uid() $$;

create or replace function my_player_id() returns uuid
  language sql stable security definer set search_path = public, auth as
  $$ select player_id from profiles where id = auth.uid() $$;

create policy profiles_self on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
create policy profiles_staff_read on profiles for select
  using (is_staff() and team_id = my_team());

create policy teams_read on teams for select using (id = my_team());

create policy players_staff on players for all
  using (is_staff() and team_id = my_team())
  with check (is_staff() and team_id = my_team());
create policy players_self_read on players for select using (id = my_player_id());
create policy players_self_insert on players for insert
  with check (owner_uid = auth.uid() and team_id = my_team());

create policy exercises_read on exercises for select
  using (team_id is null or team_id = my_team());
create policy exercises_staff_write on exercises for all
  using (is_staff() and team_id = my_team())
  with check (is_staff() and team_id = my_team());

create policy programs_staff on programs for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy programs_read on programs for select using (team_id = my_team());

create policy sessions_staff on sessions for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy sessions_read on sessions for select using (team_id = my_team());

create policy routines_staff on routines for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());

create policy logs_staff on session_logs for all
  using (is_staff() and exists (select 1 from players p where p.id = player_id and p.team_id = my_team()))
  with check (is_staff() and exists (select 1 from players p where p.id = player_id and p.team_id = my_team()));
create policy logs_self on session_logs for all
  using (player_id = my_player_id()) with check (player_id = my_player_id());

create policy daily_staff_read on daily_checkins for select
  using (is_staff() and exists (select 1 from players p where p.id = player_id and p.team_id = my_team()));
create policy daily_self on daily_checkins for all
  using (player_id = my_player_id()) with check (player_id = my_player_id());

create policy messages_staff on messages for all
  using (is_staff() and exists (select 1 from players p where p.id = player_id and p.team_id = my_team()))
  with check (is_staff() and exists (select 1 from players p where p.id = player_id and p.team_id = my_team()));
create policy messages_self on messages for all
  using (player_id = my_player_id()) with check (player_id = my_player_id());

-- ============================================================================
--  REALTIME
-- ============================================================================
alter publication supabase_realtime add table session_logs, daily_checkins, messages, players;
