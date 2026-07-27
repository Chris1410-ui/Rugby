-- 0106 — Perf : index sur les 53 clés étrangères non indexées (advisor
-- unindexed_foreign_keys). Une FK sans index de couverture force un seq scan à
-- chaque vérification (jointures, ON DELETE, RLS par team). Index B-tree sur les
-- colonnes de chaque FK (préfixe = colonnes de la contrainte). Idempotent.

create index if not exists alert_status_created_by_idx on public.alert_status (created_by);
create index if not exists athlete_routine_team_id_idx on public.athlete_routine (team_id);
create index if not exists athlete_routine_log_team_id_idx on public.athlete_routine_log (team_id);
create index if not exists camp_participants_camp_id_team_id_idx on public.camp_participants (camp_id, team_id);
create index if not exists camp_participants_player_id_team_id_idx on public.camp_participants (player_id, team_id);
create index if not exists camps_created_by_idx on public.camps (created_by);
create index if not exists challenge_completions_challenge_id_team_id_idx on public.challenge_completions (challenge_id, team_id);
create index if not exists challenge_completions_player_id_team_id_idx on public.challenge_completions (player_id, team_id);
create index if not exists challenges_created_by_idx on public.challenges (created_by);
create index if not exists club_invitations_accepted_by_idx on public.club_invitations (accepted_by);
create index if not exists club_invitations_created_by_idx on public.club_invitations (created_by);
create index if not exists club_invitations_player_id_idx on public.club_invitations (player_id);
create index if not exists consents_consented_by_idx on public.consents (consented_by);
create index if not exists crew_members_crew_id_team_id_idx on public.crew_members (crew_id, team_id);
create index if not exists crew_members_invited_by_idx on public.crew_members (invited_by);
create index if not exists crew_members_player_id_team_id_idx on public.crew_members (player_id, team_id);
create index if not exists crews_created_by_idx on public.crews (created_by);
create index if not exists crews_owner_player_id_idx on public.crews (owner_player_id);
create index if not exists exercise_library_team_id_idx on public.exercise_library (team_id);
create index if not exists exercises_team_id_idx on public.exercises (team_id);
create index if not exists notifications_team_id_idx on public.notifications (team_id);
create index if not exists password_reset_requests_player_id_idx on public.password_reset_requests (player_id);
create index if not exists player_1rm_exercise_id_idx on public.player_1rm (exercise_id);
create index if not exists players_membership_decided_by_idx on public.players (membership_decided_by);
create index if not exists players_owner_uid_idx on public.players (owner_uid);
create index if not exists profiles_team_id_idx on public.profiles (team_id);
create index if not exists program_assignments_created_by_idx on public.program_assignments (created_by);
create index if not exists program_assignments_player_id_idx on public.program_assignments (player_id);
create index if not exists program_docs_created_by_idx on public.program_docs (created_by);
create index if not exists programs_created_by_idx on public.programs (created_by);
create index if not exists programs_team_id_idx on public.programs (team_id);
create index if not exists protocol_player_overrides_player_id_idx on public.protocol_player_overrides (player_id);
create index if not exists questionnaire_assignments_player_id_team_id_idx on public.questionnaire_assignments (player_id, team_id);
create index if not exists questionnaire_assignments_questionnaire_id_team_id_idx on public.questionnaire_assignments (questionnaire_id, team_id);
create index if not exists questionnaires_created_by_idx on public.questionnaires (created_by);
create index if not exists queue_tickets_player_id_idx on public.queue_tickets (player_id);
create index if not exists recurrence_series_club_id_idx on public.recurrence_series (club_id);
create index if not exists routines_created_by_idx on public.routines (created_by);
create index if not exists routines_team_id_idx on public.routines (team_id);
create index if not exists section_templates_created_by_idx on public.section_templates (created_by);
create index if not exists section_templates_origin_club_id_idx on public.section_templates (origin_club_id);
create index if not exists sessions_created_by_idx on public.sessions (created_by);
create index if not exists sessions_override_player_id_idx on public.sessions (override_player_id);
create index if not exists sessions_program_id_idx on public.sessions (program_id);
create index if not exists task_completions_player_id_team_id_idx on public.task_completions (player_id, team_id);
create index if not exists task_completions_task_id_team_id_idx on public.task_completions (task_id, team_id);
create index if not exists tasks_created_by_idx on public.tasks (created_by);
create index if not exists test_campaigns_camp_id_team_id_idx on public.test_campaigns (camp_id, team_id);
create index if not exists test_campaigns_created_by_idx on public.test_campaigns (created_by);
create index if not exists test_results_campaign_id_team_id_idx on public.test_results (campaign_id, team_id);
create index if not exists test_results_player_id_team_id_idx on public.test_results (player_id, team_id);
create index if not exists training_attendance_player_id_team_id_idx on public.training_attendance (player_id, team_id);
create index if not exists training_attendance_training_id_team_id_idx on public.training_attendance (training_id, team_id);
