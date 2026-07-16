-- ════════════════════════════════════════════════════════════════
-- 0029 — Bilan du soir.
--
-- Un même joueur peut désormais avoir DEUX bilans par jour : matin (inchangé) et
-- soir. On distingue par une colonne `moment` et on remplace la contrainte
-- d'unicité (player_id, date) → (player_id, date, moment).
--   • Ligne matin : wb = {sleep,energy,fatigue,soreness,mood,stress} + sleep_h,
--     hydra, fc, hrv, poids, activities (inchangé).
--   • Ligne soir  : wb = {quality,intensity,difficulty,fatigue,moral,motivation,
--     ressentiMatch, remarques} (tout dans le jsonb existant ; colonnes matin NULL).
-- RLS, realtime et reset par date locale : inchangés (table existante).
-- Readiness / enrichPlayers restent basés sur le MATIN seul (filtré côté client).
-- ════════════════════════════════════════════════════════════════

alter table daily_checkins
  add column moment text not null default 'matin'
  check (moment in ('matin', 'soir'));

alter table daily_checkins drop constraint daily_checkins_player_id_date_key;
alter table daily_checkins add constraint daily_checkins_pdm_uq unique (player_id, date, moment);
