-- 0090 — Récurrence transverse (PR-R1) : séries + occurrences (Convocations)
--
-- Beaucoup d'objets d'une saison sont récurrents (entraînements 2-3×/semaine…).
-- On introduit une TABLE DE SÉRIES commune + un lien sur les objets générés.
-- PR-R1 câble les CONVOCATIONS (trainings) ; les autres écrans réutiliseront la
-- même table (object_type). Une occurrence détachée (éditée individuellement)
-- garde son series_id mais passe `customized=true` → jamais réécrasée par une
-- mise à jour de série.

create table if not exists public.recurrence_series (
  id           uuid primary key default gen_random_uuid(),
  club_id      uuid references public.clubs(id),
  team_id      text not null references public.teams(id),
  object_type  text not null,                          -- 'training' (extensible : challenge, task, session, camp, questionnaire)
  weekdays     int[]  not null default '{}',           -- ISO 1=lundi … 7=dimanche
  times        jsonb  not null default '{}'::jsonb,     -- { "2":"18:30", "4":"20:00" } (par weekday)
  period_start date   not null,
  period_end   date   not null,
  exclusions   date[] not null default '{}',           -- vacances / trêve / fériés
  assigned     jsonb  not null default '{"mode":"all"}',
  payload      jsonb  not null default '{}'::jsonb,     -- gabarit spécifique au type (titre, lieu, nature, notes…)
  created_by   uuid,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists recurrence_series_team_idx on public.recurrence_series (team_id, object_type);

alter table public.recurrence_series enable row level security;
drop policy if exists recurrence_series_rw on public.recurrence_series;
create policy recurrence_series_rw on public.recurrence_series for all
  using (is_owner() or (is_staff() and team_id = my_team()))
  with check (is_owner() or (is_staff() and team_id = my_team()));

-- Lien occurrence → série sur les convocations.
alter table public.trainings
  add column if not exists series_id  uuid references public.recurrence_series(id) on delete set null,
  add column if not exists customized boolean not null default false;
create index if not exists trainings_series_idx on public.trainings (series_id);

-- Bypass OWNER sur trainings (oublié en 0082, comme pour reference_docs en 0088)
-- → l'owner multi-clubs (is_staff() false, my_team() NULL) pouvait pas créer de
-- convocation. On préserve la lecture joueur.
drop policy if exists trainings_read on public.trainings;
create policy trainings_read on public.trainings for select using (
  is_owner()
  or (is_staff() and team_id = my_team())
  or _training_assigned_to(trainings, my_player_id())
);
drop policy if exists trainings_write on public.trainings;
create policy trainings_write on public.trainings for all
  using (is_owner() or (is_staff() and team_id = my_team()))
  with check (is_owner() or (is_staff() and team_id = my_team()));
