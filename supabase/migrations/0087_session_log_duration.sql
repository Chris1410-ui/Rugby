-- 0087 — Durée RÉELLE de séance (saisie joueur) sur session_logs
--
-- Le sRPE = RPE × durée. Jusqu'ici la charge reposait sur la durée PRÉVUE par le
-- coach (sessions.duration_min) ou un défaut. On ajoute la durée RÉELLE saisie
-- par le joueur à la validation : quand elle est présente, elle alimente le
-- calcul de charge à la place de la prévue (formule playerLoad inchangée, seule
-- la valeur d'entrée devient réelle). Colonne nullable → repli sur la prévue si
-- non renseignée (jamais de blocage de la validation).

alter table public.session_logs
  add column if not exists duration_min integer;

comment on column public.session_logs.duration_min is
  'Durée réelle de la séance en minutes, saisie par le joueur à la validation (null = repli sur la durée prévue).';
