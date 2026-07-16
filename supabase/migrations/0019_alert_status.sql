-- ════════════════════════════════════════════════════════════════
-- 0019 — Statut de traitement des alertes (file + historique).
--
-- Les alertes sont calculées en direct (lib/metrics.js buildAlerts) ; cette
-- table stocke leur TRAITEMENT sans rien perdre : transmise au kiné et/ou
-- traitée, avec un SNAPSHOT (txt/sev/icon) → l'historique est auto-suffisant
-- même si l'alerte n'est plus active. Une ligne par (joueur, type, jour).
-- ════════════════════════════════════════════════════════════════

create table alert_status (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams(id) on delete cascade,
  player_id  uuid not null references players(id) on delete cascade,
  date       date not null default current_date,
  cat        text,
  akey       text not null,               -- clé stable du type d'alerte
  txt        text, sev text, icon text,   -- snapshot (historique)
  kine_at    timestamptz,                 -- transmise au kiné
  treated_at timestamptz,                 -- traitée (retirée de la file active)
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (player_id, akey, date)
);
create index on alert_status(team_id, date);

alter table alert_status enable row level security;

-- Staff de l'équipe : lecture + écriture (le rôle médical, étant staff, voit
-- les alertes transmises kiné). Owner : accès complet.
create policy alert_status_staff on alert_status for all
  using (is_staff() and team_id = my_team())
  with check (is_staff() and team_id = my_team());
create policy alert_status_owner on alert_status for all
  using (is_owner()) with check (is_owner());

alter publication supabase_realtime add table alert_status;
