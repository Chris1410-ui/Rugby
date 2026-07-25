-- 0075 — Catalogue de SECTIONS-TYPES (donner/recevoir), PR1 : fondations.
-- On étend section_templates : rattachement au CLUB, taxonomie (facettes fixes),
-- provenance/réputation, partage/délai d'ouverture, déduplication structurelle.
-- PR1 = catalogue CLUB-LOCAL (candidats extraits) : aucun partage cross-club
-- encore (open/credits/RLS cross-club viendront en PR3/PR4).
--
-- Rétro-compat : les lignes existantes restent scope='local' et gardent leur
-- comportement (modèles de sections d'un club) ; club_id backfillé depuis l'équipe.

alter table public.section_templates
  add column if not exists club_id          uuid references public.clubs(id),
  add column if not exists scope            text not null default 'local',   -- 'local' | 'catalog'
  add column if not exists status           text not null default 'draft',   -- 'draft' | 'published' | 'archived'
  add column if not exists objective        text,        -- vocabulaire nature (force, prevention…)
  add column if not exists period           text,        -- intersaison | preseason | ensaison | semaine_match | post_tournoi
  add column if not exists positions        text[]  not null default '{}',
  add column if not exists age_category     text,
  add column if not exists equipment        text[]  not null default '{}',
  add column if not exists duration_min     int,
  add column if not exists section_kind     text,        -- type fonctionnel détecté (warmup, strength, superset…)
  add column if not exists origin_club_id   uuid references public.clubs(id),
  add column if not exists author_certified boolean not null default false,
  add column if not exists usage_count      int not null default 0,
  add column if not exists reuse_count      int not null default 0,   -- reprises par D'AUTRES clubs
  add column if not exists club_reuse_count int not null default 0,   -- nb de clubs distincts repreneurs
  add column if not exists variant_count    int not null default 1,
  add column if not exists last_used_at     timestamptz,
  add column if not exists updated_at       timestamptz not null default now(),
  add column if not exists share_optin      boolean not null default false,
  add column if not exists open_delay       text not null default 'immediate', -- immediate | 3m | 6m | season_end
  add column if not exists open_at          timestamptz,
  add column if not exists dedup_hash       text,
  add column if not exists fingerprint      jsonb;

-- Backfill club_id depuis l'équipe propriétaire.
update public.section_templates st
  set club_id = t.club_id
  from public.teams t
  where st.team_id = t.id and st.club_id is null;

-- Dédup par club sur les candidats du catalogue : un hash = une entrée par club.
create index if not exists section_templates_dedup_idx
  on public.section_templates (club_id, dedup_hash) where scope = 'catalog';
create index if not exists section_templates_scope_idx
  on public.section_templates (club_id, scope, status);

-- RLS : lecture élargie au CLUB pour les candidats du catalogue (toutes les
-- équipes d'un club voient/partagent son catalogue) ; l'écriture reste au staff
-- écrivain du club (ou owner). Les lignes 'local' gardent la portée équipe.
drop policy if exists sectpl_read on public.section_templates;
create policy sectpl_read on public.section_templates for select using (
  public.is_owner()
  or team_id = public.my_team()
  or (scope = 'catalog' and club_id = public.my_club())
);

drop policy if exists sectpl_write on public.section_templates;
create policy sectpl_write on public.section_templates for all using (
  public.is_owner()
  or (public.can_write() and (team_id = public.my_team() or (scope = 'catalog' and club_id = public.my_club())))
) with check (
  public.is_owner()
  or (public.can_write() and (team_id = public.my_team() or (scope = 'catalog' and club_id = public.my_club())))
);
