-- ════════════════════════════════════════════════════════════════
-- 0012 — Statut de séance « reportée » (remise/reportée).
--
-- Ajout ADDITIF d'une valeur à l'enum session_status. Une séance reportée
-- n'est ni validée ni manquée → dans le moteur de points elle ne rapporte
-- rien et ne pénalise pas (cf. lib/metrics.js computePoints).
-- La valeur est seulement AJOUTÉE ici (aucune utilisation dans la même
-- transaction) pour respecter la contrainte Postgres sur ALTER TYPE.
-- ════════════════════════════════════════════════════════════════

alter type session_status add value if not exists 'postponed';
