-- 0103 — Protocole collectif + PERSONNALISATION par joueur (surcharges).
--
-- Un protocole (program_docs) reste UNE entité : le « socle ». Les modifications
-- faites « au nom d'un joueur » sont stockées ici comme des SURCHARGES atomiques
-- (jamais une copie complète du protocole — sinon la maintenance devient
-- ingérable). Règle de résolution : socle → surcharge, la surcharge l'emporte
-- (voir src/lib/program/overrides.js). Les séances datées d'un joueur
-- personnalisé sont régénérées depuis socle + ses surcharges (PR-2).
--
-- `path` = adresse canonique stable (ids de section/ligne préservés par
-- normalizeProgram) :
--   sec/<sectionId>              → section entière (op 'remove' | 'patch')
--   sec/<sectionId>/row/<rowId>  → ligne d'exercice (op 'patch' | 'remove')
--   sec/<sectionId>/add          → ligne perso ajoutée (op 'add', value=ligne)
--   add/section                  → section perso ajoutée (op 'add', value=section)
--   slot/<sourceLabel>           → jour d'un créneau pour ce joueur (patch {weekday})
--
-- team_id est DÉNORMALISÉ (comme program_plans) pour une RLS simple et rapide.
create table if not exists public.protocol_player_overrides (
  id             uuid primary key default gen_random_uuid(),
  program_doc_id uuid not null references public.program_docs(id) on delete cascade,
  player_id      uuid not null references public.players(id) on delete cascade,
  team_id        text not null,
  path           text not null,
  op             text not null default 'patch',
  value          jsonb not null default '{}'::jsonb,
  created_by     uuid,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint protocol_player_overrides_op_chk check (op in ('patch', 'remove', 'add')),
  constraint protocol_player_overrides_uniq unique (program_doc_id, player_id, path)
);
create index if not exists ppo_doc_player_idx on public.protocol_player_overrides (program_doc_id, player_id);

alter table public.protocol_player_overrides enable row level security;

-- Lecture : owner partout, staff/joueurs de l'équipe du doc (team dénormalisé).
drop policy if exists ppo_read on public.protocol_player_overrides;
create policy ppo_read on public.protocol_player_overrides for select
  using (is_owner() or (team_id = my_team()));

-- Écriture : owner, ou staff écrivain de l'équipe. (updated_at posé côté client.)
drop policy if exists ppo_write on public.protocol_player_overrides;
create policy ppo_write on public.protocol_player_overrides for all
  using (is_owner() or (can_write() and team_id = my_team()))
  with check (is_owner() or (can_write() and team_id = my_team()));
