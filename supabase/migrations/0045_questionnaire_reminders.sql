-- ════════════════════════════════════════════════════════════════
-- 0045 — Rappels de questionnaires : bouton manuel (staff) + relance auto 36 h.
--
-- Un rappel = une ligne `notifications` (pastille in-app) → le trigger notify_push
-- (0034) envoie aussi le push PWA. Cible uniquement les joueurs n'ayant PAS rempli.
--
-- • remind_questionnaire(qid)      : rappel manuel, staff/owner du club. Renvoie le
--   nombre de destinataires relancés. Peut être renvoyé plusieurs fois.
-- • remind_stale_questionnaires()  : relance AUTO — assignations non remplies dont
--   l'envoi date de ≥36 h et n'ayant pas déjà reçu de relance auto. UN seul rappel
--   auto (colonne auto_reminded_at), idempotent. Planifié par pg_cron horaire.
-- Isolation club conservée (RLS + SECURITY DEFINER).
-- ════════════════════════════════════════════════════════════════

alter table public.questionnaire_assignments add column if not exists auto_reminded_at timestamptz;

-- Rappel manuel (staff/owner).
create or replace function public.remind_questionnaire(p_questionnaire uuid)
  returns integer language plpgsql security definer set search_path = public, auth as $$
declare v_team text; v_nom text; n int;
begin
  select team_id, nom into v_team, v_nom from questionnaires where id = p_questionnaire;
  if v_team is null then raise exception 'Questionnaire introuvable'; end if;
  if not ((is_staff() and v_team = my_team()) or is_owner()) then
    raise exception 'Non autorisé';
  end if;
  insert into notifications (team_id, player_id, type, titre, body, ref_id, route)
  select a.team_id, a.player_id, 'questionnaire',
         'Rappel : questionnaire à remplir',
         'Rappel : « ' || v_nom || ' » est à remplir.',
         p_questionnaire, 'questionnaires'
  from questionnaire_assignments a
  where a.questionnaire_id = p_questionnaire
    and a.filled_at is null
    and a.statut is distinct from 'rempli';
  get diagnostics n = row_count;
  return coalesce(n, 0);
end $$;

grant execute on function public.remind_questionnaire(uuid) to authenticated;

-- Relance automatique à 36 h (un seul rappel auto par assignation).
create or replace function public.remind_stale_questionnaires()
  returns integer language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with due as (
    select a.questionnaire_id, a.player_id, a.team_id, q.nom
    from questionnaire_assignments a
    join questionnaires q on q.id = a.questionnaire_id
    where a.filled_at is null
      and a.statut is distinct from 'rempli'
      and a.sent_at is not null
      and a.sent_at <= now() - interval '36 hours'
      and a.auto_reminded_at is null
  ),
  ins as (
    insert into notifications (team_id, player_id, type, titre, body, ref_id, route)
    select team_id, player_id, 'questionnaire',
           'Rappel : questionnaire à remplir',
           'Rappel : « ' || nom || ' » est toujours à remplir.',
           questionnaire_id, 'questionnaires'
    from due
    returning 1
  ),
  upd as (
    update questionnaire_assignments a
       set auto_reminded_at = now()
      from due d
     where a.questionnaire_id = d.questionnaire_id and a.player_id = d.player_id
    returning 1
  )
  select count(*) into n from upd;
  return coalesce(n, 0);
end $$;

-- Planification horaire (minute 41 pour étaler vs les autres jobs).
create extension if not exists pg_cron;
do $$ begin perform cron.unschedule('questionnaire-auto-reminder'); exception when others then null; end $$;
select cron.schedule('questionnaire-auto-reminder', '41 * * * *', $cron$ select public.remind_stale_questionnaires(); $cron$);
