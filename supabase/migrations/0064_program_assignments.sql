-- ============================================================================
--  0064 — Assignation des protocoles (par joueur ou par groupe) + cibles
--
--  Un protocole (program_docs) peut être assigné à :
--    • tout le club            (scope='team')
--    • un groupe avants/arrières(scope='group', group_key)
--    • un joueur précis         (scope='player', player_id)
--  Chaque assignation porte des CIBLES individualisées libres (targets jsonb =
--  [{label,value}]) + un libellé de « track » optionnel (ex. Puissance/Vitesse).
--
--  Visibilité côté joueur (calculée applicativement, cf. lib/program/assign.js) :
--    – aucune assignation ciblée (group/player) → protocole visible par tout le
--      club (comportement collectif par défaut) ;
--    – dès qu'il existe des assignations ciblées → visible uniquement par les
--      joueurs concernés (le staff voit toujours tout).
--
--  Lecture : owner ou membre du club (un joueur doit pouvoir lire les
--    assignations de son club pour calculer sa visibilité et ses cibles ; ce
--    sont des objectifs d'entraînement, non sensibles).
--  Écriture : owner ; staff écrivain (prépa/médical) de son club.
-- ============================================================================

create table if not exists public.program_assignments (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.program_docs(id) on delete cascade,
  team_id     text not null references public.teams(id) on delete cascade,
  scope       text not null default 'team' check (scope in ('team','group','player')),
  group_key   text check (group_key in ('avants','arrieres')),
  player_id   uuid references public.players(id) on delete cascade,
  track       text not null default '',
  targets     jsonb not null default '[]'::jsonb,   -- [{ label, value }]
  created_by  uuid default auth.uid() references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  -- cohérence scope ↔ colonne renseignée
  check ( (scope = 'group'  and group_key is not null and player_id is null)
       or (scope = 'player' and player_id is not null and group_key is null)
       or (scope = 'team'   and group_key is null and player_id is null) )
);

create index if not exists program_assignments_prog_idx on public.program_assignments(program_id);
create index if not exists program_assignments_team_idx on public.program_assignments(team_id);

alter table public.program_assignments enable row level security;

drop policy if exists progasg_read on public.program_assignments;
create policy progasg_read on public.program_assignments for select to authenticated
  using ( public.is_owner() or team_id = public.my_team() );

drop policy if exists progasg_write on public.program_assignments;
create policy progasg_write on public.program_assignments for all to authenticated
  using ( public.is_owner() or ( public.can_write() and team_id = public.my_team() ) )
  with check ( public.is_owner() or ( public.can_write() and team_id = public.my_team() ) );
