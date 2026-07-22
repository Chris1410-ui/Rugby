-- ============================================================================
--  0063 — Protocoles (constructeur de programmes d'entraînement)
--
--  Document d'entraînement RICHE et multi-semaines : métadonnées (hero) + une
--  liste ordonnée de sections (narratives en Markdown-léger ou tableaux
--  d'exercices avec progression cellule par cellule sur N semaines). Le contenu
--  riche est stocké tel quel en JSONB (`doc`), le reste en colonnes pour lister/
--  filtrer.
--
--  DISTINCT de `programs` (planning weekday → séances de calendrier). Ici on
--  produit un document consultable/exportable (page web + PDF), pas des séances.
--
--  Rattachement à un club (collectif). Assignation par joueur avec cibles
--  individualisées : porte laissée ouverte (table dédiée à venir), pas ici.
--
--  Lecture : owner partout ; sinon membre du club ET (publié OU staff) →
--    les joueurs ne voient que les protocoles PUBLIÉS de leur club ; le staff
--    (prépa/médical/coach) voit aussi les brouillons.
--  Écriture : owner partout ; staff ÉCRIVAIN (prépa/médical) sur son club
--    (le coach reste en lecture seule — miroir de can_write()).
-- ============================================================================

create table if not exists public.program_docs (
  id          uuid primary key default gen_random_uuid(),
  team_id     text not null references public.teams(id) on delete cascade,
  title       text not null default '',
  category    text not null default '',            -- libellé collectif ex. "Crabos 26·27"
  status      text not null default 'draft' check (status in ('draft','published')),
  weeks       int  not null default 4 check (weeks between 1 and 12),
  doc         jsonb not null default '{}'::jsonb,   -- { meta, sections[] }
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists program_docs_team_idx   on public.program_docs(team_id);
create index if not exists program_docs_status_idx  on public.program_docs(team_id, status);

-- updated_at automatique à chaque UPDATE.
create or replace function public.touch_program_docs() returns trigger
language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists trg_touch_program_docs on public.program_docs;
create trigger trg_touch_program_docs before update on public.program_docs
  for each row execute function public.touch_program_docs();

alter table public.program_docs enable row level security;

drop policy if exists progdocs_read on public.program_docs;
create policy progdocs_read on public.program_docs for select to authenticated
  using (
    public.is_owner()
    or ( team_id = public.my_team() and ( status = 'published' or public.is_staff() ) )
  );

drop policy if exists progdocs_write on public.program_docs;
create policy progdocs_write on public.program_docs for all to authenticated
  using ( public.is_owner() or ( public.can_write() and team_id = public.my_team() ) )
  with check ( public.is_owner() or ( public.can_write() and team_id = public.my_team() ) );
