-- 0104 — Marqueur de séance PERSONNALISÉE (protocole collectif + surcharges).
--
-- Une séance de protocole est soit COLLECTIVE (override_player_id NULL, partagée
-- par ses destinataires via `assigned`), soit PERSONNALISÉE pour un joueur précis
-- (override_player_id = ce joueur ; `assigned` = ce seul joueur). Ce marqueur rend
-- l'identification sans ambiguïté (split / régénération / badge côté UI) et permet
-- de ne jamais confondre une ligne partagée réduite à un joueur avec une vraie
-- personnalisation. Les séances déjà validées ne sont jamais modifiées.
alter table public.sessions
  add column if not exists override_player_id uuid references public.players(id) on delete cascade;

create index if not exists sessions_override_player_idx
  on public.sessions (program_doc_id, override_player_id)
  where override_player_id is not null;
