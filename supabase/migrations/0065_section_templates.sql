-- ============================================================================
--  0065 — Modèles de sections enregistrés (constructeur de protocoles)
--
--  « Enregistrer une section comme modèle » pour la réutiliser plus tard. Modèles
--  PARTAGÉS au club (tout le staff écrivain les réutilise). Les modèles FOURNIS
--  (Cardio / Récupération / Renforcement) vivent en constantes app, pas ici.
--
--  Lecture : owner ou membre du club. Écriture : owner / staff écrivain du club.
-- ============================================================================

create table if not exists public.section_templates (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null references public.teams(id) on delete cascade,
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  name        text not null default '',
  kind        text not null check (kind in ('narrative','exercises')),
  section     jsonb not null default '{}'::jsonb,   -- objet section normalisé
  created_at  timestamptz not null default now()
);

create index if not exists section_templates_team_idx on public.section_templates(team_id);

alter table public.section_templates enable row level security;

drop policy if exists sectpl_read on public.section_templates;
create policy sectpl_read on public.section_templates for select to authenticated
  using ( public.is_owner() or team_id = public.my_team() );

drop policy if exists sectpl_write on public.section_templates;
create policy sectpl_write on public.section_templates for all to authenticated
  using ( public.is_owner() or ( public.can_write() and team_id = public.my_team() ) )
  with check ( public.is_owner() or ( public.can_write() and team_id = public.my_team() ) );
