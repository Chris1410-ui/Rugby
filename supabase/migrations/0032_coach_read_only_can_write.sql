-- Rôle « coach » en LECTURE SEULE sur son club.
-- is_staff() (preparateur/medical/coach) reste inchangé → conserve la LECTURE
-- partout pour le coach. On introduit can_write() = preparateur/medical
-- uniquement, et on l'utilise dans TOUTES les policies d'ÉCRITURE (le coach
-- perd ainsi l'écriture, garde la lecture). ALTER POLICY préserve cmd + roles.

create or replace function public.can_write()
returns boolean
language sql stable security definer
set search_path to 'public','auth'
as $function$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('preparateur','medical')
  )
$function$;

-- Policies « team_id = my_team() » simples (ALL) ------------------------------
alter policy alert_status_staff on public.alert_status
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy cp_staff on public.camp_participants
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy camps_staff on public.camps
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy cc_staff on public.challenge_completions
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy ch_staff on public.challenges
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy consents_staff_write on public.consents
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy exercises_staff_write on public.exercises
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy media_staff on public.media
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy notif_staff on public.notifications
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy prr_staff on public.password_reset_requests
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy players_staff on public.players
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy programs_staff on public.programs
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy q_staff on public.questionnaires
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy routines_staff on public.routines
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy sessions_staff on public.sessions
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy tc_staff on public.task_completions
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy tasks_staff on public.tasks
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy tc_staff on public.test_campaigns
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));
alter policy tr_staff on public.test_results
  using (can_write() and (team_id = my_team())) with check (can_write() and (team_id = my_team()));

-- Policies avec sous-requête EXISTS(players) (ALL) ----------------------------
alter policy daily_staff_demo_write on public.daily_checkins
  using (can_write() and (exists (select 1 from players p where p.id = daily_checkins.player_id and p.team_id = my_team() and p.is_demo)))
  with check (can_write() and (exists (select 1 from players p where p.id = daily_checkins.player_id and p.team_id = my_team() and p.is_demo)));
alter policy messages_staff on public.messages
  using (can_write() and (exists (select 1 from players p where p.id = messages.player_id and p.team_id = my_team())))
  with check (can_write() and (exists (select 1 from players p where p.id = messages.player_id and p.team_id = my_team())));
alter policy logs_staff on public.session_logs
  using (can_write() and (exists (select 1 from players p where p.id = session_logs.player_id and p.team_id = my_team())))
  with check (can_write() and (exists (select 1 from players p where p.id = session_logs.player_id and p.team_id = my_team())));

-- questionnaire_assignments : INSERT (with check) + DELETE (using) ------------
alter policy qa_staff_send on public.questionnaire_assignments
  with check (can_write() and (team_id = my_team()));
alter policy qa_staff_unsend on public.questionnaire_assignments
  using (can_write() and (team_id = my_team()));
