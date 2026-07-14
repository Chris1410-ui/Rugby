-- ════════════════════════════════════════════════════════════════
-- 0009 — RLS du rôle owner + promotion du compte Head of Performance.
--
-- L'owner (role='owner', team_id=null) contourne le cloisonnement par club :
-- des policies ADDITIVES `*_owner` lui donnent accès à tous les clubs. Les
-- policies existantes (scoping `my_team()`) restent → isolation stricte
-- inchangée pour coach / médical / préparateur / joueur.
-- ════════════════════════════════════════════════════════════════

-- Helper de rôle (même pattern que my_team()/is_staff()) : ne lit que la ligne
-- profil de l'appelant (auth.uid()) → anon renvoie false, aucune fuite. Doit
-- rester exécutable par `authenticated` (PUBLIC) car appelé DANS les policies RLS.
create or replace function public.is_owner() returns boolean
  language sql stable security definer set search_path = public, auth as
  $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'owner') $$;

-- ── Bypass owner (lecture seule pour teams/profiles ; complet pour les données) ──
create policy teams_owner_read    on teams          for select using (is_owner());
create policy profiles_owner_read on profiles       for select using (is_owner());

create policy players_owner   on players        for all using (is_owner()) with check (is_owner());
create policy exercises_owner on exercises      for all using (is_owner()) with check (is_owner());
create policy programs_owner  on programs       for all using (is_owner()) with check (is_owner());
create policy sessions_owner  on sessions       for all using (is_owner()) with check (is_owner());
create policy logs_owner      on session_logs   for all using (is_owner()) with check (is_owner());
create policy daily_owner     on daily_checkins for all using (is_owner()) with check (is_owner());
create policy messages_owner  on messages       for all using (is_owner()) with check (is_owner());
create policy routines_owner  on routines       for all using (is_owner()) with check (is_owner());
create policy consents_owner  on consents       for all using (is_owner()) with check (is_owner());

-- Storage : l'owner accède aux fichiers de tous les clubs
create policy team_files_owner on storage.objects for all to authenticated
  using (bucket_id = 'team-files' and public.is_owner())
  with check (bucket_id = 'team-files' and public.is_owner());

-- ── Promotion du compte Head of Performance ──
update public.profiles
   set role = 'owner', team_id = null
 where id = (select id from auth.users where email = 'chris.delfosse@hotmail.com');
