-- 0079 — 1RM par mouvement et par joueur (liste dynamique + historique).
-- Permet d'exprimer une progression en % de 1RM et de calculer la charge réelle
-- de chaque joueur depuis SON 1RM. Pas de colonnes fixes pour 3-4 mouvements :
-- une ligne = une mesure datée ; l'historique naît de la coexistence des lignes.

create table if not exists public.player_1rm (
  id             uuid primary key default gen_random_uuid(),
  player_id      uuid not null references public.players(id) on delete cascade,
  team_id        text not null,
  exercise_id    uuid references public.exercise_library(id) on delete set null, -- clé si exo lié
  movement_key   text not null,               -- exKey(nom) : clé anti-doublon sinon
  movement_label text not null,               -- nom affiché (1re saisie)
  value_kg       numeric,                     -- NULL = placeholder « à renseigner »
  kind           text not null default 'teste', -- 'teste' | 'estime' | 'auto'
  test_reps      int,                         -- si estimé sous-max (traçabilité)
  test_weight    numeric,
  measured_at    date,
  source         text,                        -- 'staff' | 'player' | 'auto'
  created_by     uuid,
  created_at     timestamptz not null default now()
);
alter table public.player_1rm enable row level security;

create index if not exists player_1rm_player_idx on public.player_1rm (player_id, movement_key);
create index if not exists player_1rm_team_idx   on public.player_1rm (team_id);

-- Lecture : le joueur lit les SIENS ; le staff lit ceux de son équipe.
drop policy if exists p1rm_read on public.player_1rm;
create policy p1rm_read on public.player_1rm for select using (
  is_owner() or (team_id = my_team() and (is_staff() or player_id = my_player_id()))
);
-- Écriture : staff écrivain sur son équipe, OU le joueur sur les siens.
drop policy if exists p1rm_write on public.player_1rm;
create policy p1rm_write on public.player_1rm for all using (
  is_owner() or (can_write() and team_id = my_team()) or (player_id = my_player_id() and team_id = my_team())
) with check (
  is_owner() or (can_write() and team_id = my_team()) or (player_id = my_player_id() and team_id = my_team())
);
