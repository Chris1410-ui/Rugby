-- ============================================================================
--  0053 — Bibliothèque d'exercices (dataset MIT hasaneyldrm/exercises-dataset).
--
--  DONNÉES SEULES (licence MIT) : noms, catégories, parties du corps, équipement,
--  muscles, instructions FR + EN. Les MÉDIAS (GIF/vignettes) sont © Gym visual et
--  NE SONT PAS hébergés (le clone du repo ne donne aucun droit de redistribution)
--  → thumb_url/gif_url restent NULL ; l'attribution « © Gym visual » est conservée
--  dans chaque ligne et affichée sous chaque fiche.
--
--  Table GLOBALE partagée (team_id NULL = catalogue importé). Un club peut ajouter
--  ses propres exercices (is_custom, team_id = son club).
--  Lecture : tout membre authentifié (catalogue global + custom de son club).
--  Écriture : owner (catalogue global) ; staff écrivain (custom de son club).
-- ============================================================================

create extension if not exists pg_trgm;

create table if not exists public.exercise_library (
  id                uuid primary key default gen_random_uuid(),
  ref               text unique not null,                 -- id source "0001"
  name              text not null,
  category          text not null,                        -- = body_part
  body_part         text not null,                        -- back|cardio|chest|lower arms|…
  equipment         text not null,                        -- body weight|dumbbell|…
  target_muscle     text not null,                        -- source `target`
  muscle_group      text,                                 -- synergiste principal
  secondary_muscles jsonb not null default '[]'::jsonb,
  instructions      jsonb not null default '{}'::jsonb,   -- { fr, en }
  instruction_steps jsonb not null default '{}'::jsonb,   -- { fr:[…], en:[…] }
  media_id          text,
  thumb_url         text,                                 -- média non hébergé (© Gym visual)
  gif_url           text,
  attribution       text not null default '© Gym visual — https://gymvisual.com/',
  is_custom         boolean not null default false,
  team_id           text references public.teams(id) on delete cascade,
  created_at        timestamptz default now()
);

create index if not exists exercise_library_body_part_idx on public.exercise_library(body_part);
create index if not exists exercise_library_equipment_idx on public.exercise_library(equipment);
create index if not exists exercise_library_target_idx    on public.exercise_library(target_muscle);
create index if not exists exercise_library_name_trgm_idx  on public.exercise_library using gin (name gin_trgm_ops);

alter table public.exercise_library enable row level security;

-- Lecture : catalogue global (team_id NULL) visible par tous ; un exo custom n'est
-- visible que par son club (ou l'owner).
drop policy if exists exlib_read on public.exercise_library;
create policy exlib_read on public.exercise_library for select to authenticated
  using ( team_id is null or team_id = public.my_team() or public.is_owner() );

-- Écriture : owner partout ; staff écrivain (prépa/médical) uniquement sur les
-- exos custom de SON club. Le catalogue global (team_id NULL) reste owner-only.
drop policy if exists exlib_write on public.exercise_library;
create policy exlib_write on public.exercise_library for all to authenticated
  using ( public.is_owner() or (public.can_write() and team_id = public.my_team()) )
  with check ( public.is_owner() or (public.can_write() and team_id = public.my_team()) );
