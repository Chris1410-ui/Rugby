-- ════════════════════════════════════════════════════════════════
-- 0030 — Médiathèque vidéos (par thème).
--
-- Bibliothèque de liens vidéo (YouTube / Instagram / autre) rangés par thème,
-- partagée au sein d'un club. Lecture ouverte à TOUT le club (joueurs + staff) ;
-- ajout / suppression réservés au staff (et à l'owner). RLS stricte par club.
-- ════════════════════════════════════════════════════════════════

create table media (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams(id) on delete cascade,
  theme      text not null,
  titre      text not null,
  url        text not null,
  plateforme text,                 -- youtube | instagram | autre (auto-détecté)
  thumb_url  text,                 -- vignette (auto YouTube ; sinon optionnelle)
  created_by uuid,
  created_at timestamptz default now()
);
create index on media(team_id, created_at desc);

alter table media enable row level security;
-- Lecture : tout le club (joueurs + staff via my_team()) + owner.
create policy media_read on media for select using (team_id = my_team() or is_owner());
-- Écriture (ajout / suppression) : staff du club uniquement.
create policy media_staff on media for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy media_owner on media for all using (is_owner()) with check (is_owner());

alter publication supabase_realtime add table media;
