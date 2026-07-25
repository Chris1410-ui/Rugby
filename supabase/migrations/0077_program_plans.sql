-- 0077 — Planifier un PROTOCOLE (program_docs) → séances datées. PR1 : fondations.
-- Un protocole devient la source unique : une « planification » (program_plans)
-- fige une période + des créneaux + des destinataires, et génère des lignes
-- `sessions` qui GARDENT un lien vers le protocole source et la semaine Sk d'origine.
--
-- Rétro-compat : colonnes `sessions` ajoutées nullable → les séances existantes
-- (créées directement, ou liées à `programs` via program_id) sont intactes.

create table if not exists public.program_plans (
  id             uuid primary key default gen_random_uuid(),
  program_doc_id uuid not null references public.program_docs(id) on delete cascade,
  team_id        text not null,
  start_date     date not null,
  weeks          int  not null default 4,
  slots          jsonb not null default '[]'::jsonb,  -- créneaux : [{weekday,label,nature,code}]
  assigned       jsonb not null default '{"mode":"all"}'::jsonb,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
alter table public.program_plans enable row level security;

create index if not exists program_plans_doc_idx  on public.program_plans (program_doc_id);
create index if not exists program_plans_team_idx on public.program_plans (team_id);

-- Lecture : membres de l'équipe (comme sessions) ; écriture : staff écrivain / owner.
drop policy if exists program_plans_read on public.program_plans;
create policy program_plans_read on public.program_plans for select
  using (public.is_owner() or team_id = public.my_team());
drop policy if exists program_plans_write on public.program_plans;
create policy program_plans_write on public.program_plans for all
  using (public.is_owner() or (public.can_write() and team_id = public.my_team()))
  with check (public.is_owner() or (public.can_write() and team_id = public.my_team()));

-- Lien maintenu séance ↔ protocole source (+ semaine/section d'origine).
alter table public.sessions
  add column if not exists plan_id        uuid references public.program_plans(id) on delete set null,
  add column if not exists program_doc_id uuid references public.program_docs(id) on delete set null,
  add column if not exists source_week    int,
  add column if not exists source_label   text;

create index if not exists sessions_plan_idx on public.sessions (plan_id);
create index if not exists sessions_doc_idx  on public.sessions (program_doc_id);
