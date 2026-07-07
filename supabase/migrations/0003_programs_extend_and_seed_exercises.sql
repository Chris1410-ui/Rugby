-- ============================================================================
--  0003 — Étape 7 : programmes (plage de dates + modèles + destinataires) et
--         catalogue d'exercices global.
-- ============================================================================

alter table programs
  add column if not exists end_date  date,
  add column if not exists templates jsonb not null default '[]',
  add column if not exists assigned  jsonb not null default '{}',
  add column if not exists source    text;

-- Catalogue d'exercices global (team_id null) — lisible par toutes les équipes.
do $$
begin
  if not exists (select 1 from exercises where team_id is null) then
    insert into exercises (team_id, name, category, quality, cues) values
    (null,'Back Squat','Force','Force max · membres inf.','Dos gainé, descente contrôlée, genoux dans l''axe des pieds, poussée talons.'),
    (null,'Front Squat','Force','Force · quadriceps','Coudes hauts, buste vertical, profondeur complète.'),
    (null,'Soulevé de terre','Force','Chaîne postérieure','Barre proche des tibias, dos neutre, hanches et épaules montent ensemble.'),
    (null,'Hip Thrust','Force','Fessiers · hanche','Menton rentré, extension complète de hanche, pause 1s en haut.'),
    (null,'Développé couché','Force','Poussée · haut du corps','Omoplates serrées, barre au niveau des mamelons, pieds ancrés.'),
    (null,'Développé militaire','Force','Épaules · gainage','Fessiers serrés, pas de cambrure, tête qui avance en fin de poussée.'),
    (null,'Tractions','Force','Tirage · dos','Amplitude complète, menton au-dessus de la barre, pas d''élan.'),
    (null,'Rowing barre','Force','Tirage horizontal','Buste ~45°, tirer vers le nombril, omoplates serrées.'),
    (null,'Fentes bulgares','Force','Unilatéral · quadriceps','Genou arrière vers le sol, buste stable, poussée talon avant.'),
    (null,'Nordic Hamstring','Prévention','Ischios excentrique','Descente la plus lente possible, hanches en extension, bassin fixe.'),
    (null,'Copenhagen','Prévention','Adducteurs','Corps aligné, jambe haute posée sur le banc, maintien gainé.'),
    (null,'Extension lombaire','Prévention','Érecteurs du rachis','Mouvement contrôlé, pas d''hyperextension, regard vers le sol.'),
    (null,'Renfort nuque','Prévention','Cou · mêlée','4 directions, résistance manuelle progressive, isométrie 6-10s.'),
    (null,'Gainage','Prévention','Tronc · anti-extension','Bassin rétroversé, fessiers serrés, corps parfaitement aligné.'),
    (null,'Sprint linéaire','Vitesse','Accélération','Projection avant, poussée complète, bras relâchés puissants.'),
    (null,'Squat sauté','Puissance','Explosivité','Descente rapide, extension explosive, réception amortie.'),
    (null,'Bondissements','Puissance','Pliométrie','Contacts brefs, genoux hauts, minimiser le temps au sol.'),
    (null,'COD / changements de direction','Vitesse','Agilité','Décélération basse, appui extérieur, replacement rapide du centre de masse.'),
    (null,'Malcolm''s / navette','Conditionnement','Capacité aérobie','Allure régulière, appuis complets, respiration contrôlée.'),
    (null,'Scotland Anaerobic','Conditionnement','Anaérobie','Intensité maximale sur les répétitions, récupération respectée.'),
    (null,'Mobilité hanche','Mobilité','Amplitude','Mouvements amples et contrôlés, respiration, pas de douleur.');
  end if;
end $$;
