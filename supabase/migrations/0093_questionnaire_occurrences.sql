-- 0093 — Questionnaires programmés PR-R4 (1/2) : identité d'occurrence
--
-- Aujourd'hui questionnaire_assignments a la PK (questionnaire_id, player_id) : un
-- joueur ne peut recevoir un questionnaire qu'UNE fois. Pour des envois récurrents
-- (ex. bien-être chaque lundi) on ajoute une identité d'occurrence :
--   • id surrogate (nouvelle PK) ;
--   • occurrence_date : la date d'envoi de CETTE occurrence ;
--   • series_id : lien vers la série de récurrence (recurrence_series, 0090) ;
--   • unique (questionnaire_id, player_id, occurrence_date) → une occurrence/jour.
-- Les envois ponctuels existants gardent leur comportement (occurrence = jour
-- d'envoi, series_id NULL). Rétro-compatible : backfill depuis sent_at.

alter table public.questionnaire_assignments
  add column if not exists id            uuid not null default gen_random_uuid(),
  add column if not exists occurrence_date date,
  add column if not exists series_id     uuid references public.recurrence_series(id) on delete set null;

update public.questionnaire_assignments
  set occurrence_date = coalesce(sent_at::date, current_date)
  where occurrence_date is null;

alter table public.questionnaire_assignments
  alter column occurrence_date set not null,
  alter column occurrence_date set default current_date;

-- Bascule de la PK (questionnaire_id, player_id) → id, + unicité par occurrence.
alter table public.questionnaire_assignments drop constraint questionnaire_assignments_pkey;
alter table public.questionnaire_assignments add primary key (id);
alter table public.questionnaire_assignments
  add constraint questionnaire_assignments_occ_key unique (questionnaire_id, player_id, occurrence_date);

create index if not exists qa_series_idx on public.questionnaire_assignments (series_id);
