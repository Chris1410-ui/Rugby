-- ════════════════════════════════════════════════════════════════
-- 0046 — Poids de corps : backfill des questionnaires déjà soumis + parseur
--        robuste.
--
-- CAUSE RACINE : le trigger de #78 (migration 0040) a été déployé le 2026-07-18.
-- Il ne se déclenche qu'aux INSERT/UPDATE POSTÉRIEURS. Les questionnaires déjà
-- remplis AVANT (07-16 / 07-17) n'ont jamais déclenché le trigger → leur poids
-- n'a jamais été reporté dans players.bodyweight (16+ joueurs restés à NULL).
-- Le mapping (clé `poids`), le statut (`rempli`) et le déclenchement
-- (INSERT OR UPDATE) étaient CORRECTS — d'où le fonctionnement pour les saisies
-- récentes. Il manquait un BACKFILL.
--
-- Ce correctif :
--   1) durcit le parseur (virgule décimale, unités « kg », espaces) ;
--   2) reporte le poids de TOUTES les réponses déjà soumises (le plus récent par
--      joueur, en respectant « le plus récent gagne »).
-- Aucune valeur individuelle exposée ; players.bodyweight alimente ensuite la
-- fiche (poids courant) et les ratios ×PdC (comparaison Top 14, moyennes, 0043).
-- ════════════════════════════════════════════════════════════════

-- 1) Trigger durci (parseur tolérant : « 80,5 », « 80 kg » → 80.5 / 80).
create or replace function public.sync_bodyweight_from_questionnaire()
  returns trigger language plpgsql security definer set search_path = public, auth as $$
declare
  v_raw   text := new.reponses->>'poids';
  v_clean text;
  v_num   numeric;
  v_when  timestamptz := coalesce(new.filled_at, now());
begin
  if new.statut is distinct from 'rempli' or v_raw is null then
    return new;
  end if;
  v_clean := nullif(regexp_replace(replace(v_raw, ',', '.'), '[^0-9.]', '', 'g'), '');
  if v_clean is null or v_clean !~ '^[0-9]+(\.[0-9]+)?$' then
    return new;
  end if;
  v_num := v_clean::numeric;
  if v_num <= 0 or v_num > 400 then
    return new;
  end if;
  update public.players
     set bodyweight = v_num, bodyweight_at = v_when
   where id = new.player_id
     and (bodyweight_at is null or v_when >= bodyweight_at);
  return new;
end $$;

-- 2) Backfill : dernier poids déclaré par joueur (le plus récent gagne).
with latest as (
  select distinct on (a.player_id)
    a.player_id,
    nullif(regexp_replace(replace(a.reponses->>'poids', ',', '.'), '[^0-9.]', '', 'g'), '') as clean,
    coalesce(a.filled_at, now()) as at
  from questionnaire_assignments a
  where a.statut = 'rempli' and a.reponses ? 'poids'
  order by a.player_id, coalesce(a.filled_at, now()) desc
)
update public.players p
   set bodyweight = l.clean::numeric, bodyweight_at = l.at
  from latest l
 where p.id = l.player_id
   and l.clean ~ '^[0-9]+(\.[0-9]+)?$'
   and l.clean::numeric > 0 and l.clean::numeric <= 400
   and (p.bodyweight_at is null or l.at >= p.bodyweight_at);
