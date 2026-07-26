-- 0094 — Questionnaires programmés PR-R4 (2/2) : soumission par occurrence +
-- dispatcher pg_cron.
--
-- La série de programmation EST une ligne recurrence_series (0090) avec
-- object_type='questionnaire' et payload = { "questionnaireId": <uuid> }. Rien
-- n'est matérialisé à l'avance : un job pg_cron quotidien crée les assignations
-- du jour (mêmes destinataires que `assigned`), ce qui déclenche naturellement la
-- notification joueur à la bonne date (trigger d'insertion existant, 0026).

-- ── Soumission joueur, désormais par occurrence ──
-- L'ancienne signature (uuid, jsonb) est remplacée : avec plusieurs occurrences
-- possibles par joueur, il faut cibler la bonne. Sans p_occurrence → la dernière
-- occurrence encore « à remplir » (rétro-compatible avec un client qui ne passe
-- pas la date).
drop function if exists public.submit_questionnaire(uuid, jsonb);
create or replace function public.submit_questionnaire(p_questionnaire uuid, p_reponses jsonb, p_occurrence date default null)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare v_pid uuid := my_player_id(); v_occ date;
begin
  if v_pid is null then raise exception 'not a player'; end if;
  v_occ := coalesce(p_occurrence, (
    select max(occurrence_date) from public.questionnaire_assignments
     where questionnaire_id = p_questionnaire and player_id = v_pid and statut = 'a_remplir'));
  update public.questionnaire_assignments
     set reponses = coalesce(p_reponses, '{}'::jsonb), statut = 'rempli', filled_at = now()
   where questionnaire_id = p_questionnaire and player_id = v_pid and occurrence_date = v_occ;
  if not found then raise exception 'assignment not found for you'; end if;
end $$;
grant execute on function public.submit_questionnaire(uuid, jsonb, date) to authenticated;

-- ── Dispatcher : crée les occurrences dues aujourd'hui ──
-- Idempotent (unique par occurrence) et anti-empilement : ne recrée pas tant
-- qu'une occurrence de la MÊME série est encore « à remplir » pour ce joueur.
create or replace function public.dispatch_due_questionnaires()
  returns integer language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with due as (
    select s.id as series_id, (s.payload->>'questionnaireId')::uuid as qid, s.team_id, s.assigned
    from public.recurrence_series s
    where s.object_type = 'questionnaire'
      and s.payload ? 'questionnaireId'
      and current_date between s.period_start and s.period_end
      and (extract(isodow from current_date)::int = any(s.weekdays))
      and not (current_date = any(s.exclusions))
  ),
  targets as (
    select d.series_id, d.qid, d.team_id, p.id as player_id
    from due d
    join public.players p on p.team_id = d.team_id
    where coalesce(d.assigned->>'mode', 'all') = 'all'
       or (d.assigned->>'mode' = 'group'   and p.grp::text = d.assigned->>'group')
       or (d.assigned->>'mode' = 'players' and p.id::text = any(array(select jsonb_array_elements_text(coalesce(d.assigned->'ids', '[]'::jsonb)))))
       or (d.assigned->>'mode' = 'mix'     and (
             p.grp::text = any(array(select jsonb_array_elements_text(coalesce(d.assigned->'groups', '[]'::jsonb))))
             or p.id::text = any(array(select jsonb_array_elements_text(coalesce(d.assigned->'ids', '[]'::jsonb))))))
  ),
  ins as (
    insert into public.questionnaire_assignments (questionnaire_id, player_id, team_id, statut, sent_at, occurrence_date, series_id)
    select t.qid, t.player_id, t.team_id, 'a_remplir', now(), current_date, t.series_id
    from targets t
    join public.questionnaires q on q.id = t.qid and q.team_id = t.team_id
    where not exists (
      select 1 from public.questionnaire_assignments a
       where a.questionnaire_id = t.qid and a.player_id = t.player_id
         and a.series_id = t.series_id and a.statut = 'a_remplir')
    on conflict (questionnaire_id, player_id, occurrence_date) do nothing
    returning 1
  )
  select count(*) into v_count from ins;
  return v_count;
end $$;

-- pg_cron quotidien (06:17 UTC, minute décalée des autres jobs 23/41).
create extension if not exists pg_cron;
do $$ begin perform cron.unschedule('questionnaire-dispatch'); exception when others then null; end $$;
select cron.schedule('questionnaire-dispatch', '17 6 * * *', $cron$ select public.dispatch_due_questionnaires(); $cron$);
