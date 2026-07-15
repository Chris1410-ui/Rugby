-- ════════════════════════════════════════════════════════════════
-- 0014 — Crews : équipes formées par les joueurs.
--
-- Un joueur crée une équipe (crew) et invite des coéquipiers de SON club.
-- Isolation stricte par club garantie à DEUX niveaux :
--   1. CONTRAINTE DB : crew_members porte team_id, verrouillé par des clés
--      étrangères composites vers crews(id, team_id) ET players(id, team_id).
--      → un membre a forcément le même team_id que le crew ET que le joueur :
--        impossible de mélanger deux clubs, même en contournant l'app.
--   2. RLS : les policies re-vérifient team_id = my_team() à l'insertion.
-- L'owner (is_owner) voit tout.
-- ════════════════════════════════════════════════════════════════

-- Pré-requis pour les FK composites : unicité (id, team_id).
alter table players add constraint players_id_team_uq unique (id, team_id);

create type crew_member_status as enum ('invited', 'active');

-- ---------- CREWS ----------
create table crews (
  id              uuid primary key default gen_random_uuid(),
  team_id         text not null references teams(id) on delete cascade,
  name            text not null,
  banner          text not null,               -- clé bannière (jeu prédéfini lib/crews.js)
  created_by      uuid references auth.users(id),
  owner_player_id uuid references players(id) on delete set null,
  created_at      timestamptz default now(),
  unique (id, team_id)                          -- cible de la FK composite
);
create index on crews(team_id);

-- ---------- CREW MEMBERS ----------
create table crew_members (
  id          uuid primary key default gen_random_uuid(),
  crew_id     uuid not null,
  player_id   uuid not null,
  team_id     text not null,                    -- club — doit coller au crew ET au joueur
  status      crew_member_status not null default 'invited',
  invited_by  uuid references players(id) on delete set null,
  created_at  timestamptz default now(),
  unique (crew_id, player_id),
  -- ANTI-MÉLANGE DE CLUBS (contrainte dure) :
  foreign key (crew_id, team_id)   references crews(id, team_id)     on delete cascade,
  foreign key (player_id, team_id) references players(id, team_id)   on delete cascade
);
create index on crew_members(crew_id);
-- Un seul crew ACTIF par joueur (le score d'équipe reste non ambigu).
create unique index crew_one_active_per_player on crew_members(player_id) where status = 'active';

-- ---------- RLS ----------
alter table crews        enable row level security;
alter table crew_members enable row level security;

-- Helpers SECURITY DEFINER (bypass RLS → pas de récursion, pas de fuite :
-- ne lisent que la ligne ciblée / celle de l'appelant).
create or replace function public.crew_team(cid uuid) returns text
  language sql stable security definer set search_path = public, auth as
  $$ select team_id from public.crews where id = cid $$;

create or replace function public.player_team(pid uuid) returns text
  language sql stable security definer set search_path = public, auth as
  $$ select team_id from public.players where id = pid $$;

create or replace function public.am_active_crew_member(cid uuid) returns boolean
  language sql stable security definer set search_path = public, auth as
  $$ select exists (
       select 1 from public.crew_members m
        where m.crew_id = cid and m.player_id = public.my_player_id() and m.status = 'active'
     ) $$;

create or replace function public.is_crew_founder(cid uuid) returns boolean
  language sql stable security definer set search_path = public, auth as
  $$ select exists (select 1 from public.crews where id = cid and created_by = auth.uid()) $$;

-- ── crews ──
-- Lecture : tous les membres du club voient les crews du club (pour le classement).
create policy crews_read       on crews for select using (team_id = my_team());
-- Création : un joueur crée un crew dans SON club, en tant que lui-même.
create policy crews_insert     on crews for insert
  with check (team_id = my_team() and created_by = auth.uid() and owner_player_id = my_player_id());
-- Renommer / re-tirer la bannière : fondateur seul.
create policy crews_update     on crews for update
  using (created_by = auth.uid()) with check (created_by = auth.uid());
-- Dissoudre : fondateur seul.
create policy crews_delete     on crews for delete using (created_by = auth.uid());
-- Owner : accès complet (bypass club).
create policy crews_owner      on crews for all using (is_owner()) with check (is_owner());

-- ── crew_members ──
-- Lecture : voir les membres des crews de MON club.
create policy members_read     on crew_members for select
  using (crew_team(crew_id) = my_team());
-- Invitation / auto-ajout du fondateur : club verrouillé des deux côtés.
create policy members_insert   on crew_members for insert
  with check (
    team_id = my_team()                       -- rattaché à mon club
    and crew_team(crew_id) = my_team()         -- le crew est dans mon club
    and player_team(player_id) = my_team()     -- le joueur invité est de mon club
    and (
      (player_id = my_player_id() and is_crew_founder(crew_id))  -- fondateur s'auto-ajoute
      or am_active_crew_member(crew_id)                          -- membre actif qui invite
    )
  );
-- Accepter une invitation (invited → active) : le joueur sur SA propre ligne.
create policy members_update   on crew_members for update
  using (player_id = my_player_id()) with check (player_id = my_player_id());
-- Quitter / refuser (soi-même) ou exclure (fondateur).
create policy members_delete   on crew_members for delete
  using (player_id = my_player_id() or is_crew_founder(crew_id));
-- Owner : accès complet.
create policy members_owner    on crew_members for all using (is_owner()) with check (is_owner());

-- ---------- REALTIME ----------
alter publication supabase_realtime add table crews, crew_members;
