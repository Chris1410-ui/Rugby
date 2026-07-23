-- ════════════════════════════════════════════════════════════════
-- 0067 — Nature de séance (force / cardio / vitesse / prévention / récup /
-- technique / mobilité…). Champ DESCRIPTIF orthogonal au `code` rugby existant
-- (RS/COD/CSB…). Sert à l'affichage partout (calendrier, cartes « Aujourd'hui »,
-- constructeur) et à l'agrégation anti-surcharge à venir (« déjà 1 séance FORCE
-- ce jour »). Vocabulaire contrôlé côté client (lib/nature.js) ; pas de CHECK en
-- base pour rester souple (comme `code`). Aucune formule compliance/points n'en
-- dépend.
--
-- Backfill des séances existantes depuis leur `code` pour qu'aucune ligne ne
-- reste sans nature lisible.
-- ════════════════════════════════════════════════════════════════

alter table public.sessions add column if not exists nature text;

update public.sessions set nature = case code
  when 'RS'   then 'force'
  when 'COD'  then 'vitesse'
  when 'CDD'  then 'vitesse'
  when 'CSB'  then 'conditioning'
  when 'CASB' then 'conditioning'
  when 'AC'   then 'technique'
  when 'BLI'  then 'prevention'
  else 'autre'
end
where nature is null;
