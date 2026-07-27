-- 0102 — Sécurité : fermer l'accès `anon` aux fonctions SECURITY DEFINER.
--
-- 73 fonctions SECURITY DEFINER héritaient du GRANT EXECUTE par défaut à PUBLIC
-- (⇒ exécutables par le rôle `anon`, non authentifié). On révoque PUBLIC et on
-- ré-accorde EXECUTE à `authenticated` uniquement — SAUF :
--   • 4 RPC PRÉ-AUTHENTIFICATION (parcours join/invitation) → aussi `anon` ;
--   • 3 fonctions BATCH/cron → `service_role` seulement (jamais un client).
-- Les fonctions de trigger fonctionnent sans EXECUTE (contexte DML) ; les RPC
-- SECURITY DEFINER appellent leurs helpers en tant que propriétaire, donc rien
-- ne casse pour `authenticated`. Le chemin `anon` (avant login) n'interroge
-- aucune table directement → aucune évaluation de policy côté anon.
-- Idempotent (relançable) : on boucle sur les signatures réelles (regprocedure).

do $$
declare
  r record;
  cron_fns text[] := array[
    'expire_challenges', 'dispatch_due_questionnaires', 'remind_stale_questionnaires'
  ];
  anon_fns text[] := array[
    'list_clubs', 'precheck_membership', 'peek_invite_code', 'peek_club_invitation'
  ];
  target_fns text[] := array[
    '_challenge_assigned_to','_cic_guard','_queue_recompute_notifications','_queue_ticket_changed',
    '_task_assigned_to','_training_assigned_to','am_active_crew_member','camp_team','can_write',
    'challenge_decline','challenge_mark_done','challenge_unmark','comparison_line_stats',
    'comparison_team_stats','crew_team','dispatch_due_questionnaires','enroll_in_session',
    'expire_challenges','gen_invite_code','import_program_sessions','is_crew_founder',
    'is_hidden_athlete','is_medical','is_owner','is_staff','leave_session','list_clubs','my_club',
    'my_player_id','my_team','notif_targets','notify_camp','notify_challenge',
    'notify_challenge_confirmed','notify_media','notify_message','notify_program',
    'notify_program_assignment','notify_push','notify_questionnaire','notify_session','notify_task',
    'notify_test_result','peek_club_invitation','peek_invite_code','player_team','precheck_membership',
    'questionnaire_assigned_to_me','react_camp','react_challenge','react_questionnaire','react_session',
    'react_task','remind_questionnaire','remind_stale_questionnaires','rls_auto_enable',
    'rotate_invite_code','set_invite_code_active','set_my_initials','set_my_locale',
    'set_my_onboarding_seen','set_staff_code_role','submit_questionnaire','sync_bodyweight_from_checkin',
    'sync_bodyweight_from_questionnaire','task_mark_done','task_unmark','team_challenge_points',
    'team_challenge_stats','team_reactivity_bonus','team_task_points','team_top14','unique_totem'
  ];
begin
  for r in
    select p.oid::regprocedure::text as sig, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = any(target_fns)
  loop
    -- retire l'accès anon HÉRITÉ (public) ET DIRECT (grant to anon d'anciennes migrations)
    execute format('revoke execute on function %s from public', r.sig);
    execute format('revoke execute on function %s from anon', r.sig);
    if r.proname = any(cron_fns) then
      execute format('grant execute on function %s to service_role', r.sig);   -- batch : jamais un client
    else
      execute format('grant execute on function %s to authenticated', r.sig);  -- utilisateurs connectés
    end if;
    if r.proname = any(anon_fns) then
      execute format('grant execute on function %s to anon', r.sig);           -- parcours pré-auth (re-grant)
    end if;
  end loop;
end $$;
