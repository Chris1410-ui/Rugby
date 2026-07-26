-- 0096 — Profil athlète du staff (fondations).
--
-- Un compte staff (preparateur/medical/coach) peut activer un profil athlète : il
-- obtient une VRAIE carte `players` dans son club (totem + initiales, opt-in), et
-- concourt au classement à égalité avec les joueurs — AUCUN barème modifié : on
-- ajoute un type de participant, pas un calcul. Ses droits d'écriture staff ne
-- changent pas (le rôle reste inchangé ; seul profiles.player_id est renseigné).
--
-- Confidentialité (décision produit) : les données PRIVÉES d'un staff-athlète
-- (bilans, charges/logs, tests, 1RM, questionnaires) ne sont visibles QUE DE LUI —
-- pas des autres membres du staff (médical inclus). On exclut donc les cartes
-- `is_staff_athlete` des lectures staff/équipe existantes ; la projection publique
-- (points/badges + séances réalisées + routine ✓/✗) passera par un RPC dédié (PR-3).

alter table public.players
  add column if not exists is_staff_athlete boolean not null default false;

-- « Carte masquée » : cible = staff-athlète ET ce n'est pas la carte de l'appelant.
-- Sert à retirer ces cartes des policies de lecture staff/équipe (self-only).
create or replace function public.is_hidden_athlete(p_player uuid)
  returns boolean language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.players p where p.id = p_player and coalesce(p.is_staff_athlete, false))
     and p_player is distinct from my_player_id();
$$;

-- ── Lectures staff/équipe : exclusion des cartes staff-athlète (self-only) ──
drop policy if exists logs_staff on public.session_logs;
create policy logs_staff on public.session_logs for all
  using (is_staff() and exists (select 1 from players p where p.id = player_id and p.team_id = my_team()) and not public.is_hidden_athlete(player_id))
  with check (is_staff() and exists (select 1 from players p where p.id = player_id and p.team_id = my_team()) and not public.is_hidden_athlete(player_id));

drop policy if exists daily_staff_read on public.daily_checkins;
create policy daily_staff_read on public.daily_checkins for select
  using (is_staff() and exists (select 1 from players p where p.id = player_id and p.team_id = my_team()) and not public.is_hidden_athlete(player_id));

drop policy if exists tr_read on public.test_results;
create policy tr_read on public.test_results for select
  using (player_id = my_player_id() or (is_staff() and team_id = my_team() and not public.is_hidden_athlete(player_id)));
drop policy if exists tr_staff on public.test_results;
create policy tr_staff on public.test_results for all
  using (is_staff() and team_id = my_team() and not public.is_hidden_athlete(player_id))
  with check (is_staff() and team_id = my_team() and not public.is_hidden_athlete(player_id));
drop policy if exists tr_team_read on public.test_results;
create policy tr_team_read on public.test_results for select
  using (team_id = my_team() and not public.is_hidden_athlete(player_id));

drop policy if exists exercise_perf_read on public.exercise_perf;
create policy exercise_perf_read on public.exercise_perf for select
  using ((is_staff() and team_id = my_team() and not public.is_hidden_athlete(player_id)) or player_id = my_player_id());

drop policy if exists p1rm_read on public.player_1rm;
create policy p1rm_read on public.player_1rm for select
  using (is_owner() or (team_id = my_team() and (player_id = my_player_id() or (is_staff() and not public.is_hidden_athlete(player_id)))));

drop policy if exists qa_read on public.questionnaire_assignments;
create policy qa_read on public.questionnaire_assignments for select
  using (player_id = my_player_id() or (is_staff() and team_id = my_team() and not public.is_hidden_athlete(player_id)));

-- ── Activation (opt-in, idempotente) : crée la carte + rattache le profil ──
create or replace function public.activate_staff_athlete()
  returns uuid language plpgsql security definer set search_path = public, auth as $$
declare v_uid uuid := auth.uid(); v_role app_role; v_team text; v_existing uuid; v_pid uuid; v_name text;
begin
  select role, team_id, player_id into v_role, v_team, v_existing from public.profiles where id = v_uid;
  if v_role is null or v_team is null then raise exception 'NOT_STAFF'; end if;
  if v_role not in ('preparateur','medical','coach') then raise exception 'NOT_STAFF'; end if;
  if v_existing is not null then return v_existing; end if; -- déjà rattaché → idempotent
  v_name := public.unique_totem(v_team, null);
  insert into public.players (team_id, owner_uid, name, is_staff_athlete, membership_status, is_custom)
    values (v_team, v_uid, v_name, true, 'active', false)
    returning id into v_pid;
  update public.profiles set player_id = v_pid where id = v_uid;
  return v_pid;
end $$;
revoke execute on function public.activate_staff_athlete() from public, anon;
grant execute on function public.activate_staff_athlete() to authenticated;
