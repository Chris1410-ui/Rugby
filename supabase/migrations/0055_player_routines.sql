-- ============================================================================
--  0055 — Routines personnelles du JOUEUR (séances libres réutilisables).
--
--  Un joueur peut enregistrer le contenu d'une séance libre (Lot 3) comme
--  « routine » réutilisable, puis la recharger pour recomposer une séance en un
--  geste. Ces routines sont PRIVÉES au joueur (distinctes des routines d'équipe
--  du staff, qui ont player_id NULL).
-- ============================================================================

-- Propriétaire joueur d'une routine (NULL = routine d'équipe, créée par le staff).
alter table public.routines add column if not exists player_id uuid references public.players(id) on delete cascade;
create index if not exists routines_player_idx on public.routines(player_id);

-- Le joueur gère UNIQUEMENT ses propres routines. my_player_id() renvoie NULL
-- pour le staff → cette policy ne leur accorde rien (les routines d'équipe
-- restent régies par routines_staff). L'insertion force le rattachement au
-- joueur connecté et à son club.
drop policy if exists routines_self on public.routines;
create policy routines_self on public.routines for all to authenticated
  using ( player_id = public.my_player_id() )
  with check ( player_id = public.my_player_id() and team_id = public.my_team() );
