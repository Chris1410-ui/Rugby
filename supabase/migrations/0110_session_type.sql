-- 0110 — Séance libre typée (PR1/fondations) : discriminant `session_type` sur
-- la séance. Il pilote le MODÈLE DE SAISIE (quel éditeur, quels champs, quel
-- filtre biblio) et reste ORTHOGONAL à `nature` (la qualité d'entraînement,
-- 0067) et à `code` (la pastille rugby). Valeurs contrôlées CÔTÉ CLIENT
-- (src/lib/sessionType.js), comme `nature`/`code` — pas d'enum ni de CHECK en
-- base, pour laisser évoluer le vocabulaire sans migration.
--
-- Valeurs : strength | conditioning | bodyweight | skills | mixed.
-- Défaut « strength » = l'actuelle Salle (sets × reps × kg) → migration douce :
-- toute séance existante devient explicitement 'strength', et un item
-- `exercises` sans `kind` est lu comme 'strength' par le client. Aucune donnée
-- réécrite au fond (les blocs restent tels quels).

alter table public.sessions
  add column if not exists session_type text not null default 'strength';

-- Backfill explicite du reliquat éventuel (colonnes ajoutées NOT NULL DEFAULT
-- sont déjà remplies par Postgres ; ce filet couvre une éventuelle valeur vide).
update public.sessions
   set session_type = 'strength'
 where session_type is null or session_type = '';

comment on column public.sessions.session_type is
  'Modèle de saisie de la séance (strength|conditioning|bodyweight|skills|mixed). Orthogonal à nature/code. Vocabulaire validé côté client (src/lib/sessionType.js).';
