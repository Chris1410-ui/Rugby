-- 0092 — Récurrence PR-R3 : lien occurrence → série sur les séances autonomes
--
-- Réutilise `recurrence_series` (0090) via `object_type` = 'session'.
-- Une séance est déjà une ligne datée (`sessions.date`) portant son `assigned`
-- jsonb et ses `exercises` — même contrat one-row-one-date que défis/tâches.
-- Concerne le NOUVEAU parcours « Planifier une séance » (séance unique, staff) ;
-- les séances matérialisées par un programme gardent leur propre moteur
-- (expandTemplates) et ne sont pas rattachées à une série de récurrence.
-- Les séances ont déjà le bypass owner (0054) → rien à corriger côté RLS.

alter table public.sessions
  add column if not exists series_id  uuid references public.recurrence_series(id) on delete set null,
  add column if not exists customized boolean not null default false;
create index if not exists sessions_series_idx on public.sessions (series_id);
