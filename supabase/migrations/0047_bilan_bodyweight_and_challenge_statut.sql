-- ════════════════════════════════════════════════════════════════
-- 0047 — Propagation du poids depuis le BILAN + statuts de défis.
--
-- BUG 1 (racine « le bilan ne se propage pas ») : le poids saisi dans le bilan
-- (daily_checkins.poids) n'était JAMAIS reporté vers players.bodyweight. Le
-- trigger de #78 (0040) ne couvre que questionnaire_assignments. Résultat :
-- fiche « Poids — » et ratios ×PdC vides pour tout poids entré via le bilan
-- (ex. Sanglier : bilan 90 kg, fiche NULL). On ajoute un trigger sur
-- daily_checkins (même logique « le plus récent gagne ») + un backfill.
--
-- BUG 2 (logs, issu de #85) : la contrainte CHECK challenge_completions_statut_check
-- n'autorisait que a_faire/validee_joueur/confirmee → rejetait refuse/manque
-- (cron expire_challenges en erreur horaire, refus de défi cassé). On l'étend.
-- ════════════════════════════════════════════════════════════════

-- ---------- BUG 1 : poids du bilan → fiche ----------
create or replace function public.sync_bodyweight_from_checkin()
  returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_num  numeric := new.poids;                                   -- daily_checkins.poids est numeric
  v_when timestamptz := coalesce(new.created_at, new.date::timestamptz, now());
begin
  if v_num is null or v_num <= 0 or v_num > 400 then
    return new;
  end if;
  update public.players
     set bodyweight = v_num, bodyweight_at = v_when
   where id = new.player_id
     and (bodyweight_at is null or v_when >= bodyweight_at);       -- le plus récent gagne
  return new;
end $$;

drop trigger if exists sync_bodyweight_checkin_trg on public.daily_checkins;
create trigger sync_bodyweight_checkin_trg
  after insert or update on public.daily_checkins
  for each row execute function public.sync_bodyweight_from_checkin();

-- Backfill : dernier poids de bilan par joueur (le plus récent gagne).
with latest as (
  select distinct on (dc.player_id)
    dc.player_id, dc.poids as bw,
    coalesce(dc.created_at, dc.date::timestamptz) as at
  from daily_checkins dc
  where dc.poids is not null and dc.poids > 0 and dc.poids <= 400
  order by dc.player_id, coalesce(dc.created_at, dc.date::timestamptz) desc
)
update public.players p
   set bodyweight = l.bw, bodyweight_at = l.at
  from latest l
 where p.id = l.player_id
   and (p.bodyweight_at is null or l.at >= p.bodyweight_at);

-- ---------- BUG 2 : statuts refuse / manque autorisés ----------
alter table public.challenge_completions drop constraint if exists challenge_completions_statut_check;
alter table public.challenge_completions add constraint challenge_completions_statut_check
  check (statut = any (array['a_faire','validee_joueur','confirmee','refuse','manque']));
