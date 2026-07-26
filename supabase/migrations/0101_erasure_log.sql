-- 0101 — Journal d'effacement RGPD (droit à l'effacement, art. 17).
-- Trace append-only : qui a supprimé quel joueur (totem), quand, dans quel club,
-- et ce qui a été nettoyé (compte auth, fichiers Storage). Écrit par l'Edge
-- Function gdpr-erase (service_role → bypass RLS). Aucune FK vers players (le
-- joueur est supprimé). Lecture : owner (tout) ou staff du club ; jamais modifié.
create table if not exists public.erasure_log (
  id              uuid primary key default gen_random_uuid(),
  player_id       uuid not null,
  totem           text,
  team_id         text,
  actor_uid       uuid,
  actor_role      text,
  actor_kind      text,               -- 'owner' | 'staff' | 'self'
  storage_removed int not null default 0,
  auth_deleted    boolean not null default false,
  at              timestamptz not null default now()
);
create index if not exists erasure_log_team_idx on public.erasure_log (team_id, at desc);

alter table public.erasure_log enable row level security;
-- Lecture seule : owner partout, staff sur son club. Aucune écriture cliente
-- (l'Edge Function écrit via service_role). Append-only : pas d'update/delete.
drop policy if exists erasure_log_read on public.erasure_log;
create policy erasure_log_read on public.erasure_log for select
  using (is_owner() or (is_staff() and team_id = my_team()));
