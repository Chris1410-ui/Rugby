-- 0076 — Programmes par joueur : traçabilité SOURCE + état « à vérifier ».
-- Après un import PDF, l'extraction n'est jamais parfaite : le staff doit repérer
-- d'un coup d'œil les contenus importés non encore relus.
--
-- program_docs (protocoles riches) : source ('app' = créé dans l'app | 'pdf' =
--   importé) + reviewed (relu par le staff). Défaut reviewed=true pour l'existant
--   (ne pas déclencher de fausses alertes) ; l'import PDF posera reviewed=false.
-- programs (planning hebdo) : a déjà `source` ; on ajoute reviewed.

alter table public.program_docs
  add column if not exists source   text    not null default 'app',
  add column if not exists reviewed boolean not null default true;

alter table public.programs
  add column if not exists reviewed boolean not null default true;
