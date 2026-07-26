-- 0091 — Récurrence PR-R2 : lien occurrence → série sur défis et tâches
--
-- Réutilise `recurrence_series` (0090) via `object_type` = 'challenge' | 'task'.
-- L'échéance (date) porte l'occurrence ; pour les défis, l'heure va dans `heure`.
-- Défis et tâches ont déjà le bypass owner (0031/0024) → rien à corriger côté RLS.

alter table public.challenges
  add column if not exists series_id  uuid references public.recurrence_series(id) on delete set null,
  add column if not exists customized boolean not null default false;
create index if not exists challenges_series_idx on public.challenges (series_id);

alter table public.tasks
  add column if not exists series_id  uuid references public.recurrence_series(id) on delete set null,
  add column if not exists customized boolean not null default false;
create index if not exists tasks_series_idx on public.tasks (series_id);
