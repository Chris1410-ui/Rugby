-- ════════════════════════════════════════════════════════════════
-- 0025 — Questionnaires santé/profil personnalisables.
--
-- Le staff compose un questionnaire (modèle réutilisable) et l'envoie à des
-- joueurs (all/group/players). Le joueur ne voit que les questionnaires qu'il a
-- reçus et soumet ses réponses via un RPC SECURITY DEFINER (pas d'écriture
-- directe). Le staff consulte ; le médical peut éditer (RW).
--
-- ⚠️ Données santé / mode de vie de mineurs = SENSIBLES : lues uniquement par le
--   joueur concerné et le staff de SON club. Jamais exposées au classement ni à
--   la comparaison (aucune écriture dans le moteur de points).
-- Isolation club : FK composites (id, team_id), patron Camps/Tâches.
-- ════════════════════════════════════════════════════════════════

create table questionnaires (
  id         uuid primary key default gen_random_uuid(),
  team_id    text not null references teams(id) on delete cascade,
  nom        text not null,
  questions  jsonb not null default '[]',   -- [{ id, type, label, options?, fields?, unit? }]
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  unique (id, team_id)
);
create index on questionnaires(team_id);

create table questionnaire_assignments (
  questionnaire_id uuid not null,
  player_id        uuid not null,
  team_id          text not null,
  statut           text not null default 'a_remplir' check (statut in ('a_remplir','rempli')),
  reponses         jsonb not null default '{}',   -- { [questionId]: value }
  sent_at          timestamptz default now(),
  filled_at        timestamptz,
  primary key (questionnaire_id, player_id),
  foreign key (questionnaire_id, team_id) references questionnaires(id, team_id) on delete cascade,
  foreign key (player_id, team_id)        references players(id, team_id)        on delete cascade
);
create index on questionnaire_assignments(player_id);

-- ---------- RLS ----------
alter table questionnaires             enable row level security;
alter table questionnaire_assignments  enable row level security;

-- Rôle médical (sous-ensemble du staff) → droit d'édition des réponses.
create or replace function public.is_medical() returns boolean
  language sql stable security definer set search_path = public, auth as
  $$ select role = 'medical' from profiles where id = auth.uid() $$;

-- Le joueur est-il destinataire de ce questionnaire ? (helper anti-récursion RLS)
create or replace function public.questionnaire_assigned_to_me(qid uuid) returns boolean
  language sql stable security definer set search_path = public, auth as
  $$ select exists (
       select 1 from public.questionnaire_assignments
        where questionnaire_id = qid and player_id = public.my_player_id()
     ) $$;

-- questionnaires : staff du club (R/W) ; le joueur lit ceux qu'il a reçus.
create policy q_read  on questionnaires for select
  using ((is_staff() and team_id = my_team()) or questionnaire_assigned_to_me(id));
create policy q_staff on questionnaires for all
  using (is_staff() and team_id = my_team()) with check (is_staff() and team_id = my_team());
create policy q_owner on questionnaires for all using (is_owner()) with check (is_owner());

-- assignments : le joueur lit LES SIENNES ; le staff celles du club.
create policy qa_read on questionnaire_assignments for select
  using (player_id = my_player_id() or (is_staff() and team_id = my_team()));
-- Envoi / retrait : staff du club (insert / delete).
create policy qa_staff_send on questionnaire_assignments for insert
  with check (is_staff() and team_id = my_team());
create policy qa_staff_unsend on questionnaire_assignments for delete
  using (is_staff() and team_id = my_team());
-- Édition des réponses : médical uniquement (le joueur passe par le RPC).
create policy qa_medical on questionnaire_assignments for update
  using (is_medical() and team_id = my_team()) with check (is_medical() and team_id = my_team());
-- Owner : accès complet.
create policy qa_owner on questionnaire_assignments for all using (is_owner()) with check (is_owner());

-- ---------- RPC (soumission joueur) ----------
create or replace function public.submit_questionnaire(p_questionnaire uuid, p_reponses jsonb)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare v_pid uuid := my_player_id();
begin
  if v_pid is null then raise exception 'not a player'; end if;
  update public.questionnaire_assignments
    set reponses = coalesce(p_reponses, '{}'::jsonb), statut = 'rempli', filled_at = now()
    where questionnaire_id = p_questionnaire and player_id = v_pid;
  if not found then raise exception 'assignment not found for you'; end if;
end $$;

grant execute on function public.submit_questionnaire(uuid, jsonb) to authenticated;

-- ---------- REALTIME ----------
alter publication supabase_realtime add table questionnaires, questionnaire_assignments;
