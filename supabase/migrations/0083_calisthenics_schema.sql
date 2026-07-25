-- 0083 — Fondations « bibliothèque calisthénie » + auto-alimentation (PR1)
--
-- Schéma d'accueil, sans import de données. Prépare :
--   • l'enrichissement de exercise_library (niveau, mesure, type, flags
--     calisthénie / sans matériel, source, name_norm pour l'autocomplétion et la
--     détection de doublons, compteur d'usage, provenance club) ;
--   • les familles de progression (chaînes d'exercices ordonnées) ;
--   • une base de connaissance (knowledge_notes) pour le guide et les conseils ;
--   • une table d'alias (paires FR/EN, quasi-doublons) pour l'autocomplétion.
--
-- Portée / licence : le catalogue d'exercices et les progressions sont des faits
-- → lecture globale. Le contenu rédactionnel (guide) va dans knowledge_notes en
-- lecture globale AVEC attribution mais NON partageable inter-clubs (drapeau
-- `shareable=false`) tant que la licence n'est pas confirmée.

-- Extensions installées dans le schéma par défaut (public) : l'opclass
-- gin_trgm_ops et unaccent() y sont alors résolus sans qualifier le schéma.
create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- ─────────────────────────────────────────────────────────────────────────────
-- Normalisation d'un nom d'exercice (casse, accents, ponctuation, espaces).
-- Sert de clé de rapprochement (autocomplétion + anti-doublon). Matérialisée
-- dans exercise_library.name_norm (pas d'index d'expression → unaccent STABLE ok).
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public._norm_ex_name(p_name text)
returns text language sql stable set search_path = public as $$
  select nullif(
    trim(regexp_replace(
      regexp_replace(lower(unaccent(coalesce(p_name, ''))), '[^a-z0-9]+', ' ', 'g'),
      '\s+', ' ', 'g')),
    '')
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- exercise_library : colonnes calisthénie + autocomplétion + provenance
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.exercise_library
  add column if not exists name_en        text,
  add column if not exists level          text,               -- debutant|intermediaire|avance|expert
  add column if not exists measure         text,              -- reps|temps
  add column if not exists exercise_type   text,              -- basique|skill_statique|skill_dynamique|freestyle|mobilite
  add column if not exists unilateral      boolean,
  add column if not exists no_equipment    boolean not null default false,
  add column if not exists is_calisthenics boolean not null default false,
  add column if not exists source          text,              -- ids de sources (attribution dans `attribution`)
  add column if not exists name_norm       text,
  add column if not exists usage_count     integer not null default 0,
  add column if not exists created_by      uuid,
  add column if not exists club_id         uuid references public.clubs(id);

-- Maintien automatique de name_norm.
create or replace function public._trg_exercise_name_norm()
returns trigger language plpgsql set search_path = public as $$
begin
  new.name_norm := public._norm_ex_name(new.name);
  return new;
end $$;
drop trigger if exists exercise_name_norm on public.exercise_library;
create trigger exercise_name_norm before insert or update of name on public.exercise_library
  for each row execute function public._trg_exercise_name_norm();

-- Backfill des 1300+ lignes existantes.
update public.exercise_library set name_norm = public._norm_ex_name(name) where name_norm is null;

-- Recherche floue (autocomplétion + quasi-doublons) et filtres catalogue.
create index if not exists exercise_library_name_trgm on public.exercise_library
  using gin (name_norm gin_trgm_ops);
create index if not exists exercise_library_club_idx on public.exercise_library (club_id);
create index if not exists exercise_library_calisthenics_idx on public.exercise_library (is_calisthenics) where is_calisthenics;

-- ─────────────────────────────────────────────────────────────────────────────
-- Familles de progression (chaînes ordonnées simple → avancé) — faits, globaux
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.progression_families (
  id          uuid primary key default gen_random_uuid(),
  key         text unique not null,     -- 'handstand','front_lever',…
  name        text not null,
  category    text,
  description text,
  source      text,
  created_at  timestamptz not null default now()
);

create table if not exists public.progression_steps (
  id          uuid primary key default gen_random_uuid(),
  family_id   uuid not null references public.progression_families(id) on delete cascade,
  position    integer not null,         -- ordre 1..n
  exercise_id uuid references public.exercise_library(id) on delete set null,
  label       text not null,
  name_en     text,
  notes       text,
  unique (family_id, position)
);
create index if not exists progression_steps_family_idx on public.progression_steps (family_id, position);
create index if not exists progression_steps_exercise_idx on public.progression_steps (exercise_id);

alter table public.progression_families enable row level security;
alter table public.progression_steps enable row level security;
drop policy if exists progression_families_read on public.progression_families;
create policy progression_families_read on public.progression_families for select using (true);
drop policy if exists progression_steps_read on public.progression_steps;
create policy progression_steps_read on public.progression_steps for select using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- Base de connaissance (guide + conseils indexés par thème)
--   club_id NULL  = catalogue global (contenu fourni par l'app) ;
--   club_id défini = note propre au club (issue d'un PDF de référence, PR5).
-- `shareable` : autorise (ou non) le partage inter-clubs — false par défaut.
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.knowledge_notes (
  id               uuid primary key default gen_random_uuid(),
  club_id          uuid references public.clubs(id),
  team_id          text,
  theme            text,                       -- 'prevention_nuque','intersaison',…
  slug             text,
  title            text not null,
  body             text,                       -- markdown
  tags             text[] not null default '{}',
  source           text,
  source_ref       text,                       -- document + page
  origin           text not null default 'manual',  -- 'calisthenics_dataset'|'reference_doc'|'manual'
  reference_doc_id uuid,
  confidence       numeric,
  shareable        boolean not null default false,
  status           text not null default 'published', -- 'draft' si extrait IA (validation requise)
  created_by       uuid,
  created_at       timestamptz not null default now()
);
create index if not exists knowledge_notes_theme_idx on public.knowledge_notes (theme);
create index if not exists knowledge_notes_club_idx on public.knowledge_notes (club_id);

alter table public.knowledge_notes enable row level security;
-- Lecture : catalogue global (club_id null) OU note de mon club.
drop policy if exists knowledge_notes_read on public.knowledge_notes;
create policy knowledge_notes_read on public.knowledge_notes for select using (
  club_id is null or club_id = my_club()
);
-- Écriture : staff de son club (les notes globales restent gérées côté service).
drop policy if exists knowledge_notes_write on public.knowledge_notes;
create policy knowledge_notes_write on public.knowledge_notes for all
  using (is_staff() and club_id = my_club())
  with check (is_staff() and club_id = my_club());

-- ─────────────────────────────────────────────────────────────────────────────
-- Alias d'exercices (paires FR/EN, quasi-doublons) — global, lecture publique
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.exercise_aliases (
  id          uuid primary key default gen_random_uuid(),
  exercise_id uuid not null references public.exercise_library(id) on delete cascade,
  alias       text not null,
  alias_norm  text not null,
  created_at  timestamptz not null default now()
);
create index if not exists exercise_aliases_norm_trgm on public.exercise_aliases
  using gin (alias_norm gin_trgm_ops);
create index if not exists exercise_aliases_exercise_idx on public.exercise_aliases (exercise_id);

alter table public.exercise_aliases enable row level security;
drop policy if exists exercise_aliases_read on public.exercise_aliases;
create policy exercise_aliases_read on public.exercise_aliases for select using (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- section_templates : colonne source (attribution du catalogue candidat)
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.section_templates
  add column if not exists source text;

revoke execute on function public._norm_ex_name(text) from public, anon;
grant execute on function public._norm_ex_name(text) to authenticated;
