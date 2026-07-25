-- 0086 — Documents de référence (« PDF nourriciers ») — fondations (PR5)
--
-- Dépôt de PDF de méthodo / articles / doctrine qui enrichissent la base de
-- connaissance et servent d'assistance à la création de protocoles. Ici : le
-- schéma, la RLS club stricte et la provenance. L'analyse LLM (sections/conseils
-- candidats) vient en PR6, alimentant reference_doc_sections + knowledge_notes.
--
-- Provenance / droits : `author_owned` (case obligatoire « je suis l'auteur ou
-- j'ai l'autorisation ») + `source`. `visibility='club'` par défaut : un PDF
-- tiers reste une référence PRIVÉE du club, jamais redistribué inter-club.
-- Le fichier est stocké dans le bucket privé existant `team-files`
-- (dossier `<team>/reference/…`, accès par URL signée).

create table if not exists public.reference_docs (
  id            uuid primary key default gen_random_uuid(),
  club_id       uuid references public.clubs(id),
  team_id       text not null,
  title         text not null,
  theme         text,                       -- 'prevention_nuque','intersaison',…
  tags          text[] not null default '{}',
  objective     text,
  period        text,
  positions     text[] not null default '{}',
  age_category  text,
  equipment     text[] not null default '{}',
  storage_path  text,                        -- team-files/<team>/reference/<id>.pdf
  source        text,
  author_owned  boolean not null default false,  -- « je suis l'auteur / j'ai l'autorisation »
  visibility    text not null default 'club',    -- jamais inter-club sans opt-in explicite
  status        text not null default 'uploaded',-- uploaded → analyzing → analyzed
  page_count    integer,
  created_by    uuid,
  created_at    timestamptz not null default now()
);
create index if not exists reference_docs_club_idx on public.reference_docs (club_id);
create index if not exists reference_docs_theme_idx on public.reference_docs (theme);

-- Sections-types candidates extraites d'un document (remplies en PR6 par le LLM).
create table if not exists public.reference_doc_sections (
  id                  uuid primary key default gen_random_uuid(),
  doc_id              uuid not null references public.reference_docs(id) on delete cascade,
  club_id             uuid,
  name                text,
  section             jsonb not null default '{}',
  objective           text,
  equipment           text[] not null default '{}',
  age_category        text,
  confidence          numeric,
  page_ref            integer,
  status              text not null default 'draft',   -- draft → validated → versée (section_templates)
  section_template_id uuid,
  dedup_hash          text,
  fingerprint         jsonb,
  created_at          timestamptz not null default now()
);
create index if not exists reference_doc_sections_doc_idx on public.reference_doc_sections (doc_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS : club stricte. Lecture + écriture réservées au staff du club propriétaire.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.reference_docs enable row level security;
alter table public.reference_doc_sections enable row level security;

drop policy if exists reference_docs_rw on public.reference_docs;
create policy reference_docs_rw on public.reference_docs for all
  using (is_staff() and club_id = my_club())
  with check (is_staff() and club_id = my_club());

drop policy if exists reference_doc_sections_rw on public.reference_doc_sections;
create policy reference_doc_sections_rw on public.reference_doc_sections for all
  using (is_staff() and exists (select 1 from public.reference_docs d where d.id = doc_id and d.club_id = my_club()))
  with check (is_staff() and exists (select 1 from public.reference_docs d where d.id = doc_id and d.club_id = my_club()));
